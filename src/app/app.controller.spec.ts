import { Test, TestingModule } from '@nestjs/testing';
import { AppController, ApiController } from './app.controller';
import { AppService } from './app.service';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import compression from 'compression';
import helmet from 'helmet';
import { ConfigModule } from '@nestjs/config';
import { HttpExceptionFilter } from '../core/filters/http-exception.filter';

describe('AppController', () => {
  let app: INestApplication;
  let appController: AppController;
  let apiController: ApiController;
  let appService: AppService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          validate: undefined,
          load: [
            () => ({
              NODE_ENV: 'test',
              CORS_ORIGIN: 'http://localhost:3000',
              SUPABASE_URL: 'http://localhost:54321',
              SUPABASE_SERVICE_KEY: 'test-service-key',
              SUPABASE_JWT_SECRET: 'test-jwt-secret',
              REDIS_URL: 'redis://localhost:6379',
              LOG_LEVEL: 'error',
              ENABLE_METRICS: false,
              METRICS_PORT: 9090,
              CIRCUIT_BREAKER_TIMEOUT: 3000,
              CIRCUIT_BREAKER_ERROR_THRESHOLD: 50,
              CIRCUIT_BREAKER_RESET_TIMEOUT: 30000,
              API_TIMEOUT: 10000,
              API_RATE_LIMIT: 100,
              API_RATE_LIMIT_WINDOW: 60000,
              CACHE_TTL: 60,
              CACHE_MAX_ITEMS: 1000,
              JWT_SECRET: 'test-jwt-secret',
              JWT_EXPIRES_IN: '1h',
              COOKIE_SECRET: 'test-cookie-secret',
              TEST_TIMEOUT: 30000,
              TEST_DATABASE_URL: 'postgresql://localhost:5432/test',
            }),
          ],
        }),
      ],
      controllers: [AppController, ApiController],
      providers: [AppService],
    }).compile();

    app = moduleRef.createNestApplication();

    // Add request ID middleware first
    app.use((req: any, res: any, next: any) => {
      const correlationId = req.headers['x-correlation-id'];
      if (correlationId) {
        res.setHeader('x-correlation-id', correlationId);
      }
      req.headers['x-request-id'] = req.headers['x-request-id'] || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('x-request-id', req.headers['x-request-id']);
      next();
    });

    // Add compression middleware
    app.use(compression({
      filter: (req: any, res: any) => {
        if (req.headers['accept-encoding']?.includes('gzip')) {
          return compression.filter(req, res);
        }
        return false;
      },
      threshold: 0
    }));

    // Add security middleware
    app.use(helmet({
      xssFilter: true,
      frameguard: {
        action: 'deny'
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"]
        }
      },
      hidePoweredBy: true,
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' }
    }));

    // Add custom XSS Protection header
    app.use((req: any, res: any, next: any) => {
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Add CORS middleware
    app.enableCors({
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
      exposedHeaders: ['x-correlation-id', 'x-request-id'],
      credentials: true,
    });

    // Add caching middleware
    app.use((req: any, res: any, next: any) => {
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      }
      next();
    });

    // Add global exception filter
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    appController = moduleRef.get<AppController>(AppController);
    apiController = moduleRef.get<ApiController>(ApiController);
    appService = moduleRef.get<AppService>(AppService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  }, 10000);

  describe('root', () => {
    it('should return welcome message', () => {
      const result = appController.getRoot();
      expect(result).toEqual({
        message: 'Welcome to AmberCore API'
      });
    });

    it('should handle GET /', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect({
          message: 'Welcome to AmberCore API'
        });
    });
  });

  describe('api', () => {
    it('should return API status', async () => {
      const result = apiController.getApi();
      expect(result).toHaveProperty('message', 'API is running');
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle GET /api', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'API is running');
          expect(res.body).toHaveProperty('timestamp');
          expect(new Date(res.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    it('should timeout on slow endpoint', async () => {
      jest.setTimeout(20000);
      
      const response = await request(app.getHttpServer())
        .get('/api/slow')
        .expect(504);

      expect(response.body).toMatchObject({
        statusCode: 504,
        error: {
          name: 'HttpException',
          message: 'Request took too long to process'
        },
        timestamp: expect.any(String)
      });
      expect(new Date(response.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    }, 20000);

    it('should handle CORS preflight', () => {
      return request(app.getHttpServer())
        .options('/api')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204)
        .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
        .expect('Access-Control-Allow-Methods', /GET/);
    });

    it('should include security headers', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('X-Frame-Options', 'DENY')
        .expect('X-XSS-Protection', '1; mode=block')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('Content-Security-Policy', /default-src 'self'/);
    });

    it('should handle compression', () => {
      return request(app.getHttpServer())
        .get('/api')
        .set('Accept-Encoding', 'gzip')
        .expect(200)
        .expect('Content-Encoding', 'gzip')
        .expect((res) => {
          expect(res.headers['vary']).toContain('Accept-Encoding');
        });
    });

    it('should include correlation ID', () => {
      const correlationId = 'test-correlation-id';
      return request(app.getHttpServer())
        .get('/api')
        .set('x-correlation-id', correlationId)
        .expect(200)
        .expect('x-correlation-id', correlationId);
    });

    it('should generate request ID if not provided', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res) => {
          expect(res.headers['x-request-id']).toBeDefined();
          expect(res.headers['x-request-id']).toMatch(/^\d+-[a-z0-9]+$/);
        });
    });

    it('should cache GET requests', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('Cache-Control', 's-maxage=60, stale-while-revalidate');
    });

    it('should not cache non-GET requests', () => {
      return request(app.getHttpServer())
        .post('/api')
        .expect(404)
        .expect((res) => {
          expect(res.headers['cache-control']).toBeUndefined();
        });
    });

    it('should handle 404 errors', () => {
      return request(app.getHttpServer())
        .get('/api/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body).toMatchObject({
            statusCode: 404,
            timestamp: expect.any(String),
            path: '/api/nonexistent',
            method: 'GET',
            error: {
              name: 'NotFoundException',
              message: 'Cannot GET /api/nonexistent'
            }
          });
          expect(new Date(res.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
        });
    });
  });
});
