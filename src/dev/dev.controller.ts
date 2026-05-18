import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { UploadedFileInfo } from '../storage/storage.service';
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

  /**
   * 앱스토어 스크린샷용: 4명 mock 유저가 2026-05-18 아침에 사진 한 장씩 올린 것처럼 시드.
   * multipart/form-data 로 jiwoo / seoyeon / doyun / haeun 각 1 파일 업로드.
   * StorageService 가 자동으로 S3 업로드 → key 를 photoUrl 로 저장.
   */
  @Post('seed-mock-photos')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'jiwoo', maxCount: 1 },
      { name: 'seoyeon', maxCount: 1 },
      { name: 'doyun', maxCount: 1 },
      { name: 'haeun', maxCount: 1 },
    ]),
  )
  async seedMockPhotos(
    @UploadedFiles()
    files: {
      jiwoo?: UploadedFileInfo[];
      seoyeon?: UploadedFileInfo[];
      doyun?: UploadedFileInfo[];
      haeun?: UploadedFileInfo[];
    },
  ) {
    return this.devService.seedMockPhotos({
      jiwoo: files.jiwoo?.[0] as UploadedFileInfo,
      seoyeon: files.seoyeon?.[0] as UploadedFileInfo,
      doyun: files.doyun?.[0] as UploadedFileInfo,
      haeun: files.haeun?.[0] as UploadedFileInfo,
    });
  }

  /**
   * 앱스토어 스크린샷용: 5/1 ~ 5/17 기간에 달력 점이 다양하게 보이도록
   * 이미 올라간 4장의 photo_url 을 재사용해 row 만 추가.
   */
  @Get('seed-mock-calendar')
  async seedMockCalendar() {
    return this.devService.seedMockCalendarDots();
  }

  /** 스크린샷 작업 종료 후 mock 데이터(유저/방/사진+S3) 일괄 삭제 */
  @Get('cleanup-mock-all')
  async cleanupMockAll() {
    return this.devService.cleanupMockAll();
  }
}
