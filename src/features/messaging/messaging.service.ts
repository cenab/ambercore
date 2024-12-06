import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class MessagingService implements OnModuleDestroy {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly logger = new Logger(MessagingService.name);
  private readonly subscriptions = new Map<string, (message: any) => Promise<void>>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('Redis URL is not properly configured');
    }

    // Create separate connections for pub/sub
    this.publisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      enableReadyCheck: false,
    });

    this.subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      enableReadyCheck: false,
    });

    this.setupSubscriber();
  }

  private setupSubscriber() {
    this.subscriber.on('message', (channel: string, message: string) => {
      const handler = this.subscriptions.get(channel);
      if (handler) {
        try {
          const data = JSON.parse(message);
          handler(data).catch(error => {
            this.logger.error(`Error processing message on channel ${channel}: ${error.message}`);
          });
        } catch (error) {
          this.logger.error(`Error parsing message on channel ${channel}: ${error.message}`);
        }
      }
    });

    this.subscriber.on('error', (error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`);
    });

    this.publisher.on('error', (error) => {
      this.logger.error(`Redis publisher error: ${error.message}`);
    });
  }

  async publish<T>(channel: string, message: T): Promise<void> {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      this.logger.debug(`Message published to channel ${channel}`);
    } catch (error) {
      this.logger.error(`Error publishing message to channel ${channel}: ${error.message}`);
      throw error;
    }
  }

  async subscribe<T>(channel: string, handler: (message: T) => Promise<void>): Promise<void> {
    try {
      this.subscriptions.set(channel, handler);
      await this.subscriber.subscribe(channel);
      this.logger.log(`Subscribed to channel ${channel}`);
    } catch (error) {
      this.logger.error(`Error subscribing to channel ${channel}: ${error.message}`);
      throw error;
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
      this.logger.log(`Unsubscribed from channel ${channel}`);
    } catch (error) {
      this.logger.error(`Error unsubscribing from channel ${channel}: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.subscriber.quit();
      await this.publisher.quit();
      this.logger.log('Redis pub/sub connections closed');
    } catch (error) {
      this.logger.error(`Error closing Redis pub/sub connections: ${error.message}`);
    }
  }
} 