import { Controller, Get, All, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @All('*')
  handleNotFound() {
    return {
      statusCode: HttpStatus.NOT_FOUND,
      message: 'The requested path is not available',
      error: 'Not Found',
      timestamp: new Date().toISOString()
    };
  }
}
