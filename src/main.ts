import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Registry } from 'prom-client';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Metrics endpoint
  const registry = new Registry();
  app.getHttpAdapter().get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default bootstrap;
