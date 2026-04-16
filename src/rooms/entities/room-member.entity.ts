import { Column, Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Room } from './room.entity';

@Entity('room_members')
@Unique(['roomId', 'userId'])
export class RoomMember extends BaseEntity {
  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => Room, (room) => room.members)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 7 })
  color: string;

  @Column({ default: 0 })
  score: number;

  @Column({ name: 'joined_at', type: 'timestamp', default: () => 'NOW()' })
  joinedAt: Date;
}
