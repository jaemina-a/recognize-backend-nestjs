import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { resolveCorsOrigin } from './cors';

/**
 * WebSocket 게이트웨이용 CORS를 환경변수 기반으로 동적 결정.
 * (데코레이터 정적 cors 옵션 대체)
 */
export class CorsIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const origin = resolveCorsOrigin();
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin,
        credentials: true,
      },
    });
  }
}
