import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { ChatRoom } from '../chat/entities/chat-room.entity';
import { ChatService } from '../chat/chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { StorageService, UploadedFileInfo } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';

/** 시드용 4인 목업 캐릭터 */
const MOCK_USERS = ['지우', '서연', '도윤', '하은'] as const;
type MockNickname = (typeof MOCK_USERS)[number];

const ROOM_NAME = '기말고사 부수자!!';

/** 채팅 시나리오 (총 25개, 기말 준비 톤) */
const SCENARIO: ReadonlyArray<{ from: MockNickname; text: string }> = [
  { from: '지우', text: '얘들아 기말 일정 공유 좀' },
  { from: '서연', text: 'ㅠㅠ 나 자료구조 망함' },
  { from: '도윤', text: '그건 나도 ㅋㅋㅋ 같이 망하자' },
  { from: '하은', text: '오늘 도서관 몇 시까지 함?' },
  { from: '지우', text: '11시까지! 9시쯤 만날래?' },
  { from: '서연', text: '콜 카페인 챙겨갈게' },
  { from: '도윤', text: '아아 2샷씩 ㄱㄱ' },
  { from: '하은', text: '운영체제 족보 공유함 → [구글드라이브 링크]' },
  { from: '지우', text: '오 갓하은' },
  { from: '서연', text: '이번 시험 비중 알아? 중간 30 기말 40 이래' },
  { from: '도윤', text: '와 망' },
  { from: '하은', text: 'ㄱㅊㄱㅊ 우리는 부순다' },
  { from: '지우', text: '다들 어느 챕터까지 봤어?' },
  { from: '서연', text: '나는 5장... 한참 남음' },
  { from: '도윤', text: '7장 ㅎ' },
  { from: '하은', text: '다 봤지 ^^' },
  { from: '지우', text: '야 너 거짓말 ㅋㅋ' },
  { from: '하은', text: '들켰네ㅋㅋㅋㅋ' },
  { from: '서연', text: '내일 새벽까지 달리자' },
  { from: '도윤', text: '밤샘 인증 ㄱㄱ' },
  { from: '지우', text: '내일 8시 카공 카페에서 봐' },
  { from: '서연', text: '알람 5개 맞춰놓음' },
  { from: '하은', text: '지각하면 커피 사기' },
  { from: '도윤', text: '콜' },
  { from: '지우', text: '기말 부수자 화이팅!!! 🔥' },
];

@Injectable()
export class DevService {
  private readonly logger = new Logger(DevService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly roomsService: RoomsService,
    private readonly chatService: ChatService,
    private readonly storage: StorageService,
  ) {}

