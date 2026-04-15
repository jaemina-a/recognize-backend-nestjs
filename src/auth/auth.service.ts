import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

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
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async kakaoLogin(kakaoAccessToken: string) {
    // 1. 카카오 API로 사용자 정보 조회
    const kakaoUser = await this.getKakaoUserInfo(kakaoAccessToken);

    // 2. DB에서 사용자 조회 또는 생성
    const user = await this.findOrCreateUser(kakaoUser);

    // 3. JWT 토큰 발급
    const tokens = await this.generateTokens(user);

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

  private async getKakaoUserInfo(
    accessToken: string,
  ): Promise<KakaoUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type':
          'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        '카카오 토큰이 유효하지 않습니다.',
      );
    }

    return response.json();
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
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
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
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION') as any,
      });

      return { accessToken };
    } catch {
      throw new UnauthorizedException(
        '리프레시 토큰이 유효하지 않습니다.',
      );
    }
  }
}
