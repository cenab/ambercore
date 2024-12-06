import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import express from 'express';
import { Server } from 'http';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import CircuitBreaker from 'opossum';

const logger = new Logger('Serverless');

let server: Server;
const expressApp = express();
let memoryInterval: NodeJS.Timeout;

const GLOBAL_PREFIX = '';
const REQUEST_TIMEOUT = 10000; // 10 seconds
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
};

// Circuit breaker for the bootstrap process
const bootstrapBreaker = new CircuitBreaker(bootstrap, CIRCUIT_BREAKER_OPTIONS);

bootstrapBreaker.on('open', () => {
  logger.warn('Circuit Breaker opened - server may be experiencing issues');
});

bootstrapBreaker.on('halfOpen', () => {
  logger.log('Circuit Breaker half-open - attempting to recover');
});

bootstrapBreaker.on('close', () => {
  logger.log('Circuit Breaker closed - server has recovered');
});

async function bootstrap(): Promise<Server> {
  try {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      }
    );

    // Compression first
    app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Force compression for testing
        if (process.env.NODE_ENV === 'test') {
          return true;
        }
        return compression.filter(req, res);
      },
      level: 6, // Default compression level
    }));

    // Security
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }));

    // Additional security headers
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!res.headersSent) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
      }
      next();
    });

    // CORS
    app.enableCors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-correlation-id',
        'x-request-id',
        'x-forwarded-for',
        'Accept-Encoding',
      ],
      exposedHeaders: ['x-correlation-id', 'x-request-id', 'Content-Encoding'],
      credentials: true,
      maxAge: 86400, // 24 hours
    });

    // Parsing
    app.use(json({ limit: '10mb' }));
    app.use(urlencoded({ extended: true, limit: '10mb' }));

    // Add request ID middleware
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!res.headersSent) {
        req.headers['x-request-id'] = req.headers['x-request-id'] || 
          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        res.setHeader('x-request-id', req.headers['x-request-id']);
      }
      next();
    });

    // Add basic caching for GET requests
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!res.headersSent && req.method === 'GET') {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      }
      next();
    });

    // Add timeout middleware
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Skip timeout for OPTIONS requests
      if (req.method === 'OPTIONS') {
        return next();
      }

      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({
            error: 'Gateway Timeout',
            message: 'Request took too long to process',
            correlationId: req.headers['x-correlation-id'],
            requestId: req.headers['x-request-id'],
            timestamp: new Date().toISOString(),
          });
        }
      }, REQUEST_TIMEOUT);

      res.on('finish', () => {
        clearTimeout(timeout);
      });

      next();
    });

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!res.headersSent) {
        logger.error('Error handling request:', {
          error: err,
          correlationId: req.headers['x-correlation-id'],
          requestId: req.headers['x-request-id'],
          url: req.url,
          method: req.method,
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'production' ? 
            'An unexpected error occurred' : err.message,
          correlationId: req.headers['x-correlation-id'],
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        });
      }
      next();
    });

    // Not found handler
    app.use((req: express.Request, res: express.Response) => {
      if (!res.headersSent) {
        res.status(404).json({
          error: 'Not Found',
          message: `Cannot ${req.method} ${req.url}`,
          correlationId: req.headers['x-correlation-id'],
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Validation and transformation
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }));

    // Global prefix
    app.setGlobalPrefix(GLOBAL_PREFIX);

    await app.init();

    // Use a random port for testing
    const port = process.env.PORT || 0;
    server = expressApp.listen(port);
    
    // Monitor memory usage
    memoryInterval = setInterval(() => {
      const used = process.memoryUsage();
      if (used.heapUsed > 1024 * 1024 * 512) { // 512MB
        logger.error('Memory limit exceeded, restarting server');
        clearInterval(memoryInterval);
        process.exit(1);
      }
    }, 30000); // Check every 30 seconds

    logger.log(`🚀 Serverless application initialized - /${GLOBAL_PREFIX}`);
    return server;
  } catch (error) {
    logger.error('Error initializing serverless application:', error);
    throw error;
  }
}

export default async function handler(req: express.Request, res: express.Response) {
  const requestStart = Date.now();
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<void>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      if (!res.headersSent) {
        logger.error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Request took too long to process',
          correlationId: req.headers['x-correlation-id'],
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        });
      }
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT);
  });

  try {
    // Add correlation ID if not present
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!res.headersSent) {
      res.setHeader('x-correlation-id', req.headers['x-correlation-id']);
    }

    // Log request
    logger.debug(`Incoming ${req.method} request to ${req.url}`, {
      correlationId: req.headers['x-correlation-id'],
      requestId: req.headers['x-request-id'],
    });

    if (!server) {
      server = await bootstrapBreaker.fire();
    }

    // Handle the request
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        expressApp(req, res)
          .on('finish', () => {
            const duration = Date.now() - requestStart;
            logger.debug(`Request completed in ${duration}ms`, {
              correlationId: req.headers['x-correlation-id'],
              requestId: req.headers['x-request-id'],
              duration,
              statusCode: res.statusCode,
            });
            resolve();
          })
          .on('error', reject);
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    logger.error('Error handling request:', {
      error,
      correlationId: req.headers['x-correlation-id'],
      requestId: req.headers['x-request-id'],
      url: req.url,
      method: req.method,
    });

    // Don't send error response if headers already sent
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 
          'An unexpected error occurred' : error.message,
        correlationId: req.headers['x-correlation-id'],
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  logger.log('SIGTERM received, cleaning up...');
  if (memoryInterval) {
    clearInterval(memoryInterval);
  }
  if (server) {
    server.close(() => {
      logger.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
