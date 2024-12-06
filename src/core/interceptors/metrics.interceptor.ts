import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  private static readonly requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
  });

  private static readonly requestDurationHistogram = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  private static readonly requestSizeHistogram = new Histogram({
    name: 'http_request_size_bytes',
    help: 'HTTP request size in bytes',
    labelNames: ['method', 'path'],
    buckets: [100, 1000, 5000, 10000, 50000, 100000],
  });

  private static readonly responseSizeHistogram = new Histogram({
    name: 'http_response_size_bytes',
    help: 'HTTP response size in bytes',
    labelNames: ['method', 'path', 'status'],
    buckets: [100, 1000, 5000, 10000, 50000, 100000],
  });

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url } = request;
    const startTime = process.hrtime();

    // Record request size
    const requestSize = request.headers['content-length'] 
      ? parseInt(request.headers['content-length'], 10)
      : 0;
    
    MetricsInterceptor.requestSizeHistogram
      .labels(method, url)
      .observe(requestSize);

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          this.recordMetrics(method, url, response.statusCode, startTime, data);
        },
        error: (error: any) => {
          this.recordMetrics(
            method,
            url,
            error.status || 500,
            startTime,
            error.response,
          );
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    url: string,
    statusCode: number,
    startTime: [number, number],
    data: any,
  ): void {
    // Record request count
    MetricsInterceptor.requestCounter
      .labels(method, url, statusCode.toString())
      .inc();

    // Record duration
    const duration = this.getDurationInSeconds(startTime);
    MetricsInterceptor.requestDurationHistogram
      .labels(method, url, statusCode.toString())
      .observe(duration);

    // Record response size
    const responseSize = this.getResponseSize(data);
    MetricsInterceptor.responseSizeHistogram
      .labels(method, url, statusCode.toString())
      .observe(responseSize);

    // Log request details
    this.logger.debug(
      `Request completed: ${method} ${url}`,
      {
        method,
        url,
        statusCode,
        duration: `${duration.toFixed(3)}s`,
        requestSize: `${this.formatBytes(responseSize)}`,
        responseSize: `${this.formatBytes(responseSize)}`,
      },
    );
  }

  private getDurationInSeconds(startTime: [number, number]): number {
    const diff = process.hrtime(startTime);
    return diff[0] + diff[1] / 1e9;
  }

  private getResponseSize(data: any): number {
    if (!data) return 0;
    if (typeof data === 'string') return data.length;
    return Buffer.byteLength(JSON.stringify(data));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
} 