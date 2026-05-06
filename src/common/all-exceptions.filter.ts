import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 전역 예외 필터. 모든 예외를 표준 JSON 포맷으로 반환.
 * - HttpException: 그대로 status + body 사용
 * - 그 외: 500 + 메시지 마스킹 (운영에서는 stack 노출 금지)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    // HTTP 컨텍스트만 처리. WS 등은 기본 동작.
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getResponse() && exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown;
    let error: string | undefined;

    if (isHttp) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = b.message ?? exception.message;
        error = (b.error as string) ?? undefined;
      } else {
        message = exception.message;
      }
    } else {
      const isProd = process.env.NODE_ENV === 'production';
      message = isProd
        ? 'Internal server error'
        : ((exception as Error)?.message ?? 'Unknown');
      error = 'InternalServerError';
      this.logger.error(
        `Unhandled ${req.method} ${req.url}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status as number).json({
      statusCode: status,
      error,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
