import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { ChatRoom } from '../chat/entities/chat-room.entity';
import { RoomsModule } from '../rooms/rooms.module';
import { User } from '../users/entities/user.entity';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ChatRoom, ChatMessage]),
    RoomsModule,
    ChatModule,
  ],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
