import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConnectionManager } from '../common/connection.manager';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private static pool: SupabaseClient | null = null;
  private static connectionCount = 0;
  private static readonly MAX_CONNECTIONS = 10;
  private static readonly CONNECTION_TIMEOUT = 5000;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async cleanup() {
    try {
      if (DatabaseService.pool) {
        // Just nullify the pool since Supabase client doesn't need explicit cleanup
        DatabaseService.pool = null;
        DatabaseService.connectionCount = 0;
        this.logger.log('Database connections cleaned up');
      }
    } catch (error) {
      this.logger.error('Error cleaning up database connections:', error);
    }
  }

  async getClient(): Promise<SupabaseClient> {
    try {
      if (!DatabaseService.pool) {
        const startTime = Date.now();
        
        // Create new client with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Database connection timeout'));
          }, DatabaseService.CONNECTION_TIMEOUT);
        });

        const connectionPromise = this.createNewClient();
        DatabaseService.pool = await Promise.race([connectionPromise, timeoutPromise]);

        const duration = Date.now() - startTime;
        this.logger.log(`Database connection established in ${duration}ms`);
      }

      DatabaseService.connectionCount++;
      if (DatabaseService.connectionCount > DatabaseService.MAX_CONNECTIONS) {
        this.logger.warn(`High connection count: ${DatabaseService.connectionCount}`);
      }

      return DatabaseService.pool;
    } catch (error) {
      this.logger.error('Failed to get database client:', error);
      throw error;
    }
  }

  private async createNewClient(): Promise<SupabaseClient> {
    const client = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-connection-id': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        },
      }
    );

    return client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const startTime = Date.now();
      const { data, error } = await client.auth.getSession();
      const duration = Date.now() - startTime;

      if (error) {
        this.logger.error('Database health check failed:', error);
        return false;
      }

      this.logger.debug(`Health check completed in ${duration}ms`);
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  async releaseConnection() {
    if (DatabaseService.connectionCount > 0) {
      DatabaseService.connectionCount--;
    }

    if (DatabaseService.connectionCount === 0 && DatabaseService.pool) {
      await this.cleanup();
    }
  }
}
