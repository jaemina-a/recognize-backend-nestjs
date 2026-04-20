import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('chat_reads')
@Unique(['chatRoomId', 'userId'])
export class ChatRead extends BaseEntity {
  @Column({ name: 'chat_room_id', type: 'uuid' })
  chatRoomId: string;

  @ManyToOne(() => ChatRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoom;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'last_read_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  lastReadAt: Date;

  @Column({ name: 'last_read_id', type: 'uuid', nullable: true })
  lastReadId: string | null;

  @ManyToOne(() => ChatMessage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_read_id' })
  lastReadMessage: ChatMessage | null;
}
