import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Photo } from './photo.entity';

@Entity('recognitions')
export class Recognition extends BaseEntity {
  @Column({ name: 'photo_id', unique: true })
  photoId: string;

  @ManyToOne(() => Photo)
  @JoinColumn({ name: 'photo_id' })
  photo: Photo;

  @Column({ name: 'recognizer_id' })
  recognizerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recognizer_id' })
  recognizer: User;

  @Column({ name: 'recognized_at', type: 'timestamp', default: () => 'NOW()' })
  recognizedAt: Date;
}