  /**
   * 앱스토어 스크린샷용: 4명의 mock 유저가 2026-05-18 아침(07:00~10:00 KST) 사이
   * 사진 1장씩 올린 것처럼 photos 테이블에 행 4개 추가.
   *
   * 입력 files: { jiwoo, seoyeon, doyun, haeun } 각 1장 (multer-s3 가 이미 S3 업로드 완료된 상태).
   *
   * 안전: 같은 (room, uploader, 2026-05-18) 조합으로 이미 사진이 있으면 ConflictException.
   *      → 사진 데이터 절대 덮어쓰지 않음.
   */
  async seedMockPhotos(files: {
    jiwoo: UploadedFileInfo;
    seoyeon: UploadedFileInfo;
    doyun: UploadedFileInfo;
    haeun: UploadedFileInfo;
  }): Promise<{
    ok: true;
    inserted: Array<{ nickname: string; photoUrl: string; uploadedAt: string }>;
  }> {
    const mapping: Array<{ nickname: MockNickname; file: UploadedFileInfo }> = [
      { nickname: '지우', file: files.jiwoo },
      { nickname: '서연', file: files.seoyeon },
      { nickname: '도윤', file: files.doyun },
      { nickname: '하은', file: files.haeun },
    ];

    for (const m of mapping) {
      if (!m.file) {
        throw new ConflictException(
          `누락된 파일: ${m.nickname} (필드명: jiwoo/seoyeon/doyun/haeun 중 ${m.nickname})`,
        );
      }
    }

    // 방 조회
    const roomRows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM rooms WHERE name = $1 ORDER BY created_at DESC LIMIT 1`,
      [ROOM_NAME],
    );
    if (roomRows.length === 0) {
      throw new NotFoundException(`방을 찾을 수 없음: ${ROOM_NAME}`);
    }
    const roomId = roomRows[0].id;

    // 유저 조회
    const userRows = await this.dataSource.query<
      Array<{ id: string; nickname: string }>
    >(
      `SELECT id, nickname FROM users WHERE social_provider = 'mock' AND nickname = ANY($1::text[])`,
      [MOCK_USERS as readonly string[]],
    );
    const userIdByName = new Map(userRows.map((r) => [r.nickname, r.id]));
    for (const name of MOCK_USERS) {
      if (!userIdByName.has(name)) {
        throw new NotFoundException(`mock 유저 누락: ${name}`);
      }
    }

    // 안전 가드: 2026-05-18 KST 에 이미 사진 있으면 중단
    const existing = await this.dataSource.query<Array<{ cnt: number }>>(
      `SELECT COUNT(*)::int AS cnt FROM photos
       WHERE room_id = $1
         AND uploader_id = ANY($2::uuid[])
         AND (uploaded_at AT TIME ZONE 'Asia/Seoul')::date = DATE '2026-05-18'`,
      [roomId, Array.from(userIdByName.values())],
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) {
      throw new ConflictException(
        `2026-05-18 에 이미 mock 유저가 올린 사진이 존재합니다. 덮어쓰기 방지를 위해 중단.`,
      );
    }

    // 07:00 ~ 10:00 KST 사이 랜덤 시각 (4명 모두 다르게)
    const randomMorningKst = (): string => {
      const minMs = 7 * 3600 * 1000;
      const maxMs = 10 * 3600 * 1000;
      const off = minMs + Math.floor(Math.random() * (maxMs - minMs));
      const h = String(Math.floor(off / 3_600_000)).padStart(2, '0');
      const m = String(Math.floor((off % 3_600_000) / 60_000)).padStart(2, '0');
      const s = String(Math.floor((off % 60_000) / 1000)).padStart(2, '0');
      return `2026-05-18T${h}:${m}:${s}+09:00`;
    };

    const inserted: Array<{
      nickname: string;
      photoUrl: string;
      uploadedAt: string;
    }> = [];
    for (const { nickname, file } of mapping) {
      const uploaderId = userIdByName.get(nickname)!;
      const photoUrl = this.storage.resolveUploadedUrl(file);
      const uploadedAt = randomMorningKst();
      await this.dataSource.query(
        `INSERT INTO photos (room_id, uploader_id, photo_url, uploaded_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz, $4::timestamptz)`,
        [roomId, uploaderId, photoUrl, uploadedAt],
      );
      inserted.push({ nickname, photoUrl, uploadedAt });
      this.logger.log(
        `[seed-photos] ${nickname} → ${photoUrl} @ ${uploadedAt}`,
      );
    }

    return { ok: true, inserted };
  }

  /**
   * 앱스토어 스크린샷용: 5/1~5/17 기간에 달력 점이 다양하게 보이도록
   * mock 유저들이 이미 올린 사진 URL을 재사용해 photos row 만 추가.
   * - 날짜마다 1~4명 랜덤 (모든 날에 다 찍히지는 않음)
   * - S3 재업로드 없음
   * - 2026-05-18 은 건드리지 않음
   * - 동일 (room, uploader, date) 조합이 이미 있으면 skip
   */
  async seedMockCalendarDots(): Promise<{
    ok: true;
    inserted: number;
    skipped: number;
  }> {
    const roomRows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM rooms WHERE name = $1 ORDER BY created_at DESC LIMIT 1`,
      [ROOM_NAME],
    );
    if (roomRows.length === 0) {
      throw new NotFoundException(`방을 찾을 수 없음: ${ROOM_NAME}`);
    }
    const roomId = roomRows[0].id;

