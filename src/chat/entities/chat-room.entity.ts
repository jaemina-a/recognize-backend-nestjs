import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('chat_rooms')
@Index(['roomId', 'type'], { unique: true })
export class ChatRoom extends BaseEntity {
  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @ManyToOne(() => Room, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: Room | null;

  @Column({ length: 20, default: 'group' })
  type: 'group' | 'dm';

  @Column({ name: 'last_message_id', type: 'uuid', nullable: true })
  lastMessageId: string | null;

  @Column({
    name: 'last_message_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastMessageAt: Date | null;
}
