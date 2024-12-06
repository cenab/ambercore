import { Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export abstract class RedisStorage {
  protected readonly logger: Logger;

  constructor(protected readonly cacheService: CacheService) {
    this.logger = new Logger(this.constructor.name);
  }

  protected async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheService.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get value for key ${key}:`, error);
      return null;
    }
  }

  protected async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheService.set(
        key,
        JSON.stringify(value),
        ttl,
      );
    } catch (error) {
      this.logger.error(`Failed to set value for key ${key}:`, error);
      throw error;
    }
  }

  protected async delete(key: string): Promise<void> {
    try {
      await this.cacheService.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  protected async list<T>(pattern: string): Promise<T[]> {
    try {
      const keys = await this.cacheService.keys(pattern);
      if (!keys.length) return [];

      const values = await this.cacheService.mget(...keys);
      return values
        .filter((value): value is string => value !== null)
        .map(value => JSON.parse(value));
    } catch (error) {
      this.logger.error(`Failed to list keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  protected async exists(key: string): Promise<boolean> {
    try {
      return await this.cacheService.exists(key);
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  protected async publish(channel: string, message: any): Promise<void> {
    try {
      await this.cacheService.publish(
        channel,
        typeof message === 'string' ? message : JSON.stringify(message),
      );
    } catch (error) {
      this.logger.error(`Failed to publish message to channel ${channel}:`, error);
      throw error;
    }
  }

  protected async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.cacheService.subscribe(channel, callback);
    } catch (error) {
      this.logger.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }

  protected async unsubscribe(channel: string): Promise<void> {
    try {
      await this.cacheService.unsubscribe(channel);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from channel ${channel}:`, error);
      throw error;
    }
  }

  protected async increment(key: string, value = 1): Promise<number> {
    try {
      return await this.cacheService.incr(key, value);
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error);
      throw error;
    }
  }

  protected async decrement(key: string, value = 1): Promise<number> {
    try {
      return await this.cacheService.decr(key, value);
    } catch (error) {
      this.logger.error(`Failed to decrement key ${key}:`, error);
      throw error;
    }
  }

  protected async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.cacheService.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Failed to set expiry for key ${key}:`, error);
      throw error;
    }
  }
} 