import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Photo } from './entities/photo.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo, RoomMember]),
    MulterModule.registerAsync({
      inject: [StorageService],
      useFactory: (storage: StorageService) => ({
        storage: storage.buildMulterStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      }),
    }),
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
