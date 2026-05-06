import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { CorsIoAdapter } from './common/cors-io.adapter';
import { resolveCorsOrigin } from './common/cors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serve uploaded files (local storage driver only)
  if ((process.env.STORAGE_DRIVER ?? 'local').toLowerCase() === 'local') {
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
      prefix: '/uploads/',
    });
  }

  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });

  // WebSocket CORS (환경변수 기반 동적 설정)
  app.useWebSocketAdapter(new CorsIoAdapter(app));

  // ALB / 프록시 뒤에서 실제 클라 IP 인식 (throttler/logging 정확도)
  app.set('trust proxy', 1);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
