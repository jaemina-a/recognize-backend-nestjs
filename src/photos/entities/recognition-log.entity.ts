import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('recognition_logs')
export class RecognitionLog extends BaseEntity {
  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'uploader_id' })
  uploaderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  @Column({ name: 'recognizer_id' })
  recognizerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recognizer_id' })
  recognizer: User;

  @Column({ name: 'recognized_at', type: 'timestamp', default: () => 'NOW()' })
  recognizedAt: Date;
}