    const userRows = await this.dataSource.query<
      Array<{ id: string; nickname: string }>
    >(
      `SELECT id, nickname FROM users WHERE social_provider = 'mock' AND nickname = ANY($1::text[])`,
      [MOCK_USERS as readonly string[]],
    );
    const userIdByName = new Map(userRows.map((r) => [r.nickname, r.id]));
    for (const name of MOCK_USERS) {
      if (!userIdByName.has(name)) {
        throw new NotFoundException(`mock 유저 누락: ${name}`);
      }
    }

    // 각 mock 유저가 기존에 올린 photo_url 재사용 (가장 최근 1건)
    const existingPhotoRows = await this.dataSource.query<
      Array<{ uploader_id: string; photo_url: string }>
    >(
      `SELECT DISTINCT ON (uploader_id) uploader_id, photo_url
       FROM photos
       WHERE room_id = $1
         AND uploader_id = ANY($2::uuid[])
       ORDER BY uploader_id, uploaded_at DESC`,
      [roomId, Array.from(userIdByName.values())],
    );
    const photoUrlByUploader = new Map(
      existingPhotoRows.map((r) => [r.uploader_id, r.photo_url]),
    );
    for (const name of MOCK_USERS) {
      const uid = userIdByName.get(name)!;
      if (!photoUrlByUploader.has(uid)) {
        throw new ConflictException(
          `${name} 의 기존 사진 URL을 찾을 수 없습니다. 먼저 /dev/seed-mock-photos 로 사진을 올려주세요.`,
        );
      }
    }

    // 기존 (uploader, KST date) 세트 (중복 방지)
    const existingKeyRows = await this.dataSource.query<
      Array<{ uploader_id: string; d: string }>
    >(
      `SELECT uploader_id,
              to_char((uploaded_at AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS d
       FROM photos
       WHERE room_id = $1
         AND uploader_id = ANY($2::uuid[])`,
      [roomId, Array.from(userIdByName.values())],
    );
    const existingKeys = new Set(
      existingKeyRows.map((r) => `${r.uploader_id}|${r.d}`),
    );

