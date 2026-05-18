import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DevService } from './dev.service';

@Controller('dev')
export class DevController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly devService: DevService,
  ) {}

  /**
   * TODO(임시): DevModule 이 production 에 잠시 노출되어 있는 동안
   * 파괴적 reset 엔드포인트는 완전히 차단해 둠. 스크린샷 작업 후 원복.
   */
  @Get('reset')
  reset() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        '/dev/reset 은 production 에서 비활성화되어 있습니다.',
      );
    }
    return this.dataSource
      .query(
        `TRUNCATE TABLE photos, room_members, rooms RESTART IDENTITY CASCADE`,
      )
      .then(() => ({ message: 'DB 초기화 완료' }));
  }

  /**
   * 앱스토어 스크린샷용 목업 시드 (mock 유저 4명 + 기말고사 채팅방 + 25개 메시지).
   * - DevModule 은 NODE_ENV !== 'production' 일 때만 등록되므로 운영에는 노출되지 않음.
   * - photos 테이블은 일절 건드리지 않음.
   */
  @Get('seed-mock')
  async seedMock() {
    return this.devService.seedMock();
  }
}
