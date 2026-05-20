import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AppleOAuthClient } from './apple/apple-oauth.client';
import { AppleLoginDto } from './dto/apple-login.dto';
import { verifyAppleIdentityToken } from './apple/apple-token.verifier';

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly appleOAuthClient: AppleOAuthClient,
  ) {}

  async appleLogin(dto: AppleLoginDto) {
    const audience = this.configService.get<string>('APPLE_BUNDLE_ID');
    if (!audience) {
      this.logger.error('[APPLE] APPLE_BUNDLE_ID is not configured');
      throw new UnauthorizedException('Apple 로그인 설정이 누락되었습니다.');
    }

    this.logger.log(
      `[APPLE] POST /auth/apple. identityToken length=${dto.identityToken?.length ?? 0}, has authorizationCode=${!!dto.authorizationCode}`,
    );

    const payload = await verifyAppleIdentityToken({
      identityToken: dto.identityToken,
      audience,
    });

    const appleSub = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const subTail = appleSub.slice(-6);
    this.logger.log(
      `[APPLE] identityToken verified. sub=*${subTail} hasEmail=${!!email}`,
    );

    // 1) 기존 Apple 사용자 조회
    let user = await this.userRepository.findOne({
      where: { socialId: appleSub, socialProvider: 'apple' },
    });

    // 2) 신규 사용자 생성 (race condition 대비: 충돌 시 재조회)
    if (!user) {
      const baseNickname =
        dto.nickname?.trim() && dto.nickname.trim().length > 0
          ? dto.nickname.trim()
          : `Apple_${subTail}`;
      try {
        user = this.userRepository.create({
          socialProvider: 'apple',
          socialId: appleSub,
          email,
          nickname: await this.ensureUniqueNickname(baseNickname),
          profileImage: null,
        });
        user = await this.userRepository.save(user);
      } catch (e) {
        // unique constraint 충돌 시: 동시에 같은 sub로 생성된 경우 재조회
        const existing = await this.userRepository.findOne({
          where: { socialId: appleSub, socialProvider: 'apple' },
        });
        if (!existing) throw e;
        user = existing;
      }
    }

    // 3) authorizationCode가 있으면 Apple refresh_token 교환 후 저장 (계정 삭제 시 revoke 용)
    if (dto.authorizationCode && this.appleOAuthClient.isConfigured()) {
      const appleRefreshToken =
        await this.appleOAuthClient.exchangeAuthorizationCode(
          dto.authorizationCode,
        );
      if (appleRefreshToken) {
        user.appleRefreshToken = appleRefreshToken;
        await this.userRepository.save(user);
        this.logger.log(`[APPLE] refresh_token stored for userId=${user.id}`);
      } else {
        this.logger.warn(
          `[APPLE] refresh_token exchange returned null. userId=${user.id}`,
        );
      }
    }

    const tokens = await this.generateTokens(user);
    this.logger.log(`[APPLE] login success. userId=${user.id}`);

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        profileImage: user.profileImage,
        provider: user.socialProvider,
      },
      ...tokens,
    };
  }

  async kakaoLogin(kakaoAccessToken: string) {
    this.logger.log(
      `[KAKAO] kakaoLogin called. token prefix=${kakaoAccessToken?.slice(0, 8)}... length=${kakaoAccessToken?.length}`,
    );

    // 1. 카카오 API로 사용자 정보 조회
    const kakaoUser = await this.getKakaoUserInfo(kakaoAccessToken);
    this.logger.log(
      `[KAKAO] kakao user fetched. id=${kakaoUser.id} nickname=${kakaoUser.kakao_account?.profile?.nickname}`,
    );

    // 2. DB에서 사용자 조회 또는 생성
    const user = await this.findOrCreateUser(kakaoUser);
    this.logger.log(`[KAKAO] DB user resolved. userId=${user.id}`);

    // 3. JWT 토큰 발급
    const tokens = await this.generateTokens(user);
    this.logger.log(`[KAKAO] tokens issued for userId=${user.id}`);

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        profileImage: user.profileImage,
        provider: user.socialProvider,
      },
      ...tokens,
    };
  }

  private async getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `[KAKAO] kapi /v2/user/me failed. status=${response.status} body=${errorBody}`,
      );
      throw new UnauthorizedException('카카오 토큰이 유효하지 않습니다.');
    }

    return response.json() as Promise<KakaoUserInfo>;
  }

  private async findOrCreateUser(kakaoUser: KakaoUserInfo): Promise<User> {
    const socialId = String(kakaoUser.id);

    let user = await this.userRepository.findOne({
      where: { socialId, socialProvider: 'kakao' },
    });

    if (!user) {
      const nickname =
        kakaoUser.kakao_account?.profile?.nickname ??
        `user_${socialId.slice(-6)}`;

      user = this.userRepository.create({
        socialId,
        socialProvider: 'kakao',
        nickname: await this.ensureUniqueNickname(nickname),
        email: null,
        profileImage:
          kakaoUser.kakao_account?.profile?.profile_image_url ?? null,
      });

      user = await this.userRepository.save(user);
    }

    return user;
  }

  private async ensureUniqueNickname(nickname: string): Promise<string> {
    const existing = await this.userRepository.findOne({
      where: { nickname },
    });
    if (!existing) return nickname;

    let suffix = 1;
    while (
      await this.userRepository.findOne({
        where: { nickname: `${nickname}${suffix}` },
      })
    ) {
      suffix++;
    }
    return `${nickname}${suffix}`;
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, nickname: user.nickname };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRATION',
        ) as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION',
        ) as StringValue,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        nickname: string;
      }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
      }

      const newPayload = { sub: user.id, nickname: user.nickname };
      const accessToken = await this.jwtService.signAsync(newPayload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRATION',
        ) as StringValue,
      });

      return { accessToken };
    } catch {
      throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다.');
    }
  }
}
