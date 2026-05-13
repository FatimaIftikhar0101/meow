import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const id =
      incoming && /^[a-zA-Z0-9_-]{8,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    (req as Request & { id: string }).id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
