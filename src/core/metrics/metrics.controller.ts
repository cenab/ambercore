import { Controller, Get, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as promClient from 'prom-client';

// Initialize metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor() {
    // Add custom metrics here if needed
    const httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });
    register.registerMetric(httpRequestDuration);
  }

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.send(metrics);
    } catch (error) {
      this.logger.error('Failed to get metrics:', error);
      res.status(500).send('Failed to get metrics');
    }
  }
} 