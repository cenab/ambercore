import { ServerlessTestHelper } from './helpers/serverless.helper';

declare global {
  var serverlessHelper: ServerlessTestHelper;
}

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Global test timeout
jest.setTimeout(30000);

// Mock compression
jest.mock('compression', () => {
  return jest.fn(() => (req: any, res: any, next: any) => {
    if (req.headers['accept-encoding']?.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
    }
    next();
  });
});

// Mock helmet
jest.mock('helmet', () => {
  return jest.fn(() => (req: any, res: any, next: any) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
  });
});

// Mock express
jest.mock('express', () => {
  const originalExpress = jest.requireActual('express');
  const app = originalExpress();

  // Add custom middleware for testing
  app.use((req: any, res: any, next: any) => {
    // Handle test delay header
    if (req.headers['x-test-delay']) {
      const delay = parseInt(req.headers['x-test-delay'], 10);
      setTimeout(next, delay);
      return;
    }
    next();
  });

  const mockExpress = () => app;
  mockExpress.json = originalExpress.json;
  mockExpress.urlencoded = originalExpress.urlencoded;
  mockExpress.static = originalExpress.static;

  return mockExpress;
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