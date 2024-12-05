import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Registry } from 'prom-client';
import { AllExceptionsFilter } from './middleware/error.middleware';

let app;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, { cors: true });

    // Global error filter
    app.useGlobalFilters(new AllExceptionsFilter());

    // Metrics endpoint
    const registry = new Registry();
    app.getHttpAdapter().get('/metrics', async (req, res) => {
      res.setHeader('Content-Type', registry.contentType);
      res.send(await registry.metrics());
    });

    await app.init();
  }

  return app.getHttpAdapter().getInstance();
}

export default bootstrap;
