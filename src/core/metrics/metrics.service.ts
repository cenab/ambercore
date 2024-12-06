import { Injectable, OnModuleInit } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import * as promClient from 'prom-client';
import { RedisStorage } from '../common/redis.storage';

interface Metric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
  help?: string;
  type?: string;
}

@Injectable()
export class MetricsService extends RedisStorage implements OnModuleInit {
  private readonly metricsPrefix = 'metrics';
  private readonly register: promClient.Registry;
  
  // Common metrics
  private httpRequestDuration: promClient.Histogram;
  private httpRequestTotal: promClient.Counter;
  private httpRequestErrors: promClient.Counter;
  private cacheHits: promClient.Counter;
  private cacheMisses: promClient.Counter;
  private activeConnections: promClient.Gauge;
  private memoryUsage: promClient.Gauge;

  constructor(cacheService: CacheService) {
    super(cacheService);
    this.register = new promClient.Registry();
    
    // Initialize metrics
    this.initializeMetrics();
  }

  async onModuleInit() {
    // Start collecting default metrics
    promClient.collectDefaultMetrics({ 
      register: this.register,
      prefix: 'app_',
    });

    // Start memory usage collection
    this.startMemoryMetrics();
  }

  private initializeMetrics() {
    // HTTP metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestErrors = new promClient.Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_code'],
    });

    // Cache metrics
    this.cacheHits = new promClient.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
    });

    this.cacheMisses = new promClient.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
    });

    // Connection metrics
    this.activeConnections = new promClient.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
    });

    // Memory metrics
    this.memoryUsage = new promClient.Gauge({
      name: 'memory_usage_bytes',
      help: 'Process memory usage',
      labelNames: ['type'],
    });

    // Register all metrics
    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestTotal);
    this.register.registerMetric(this.httpRequestErrors);
    this.register.registerMetric(this.cacheHits);
    this.register.registerMetric(this.cacheMisses);
    this.register.registerMetric(this.activeConnections);
    this.register.registerMetric(this.memoryUsage);
  }

  private startMemoryMetrics() {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, usage.rss);
      this.memoryUsage.set({ type: 'heapTotal' }, usage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed' }, usage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, usage.external);
    }, 10000); // Update every 10 seconds
  }

  // HTTP metrics
  observeHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    try {
      this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
      this.httpRequestTotal.inc({ method, route, status_code: statusCode });
    } catch (error) {
      this.logger.error('Failed to observe HTTP request:', error);
    }
  }

  recordHttpError(method: string, route: string, errorCode: string) {
    try {
      this.httpRequestErrors.inc({ method, route, error_code: errorCode });
    } catch (error) {
      this.logger.error('Failed to record HTTP error:', error);
    }
  }

  // Cache metrics
  recordCacheHit(type: string) {
    try {
      this.cacheHits.inc({ cache_type: type });
    } catch (error) {
      this.logger.error('Failed to record cache hit:', error);
    }
  }

  recordCacheMiss(type: string) {
    try {
      this.cacheMisses.inc({ cache_type: type });
    } catch (error) {
      this.logger.error('Failed to record cache miss:', error);
    }
  }

  // Connection metrics
  setActiveConnections(type: string, count: number) {
    try {
      this.activeConnections.set({ type }, count);
    } catch (error) {
      this.logger.error('Failed to set active connections:', error);
    }
  }

  // Custom metric recording
  async recordMetric(name: string, value: number, labels: Record<string, string> = {}, help?: string): Promise<void> {
    try {
      if (isNaN(value)) {
        this.logger.error(`Invalid metric value for ${name}: NaN`);
        return;
      }

      const metric: Metric = {
        name,
        value,
        labels,
        help,
        timestamp: Date.now(),
        type: 'gauge',
      };

      const key = `${this.metricsPrefix}:${name}:${JSON.stringify(labels)}`;
      await this.set(key, metric, 300); // TTL of 5 minutes for metrics
    } catch (error) {
      this.logger.error(`Failed to record metric ${name}:`, error);
    }
  }

  async getMetrics(): Promise<string> {
    try {
      const metrics = await this.list<Metric>(`${this.metricsPrefix}:*`);
      
      // Group metrics by name
      const metricGroups = new Map<string, Metric[]>();
      metrics.forEach(metric => {
        if (!metric || !metric.name || typeof metric.value !== 'number') {
          this.logger.error('Invalid metric data:', metric);
          return;
        }

        const group = metricGroups.get(metric.name) || [];
        group.push(metric);
        metricGroups.set(metric.name, group);
      });

      // Update Prometheus metrics
      for (const [name, group] of metricGroups) {
        let gauge = this.register.getSingleMetric(name) as promClient.Gauge<string>;
        if (!gauge) {
          gauge = new promClient.Gauge({
            name,
            help: group[0].help || `${name} metric`,
            labelNames: Object.keys(group[0].labels),
          });
          this.register.registerMetric(gauge);
        }

        // Update all values for this metric
        group.forEach(metric => {
          gauge.set(metric.labels, metric.value);
        });
      }

      return this.register.metrics();
    } catch (error) {
      this.logger.error('Failed to get metrics:', error);
      throw error;
    }
  }

  async cleanupOldMetrics(maxAge: number = 3600000): Promise<void> { // Default 1 hour
    try {
      const metrics = await this.list<Metric>(`${this.metricsPrefix}:*`);
      const now = Date.now();

      for (const metric of metrics) {
        if (now - metric.timestamp > maxAge) {
          const key = `${this.metricsPrefix}:${metric.name}:${JSON.stringify(metric.labels)}`;
          await this.delete(key);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics:', error);
    }
  }
}
