import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';

interface HealthCheck {
  status: string;
  timestamp: string;
  services: {
    database: boolean;
    cache: boolean;
  };
}

@Controller()
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  async healthCheck(): Promise<HealthCheck> {
    let databaseStatus = false;
    let cacheStatus = false;

    try {
      const { data, error } = await this.databaseService.getSupabaseClient().auth.getSession();
      databaseStatus = !error;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    try {
      cacheStatus = await this.cacheService.isHealthy();
    } catch (error) {
      console.error('Cache health check failed:', error);
    }

    return {
      status: databaseStatus && cacheStatus ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        cache: cacheStatus,
      },
    };
  }
}
