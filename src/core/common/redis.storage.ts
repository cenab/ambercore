import { Injectable } from '@nestjs/common';
import { RedisService } from '../shared/services/redis.service';

@Injectable()
export abstract class RedisStorage<T> {
  constructor(protected readonly redisService: RedisService) {}

  protected async get(key: string): Promise<T | null> {
    try {
      const value = await this.redisService.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  protected async set(
    key: string,
    value: T,
    ttl?: number
  ): Promise<boolean> {
    try {
      return await this.redisService.set(
        key,
        JSON.stringify(value),
        ttl
      );
    } catch {
      return false;
    }
  }

  protected async delete(key: string): Promise<boolean> {
    try {
      return await this.redisService.del(key);
    } catch {
      return false;
    }
  }

  protected async getAll(pattern: string): Promise<T[]> {
    try {
      const keys = await this.redisService.keys(pattern);
      if (keys.length === 0) return [];

      const values = await Promise.all(
        keys.map(key => this.redisService.get(key))
      );

      return values
        .filter((value: unknown): value is string => value !== null)
        .map(value => JSON.parse(value));
    } catch {
      return [];
    }
  }

  protected async exists(key: string): Promise<boolean> {
    try {
      const value = await this.redisService.get(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  protected async publish(
    channel: string,
    message: string
  ): Promise<boolean> {
    try {
      await this.redisService.lpush(channel, message);
      return true;
    } catch {
      return false;
    }
  }

  protected async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    // Note: For real-time subscriptions, consider using Pusher instead
    // This is a basic implementation using polling
    setInterval(async () => {
      const messages = await this.redisService.lrange(channel, 0, -1);
      messages.forEach(callback);
    }, 1000);
  }

  protected async unsubscribe(channel: string): Promise<void> {
    // Cleanup if needed
  }

  protected async increment(
    key: string,
    value: number = 1
  ): Promise<number | null> {
    try {
      const current = await this.redisService.get(key);
      const newValue = (parseInt(current as string || '0', 10) || 0) + value;
      await this.redisService.set(key, newValue.toString());
      return newValue;
    } catch {
      return null;
    }
  }

  protected async decrement(
    key: string,
    value: number = 1
  ): Promise<number | null> {
    return this.increment(key, -value);
  }

  protected async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const value = await this.redisService.get(key);
      if (value === null) return false;
      return await this.redisService.set(key, value, seconds);
    } catch {
      return false;
    }
  }
} 