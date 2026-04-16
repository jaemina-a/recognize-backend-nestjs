import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  async createRoom(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom(req.user.userId, dto.name);
  }

  @Get()
  async getMyRooms(@Request() req: { user: { userId: string } }) {
    return this.roomsService.getMyRooms(req.user.userId);
  }

  @Get(':id')
  async getRoomDetail(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.roomsService.getRoomDetail(id, req.user.userId);
  }

  @Post('join')
  async joinRoom(
    @Request() req: { user: { userId: string } },
    @Body() dto: JoinRoomDto,
  ) {
    return this.roomsService.joinRoom(req.user.userId, dto.inviteCode);
  }

  @Delete(':id/leave')
  async leaveRoom(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.roomsService.leaveRoom(id, req.user.userId);
    return { message: '방을 나갔습니다.' };
  }
}
