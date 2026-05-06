import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { diskStorage, StorageEngine } from 'multer';
import multerS3 from 'multer-s3';
import { extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

export type StorageDriver = 'local' | 's3';

export type UploadedFileInfo = Express.Multer.File & {
  key?: string;
  location?: string;
  bucket?: string;
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  readonly driver: StorageDriver;
  private readonly bucket?: string;
  private readonly region?: string;
  private readonly publicUrlBase?: string;
  private readonly localDir: string;
  private readonly s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    const raw = (
      this.config.get<string>('STORAGE_DRIVER') ?? 'local'
    ).toLowerCase();
    this.driver = raw === 's3' ? 's3' : 'local';
    this.localDir = this.config.get<string>('LOCAL_UPLOAD_DIR') ?? './uploads';

    if (this.driver === 's3') {
      this.bucket = this.config.get<string>('AWS_S3_BUCKET');
      this.region = this.config.get<string>('AWS_REGION');
      const customPublic = this.config.get<string>('AWS_S3_PUBLIC_URL');
      this.publicUrlBase = customPublic?.replace(/\/+$/, '');

      if (!this.bucket || !this.region) {
        throw new Error(
          'STORAGE_DRIVER=s3 이지만 AWS_S3_BUCKET 또는 AWS_REGION 환경변수가 설정되지 않았습니다.',
        );
      }

      this.s3 = new S3Client({ region: this.region });
    }
  }

  onModuleInit() {
    this.logger.log(
      `Storage driver: ${this.driver}` +
        (this.driver === 's3'
          ? ` (bucket=${this.bucket}, region=${this.region})`
          : ` (dir=${this.localDir})`),
    );
  }

  /** Multer storage engine. Used by MulterModule.registerAsync. */
  buildMulterStorage(): StorageEngine {
    if (this.driver === 's3') {
      return multerS3({
        s3: this.s3 as never,
        bucket: this.bucket as string,
        // AUTO_CONTENT_TYPE을 직접 전달하면 unbound-method 경고가 발생하므로 wrapper로 감쌈
        contentType: (req, file, cb) =>
          multerS3.AUTO_CONTENT_TYPE(req, file, cb),
        key: (_req, file, cb) => {
          const key = `photos/${randomUUID()}${extname(file.originalname)}`;
          cb(null, key);
        },
      });
    }

    // local
    try {
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
    } catch (err) {
      this.logger.warn(
        `로컬 업로드 디렉터리 생성 실패 (${this.localDir}): ${(err as Error).message}. ` +
          `운영에서는 STORAGE_DRIVER=s3 사용을 권장합니다.`,
      );
    }
    return diskStorage({
      destination: this.localDir,
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname)}`);
      },
    });
  }

  /**
   * 업로드된 파일을 DB에 저장할 canonical 문자열로 변환.
   * - s3: 절대 URL (https://bucket.s3.region.amazonaws.com/photos/xxx 또는 CDN URL)
   * - local: "uploads/xxx" (기존 동작 유지)
   */
  resolveUploadedUrl(file: UploadedFileInfo): string {
    if (this.driver === 's3') {
      const key = file.key;
      if (!key) {
        throw new Error(
          'multer-s3 file.key가 없습니다. 업로드 설정을 확인하세요.',
        );
      }
      if (this.publicUrlBase) {
        return `${this.publicUrlBase}/${key}`;
      }
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }
    return `uploads/${file.filename}`;
  }

  /** 기존 사진 URL을 받아 실제 저장소에서 삭제. 실패해도 throw 하지 않고 로그만 남김. */
  async delete(photoUrl: string | null | undefined): Promise<void> {
    if (!photoUrl) return;
    try {
      if (this.driver === 's3') {
        const key = this.extractS3Key(photoUrl);
        if (!key) {
          this.logger.warn(`S3 key 추출 실패: ${photoUrl}`);
          return;
        }
        await this.s3!.send(
          new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }),
        );
        return;
      }

      // local
      if (photoUrl.startsWith('uploads/')) {
        const filePath = resolve(photoUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(
        `사진 삭제 실패 (${photoUrl}): ${(err as Error).message}`,
      );
    }
  }

  private extractS3Key(photoUrl: string): string | null {
    if (this.publicUrlBase && photoUrl.startsWith(this.publicUrlBase + '/')) {
      return photoUrl.slice(this.publicUrlBase.length + 1);
    }
    // path-style 또는 virtual-hosted-style
    const virtualHosted = photoUrl.match(
      /^https?:\/\/[^/]+\.s3[.-][^/]+\.amazonaws\.com\/(.+)$/i,
    );
    if (virtualHosted) return decodeURIComponent(virtualHosted[1]);
    const pathStyle = photoUrl.match(
      /^https?:\/\/s3[.-][^/]+\.amazonaws\.com\/[^/]+\/(.+)$/i,
    );
    if (pathStyle) return decodeURIComponent(pathStyle[1]);
    return null;
  }
}
