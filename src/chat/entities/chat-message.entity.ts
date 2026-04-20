import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { ChatRoom } from './chat-room.entity';

export type ChatMessageType = 'text' | 'system' | 'image';

@Entity('chat_messages')
@Index(['chatRoomId', 'createdAt'])
@Index(['chatRoomId', 'clientId'], {
  unique: true,
  where: '"client_id" IS NOT NULL',
})
export class ChatMessage extends BaseEntity {
  @Column({ name: 'chat_room_id', type: 'uuid' })
  chatRoomId: string;

  @ManyToOne(() => ChatRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoom;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User | null;

  @Column({ length: 20, default: 'text' })
  type: ChatMessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @Column({ name: 'client_id', type: 'varchar', length: 64, nullable: true })
  clientId: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
