import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest<Request & { id?: string }>();
    const res = httpCtx.getResponse<Response>();

    if (!req.method) {
      return next.handle();
    }

    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.log(req, res, start),
        error: () => this.log(req, res, start),
      }),
    );
  }

  private log(
    req: Request & { id?: string },
    res: Response,
    start: number,
  ): void {
    const ms = Date.now() - start;
    this.logger.log(
      `[${req.id ?? '-'}] ${req.method} ${req.url} ${res.statusCode} ${ms}ms`,
    );
  }
}
