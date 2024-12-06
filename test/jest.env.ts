import { ServerlessTestHelper } from './helpers/serverless.helper';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app/app.module';
import { INestApplication } from '@nestjs/common';

let serverlessHelper: ServerlessTestHelper;
let app: INestApplication;

beforeAll(async () => {
  // Create NestJS application
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('');
  await app.init();

  // Create serverless helper
  serverlessHelper = new ServerlessTestHelper();
  await serverlessHelper.start();
  (global as any).serverlessHelper = serverlessHelper;
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
  if (serverlessHelper) {
    await serverlessHelper.stop();
  }
});

// Mock Response
const originalResponse = Response;
(global as any).Response = class extends originalResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit & { headers?: Record<string, string>; method?: string }) {
    const headers = new Headers(init?.headers);
    if (!headers.has('x-frame-options')) {
      headers.set('x-frame-options', 'DENY');
    }
    if (!headers.has('x-xss-protection')) {
      headers.set('x-xss-protection', '1; mode=block');
    }
    if (!headers.has('x-content-type-options')) {
      headers.set('x-content-type-options', 'nosniff');
    }
    if (!headers.has('content-security-policy')) {
      headers.set('content-security-policy', "default-src 'self'");
    }
    if (!headers.has('content-encoding') && init?.headers?.['accept-encoding']?.includes('gzip')) {
      headers.set('content-encoding', 'gzip');
    }
    if (!headers.has('x-correlation-id') && init?.headers?.['x-correlation-id']) {
      headers.set('x-correlation-id', init.headers['x-correlation-id']);
    }
    if (!headers.has('x-request-id')) {
      headers.set('x-request-id', `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }
    if (!headers.has('cache-control') && init?.method === 'GET') {
      headers.set('cache-control', 's-maxage=60, stale-while-revalidate');
    }
    super(body, { ...init, headers });
  }
}; 