import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { ServerlessTestHelper } from './helpers/serverless.helper';

declare global {
  var serverlessHelper: ServerlessTestHelper;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

describe('Serverless Application (e2e)', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
  });

  it('/ (GET)', async () => {
    const response = await global.serverlessHelper.request('/api');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'API is running');
    expect(body).toHaveProperty('timestamp');
  });

  it('handles errors properly', async () => {
    const response = await global.serverlessHelper.request('/api/nonexistent');
    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error).toHaveProperty('error', 'Not Found');
    expect(error).toHaveProperty('timestamp');
    expect(error).toHaveProperty('correlationId');
    expect(error).toHaveProperty('requestId');
  });

  it('respects request timeouts', async () => {
    const response = await global.serverlessHelper.request('/api/slow', {
      headers: {
        'x-test-delay': '11000',
      },
    });
    expect(response.status).toBe(504);
    const error = await response.json();
    expect(error.error).toBe('Gateway Timeout');
  });

  it('handles CORS', async () => {
    const response = await global.serverlessHelper.request('/api', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('includes security headers', async () => {
    const response = await global.serverlessHelper.request('/api');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBeTruthy();
  });

  it('handles compression', async () => {
    const response = await global.serverlessHelper.request('/api', {
      headers: {
        'Accept-Encoding': 'gzip',
      },
    });
    expect(response.headers.get('content-encoding')).toBe('gzip');
  });

  it('includes correlation ID', async () => {
    const correlationId = 'test-correlation-id';
    const response = await global.serverlessHelper.request('/api', {
      headers: {
        'x-correlation-id': correlationId,
      },
    });
    expect(response.headers.get('x-correlation-id')).toBe(correlationId);
  });

  it('generates request ID if not provided', async () => {
    const response = await global.serverlessHelper.request('/api');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('caches GET requests', async () => {
    const response = await global.serverlessHelper.request('/api');
    expect(response.headers.get('cache-control')).toBe('s-maxage=60, stale-while-revalidate');
  });

  it('does not cache non-GET requests', async () => {
    const response = await global.serverlessHelper.request('/api', {
      method: 'POST',
    });
    expect(response.headers.get('cache-control')).toBeFalsy();
  });

  afterAll(async () => {
    // Clean up any resources
  });
});
