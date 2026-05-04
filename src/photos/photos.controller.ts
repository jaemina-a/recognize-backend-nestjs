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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhotosService } from './photos.service';
import { StorageService } from '../storage/storage.service';
import type { UploadedFileInfo } from '../storage/storage.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(
    private readonly photosService: PhotosService,
    private readonly storage: StorageService,
  ) {}

  @Post('rooms/:roomId/photos')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(
    @Request() req: { user: { userId: string } },
    @Param('roomId') roomId: string,
    @UploadedFile() file: UploadedFileInfo,
  ) {
    const photoUrl = this.storage.resolveUploadedUrl(file);
    return this.photosService.uploadPhoto(roomId, req.user.userId, photoUrl);
  }

  @Get('rooms/:roomId/photos')
  async getFeed(
    @Request() req: { user: { userId: string } },
    @Param('roomId') roomId: string,
  ) {
    return this.photosService.getFeed(roomId, req.user.userId);
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

  @Get('rooms/:roomId/photos/by-date')
  async getPhotosByDate(
    @Request() req: { user: { userId: string } },
    @Param('roomId') roomId: string,
    @Query('date') date: string,
  ) {
    return this.photosService.getPhotosByDate(roomId, req.user.userId, date);
  }
}
