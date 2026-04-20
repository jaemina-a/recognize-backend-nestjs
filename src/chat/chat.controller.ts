import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ReadMessagesDto } from './dto/read-messages.dto';

@Controller('rooms/:roomId/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async getChatRoom(
    @Param('roomId') roomId: string,
    @Request() req: { user: { userId: string } },
  ) {
    const chatRoom = await this.chatService.getOrCreateChatRoomByRoomId(
      roomId,
      req.user.userId,
    );
    const unreadCount = await this.chatService.getUnreadCount(
      chatRoom.id,
      req.user.userId,
    );
    return {
      id: chatRoom.id,
      roomId: chatRoom.roomId,
      type: chatRoom.type,
      lastMessageId: chatRoom.lastMessageId,
      lastMessageAt: chatRoom.lastMessageAt?.toISOString() ?? null,
      unreadCount,
    };
  }

  @Get('messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Request() req: { user: { userId: string } },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const chatRoom = await this.chatService.getOrCreateChatRoomByRoomId(
      roomId,
      req.user.userId,
    );
    return this.chatService.getMessages(
      chatRoom.id,
      req.user.userId,
      cursor,
      limit ? Number(limit) : 30,
    );
  }

  @Post('read')
  async markRead(
    @Param('roomId') roomId: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: ReadMessagesDto,
  ) {
    const chatRoom = await this.chatService.getOrCreateChatRoomByRoomId(
      roomId,
      req.user.userId,
    );
    return this.chatService.markRead(
      chatRoom.id,
      req.user.userId,
      dto.lastReadId,
    );
  }
}
