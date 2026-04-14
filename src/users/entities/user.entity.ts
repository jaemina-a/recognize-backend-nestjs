import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ length: 50, unique: true })
  nickname: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'profile_image', nullable: true })
  profileImage: string;

  @Column({ name: 'social_provider', length: 20 })
  socialProvider: string; // 'kakao' | 'google' | 'apple'

  @Column({ name: 'social_id' })
  socialId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
