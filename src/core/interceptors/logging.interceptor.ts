import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers, query, params } = request;
    const correlationId = headers['x-correlation-id'] || uuidv4();
    const requestId = headers['x-request-id'] || uuidv4();
    const userAgent = headers['user-agent'];
    const ip = headers['x-forwarded-for'] || request.ip;
    const startTime = process.hrtime();

    // Log request
    this.logger.debug(
      `Incoming request: ${method} ${url}`,
      {
        correlationId,
        requestId,
        method,
        url,
        userAgent,
        ip,
        query,
        params,
        body: this.sanitizeBody(body),
        timestamp: new Date().toISOString(),
      },
    );

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const duration = this.getDurationInSeconds(startTime);
          
          // Log successful response
          this.logger.debug(
            `Request completed successfully: ${method} ${url}`,
            {
              correlationId,
              requestId,
              method,
              url,
              duration: `${duration.toFixed(3)}s`,
              response: this.sanitizeResponse(data),
              timestamp: new Date().toISOString(),
            },
          );
        },
        error: (error: any) => {
          const duration = this.getDurationInSeconds(startTime);

          // Log error response
          this.logger.error(
            `Request failed: ${method} ${url}`,
            {
              correlationId,
              requestId,
              method,
              url,
              duration: `${duration.toFixed(3)}s`,
              error: {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
                code: error.code,
                status: error.status,
              },
              timestamp: new Date().toISOString(),
            },
          );
        },
      }),
    );
  }

  private getDurationInSeconds(startTime: [number, number]): number {
    const diff = process.hrtime(startTime);
    return diff[0] + diff[1] / 1e9;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }

  private sanitizeResponse(data: any): any {
    if (!data) return data;

    // If data is too large, truncate it
    const maxSize = 10000; // 10KB
    const stringified = JSON.stringify(data);
    if (stringified.length > maxSize) {
      return {
        _truncated: true,
        _originalSize: stringified.length,
        _preview: stringified.substring(0, maxSize) + '...',
      };
    }

    return data;
  }
} 