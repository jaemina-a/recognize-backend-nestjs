import { Column, Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { RoomMember } from './room-member.entity';

@Entity('rooms')
export class Room extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'invite_code', length: 8, unique: true })
  inviteCode: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'max_members', default: 4 })
  maxMembers: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => RoomMember, (member) => member.room)
  members: RoomMember[];
}
