import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let cachedApp;

async function bootstrap() {
  if (!cachedApp) {
    const adapter = new ExpressAdapter(server);
    const app = await NestFactory.create(AppModule, adapter, {
      cors: true,
      logger: ['error', 'warn'],
      bufferLogs: true,
    });
    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

export default async function handler(req, res) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}
