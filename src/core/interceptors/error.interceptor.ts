import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;

    return next.handle().pipe(
      catchError(error => {
        this.logger.error(
          `Request failed: ${method} ${url}`,
          {
            error: error.message,
            stack: error.stack,
            correlationId: headers['x-correlation-id'],
            requestId: headers['x-request-id'],
          },
        );

        // Add request context to error
        error.metadata = {
          timestamp: new Date().toISOString(),
          correlationId: headers['x-correlation-id'],
          requestId: headers['x-request-id'],
          path: url,
          method,
        };

        return throwError(() => error);
      }),
    );
  }
} 