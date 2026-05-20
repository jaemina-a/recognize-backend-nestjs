import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { PhotosModule } from './photos/photos.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';

@Module({
  imports: [
    // 1. 환경 변수 로드 (.env 파일)
    ConfigModule.forRoot({
      isGlobal: true, // 모든 모듈에서 ConfigService 사용 가능
      envFilePath: `.env${process.env.NODE_ENV === 'production' ? '.production' : ''}`,
    }),

    // 2. TypeORM 데이터베이스 연결
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        // 운영에서는 반드시 false. 스키마 변경은 마이그레이션으로 관리.
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        migrations: [__dirname + '/migrations/*.{js,ts}'],
        // 부팅 시 자동 마이그레이션 실행 (DB_MIGRATIONS_RUN=true 일 때)
        migrationsRun:
          configService.get<string>('DB_MIGRATIONS_RUN') === 'true',
        logging: configService.get<string>('DB_LOGGING') === 'true',
        // RDS 등 SSL 강제 환경에서 DB_SSL=true 로 설정
        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    UsersModule,
    AuthModule,
    RoomsModule,
    StorageModule,
    PhotosModule,
    ChatModule,
    // Rate limit: 1분당 100req (기본). 라우트별 @Throttle 로 강화 가능.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
