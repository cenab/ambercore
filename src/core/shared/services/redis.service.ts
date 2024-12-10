import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL is required');
    }

    try {
      const url = new URL(redisUrl);
      const [username, password] = (url.username && url.password) 
        ? [url.username, url.password] 
        : ['default', url.pathname.slice(1)];

      this.client = new Redis({
        host: url.hostname,
        port: Number(url.port) || 6379,
        username,
        password,
        tls: {
          rejectUnauthorized: false,
          servername: url.hostname
        },
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableReadyCheck: false,
        stringNumbers: true,
        enableOfflineQueue: false,
        connectTimeout: 20000,
        commandTimeout: 60000,
        keepAlive: 30000,
        noDelay: true,
        db: 0
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected');
      });

      this.client.on('error', (error) => {
        this.logger.error(`Redis error: ${error.message}`);
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis reconnecting...');
      });

      this.client.on('ready', () => {
        this.logger.log('Redis ready');
      });

      this.client.on('end', () => {
        this.logger.warn('Redis connection ended');
      });

    } catch (error) {
      this.logger.error(`Redis initialization error: ${error.message}`);
      throw error;
    }

    return Promise.resolve();
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch (error) {
      this.logger.error(`Redis disconnect error: ${error.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis set error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Redis del error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Redis keys error for pattern ${pattern}: ${error.message}`);
      return [];
    }
  }

  isReady(): boolean {
    return this.client?.status === 'ready';
  }
} 