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
}
