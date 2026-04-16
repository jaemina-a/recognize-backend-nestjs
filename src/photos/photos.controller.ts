import {
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhotosService } from './photos.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('rooms/:roomId/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadPhoto(
    @Request() req: { user: { userId: string } },
    @Param('roomId') roomId: string,
    @UploadedFile() file: { filename: string; originalname: string },
  ) {
    const photoUrl = `uploads/${file.filename}`;
    return this.photosService.uploadPhoto(roomId, req.user.userId, photoUrl);
  }

  @Get('rooms/:roomId/photos')
  async getFeed(
    @Request() req: { user: { userId: string } },
    @Param('roomId') roomId: string,
  ) {
    return this.photosService.getFeed(roomId, req.user.userId);
  }

  @Post('photos/:photoId/recognize')
  async recognizePhoto(
    @Request() req: { user: { userId: string } },
    @Param('photoId') photoId: string,
  ) {
    return this.photosService.recognizePhoto(photoId, req.user.userId);
  }

  @Get('rooms/:roomId/calendar')
  async getCalendar(
    @Request() req: { user: { userId: string } },
    @Param('roomId') roomId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.photosService.getCalendar(
      roomId,
      req.user.userId,
      parseInt(year),
      parseInt(month),
    );
  }
}
