import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ length: 50, unique: true })
  nickname: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', name: 'profile_image', nullable: true })
  profileImage: string | null;

  @Column({ name: 'social_provider', length: 20 })
  socialProvider: string; // 'kakao' | 'google' | 'apple'

  @Column({ name: 'social_id', unique: true })
  socialId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Sign in with Apple refresh_token (계정 삭제 시 Apple /auth/revoke 호출용).
   * Apple 사용자만 값이 있다. plaintext 저장 (DB 자체가 보안 경계 내라는 전제).
   * TODO(보안 강화): 이후 AES-GCM + KMS-managed key 로 at-rest 암호화 고려.
   */
  @Column({ name: 'apple_refresh_token', type: 'text', nullable: true })
  appleRefreshToken: string | null;
}
