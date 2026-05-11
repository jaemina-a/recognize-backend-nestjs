import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { MockLoginDto } from './dto/mock-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('kakao')
  async kakaoLogin(@Body() dto: KakaoLoginDto) {
    this.logger.log(
      `[KAKAO] POST /auth/kakao received. body.accessToken length=${dto?.accessToken?.length ?? 0}`,
    );
    try {
      const result = await this.authService.kakaoLogin(dto.accessToken);
      this.logger.log(`[KAKAO] login success. userId=${result.user.id}`);
      return result;
    } catch (e) {
      this.logger.error(
        `[KAKAO] login failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('mock')
  async mockLogin(@Body() dto: MockLoginDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return this.authService.mockLogin(dto.nickname);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: { user: { userId: string } }) {
    return req.user;
  }
}
