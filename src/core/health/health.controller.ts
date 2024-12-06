import { Controller, Get, Logger } from '@nestjs/common';
import { DatabaseService } from '@core/database/database.service';
import { CacheService } from '@core/cache/cache.service';

interface HealthCheck {
  status: string;
  timestamp: string;
  services: {
    database: boolean;
    cache: boolean;
  };
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  async healthCheck(): Promise<HealthCheck> {
    let databaseStatus = false;
    let cacheStatus = false;

    try {
      await this.databaseService.healthCheck();
      databaseStatus = true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
    }

    try {
      await this.cacheService.healthCheck();
      cacheStatus = true;
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
    }

    const isHealthy = databaseStatus && cacheStatus;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        cache: cacheStatus,
      },
    };
  }
}
