import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from '../chat/chat.service';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { randomBytes } from 'crypto';

const COLOR_POOL = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF'];

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    private readonly chatService: ChatService,
  ) {}

  async createRoom(userId: string, name: string) {
    const inviteCode = await this.generateUniqueInviteCode();

    const room = this.roomRepository.create({
      name,
      inviteCode,
      ownerId: userId,
    });
    const savedRoom = await this.roomRepository.save(room);

    const member = this.roomMemberRepository.create({
      roomId: savedRoom.id,
      userId,
      color: COLOR_POOL[0],
      score: 0,
    });
    await this.roomMemberRepository.save(member);

    // 방 생성 시 채팅방도 함께 생성
    await this.chatService.ensureChatRoomForRoom(savedRoom.id);

    return this.getRoomDetail(savedRoom.id, userId);
  }

  async getMyRooms(userId: string) {
    const memberships = await this.roomMemberRepository.find({
      where: { userId },
      relations: ['room'],
    });

    const roomIds = memberships.map((m) => m.roomId);
    if (roomIds.length === 0) return [];

    const rooms = await this.roomRepository.find({
      where: roomIds.map((id) => ({ id, isActive: true })),
      relations: ['members', 'members.user'],
      order: { createdAt: 'DESC' },
    });

    return rooms.map((room) => this.formatRoom(room));
  }

  async getRoomDetail(roomId: string, userId: string) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId, isActive: true },
      relations: ['members', 'members.user'],
    });

    if (!room) {
      throw new NotFoundException('방을 찾을 수 없습니다.');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }

    return this.formatRoom(room);
  }

  async joinRoom(userId: string, inviteCode: string) {
    const room = await this.roomRepository.findOne({
      where: { inviteCode, isActive: true },
      relations: ['members'],
    });

    if (!room) {
      throw new NotFoundException('유효하지 않은 초대코드입니다.');
    }

    const existingMember = room.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new ConflictException('이미 이 방에 참여하고 있습니다.');
    }

    if (room.members.length >= room.maxMembers) {
      throw new BadRequestException('방이 가득 찼습니다.');
    }

    const colorIndex = room.members.length % COLOR_POOL.length;
    const member = this.roomMemberRepository.create({
      roomId: room.id,
      userId,
      color: COLOR_POOL[colorIndex],
      score: 0,
    });
    await this.roomMemberRepository.save(member);

    // 채팅방이 없으면 생성 + 시스템 메시지
    const chatRoom = await this.chatService.ensureChatRoomForRoom(room.id);
    await this.chatService.createSystemMessage(
      chatRoom.id,
      'member_joined',
      { userId },
    );

    return this.getRoomDetail(room.id, userId);
  }

  async leaveRoom(roomId: string, userId: string) {
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });

    if (!member) {
      throw new NotFoundException('이 방의 멤버가 아닙니다.');
    }

    await this.roomMemberRepository.remove(member);

    const remainingMembers = await this.roomMemberRepository.count({
      where: { roomId },
    });

    if (remainingMembers === 0) {
      await this.roomRepository.update(roomId, { isActive: false });
    }
  }

  private formatRoom(room: Room) {
    return {
      id: room.id,
      name: room.name,
      inviteCode: room.inviteCode,
      ownerId: room.ownerId,
      maxMembers: room.maxMembers,
      createdAt: room.createdAt.toISOString(),
      members: room.members.map((m) => ({
        userId: m.userId,
        nickname: m.user.nickname,
        profileImage: m.user.profileImage,
        totalScore: m.score,
        color: m.color,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  private async generateUniqueInviteCode(): Promise<string> {
    let code: string;
    let exists: boolean;
    do {
      code = randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
      const existing = await this.roomRepository.findOne({
        where: { inviteCode: code },
      });
      exists = !!existing;
    } while (exists);
    return code;
  }
}
