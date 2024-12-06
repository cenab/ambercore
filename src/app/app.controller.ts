import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api')
  getApi(): { message: string; timestamp: string } {
    return {
      message: 'API is running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api/slow')
  async getSlowApi(): Promise<{ message: string; timestamp: string }> {
    await new Promise(resolve => setTimeout(resolve, 11000)); // Longer than timeout
    return {
      message: 'This should timeout',
      timestamp: new Date().toISOString(),
    };
  }
}
