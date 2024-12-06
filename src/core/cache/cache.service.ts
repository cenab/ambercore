import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { ChainableCommander } from 'ioredis';

@Injectable()
export class CacheService {
  protected readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.get('REDIS_URL')!);
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Key operations
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  // Multiple operations
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return this.client.mget(keys);
  }

  async mset(keyValuePairs: Record<string, string>): Promise<void> {
    await this.client.mset(keyValuePairs);
  }

  // Counter operations
  async incr(key: string, value = 1): Promise<number> {
    if (value === 1) {
      return this.client.incr(key);
    }
    return this.client.incrby(key, value);
  }

  async decr(key: string, value = 1): Promise<number> {
    if (value === 1) {
      return this.client.decr(key);
    }
    return this.client.decrby(key, value);
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.client.unsubscribe(channel);
  }

  // Transaction operations
  async multi(): Promise<ChainableCommander> {
    return this.client.multi();
  }

  async exec(pipeline: ChainableCommander): Promise<[Error | null, unknown][]> {
    const results = await pipeline.exec();
    return results || [];
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
