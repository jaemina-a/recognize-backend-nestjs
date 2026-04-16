import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity';
import { Recognition } from './entities/recognition.entity';
import { RecognitionLog } from './entities/recognition-log.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, Recognition, RecognitionLog, RoomMember])],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
