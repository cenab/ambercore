import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('favicon.ico')
  getFavicon(@Res() res: Response) {
    // Return 204 No Content if you don't have a favicon
    res.status(HttpStatus.NO_CONTENT).send();
  }

  @Get('favicon.png')
  getFaviconPng(@Res() res: Response) {
    // Return 204 No Content if you don't have a favicon
    res.status(HttpStatus.NO_CONTENT).send();
  }
}
