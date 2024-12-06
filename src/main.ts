import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let app;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, {
      cors: true,
      logger: ['error', 'warn'],
      bufferLogs: true,
    });

    const initPromises = [];
    await Promise.all(initPromises);

    await app.init();
  }

  return app.getHttpAdapter().getInstance();
}

export default bootstrap;
