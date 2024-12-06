import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { WebhookConfig, WebhookEvent, WebhookSubscription, WebhookHandler, WebhookDeliveryOptions } from './webhook.types';
import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

// Mock logger
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// Mock Logger class
jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(mockLogger.warn);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(mockLogger.debug);
jest.spyOn(Logger.prototype, 'verbose').mockImplementation(mockLogger.verbose);

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock express
jest.mock('express', () => {
  const mockExpressApp = {
    use: jest.fn(),
    post: jest.fn(),
    listen: jest.fn(),
  };

  const mockExpress = jest.fn(() => mockExpressApp) as jest.Mock & { json: jest.Mock };
  mockExpress.json = jest.fn();

  return mockExpress;
});

// Configure test environment
jest.setTimeout(30000);
jest.useFakeTimers();

describe('WebhookService', () => {
  let service: WebhookService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockExpressApp: any;
  let mockExpress: any;

  const createService = (config: Partial<WebhookConfig> = {}) => {
    const defaultConfig: WebhookConfig = {
      secret: 'test-secret',
      path: '/webhooks',
      port: 3000,
      verifySignature: true,
      endpoints: {
        test: 'https://test-endpoint.com/webhook',
      },
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key',
      },
      timeout: 5000,
      retries: 3,
      retryDelay: 1000,
    };

    return new WebhookService({ ...defaultConfig, ...config });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Get express mock
    mockExpress = require('express');
    mockExpressApp = mockExpress();

    // Mock request object
    mockRequest = {
      body: {},
      headers: {},
      method: 'POST',
      path: '/webhooks',
    };

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    // Mock successful fetch response
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })
    );

    service = createService();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    await service.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default config', () => {
      const defaultService = new WebhookService({});
      expect(defaultService).toBeDefined();
    });

    it('should start server when path is configured', async () => {
      await service.onModuleInit();
      expect(mockExpress).toHaveBeenCalled();
      expect(mockExpressApp.use).toHaveBeenCalled();
      expect(mockExpressApp.post).toHaveBeenCalled();
      expect(mockExpressApp.listen).toHaveBeenCalledWith(3000);
    });

    it('should not start server when path is not configured', async () => {
      const noServerService = createService({ path: undefined });
      await noServerService.onModuleInit();
      expect(mockExpressApp.listen).not.toHaveBeenCalled();
    });
  });

  describe('webhook handling', () => {
    it('should handle incoming webhook with valid signature', async () => {
      const payload = { type: 'test', data: { message: 'Hello' } };
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(JSON.stringify(payload))
        .digest('hex');

      mockRequest.body = payload;
      mockRequest.headers = {
        'x-webhook-signature': signature,
      };

      let handlerCalled = false;
      const handler: WebhookHandler = {
        type: 'test',
        handler: async (event) => {
          handlerCalled = true;
          expect(event.data.message).toBe('Hello');
        },
      };

      service.registerHandler(handler);

      // Simulate webhook handling
      const event = mockRequest.body as WebhookEvent;
      await handler.handler(event, mockRequest as Request, mockResponse as Response);

      expect(handlerCalled).toBeTruthy();
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = { type: 'test', data: { message: 'Hello' } };
      const invalidSignature = 'invalid-signature';

      mockRequest.body = payload;
      mockRequest.headers = {
        'x-webhook-signature': invalidSignature,
      };

      const handler: WebhookHandler = {
        type: 'test',
        handler: async () => {
          throw new Error('Should not be called');
        },
      };

      service.registerHandler(handler);
      await service.onModuleInit();

      // Verify signature check fails
      expect(service['verifySignature'](mockRequest as Request)).toBeFalsy();
    });

    it('should handle missing signature header', () => {
      const payload = { type: 'test', data: { message: 'Hello' } };
      mockRequest.body = payload;
      mockRequest.headers = {}; // No signature header

      expect(service['verifySignature'](mockRequest as Request)).toBeFalsy();
    });

    it('should bypass signature verification when disabled', () => {
      const noVerifyService = createService({ verifySignature: false });
      const payload = { type: 'test', data: { message: 'Hello' } };
      mockRequest.body = payload;
      mockRequest.headers = {}; // No signature header

      expect(noVerifyService['verifySignature'](mockRequest as Request)).toBeTruthy();
    });

    it('should handle unregistered event types', async () => {
      const payload = { type: 'unknown', data: { message: 'Hello' } };
      mockRequest.body = payload;

      const handler: WebhookHandler = {
        type: 'test',
        handler: async () => {
          throw new Error('Should not be called');
        },
      };

      service.registerHandler(handler);
      await service.onModuleInit();

      // Verify handler not found
      expect(service['handlers'].get('unknown')).toBeUndefined();
    });
  });

  describe('webhook delivery', () => {
    it('should send webhook successfully', async () => {
      const data = { message: 'Hello' };
      
      const subscription = service.subscribe('https://test-endpoint.com/webhook', ['test']);
      
      const results = await service.send('test', data);
      
      expect(results[0].success).toBeTruthy();
      expect(results[0].statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-endpoint.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
          }),
          body: expect.any(String),
        })
      );
    });

    it('should handle delivery failure and retry', async () => {
      const data = { message: 'Retry Test' };
      
      service.subscribe('https://test-endpoint.com/webhook', ['test']);

      // Mock first two calls to fail, third to succeed
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
        .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          })
        );

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0 as any;
      });

      const results = await service.send('test', data);

      expect(results[0].success).toBeTruthy();
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results[0].retries).toBe(2);
    });

    it('should handle delivery timeout', async () => {
      // Create a new service instance with a short timeout
      service = createService({ timeout: 100 });
      
      const data = { message: 'Timeout Test' };
      service.subscribe('https://test-endpoint.com/webhook', ['test']);

      // Mock fetch to simulate a timeout
      mockFetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });

      const results = await service.send('test', data);

      expect(results[0].success).toBeFalsy();
      expect(results[0].error).toBe('Request timed out');
    });

    it('should handle non-200 responses', async () => {
      const data = { message: 'Error Test' };
      service.subscribe('https://test-endpoint.com/webhook', ['test']);

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ error: 'Not Found' }),
        })
      );

      // Run test
      const results = await service.send('test', data);

      expect(results[0].success).toBeFalsy();
      expect(results[0].error).toBe('HTTP 404: Not Found');
    });

    it('should respect custom delivery options', async () => {
      const data = { message: 'Custom Options Test' };
      service.subscribe('https://test-endpoint.com/webhook', ['test']);

      const options: WebhookDeliveryOptions = {
        timeout: 1000,
        retries: 1,
        retryDelay: 500,
        headers: {
          'Custom-Header': 'test',
        },
      };

      await service.send('test', data, options);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'test',
          }),
        })
      );
    });
  });

  describe('subscription management', () => {
    it('should manage webhook subscriptions', async () => {
      const subscription = service.subscribe('https://test-endpoint.com/webhook', ['test']);
      expect(service.getSubscription(subscription.id)).toEqual(subscription);

      // Update subscription
      const updated = service.updateSubscription(subscription.id, { active: false });
      expect(updated?.active).toBeFalsy();

      // Remove subscription
      service.unsubscribe(subscription.id);
      expect(service.getSubscription(subscription.id)).toBeUndefined();
    });

    it('should deliver webhooks to all active subscriptions', async () => {
      // Add multiple subscriptions
      service.subscribe('https://endpoint1.com/webhook', ['test']);
      service.subscribe('https://endpoint2.com/webhook', ['test']);
      const inactiveSub = service.subscribe('https://endpoint3.com/webhook', ['test']);
      service.updateSubscription(inactiveSub.id, { active: false });

      const data = { message: 'Broadcast Test' };
      const results = await service.send('test', data);

      // Should only deliver to active subscriptions
      expect(results.length).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://endpoint1.com/webhook',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://endpoint2.com/webhook',
        expect.any(Object)
      );
    });

    it('should handle subscription updates for non-existent subscriptions', () => {
      const result = service.updateSubscription('non-existent', { active: false });
      expect(result).toBeUndefined();
    });

    it('should track delivery history', async () => {
      const subscription = service.subscribe('https://test-endpoint.com/webhook', ['test']);
      
      // Successful delivery
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        })
      );

      await service.send('test', { message: 'Success' });
      const afterSuccess = service.getSubscription(subscription.id);
      expect(afterSuccess?.lastDelivery?.success).toBeTruthy();
      expect(afterSuccess?.lastDelivery?.statusCode).toBe(200);

      // Failed delivery
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: 'Server Error' }),
        })
      );

      await service.send('test', { message: 'Failure' });
      const afterFailure = service.getSubscription(subscription.id);
      expect(afterFailure?.lastDelivery?.success).toBeFalsy();
      expect(afterFailure?.lastDelivery?.statusCode).toBe(500);
    });
  });

  describe('handler management', () => {
    it('should manage webhook handlers', () => {
      const handler: WebhookHandler = {
        type: 'test',
        handler: async () => {},
      };

      service.registerHandler(handler);
      expect(service['handlers'].get('test')).toBeDefined();

      service.unregisterHandler('test');
      expect(service['handlers'].get('test')).toBeUndefined();
    });

    it('should allow multiple handlers for different event types', () => {
      const handler1: WebhookHandler = {
        type: 'test1',
        handler: async () => {},
      };

      const handler2: WebhookHandler = {
        type: 'test2',
        handler: async () => {},
      };

      service.registerHandler(handler1);
      service.registerHandler(handler2);

      expect(service['handlers'].get('test1')).toBeDefined();
      expect(service['handlers'].get('test2')).toBeDefined();
    });

    it('should override existing handler for same event type', () => {
      const handler1: WebhookHandler = {
        type: 'test',
        handler: async () => {},
      };

      const handler2: WebhookHandler = {
        type: 'test',
        handler: async () => {},
      };

      service.registerHandler(handler1);
      service.registerHandler(handler2);

      expect(service['handlers'].get('test')).toBe(handler2);
    });
  });

  describe('error handling', () => {
    it('should handle server initialization errors', () => {
      mockExpressApp.listen.mockImplementationOnce(() => {
        throw new Error('Port in use');
      });

      service.onModuleInit();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize webhook server'),
        expect.any(Error)
      );
    });

    it('should handle handler errors gracefully', async () => {
      const handler: WebhookHandler = {
        type: 'test',
        handler: async () => {
          throw new Error('Handler error');
        },
      };

      service.registerHandler(handler);

      const event = { type: 'test', data: {} } as WebhookEvent;
      await expect(
        handler.handler(event, mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Handler error');
    });

    it('should handle signature generation errors', () => {
      const service = createService({ secret: undefined });
      const payload = { type: 'test', data: {} };

      expect(service['generateSignature'](payload)).toBe('');
    });
  });
}); 