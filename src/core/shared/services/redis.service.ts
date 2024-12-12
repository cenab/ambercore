import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      this.client = new Redis({
        url: this.configService.getOrThrow('UPSTASH_REDIS_REST_URL'),
        token: this.configService.getOrThrow('UPSTASH_REDIS_REST_TOKEN'),
      });

      this.logger.log('Redis client initialized');
    } catch (error) {
      this.logger.error(`Redis initialization error: ${error.message}`);
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, { ex: ttlSeconds });
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
      const keys = await this.client.keys(pattern);
      return Array.isArray(keys) ? keys : [];
    } catch (error) {
      this.logger.error(`Redis keys error for pattern ${pattern}: ${error.message}`);
      return [];
    }
  }

  async hset(key: string, value: Record<string, any>): Promise<boolean> {
    try {
      await this.client.hset(key, value);
      return true;
    } catch (error) {
      this.logger.error(`Redis hset error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async hget(key: string, field: string): Promise<any> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      this.logger.error(`Redis hget error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async zadd(key: string, score: number, member: string): Promise<boolean> {
    try {
      await this.client.zadd(key, { score, member });
      return true;
    } catch (error) {
      this.logger.error(`Redis zadd error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Redis zrange error for key ${key}: ${error.message}`);
      return [];
    }
  }

  async lpush(key: string, value: string): Promise<boolean> {
    try {
      await this.client.lpush(key, value);
      return true;
    } catch (error) {
      this.logger.error(`Redis lpush error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Redis lrange error for key ${key}: ${error.message}`);
      return [];
    }
  }

  async sadd(key: string, member: string): Promise<boolean> {
    try {
      await this.client.sadd(key, member);
      return true;
    } catch (error) {
      this.logger.error(`Redis sadd error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async spop(key: string, count: number = 1): Promise<string | string[] | null> {
    try {
      return await this.client.spop(key, count);
    } catch (error) {
      this.logger.error(`Redis spop error for key ${key}: ${error.message}`);
      return null;
    }
  }
} 