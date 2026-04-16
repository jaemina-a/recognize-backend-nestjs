import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { MockLoginDto } from './dto/mock-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('kakao')
  async kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto.accessToken);
  }

  @Post('mock')
  async mockLogin(@Body() dto: MockLoginDto) {
    return this.authService.mockLogin(dto.nickname);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: { user: { userId: string } }) {
    return req.user;
  }
}
