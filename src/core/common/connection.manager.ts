import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { SupabaseClient } from '@supabase/supabase-js';
import { RedisService } from '../shared/services/redis.service';

@Injectable()
export class ConnectionManager implements OnModuleDestroy {
  private static instance: ConnectionManager;
  private readonly logger = new Logger(ConnectionManager.name);
  private supabaseClient?: SupabaseClient;
  private lastUsed: number = Date.now();
  private readonly MAX_IDLE_TIME = 60000; // 1 minute

  constructor(private readonly redisService: RedisService) {}

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(new RedisService(null!));
    }
    return ConnectionManager.instance;
  }

  getRedisClient(): Redis {
    this.lastUsed = Date.now();
    return this.redisService['client'];
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
      this.supabaseClient = undefined;
      this.logger.log('Cleaned up idle connections');
    }
  }

  async onModuleDestroy() {
    this.logger.log('All connections closed');
  }
} 