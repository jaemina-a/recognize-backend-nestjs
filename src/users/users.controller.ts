import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * DELETE /users/me
   * - JWT 인증 필수
   * - 본인 계정을 익명화/비활성화 (App Store Guideline 5.1.1(v))
   * - 204 No Content
   */
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@Request() req: { user: { userId: string } }): Promise<void> {
    this.logger.log(`[DELETE] /users/me userId=${req.user.userId}`);
    await this.usersService.deleteAccount(req.user.userId);
  }
}
