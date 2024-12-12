import { Injectable } from '@nestjs/common';
import { RedisStorage } from '../common/redis.storage';
import { RedisService } from '../shared/services/redis.service';

export interface Metric {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
}

@Injectable()
export class MetricsService extends RedisStorage<Metric> {
  private readonly METRICS_PREFIX = 'metrics:';
  private readonly METRICS_TTL = 86400; // 24 hours

  constructor(redisService: RedisService) {
    super(redisService);
  }

  async recordMetric(metric: Omit<Metric, 'timestamp'>): Promise<boolean> {
    const fullMetric: Metric = {
      ...metric,
      timestamp: new Date().toISOString(),
    };

    return this.set(
      this.getMetricKey(metric.name),
      fullMetric,
      this.METRICS_TTL
    );
  }

  async getMetrics(): Promise<Metric[]> {
    return this.getAll(`${this.METRICS_PREFIX}*`);
  }

  private getMetricKey(name: string): string {
    return `${this.METRICS_PREFIX}${name}`;
  }
}
