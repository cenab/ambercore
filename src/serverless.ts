import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AllExceptionsFilter } from './middleware/error.middleware';

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

    // Apply global error filter
    app.useGlobalFilters(new AllExceptionsFilter());

    // Enable CORS
    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

export default async function handler(req, res) {
  try {
    const app = await bootstrap();
    const expressApp = app.getHttpAdapter().getInstance();
    return expressApp(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
