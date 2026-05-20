import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AppleLoginDto } from './dto/apple-login.dto';
import { KakaoLoginDto } from './dto/kakao-login.dto';
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
  @Post('apple')
  async appleLogin(@Body() dto: AppleLoginDto) {
    this.logger.log(
      `[APPLE] POST /auth/apple received. identityToken length=${dto?.identityToken?.length ?? 0}`,
    );
    try {
      const result = await this.authService.appleLogin(dto);
      this.logger.log(`[APPLE] login success. userId=${result.user.id}`);
      return result;
    } catch (e) {
      this.logger.error(
        `[APPLE] login failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
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
