import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';

type JoinPayload = { chatRoomId: string };
type LeavePayload = { chatRoomId: string };
type SendPayload = { chatRoomId: string; content: string; clientId?: string };
type ReadPayload = { chatRoomId: string; lastReadId?: string };

const roomKey = (chatRoomId: string) => `chat:${chatRoomId}`;

// CORS는 main.ts의 CorsIoAdapter에서 환경변수 기반으로 동적 설정.
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  handleConnection(client: Socket) {
    try {
      this.wsJwtGuard.authenticate(client);
      this.logger.log(`Connected: ${client.id} (user=${client.data.userId})`);
    } catch {
      client.emit('chat:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:join')
  async onJoin(
    @MessageBody() body: JoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string;
    try {
      // membership 확인 위해 chatRoom → roomId 조회 + assertMembership
      // serialize하기 위해 service 우회: getMessages 호출은 무거우니 chat-room만 조회
      // 단순화: getMessages(limit=0)로는 어색하므로 직접 service에 helper가 있으면 좋지만,
      // 여기서는 chatService 내부 메서드를 활용 (chatRoomId 기반 권한 체크용 메시지 조회)
      // 우선 해당 chatRoom 멤버십 검증을 위해 메시지 0건 조회를 시도
      await this.chatService.getMessages(body.chatRoomId, userId, undefined, 1);
      await client.join(roomKey(body.chatRoomId));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('chat:leave')
  async onLeave(
    @MessageBody() body: LeavePayload,
    @ConnectedSocket() client: Socket,
  ) {
    await client.leave(roomKey(body.chatRoomId));
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async onSend(
    @MessageBody() body: SendPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string;
    try {
      const message = await this.chatService.sendMessage(
        body.chatRoomId,
        userId,
        body.content,
        body.clientId ?? null,
      );
      this.server.to(roomKey(body.chatRoomId)).emit('chat:message', message);
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('chat:read')
  async onRead(
    @MessageBody() body: ReadPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string;
    try {
      const result = await this.chatService.markRead(
        body.chatRoomId,
        userId,
        body.lastReadId,
      );
      this.server.to(roomKey(body.chatRoomId)).emit('chat:read', {
        chatRoomId: body.chatRoomId,
        userId,
        lastReadId: result.lastReadId,
        lastReadAt: result.lastReadAt,
      });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
