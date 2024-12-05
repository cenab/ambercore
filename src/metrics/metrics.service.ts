import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
  });

  onModuleInit() {
    client.collectDefaultMetrics();
  }

  incrementHttpRequests() {
    this.httpRequestCounter.inc();
  }
}
