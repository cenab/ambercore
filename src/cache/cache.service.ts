import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private redis: Redis | null = null;
  private connecting = false;

  private async getClient() {
    if (this.redis) return this.redis;
    if (this.connecting) {
      while (this.connecting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return this.redis;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined');
    }

    this.connecting = true;
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 500,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 1000);
        },
        reconnectOnError: (err) => {
          return err.message.includes('READONLY');
        },
        lazyConnect: true,
      });

      this.redis.on('error', (error) => {
        console.warn('Redis connection error:', error.message);
      });

      await this.redis.connect();
      return this.redis;
    } catch (error) {
      console.error('Redis initialization error:', error);
      return null;
    } finally {
      this.connecting = false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      if (!client) return null;
      return await client.get(key);
    } catch (error) {
      console.error('Redis get error:', error.message);
      return null;
    }
  }

  async set(key: string, value: string, ttl = 60): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;
      await client.set(key, value, 'EX', ttl);
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;
      await client.del(key);
    } catch (error) {
      console.error('Redis del error:', error.message);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.error('Redis quit error:', error.message);
      }
      this.redis = null;
    }
  }
}