    const pickRandom = <T>(arr: readonly T[], n: number): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.slice(0, n);
    };

    // 5/1 ~ 5/17 중 일부 날짜에만, 인원수도 다양하게
    const PLAN: ReadonlyArray<{ day: number; count: number }> = [
      { day: 1, count: 2 },
      { day: 2, count: 3 },
      { day: 4, count: 1 },
      { day: 5, count: 4 },
      { day: 6, count: 2 },
      { day: 8, count: 3 },
      { day: 9, count: 2 },
      { day: 11, count: 4 },
      { day: 12, count: 1 },
      { day: 13, count: 3 },
      { day: 14, count: 2 },
      { day: 15, count: 4 },
      { day: 16, count: 3 },
      { day: 17, count: 2 },
    ];

    let inserted = 0;
    let skipped = 0;

    for (const { day, count } of PLAN) {
      const date = `2026-05-${String(day).padStart(2, '0')}`;
      const names = pickRandom(MOCK_USERS, count);
      for (const nickname of names) {
        const uploaderId = userIdByName.get(nickname)!;
        const key = `${uploaderId}|${date}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }
        existingKeys.add(key);

        const photoUrl = photoUrlByUploader.get(uploaderId)!;
        // 06:00 ~ 23:00 KST 사이 랜덤 시각
        const minMs = 6 * 3600 * 1000;
        const maxMs = 23 * 3600 * 1000;
        const off = minMs + Math.floor(Math.random() * (maxMs - minMs));
        const h = String(Math.floor(off / 3_600_000)).padStart(2, '0');
        const m = String(Math.floor((off % 3_600_000) / 60_000)).padStart(
          2,
          '0',
        );
        const s = String(Math.floor((off % 60_000) / 1000)).padStart(2, '0');
        const uploadedAt = `${date}T${h}:${m}:${s}+09:00`;

        await this.dataSource.query(
          `INSERT INTO photos (room_id, uploader_id, photo_url, uploaded_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz, $4::timestamptz)`,
          [roomId, uploaderId, photoUrl, uploadedAt],
        );
        inserted++;
      }
    }

    this.logger.log(`[seed-calendar] inserted=${inserted}, skipped=${skipped}`);
    return { ok: true, inserted, skipped };
  }

  /**
   * 앱스토어 스크린샷용 목업 시드.
   * - 기존 mock 유저/방/멤버/채팅방/메시지/읽음만 제거 후 재생성
   * - photos 테이블은 절대 SELECT/DELETE/UPDATE 하지 않음
   *   (단, mock 유저가 업로더로 참조된 사진이 있다면 안전 차원에서 중단)
   * - 메시지의 createdAt 을 과거로 분포시켜 자연스러운 대화 흐름 생성
   */
  async seedMock() {
    // 1) 기존 mock 데이터 정리 (사진 보존)
    await this.cleanupMockData();

    // 2) mock 유저 4명 생성
    const users = await this.createMockUsers();
    const byName = new Map<MockNickname, User>(
      MOCK_USERS.map((n) => [n, users.find((u) => u.nickname === n)!]),
    );

    // 3) 방 생성 — 지우가 owner
    const owner = byName.get('지우')!;
    const room = await this.roomsService.createRoom(owner.id, ROOM_NAME);

    // 4) 나머지 3명 합류 (자동으로 member_joined 시스템 메시지 생성됨)
    for (const name of ['서연', '도윤', '하은'] as const) {
      const user = byName.get(name)!;
      await this.roomsService.joinRoom(user.id, room.inviteCode);
    }

    // 5) 시나리오 메시지 시간 분포 삽입
    const chatRoom = await this.chatService.ensureChatRoomForRoom(room.id);
    const insertedCount = await this.seedConversation(chatRoom.id, byName);

    return {
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        nickname: u.nickname,
      })),
      roomId: room.id,
      inviteCode: room.inviteCode,
      chatRoomId: chatRoom.id,
      messageCount: insertedCount,
    };
  }

  /** 기존 mock 데이터만 정리. photos 는 일절 건드리지 않음. */
  private async cleanupMockData(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // mock 유저 id 조회
      const mockUsers = await manager.find(User, {
        where: { socialProvider: 'mock' },
        select: ['id'],
      });
      const mockUserIds = mockUsers.map((u) => u.id);
      if (mockUserIds.length === 0) {
        this.logger.log('[seed] no existing mock users, skip cleanup');
        return;
      }

      // 안전 가드: mock 유저가 사진 업로더로 참조되어 있으면 중단 (사진 데이터 보존 우선)
      const photoRefRows = await manager.query<Array<{ cnt: number }>>(
        `SELECT COUNT(*)::int AS cnt FROM photos WHERE uploader_id = ANY($1::uuid[])`,
        [mockUserIds],
      );
      const cnt = Number(photoRefRows[0]?.cnt ?? 0);
      if (cnt > 0) {
        throw new ConflictException(
          `mock 유저가 업로더로 참조된 사진이 ${cnt}건 있습니다. 사진 데이터 보존을 위해 시드를 중단합니다.`,
        );
      }

      // mock owner 가 만든 방 + mock 유저가 멤버로 속한 방 모두 정리
      const ownedRooms = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM rooms WHERE owner_id = ANY($1::uuid[])`,
        [mockUserIds],
      );
      const memberRooms = await manager.query<Array<{ room_id: string }>>(
        `SELECT DISTINCT room_id FROM room_members WHERE user_id = ANY($1::uuid[])`,
        [mockUserIds],
      );
      const roomIds = Array.from(
        new Set<string>([
          ...ownedRooms.map((r) => r.id),
          ...memberRooms.map((r) => r.room_id),
        ]),
      );

      if (roomIds.length > 0) {
        // 채팅 관련 (chat_messages, chat_reads → chat_rooms 는 CASCADE 지만 명시적으로 정리)
        await manager.query(
          `DELETE FROM chat_messages WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE room_id = ANY($1::uuid[]))`,
          [roomIds],
        );
        await manager.query(
          `DELETE FROM chat_reads WHERE chat_room_id IN (SELECT id FROM chat_rooms WHERE room_id = ANY($1::uuid[]))`,
          [roomIds],
        );
        await manager.query(
          `DELETE FROM chat_rooms WHERE room_id = ANY($1::uuid[])`,
          [roomIds],
        );
        await manager.query(
          `DELETE FROM room_members WHERE room_id = ANY($1::uuid[])`,
          [roomIds],
        );
        await manager.query(`DELETE FROM rooms WHERE id = ANY($1::uuid[])`, [
          roomIds,
        ]);
      }

      // mock 유저가 다른 방에 참여하고 있던 흔적도 정리
      await manager.query(
        `DELETE FROM room_members WHERE user_id = ANY($1::uuid[])`,
        [mockUserIds],
      );
      await manager.query(
        `DELETE FROM chat_reads WHERE user_id = ANY($1::uuid[])`,
        [mockUserIds],
      );

      // 마지막으로 mock 유저 삭제
      await manager.delete(User, { id: In(mockUserIds) });

      this.logger.log(
        `[seed] cleaned up mock data: ${mockUserIds.length} users, ${roomIds.length} rooms`,
      );
    });
  }

  private async createMockUsers(): Promise<User[]> {
    const created: User[] = [];
    for (const nickname of MOCK_USERS) {
      const user = this.userRepository.create({
        nickname,
        socialProvider: 'mock',
        socialId: `mock-${nickname}`,
        email: null,
        profileImage: null,
      });
      created.push(await this.userRepository.save(user));
    }
    return created;
  }

  /**
   * 시나리오 메시지를 과거 시각으로 분포 삽입하고,
   * joinRoom 으로 자동 생성된 system 메시지는 시나리오 첫 메시지 앞으로 당겨 정렬을 자연스럽게 만든다.
   */
  private async seedConversation(
    chatRoomId: string,
    byName: Map<MockNickname, User>,
  ): Promise<number> {
    // 시작 시각: 3시간 전부터 30초~6분 랜덤 간격으로 분포
    const baseTime = Date.now() - 3 * 60 * 60 * 1000;
    let cursor = baseTime;

    const saved: ChatMessage[] = [];
    for (const line of SCENARIO) {
      cursor += 30_000 + Math.floor(Math.random() * 330_000); // 30s ~ 6m
      const sender = byName.get(line.from)!;
      const at = new Date(cursor);
      const msg = this.chatMessageRepository.create({
        chatRoomId,
        senderId: sender.id,
        type: 'text',
        content: line.text,
        metadata: {},
        clientId: null,
        createdAt: at,
        updatedAt: at,
      });
      saved.push(await this.chatMessageRepository.save(msg));
    }

    // joinRoom 으로 자동 생성된 system 메시지(member_joined)를 시나리오 앞 시점으로 보정
    const systemMessages = await this.chatMessageRepository.find({
      where: { chatRoomId, type: 'system' },
      order: { createdAt: 'ASC' },
    });
    const systemStart = baseTime - systemMessages.length * 60_000;
    for (let i = 0; i < systemMessages.length; i++) {
      const at = new Date(systemStart + i * 60_000);
      await this.chatMessageRepository.update(systemMessages[i].id, {
        createdAt: at,
        updatedAt: at,
      });
    }

    // chat_rooms.last_message_* 동기화
    const lastMessage = saved[saved.length - 1];
    if (lastMessage) {
      await this.chatRoomRepository.update(chatRoomId, {
        lastMessageId: lastMessage.id,
        lastMessageAt: lastMessage.createdAt,
      });
    }

    return saved.length;
  }
}
