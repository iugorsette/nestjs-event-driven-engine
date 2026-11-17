import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { RequestContext } from './request-context';
import { StructuredLogger } from './structured-logger';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLogger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = performance.now();
    response.setHeader('x-request-id', requestId);

    RequestContext.run(requestId, () => {
      this.logger.log(
        { event: 'http.request.started', method: request.method },
        RequestContextMiddleware.name,
      );

      response.once('finish', () => {
        this.logger.log(
          {
            event: 'http.request.completed',
            method: request.method,
            statusCode: response.statusCode,
            durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          },
          RequestContextMiddleware.name,
        );
      });

      next();
    });
  }
}
