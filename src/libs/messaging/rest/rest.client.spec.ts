import { Test, TestingModule } from '@nestjs/testing';
import { RestClient } from './rest.client';
import { RestConfig, ApiResponse } from './rest.types';
import { Logger } from '@nestjs/common';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

describe('RestClient', () => {
  let client: RestClient;
  let mockResponse: ApiResponse<any>;

  const mockConfig: RestConfig = {
    baseUrl: 'https://api.example.com',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-api-key',
    },
    timeout: 5000,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockResponse = {
      success: true,
      data: { id: 1, name: 'Test' },
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RestClient,
          useValue: new RestClient(mockConfig),
        },
      ],
    }).compile();

    client = module.get<RestClient>(RestClient);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('GET requests', () => {
    it('should make a successful GET request', async () => {
      const result = await client.get('/users/1');
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle query parameters correctly', async () => {
      await client.get('/users', {
        query: { page: '1', limit: '10' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users?page=1&limit=10',
        expect.any(Object)
      );
    });

    it('should handle custom headers', async () => {
      await client.get('/users', {
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });
  });

  describe('POST requests', () => {
    it('should make a successful POST request', async () => {
      const body = { name: 'New User' };
      await client.post('/users', { body });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('should handle empty body', async () => {
      await client.post('/users/1/activate');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1/activate',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });

  describe('PUT requests', () => {
    it('should make a successful PUT request', async () => {
      const body = { name: 'Updated User' };
      await client.put('/users/1', { body });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        })
      );
    });
  });

  describe('PATCH requests', () => {
    it('should make a successful PATCH request', async () => {
      const body = { name: 'Patched User' };
      await client.patch('/users/1', { body });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      );
    });
  });

  describe('DELETE requests', () => {
    it('should make a successful DELETE request', async () => {
      await client.delete('/users/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle 404 errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ message: 'User not found' }),
        })
      );

      await expect(client.get('/users/999')).rejects.toEqual(
        expect.objectContaining({
          code: '404',
          message: 'User not found',
          statusCode: 404,
          path: '/users/999',
        })
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(client.get('/users')).rejects.toEqual(
        expect.objectContaining({
          code: 'REQUEST_ERROR',
          message: 'Network error',
          statusCode: 500,
          path: '/users',
        })
      );
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        })
      );

      await expect(client.get('/users')).rejects.toEqual(
        expect.objectContaining({
          code: 'REQUEST_ERROR',
          message: 'Invalid JSON',
          statusCode: 500,
          path: '/users',
        })
      );
    });

    it('should handle request timeouts', async () => {
      // Mock fetch to simulate a timeout
      mockFetch.mockImplementationOnce(() => {
        throw new Error('The user aborted a request.');
      });

      await expect(client.get('/users')).rejects.toEqual({
        code: 'REQUEST_ERROR',
        message: 'The user aborted a request.',
        statusCode: 500,
        path: '/users',
      });
    });
  });

  describe('URL handling', () => {
    it('should handle trailing slashes correctly', async () => {
      await client.get('/users/');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/users\/?$/),
        expect.any(Object)
      );
    });

    it('should handle absolute URLs', async () => {
      await client.get('https://other-api.com/users');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://other-api.com/users',
        expect.any(Object)
      );
    });

    it('should handle query parameters with special characters', async () => {
      await client.get('/search', {
        query: { q: 'test & demo', filter: 'status=active' },
      });

      // URL encoding can be either %20 or + for spaces, both are valid
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/search\?q=test[+%20]%26[+%20]demo&filter=status%3Dactive$/),
        expect.any(Object)
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
}); 