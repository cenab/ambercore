import { Controller, Get } from '@nestjs/common';

interface HealthCheck {
  status: string;
  timestamp: string;
  environment: string;
}

@Controller('health')
export class HealthController {
  @Get()
  healthCheck(): HealthCheck {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
