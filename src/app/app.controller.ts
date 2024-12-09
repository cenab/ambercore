import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): { message: string } {
    return {
      message: this.appService.getHello()
    };
  }
}

@Controller('api')
export class ApiController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApi(): { message: string; timestamp: string } {
    return {
      message: 'API is running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('slow')
  async getSlowApi(): Promise<{ message: string; timestamp: string }> {
    await new Promise(resolve => setTimeout(resolve, 11000)); // Longer than timeout
    throw new HttpException({
      error: 'Gateway Timeout',
      message: 'Request took too long to process',
      timestamp: new Date().toISOString(),
    }, HttpStatus.GATEWAY_TIMEOUT);
  }
}
