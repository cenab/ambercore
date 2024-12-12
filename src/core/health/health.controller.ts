import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../shared/services/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: await this.checkRedis(),
      }
    };

    const hasFailures = Object.values(checks.services).some(
      status => status !== 'healthy'
    );

    return {
      ...checks,
      status: hasFailures ? 'error' : 'ok'
    };
  }

  private async checkRedis(): Promise<string> {
    try {
      const testKey = 'health:test';
      await this.redisService.set(testKey, 'test', 5);
      const value = await this.redisService.get(testKey);
      return value === 'test' ? 'healthy' : 'unhealthy';
    } catch (error) {
      return 'unhealthy';
    }
  }
}
