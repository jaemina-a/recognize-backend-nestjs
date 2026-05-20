import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppleOAuthClient } from '../auth/apple/apple-oauth.client';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly appleOAuthClient: AppleOAuthClient,
  ) {}

  /**
   * 계정 삭제 (App Store Guideline 5.1.1(v) 대응).
   *
   * 정책:
   * - 다른 사용자가 함께 본 photos/chat 데이터는 외래키(NO ACTION)로 보존된다.
   * - 따라서 user row 자체는 유지하되 **개인정보를 익명화**하고 isActive=false로 표시한다.
   * - Apple 사용자의 경우 저장된 refresh_token으로 Apple revoke API를 호출한다 (best-effort).
   * - socialId는 `deleted-<uuid>`로 변경해 동일 소셜계정으로 신규 가입이 가능하도록 한다.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 1) Apple revoke (best-effort, 실패해도 익명화는 진행)
    if (
      user.socialProvider === 'apple' &&
      user.appleRefreshToken &&
      this.appleOAuthClient.isConfigured()
    ) {
      const ok = await this.appleOAuthClient.revokeToken(
        user.appleRefreshToken,
        'refresh_token',
      );
      this.logger.log(
        `[DELETE] apple revoke for userId=${userId} result=${ok ? 'ok' : 'failed'}`,
      );
    }

    // 2) 익명화
    const deletedTag = `deleted-${user.id}`;
    user.email = null;
    user.profileImage = null;
    user.nickname = `deleted_${user.id.slice(0, 8)}`;
    user.socialId = deletedTag;
    user.appleRefreshToken = null;
    user.isActive = false;
    await this.userRepository.save(user);

    this.logger.log(
      `[DELETE] account anonymized. userId=${userId} provider=${user.socialProvider}`,
    );
  }
}
