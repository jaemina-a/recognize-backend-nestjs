import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { ChatRoom } from '../chat/entities/chat-room.entity';
import { RoomsModule } from '../rooms/rooms.module';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ChatRoom, ChatMessage]),
    RoomsModule,
    ChatModule,
    MulterModule.registerAsync({
      inject: [StorageService],
      useFactory: (storage: StorageService) => ({
        storage: storage.buildMulterStorage(),
        limits: { fileSize: 15 * 1024 * 1024 }, // 15MB (스크린샷 이미지 최대 8MB)
      }),
    }),
  ],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
