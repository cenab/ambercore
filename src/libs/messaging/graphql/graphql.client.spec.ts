import { Test } from '@nestjs/testing';
import { GraphQLClient } from './graphql.client';
import { GraphQLConfig, GraphQLRequestOptions, GraphQLSubscriptionOptions } from './graphql.types';
import { Logger } from '@nestjs/common';
import { print, Kind, DocumentNode } from 'graphql';
import WebSocket from 'ws';

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

// Mock WebSocket
jest.mock('ws', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe('GraphQLClient', () => {
  let client: GraphQLClient;
  let mockWebSocket: jest.Mocked<WebSocket>;

  const createClient = (config: Partial<GraphQLConfig> = {}) => {
    const defaultConfig: GraphQLConfig = {
      endpoint: 'https://api.example.com/graphql',
      wsEndpoint: 'wss://api.example.com/graphql',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    };

    return new GraphQLClient({ ...defaultConfig, ...config });
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock WebSocket instance
    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
    } as any;

    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWebSocket);

    // Mock successful fetch response
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: {
            user: {
              id: '1',
              name: 'Test User',
            },
          },
        }),
      })
    );

    client = createClient();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(client).toBeDefined();
    });

    it('should initialize with default config', () => {
      const defaultClient = new GraphQLClient({
        endpoint: 'https://api.example.com/graphql',
      });
      expect(defaultClient).toBeDefined();
    });

    it('should handle missing websocket endpoint', () => {
      const noWsClient = createClient({ wsEndpoint: undefined });
      expect(() => noWsClient.subscribe({
        query: 'subscription { userUpdated { id name } }',
        onData: () => {},
      })).toThrow('WebSocket endpoint not configured');
    });
  });

  describe('query operations', () => {
    it('should send query request successfully', async () => {
      const options: GraphQLRequestOptions = {
        query: 'query { user(id: "1") { id name } }',
        variables: { id: '1' },
        operationName: 'GetUser',
      };

      const result = await client.query(options);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: JSON.stringify({
            query: options.query,
            variables: options.variables,
            operationName: options.operationName,
          }),
        })
      );

      expect(result.data).toEqual({
        user: {
          id: '1',
          name: 'Test User',
        },
      });
    });

    it('should handle query with DocumentNode', async () => {
      const documentNode: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [],
        loc: undefined,
      };

      const options: GraphQLRequestOptions = {
        query: documentNode,
        variables: { id: '1' },
      };

      await client.query(options);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(print(documentNode)),
        })
      );
    });

    it('should handle query errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            errors: [{
              message: 'User not found',
              locations: [{ line: 1, column: 1 }],
              path: ['user'],
            }],
          }),
        })
      );

      const options: GraphQLRequestOptions = {
        query: 'query { user(id: "999") { id name } }',
      };

      await expect(client.query(options)).rejects.toThrow('GraphQL query returned errors');
    });

    it('should handle network errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      const options: GraphQLRequestOptions = {
        query: 'query { user(id: "1") { id name } }',
      };

      await expect(client.query(options)).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'GraphQL query failed',
        expect.any(Error)
      );
    });

    it('should handle non-200 responses', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal server error' }),
        })
      );

      const options: GraphQLRequestOptions = {
        query: 'query { user(id: "1") { id name } }',
      };

      await expect(client.query(options)).rejects.toThrow('GraphQL request failed');
    });

    it('should merge custom headers with default headers', async () => {
      const options: GraphQLRequestOptions = {
        query: 'query { user(id: "1") { id name } }',
        headers: {
          'X-Custom-Header': 'test',
        },
      };

      await client.query(options);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'X-Custom-Header': 'test',
          }),
        })
      );
    });
  });

  describe('subscription operations', () => {
    it('should establish websocket connection', () => {
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        onData: jest.fn(),
      };

      client.subscribe(options);

      expect(WebSocket).toHaveBeenCalledWith(
        'wss://api.example.com/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should send subscription start message', () => {
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        variables: { userId: '1' },
        operationName: 'WatchUserUpdates',
        onData: jest.fn(),
      };

      client.subscribe(options);

      expect(mockWebSocket.on).toHaveBeenCalledWith('open', expect.any(Function));
      
      // Simulate connection open
      const onOpen = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'open'
      )[1];
      onOpen();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'start',
          payload: {
            query: options.query,
            variables: options.variables,
            operationName: options.operationName,
          },
        })
      );
    });

    it('should handle subscription data', () => {
      const onData = jest.fn();
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        onData,
      };

      client.subscribe(options);

      // Simulate message received
      const onMessage = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      )[1];

      const data = {
        type: 'data',
        payload: {
          data: {
            userUpdated: {
              id: '1',
              name: 'Updated User',
            },
          },
        },
      };

      onMessage(Buffer.from(JSON.stringify(data)));

      expect(onData).toHaveBeenCalledWith(data.payload);
    });

    it('should handle subscription errors', () => {
      const onError = jest.fn();
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        onData: jest.fn(),
        onError,
      };

      client.subscribe(options);

      // Simulate error
      const onError_ = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'error'
      )[1];

      const error = new Error('Connection error');
      onError_(error);

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should handle subscription completion', () => {
      const onComplete = jest.fn();
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        onData: jest.fn(),
        onComplete,
      };

      client.subscribe(options);

      // Simulate connection close
      const onClose = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'close'
      )[1];
      onClose();

      expect(onComplete).toHaveBeenCalled();
    });

    it('should handle malformed subscription data', () => {
      const onError = jest.fn();
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        onData: jest.fn(),
        onError,
      };

      client.subscribe(options);

      // Simulate malformed message
      const onMessage = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      )[1];

      onMessage(Buffer.from('invalid json'));

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return unsubscribe function', () => {
      const options: GraphQLSubscriptionOptions = {
        query: 'subscription { userUpdated { id name } }',
        onData: jest.fn(),
      };

      const unsubscribe = client.subscribe(options);

      unsubscribe();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });
}); 