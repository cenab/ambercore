import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      lazyConnect: true, // Don't connect immediately
    });

    this.redis.on('error', (error) => {
      console.warn('Redis connection error:', error.message);
    });
  }

  private async ensureConnection() {
    if (this.redis.status !== 'ready') {
      try {
        await this.redis.connect();
      } catch (error) {
        console.error('Redis connection failed:', error.message);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      return await this.redis.get(key);
    } catch (error) {
      console.error('Redis get error:', error.message);
      return null;
    }
  }

  async set(key: string, value: string, ttl = 60): Promise<void> {
    try {
      await this.ensureConnection();
      await this.redis.set(key, value, 'EX', ttl);
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis del error:', error.message);
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Redis quit error:', error.message);
    }
  }
}
