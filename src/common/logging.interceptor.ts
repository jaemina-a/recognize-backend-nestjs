import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * 요청 로그: METHOD URL STATUS DURATIONms
 * /health 는 시끄러우니 제외.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = req;

    if (originalUrl === '/health') return next.handle();

    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - startedAt;
          this.logger.log(`${method} ${originalUrl} ${res.statusCode} ${ms}ms`);
        },
        error: (err: unknown) => {
          const ms = Date.now() - startedAt;
          const status = (err as { status?: number })?.status ?? 500;
          this.logger.warn(
            `${method} ${originalUrl} ${status} ${ms}ms — ${(err as { message?: string })?.message ?? 'error'}`,
          );
        },
      }),
    );
  }
}
