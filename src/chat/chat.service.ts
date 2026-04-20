import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { ChatMessage, ChatMessageType } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';
import { ChatRoom } from './entities/chat-room.entity';

export type SerializedMessage = {
  id: string;
  chatRoomId: string;
  senderId: string | null;
  type: ChatMessageType;
  content: string;
  metadata: Record<string, unknown>;
  clientId: string | null;
  createdAt: string;
};

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatRead)
    private readonly chatReadRepository: Repository<ChatRead>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
  ) {}

  /** 방에 채팅방이 없으면 생성, 있으면 그대로 반환 */
  async ensureChatRoomForRoom(roomId: string): Promise<ChatRoom> {
    const existing = await this.chatRoomRepository.findOne({
      where: { roomId, type: 'group' },
    });
    if (existing) return existing;

    const created = this.chatRoomRepository.create({
      roomId,
      type: 'group',
    });
    return this.chatRoomRepository.save(created);
  }

  async assertMembership(roomId: string, userId: string): Promise<void> {
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }
  }

  async getOrCreateChatRoomByRoomId(
    roomId: string,
    userId: string,
  ): Promise<ChatRoom> {
    await this.assertMembership(roomId, userId);
    return this.ensureChatRoomForRoom(roomId);
  }

  async getMessages(
    chatRoomId: string,
    userId: string,
    cursor?: string,
    limit = 30,
  ): Promise<{ messages: SerializedMessage[]; nextCursor: string | null }> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
    });
    if (!chatRoom) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    if (chatRoom.roomId) {
      await this.assertMembership(chatRoom.roomId, userId);
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const where: Record<string, unknown> = { chatRoomId };
    if (cursor) {
      where.createdAt = LessThan(new Date(cursor));
    }

    const rows = await this.chatMessageRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: safeLimit + 1,
    });

    const hasMore = rows.length > safeLimit;
    const sliced = hasMore ? rows.slice(0, safeLimit) : rows;
    const nextCursor = hasMore
      ? sliced[sliced.length - 1].createdAt.toISOString()
      : null;

    return {
      messages: sliced.map((m) => this.serialize(m)),
      nextCursor,
    };
  }

  async sendMessage(
    chatRoomId: string,
    senderId: string,
    content: string,
    clientId: string | null,
  ): Promise<SerializedMessage> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
    });
    if (!chatRoom) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    if (chatRoom.roomId) {
      await this.assertMembership(chatRoom.roomId, senderId);
    }

    // 멱등성: 같은 (chatRoomId, clientId)가 이미 있으면 그대로 반환
    if (clientId) {
      const existing = await this.chatMessageRepository.findOne({
        where: { chatRoomId, clientId },
      });
      if (existing) return this.serialize(existing);
    }

    const message = this.chatMessageRepository.create({
      chatRoomId,
      senderId,
      type: 'text',
      content,
      metadata: {},
      clientId: clientId ?? null,
    });
    const saved = await this.chatMessageRepository.save(message);

    await this.chatRoomRepository.update(chatRoomId, {
      lastMessageId: saved.id,
      lastMessageAt: saved.createdAt,
    });

    return this.serialize(saved);
  }

  async createSystemMessage(
    chatRoomId: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<SerializedMessage> {
    const message = this.chatMessageRepository.create({
      chatRoomId,
      senderId: null,
      type: 'system',
      content,
      metadata,
      clientId: null,
    });
    const saved = await this.chatMessageRepository.save(message);
    await this.chatRoomRepository.update(chatRoomId, {
      lastMessageId: saved.id,
      lastMessageAt: saved.createdAt,
    });
    return this.serialize(saved);
  }

  async markRead(
    chatRoomId: string,
    userId: string,
    lastReadId?: string,
  ): Promise<{ lastReadId: string | null; lastReadAt: string }> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
    });
    if (!chatRoom) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    if (chatRoom.roomId) {
      await this.assertMembership(chatRoom.roomId, userId);
    }

    let resolvedId: string | null = lastReadId ?? null;
    if (!resolvedId) {
      const latest = await this.chatMessageRepository.findOne({
        where: { chatRoomId },
        order: { createdAt: 'DESC' },
      });
      resolvedId = latest?.id ?? null;
    }

    const existing = await this.chatReadRepository.findOne({
      where: { chatRoomId, userId },
    });
    const now = new Date();
    if (existing) {
      existing.lastReadId = resolvedId;
      existing.lastReadAt = now;
      await this.chatReadRepository.save(existing);
    } else {
      await this.chatReadRepository.save(
        this.chatReadRepository.create({
          chatRoomId,
          userId,
          lastReadId: resolvedId,
          lastReadAt: now,
        }),
      );
    }

    return { lastReadId: resolvedId, lastReadAt: now.toISOString() };
  }

  async getUnreadCount(chatRoomId: string, userId: string): Promise<number> {
    const read = await this.chatReadRepository.findOne({
      where: { chatRoomId, userId },
    });
    const qb = this.chatMessageRepository
      .createQueryBuilder('m')
      .where('m.chat_room_id = :chatRoomId', { chatRoomId })
      .andWhere('m.sender_id IS NULL OR m.sender_id <> :userId', { userId });
    if (read) {
      qb.andWhere('m.created_at > :lastReadAt', {
        lastReadAt: read.lastReadAt,
      });
    }
    return qb.getCount();
  }

  serialize(m: ChatMessage): SerializedMessage {
    return {
      id: m.id,
      chatRoomId: m.chatRoomId,
      senderId: m.senderId,
      type: m.type,
      content: m.content,
      metadata: m.metadata ?? {},
      clientId: m.clientId,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
