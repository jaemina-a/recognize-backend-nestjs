import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Photo } from './entities/photo.entity';
import { Recognition } from './entities/recognition.entity';
import { RecognitionLog } from './entities/recognition-log.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { User } from '../users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    @InjectRepository(Recognition)
    private readonly recognitionRepository: Repository<Recognition>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    @InjectRepository(RecognitionLog)
    private readonly recognitionLogRepository: Repository<RecognitionLog>,
    private readonly dataSource: DataSource,
  ) {}

  async uploadPhoto(roomId: string, uploaderId: string, photoUrl: string) {
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId: uploaderId },
    });
    if (!member) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }

    const existing = await this.photoRepository.findOne({
      where: { roomId, uploaderId },
    });

    if (existing) {
      // Delete existing recognition
      await this.recognitionRepository.delete({ photoId: existing.id });

      // Delete old file if local
      if (existing.photoUrl.startsWith('uploads/')) {
        const filePath = path.resolve(existing.photoUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Update existing photo
      existing.photoUrl = photoUrl;
      existing.uploadedAt = new Date();
      existing.isRecognized = false;
      await this.photoRepository.save(existing);

      return this.formatPhoto(existing, uploaderId);
    }

    const photo = this.photoRepository.create({
      roomId,
      uploaderId,
      photoUrl,
    });
    const saved = await this.photoRepository.save(photo);
    return this.formatPhoto(saved, uploaderId);
  }

  async getFeed(roomId: string, userId: string) {
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }

    // 오늘(KST) 업로드된 사진만 조회
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

    const photos = await this.photoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.uploader', 'uploader')
      .where('p.room_id = :roomId', { roomId })
      .andWhere(`(p.uploaded_at AT TIME ZONE 'Asia/Seoul')::date = :todayStr`, { todayStr })
      .orderBy('p.uploaded_at', 'DESC')
      .getMany();

    const photoIds = photos.map((p) => p.id);
    const recognitions =
      photoIds.length > 0
        ? await this.recognitionRepository
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.recognizer', 'recognizer')
            .where('r.photo_id IN (:...photoIds)', { photoIds })
            .getMany()
        : [];

    const recognitionMap = new Map(recognitions.map((r) => [r.photoId, r]));

    // Get room members for color info
    const members = await this.roomMemberRepository.find({
      where: { roomId },
      relations: ['user'],
    });
    const memberMap = new Map(members.map((m) => [m.userId, m]));

    return photos.map((photo) => {
      const recognition = recognitionMap.get(photo.id);
      const uploaderMember = memberMap.get(photo.uploaderId);
      return {
        id: photo.id,
        roomId: photo.roomId,
        uploaderId: photo.uploaderId,
        uploaderNickname: photo.uploader.nickname,
        uploaderColor: uploaderMember?.color ?? '#000000',
        photoUrl: photo.photoUrl,
        uploadedAt: photo.uploadedAt.toISOString(),
        isRecognized: photo.isRecognized,
        recognizedBy: recognition
          ? {
              userId: recognition.recognizerId,
              nickname: recognition.recognizer.nickname,
              recognizedAt: recognition.recognizedAt.toISOString(),
            }
          : null,
      };
    });
  }

  async recognizePhoto(photoId: string, recognizerId: string) {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId },
      relations: ['uploader'],
    });

    if (!photo) {
      throw new NotFoundException('사진을 찾을 수 없습니다.');
    }

    if (photo.uploaderId === recognizerId) {
      throw new ForbiddenException('본인의 사진은 인정할 수 없습니다.');
    }

    const member = await this.roomMemberRepository.findOne({
      where: { roomId: photo.roomId, userId: recognizerId },
    });
    if (!member) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Try to insert recognition (UNIQUE constraint on photo_id guarantees first-come)
      const recognition = this.recognitionRepository.create({
        photoId,
        recognizerId,
      });

      await queryRunner.manager.save(recognition);

      // Insert permanent recognition log
      const log = this.recognitionLogRepository.create({
        roomId: photo.roomId,
        uploaderId: photo.uploaderId,
        recognizerId,
      });
      await queryRunner.manager.save(log);

      // Update photo status
      await queryRunner.manager.update(Photo, photoId, {
        isRecognized: true,
      });

      // Increment uploader's score
      await queryRunner.manager.increment(
        RoomMember,
        { roomId: photo.roomId, userId: photo.uploaderId },
        'score',
        1,
      );

      await queryRunner.commitTransaction();

      const updatedPhoto = await this.photoRepository.findOne({
        where: { id: photoId },
        relations: ['uploader'],
      });
      return this.formatPhoto(updatedPhoto!, recognizerId);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      // UNIQUE violation = already recognized
      if (error?.code === '23505') {
        throw new ConflictException('이미 다른 유저가 인정했습니다.');
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async formatPhoto(photo: Photo, requesterId: string) {
    const recognition = await this.recognitionRepository.findOne({
      where: { photoId: photo.id },
      relations: ['recognizer'],
    });

    let uploaderNickname = photo.uploader?.nickname;
    if (!uploaderNickname) {
      const fullPhoto = await this.photoRepository.findOne({
        where: { id: photo.id },
        relations: ['uploader'],
      });
      uploaderNickname = fullPhoto?.uploader?.nickname ?? '';
    }

    return {
      id: photo.id,
      roomId: photo.roomId,
      uploaderId: photo.uploaderId,
      uploaderNickname,
      photoUrl: photo.photoUrl,
      uploadedAt: photo.uploadedAt.toISOString(),
      isRecognized: photo.isRecognized,
      recognizedBy: recognition
        ? {
            userId: recognition.recognizerId,
            nickname: recognition.recognizer.nickname,
            recognizedAt: recognition.recognizedAt.toISOString(),
          }
        : null,
    };
  }

  async getCalendar(roomId: string, userId: string, year: number, month: number) {
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new ForbiddenException('이 방의 멤버가 아닙니다.');
    }

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const results = await this.recognitionLogRepository
      .createQueryBuilder('rl')
      .innerJoin(RoomMember, 'rm', 'rl.room_id = rm.room_id AND rl.uploader_id = rm.user_id')
      .innerJoin(User, 'u', 'rm.user_id = u.id')
      .where('rl.room_id = :roomId', { roomId })
      .andWhere(`(rl.recognized_at AT TIME ZONE 'Asia/Seoul')::date >= :startDate`, { startDate: startDateStr })
      .andWhere(`(rl.recognized_at AT TIME ZONE 'Asia/Seoul')::date < :endDate`, { endDate: endDateStr })
      .select([
        `TO_CHAR(rl.recognized_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date`,
        'rm.user_id AS "userId"',
        'u.nickname AS nickname',
        'rm.color AS color',
      ])
      .orderBy('date', 'ASC')
      .getRawMany();

    // Group by date
    const grouped: Record<string, { userId: string; nickname: string; color: string }[]> = {};
    for (const row of results) {
      const dateStr = String(row.date).split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push({
        userId: row.userId,
        nickname: row.nickname,
        color: row.color,
      });
    }

    return Object.entries(grouped).map(([date, recognitions]) => ({
      date,
      recognitions,
    }));
  }
}
