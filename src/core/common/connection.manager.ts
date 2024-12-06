import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ConnectionManager implements OnModuleDestroy {
  private static instance: ConnectionManager;
  private readonly logger = new Logger(ConnectionManager.name);
  private redisClient?: Redis;
  private supabaseClient?: SupabaseClient;
  private lastUsed: number = Date.now();
  private readonly MAX_IDLE_TIME = 60000; // 1 minute

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  async getRedisClient(url: string): Promise<Redis> {
    this.lastUsed = Date.now();
    if (!this.redisClient) {
      this.redisClient = new Redis(url, {
        maxRetriesPerRequest: 3,
        connectTimeout: 1000,
        disconnectTimeout: 2000,
      });
    }
    return this.redisClient;
  }

  async getSupabaseClient(client: SupabaseClient): Promise<SupabaseClient> {
    this.lastUsed = Date.now();
    if (!this.supabaseClient) {
      this.supabaseClient = client;
    }
    return this.supabaseClient;
  }

  private async cleanup() {
    const now = Date.now();
    if (now - this.lastUsed > this.MAX_IDLE_TIME) {
      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = undefined;
      }
      this.supabaseClient = undefined;
      this.logger.log('Cleaned up idle connections');
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.logger.log('All connections closed');
  }
} 