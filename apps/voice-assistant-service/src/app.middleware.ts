import { MiddlewareConsumer, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query } = req;
    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl}`);
    if (Object.keys(query || {}).length > 0) {
      console.log('Query:', JSON.stringify(query, null, 2));
    }
    next();
  }
}
