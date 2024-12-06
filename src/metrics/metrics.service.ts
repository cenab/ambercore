import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly httpRequestCounter: client.Counter<string>;
  private readonly httpRequestDuration: client.Histogram<string>;

  constructor() {
    // Create a Registry to register the metrics
    const register = new client.Registry();

    // Create a counter for HTTP requests
    this.httpRequestCounter = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'status'],
    });

    // Create a histogram for request duration
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    // Register the metrics
    register.registerMetric(this.httpRequestCounter);
    register.registerMetric(this.httpRequestDuration);
  }

  onModuleInit() {
    // Enable the collection of default metrics
    client.collectDefaultMetrics();
  }

  // Method to increment the request counter
  incrementHttpRequests(method: string, status: string) {
    this.httpRequestCounter.labels(method, status).inc();
  }

  // Method to observe request duration
  observeHttpRequestDuration(method: string, status: string, duration: number) {
    this.httpRequestDuration.labels(method, status).observe(duration);
  }
}
