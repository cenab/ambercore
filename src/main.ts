import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let app;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, { cors: true });
    await app.init();
  }

  return app.getHttpAdapter().getInstance();
}

export default bootstrap;
