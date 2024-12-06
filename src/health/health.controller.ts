import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/')
  healthCheck(): { status: string; timestamp: string; environment: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };
  }
}
