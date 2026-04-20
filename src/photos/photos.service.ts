import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Photo } from './entities/photo.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { User } from '../users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

type PhotoDto = {
  id: string;
  roomId: string;
  uploaderId: string;
  uploaderNickname: string;
  uploaderColor: string;
  photoUrl: string;
  uploadedAt: string;
};

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // Helpers
  // ============================================================

  private async assertRoomMember(roomId: string, userId: string) {
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }
    return member;
  }

  private async loadPhotoOrThrow(photoId: string): Promise<Photo> {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId },
    });
    if (!photo) {
      throw new NotFoundException('사진을 찾을 수 없습니다.');
    }
    return photo;
  }

  private async toPhotoDtos(
    photos: Photo[],
    _viewerId: string,
  ): Promise<PhotoDto[]> {
    if (photos.length === 0) return [];

    const roomIds = Array.from(new Set(photos.map((p) => p.roomId)));
    const members = await this.roomMemberRepository.find({
      where: { roomId: In(roomIds) },
    });
    const colorByKey = new Map<string, string>();
    for (const m of members)
      colorByKey.set(`${m.roomId}:${m.userId}`, m.color);

    return photos.map((photo) => ({
      id: photo.id,
      roomId: photo.roomId,
      uploaderId: photo.uploaderId,
      uploaderNickname: photo.uploader?.nickname ?? '',
      uploaderColor:
        colorByKey.get(`${photo.roomId}:${photo.uploaderId}`) ?? '#000000',
      photoUrl: photo.photoUrl,
      uploadedAt: photo.uploadedAt.toISOString(),
    }));
  }

  // ============================================================
  // Upload
  // ============================================================

  async uploadPhoto(roomId: string, uploaderId: string, photoUrl: string) {
    await this.assertRoomMember(roomId, uploaderId);

    const existingToday = await this.photoRepository
      .createQueryBuilder('p')
      .where('p.room_id = :roomId', { roomId })
      .andWhere('p.uploader_id = :uploaderId', { uploaderId })
      .andWhere(
        `CAST(p.uploaded_at AT TIME ZONE 'Asia/Seoul' AS date) = CAST(NOW() AT TIME ZONE 'Asia/Seoul' AS date)`,
      )
      .getOne();

    if (existingToday) {
      if (existingToday.photoUrl.startsWith('uploads/')) {
        const filePath = path.resolve(existingToday.photoUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      existingToday.photoUrl = photoUrl;
      existingToday.uploadedAt = new Date();
      await this.photoRepository.save(existingToday);
      const reloaded = await this.photoRepository.findOne({
        where: { id: existingToday.id },
        relations: ['uploader'],
      });
      const [dto] = await this.toPhotoDtos([reloaded!], uploaderId);
      return dto;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const photo = this.photoRepository.create({
        roomId,
        uploaderId,
        photoUrl,
      });
      const saved = await queryRunner.manager.save(photo);
      await queryRunner.manager.increment(
        RoomMember,
        { roomId, userId: uploaderId },
        'score',
        1,
      );
      await queryRunner.commitTransaction();

      const reloaded = await this.photoRepository.findOne({
        where: { id: saved.id },
        relations: ['uploader'],
      });
      const [dto] = await this.toPhotoDtos([reloaded!], uploaderId);
      return dto;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================================
  // Feed (today)
  // ============================================================

  async getFeed(roomId: string, userId: string) {
    await this.assertRoomMember(roomId, userId);

    const todayStr = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'Asia/Seoul',
    });

    const photos = await this.photoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.uploader', 'uploader')
      .where('p.room_id = :roomId', { roomId })
      .andWhere(
        `CAST(p.uploaded_at AT TIME ZONE 'Asia/Seoul' AS date) = :todayStr`,
        { todayStr },
      )
      .orderBy('p.uploaded_at', 'DESC')
      .getMany();

    return this.toPhotoDtos(photos, userId);
  }

  // ============================================================
  // Calendar
  // ============================================================

  async getCalendar(
    roomId: string,
    userId: string,
    year: number,
    month: number,
  ) {
    await this.assertRoomMember(roomId, userId);

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const results = await this.photoRepository
      .createQueryBuilder('p')
      .innerJoin(
        RoomMember,
        'rm',
        'p.room_id = rm.room_id AND p.uploader_id = rm.user_id',
      )
      .innerJoin(User, 'u', 'rm.user_id = u.id')
      .where('p.room_id = :roomId', { roomId })
      .andWhere(
        `CAST(p.uploaded_at AT TIME ZONE 'Asia/Seoul' AS date) >= :startDate`,
        { startDate: startDateStr },
      )
      .andWhere(
        `CAST(p.uploaded_at AT TIME ZONE 'Asia/Seoul' AS date) < :endDate`,
        { endDate: endDateStr },
      )
      .select(
        `TO_CHAR(p.uploaded_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`,
        'uploadDate',
      )
      .addSelect('rm.user_id', 'userId')
      .addSelect('u.nickname', 'nickname')
      .addSelect('rm.color', 'color')
      .orderBy('"uploadDate"', 'ASC')
      .getRawMany();

    const grouped: Record<
      string,
      { userId: string; nickname: string; color: string }[]
    > = {};
    for (const row of results) {
      const dateStr = String(row.uploadDate).split('T')[0];
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push({
        userId: row.userId,
        nickname: row.nickname,
        color: row.color,
      });
    }

    return Object.entries(grouped).map(([date, uploads]) => ({
      date,
      uploads,
    }));
  }

  // ============================================================
  // Photos by date
  // ============================================================

  async getPhotosByDate(roomId: string, userId: string, date: string) {
    await this.assertRoomMember(roomId, userId);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('잘못된 날짜 형식입니다.');
    }

    const photos = await this.photoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.uploader', 'uploader')
      .where('p.room_id = :roomId', { roomId })
      .andWhere(
        `CAST(p.uploaded_at AT TIME ZONE 'Asia/Seoul' AS date) = :targetDate`,
        { targetDate: date },
      )
      .orderBy('p.uploaded_at', 'ASC')
      .getMany();

    return this.toPhotoDtos(photos, userId);
  }
}
