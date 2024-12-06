import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { GrpcClient } from './grpc.client';
import { GRPCConfig, GRPCCallOptions } from './grpc.types';
import { Metadata, ServiceError } from '@grpc/grpc-js';

jest.mock('@grpc/grpc-js');
jest.mock('@grpc/proto-loader');

interface MockServiceMethods {
  GetUser: jest.Mock;
  ListUsers: jest.Mock;
  CreateUser: jest.Mock;
  WatchUserUpdates: jest.Mock;
  close: jest.Mock;
}

describe('GrpcClient', () => {
  let client: GrpcClient;
  let mockMetadata: jest.Mock;
  let mockCredentials: { createInsecure: jest.Mock; createSsl: jest.Mock };
  let mockService: MockServiceMethods;
  let mockLogger: { [key: string]: jest.Mock };

  // Mock stream class
  class MockStream extends EventEmitter {
    write: jest.Mock;
    end: jest.Mock;
    cancel: jest.Mock;

    constructor() {
      super();
      this.write = jest.fn().mockReturnValue(true);
      this.end = jest.fn();
      this.cancel = jest.fn();
    }
  }

  beforeAll(() => {
    // Setup logger mock
    mockLogger = {
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

    // Setup mocks
    mockMetadata = jest.fn().mockImplementation(() => ({
      add: jest.fn(),
    }));

    mockCredentials = {
      createInsecure: jest.fn().mockReturnValue('mock-insecure-credentials'),
      createSsl: jest.fn().mockReturnValue('mock-ssl-credentials'),
    };

    mockService = {
      GetUser: jest.fn().mockImplementation(
        (request: any, metadata: Metadata, options: GRPCCallOptions, callback: (error: ServiceError | null, response: any) => void) => {
          callback(null, { id: '1', name: 'Test User' });
        }
      ),
      ListUsers: jest.fn().mockImplementation(
        (request: any, metadata: Metadata, options: GRPCCallOptions) => {
          const stream = new MockStream();
          setTimeout(() => {
            stream.emit('data', { id: '1', name: 'User 1' });
            stream.emit('data', { id: '2', name: 'User 2' });
            stream.emit('end');
          }, 0);
          return stream;
        }
      ),
      CreateUser: jest.fn().mockImplementation(
        (metadata: Metadata, options: GRPCCallOptions, callback: (error: ServiceError | null, response: any) => void) => {
          const stream = new MockStream();
          stream.end.mockImplementation(() => {
            callback(null, { id: '1', name: 'New User' });
          });
          return stream;
        }
      ),
      WatchUserUpdates: jest.fn().mockImplementation(
        (metadata: Metadata, options: GRPCCallOptions) => {
          const stream = new MockStream();
          stream.write.mockImplementation(() => {
            stream.emit('data', { type: 'CREATED', user: { id: '1', name: 'New User' } });
            stream.emit('data', { type: 'UPDATED', user: { id: '1', name: 'Updated User' } });
            return true;
          });
          stream.end.mockImplementation(() => {
            stream.emit('end');
          });
          return stream;
        }
      ),
      close: jest.fn(),
    };

    // Setup gRPC module mocks
    const grpc = require('@grpc/grpc-js');
    const protoLoader = require('@grpc/proto-loader');

    const mockServiceConstructor = jest.fn().mockImplementation(() => mockService);
    const mockAnotherServiceConstructor = jest.fn().mockImplementation(() => ({
      ...mockService,
      AnotherMethod: jest.fn(),
    }));

    grpc.loadPackageDefinition.mockReturnValue({
      ambercore: {
        UserService: mockServiceConstructor,
        AnotherService: mockAnotherServiceConstructor,
      },
    });

    grpc.credentials = mockCredentials;
    grpc.Metadata = mockMetadata;

    protoLoader.loadSync.mockReturnValue({});
  });

  const mockConfig: GRPCConfig = {
    enabled: true,
    debug: false,
    host: 'localhost',
    port: 50051,
    protoPath: './proto/service.proto',
    packageName: 'ambercore',
    serviceName: 'UserService',
    ssl: false,
    maxMessageSize: 4 * 1024 * 1024,
    keepaliveInterval: 30000,
    retryConfig: {
      attempts: 3,
      delay: 1000,
      maxDelay: 5000,
      timeout: 10000,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GrpcClient,
          useFactory: () => {
            const grpcClient = new GrpcClient(mockConfig);
            return grpcClient;
          },
        },
      ],
    }).compile();

    client = module.get<GrpcClient>(GrpcClient);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(client).toBeDefined();
    });

    it('should load service with default config', () => {
      expect(mockLogger.log).toHaveBeenCalledWith('Loaded gRPC service: UserService');
    });

    it('should handle missing proto path', () => {
      const invalidConfig = { ...mockConfig, protoPath: undefined };
      expect(() => new GrpcClient(invalidConfig)).not.toThrow();
    });

    it('should handle missing service name', () => {
      const invalidConfig = { ...mockConfig, serviceName: undefined };
      expect(() => new GrpcClient(invalidConfig)).not.toThrow();
    });

    it('should use SSL credentials when SSL is enabled', () => {
      const sslConfig = { ...mockConfig, ssl: true, credentials: undefined };
      new GrpcClient(sslConfig);
      expect(mockCredentials.createSsl).toHaveBeenCalled();
    });
  });

  describe('metadata handling', () => {
    it('should create metadata with string values', async () => {
      await client.unaryCall('GetUser', { id: '1' }, {
        metadata: { 'x-trace-id': 'test-trace' },
      });

      const mockMetadataInstance = mockMetadata.mock.results[0].value;
      expect(mockMetadataInstance.add).toHaveBeenCalledWith('x-trace-id', 'test-trace');
    });

    it('should create metadata with array values', async () => {
      await client.unaryCall('GetUser', { id: '1' }, {
        metadata: { 'x-custom-header': ['value1', 'value2'] },
      });

      const mockMetadataInstance = mockMetadata.mock.results[0].value;
      expect(mockMetadataInstance.add).toHaveBeenCalledWith('x-custom-header', 'value1');
      expect(mockMetadataInstance.add).toHaveBeenCalledWith('x-custom-header', 'value2');
    });

    it('should handle empty metadata', async () => {
      await client.unaryCall('GetUser', { id: '1' });
      const mockMetadataInstance = mockMetadata.mock.results[0].value;
      expect(mockMetadataInstance.add).not.toHaveBeenCalled();
    });
  });

  describe('connection management', () => {
    it('should create client with correct address', () => {
      const grpc = require('@grpc/grpc-js');
      expect(grpc.loadPackageDefinition).toHaveBeenCalled();
      expect(mockService).toBeDefined();
    });

    it('should handle multiple services', () => {
      client.loadService({
        name: 'AnotherService',
        package: 'ambercore',
        service: 'AnotherService',
      });

      expect(mockLogger.log).toHaveBeenCalledWith('Loaded gRPC service: AnotherService');
    });

    it('should close all clients', () => {
      client.closeAll();
      expect(mockService.close).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Closed all gRPC clients');
    });

    it('should handle service not found error', () => {
      client.closeAll(); // Clear existing clients
      expect(() => client.unaryCall('GetUser', { id: '1' }))
        .rejects.toThrow('Service default not loaded');
    });
  });

  describe('call handling', () => {
    it('should handle unary call', async () => {
      const result = await client.unaryCall('GetUser', { id: '1' });
      expect(result).toEqual({ id: '1', name: 'Test User' });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle server streaming', (done) => {
      const results: any[] = [];
      client.serverStreamCall('ListUsers', { page: 1, limit: 10 }).subscribe({
        next: (data) => results.push(data),
        error: (error) => done(error),
        complete: () => {
          expect(results).toEqual([
            { id: '1', name: 'User 1' },
            { id: '2', name: 'User 2' },
          ]);
          expect(mockLogger.error).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should handle client streaming', async () => {
      const stream = client.clientStreamCall('CreateUser');
      
      stream.write({ name: 'Test User', email: 'test@example.com' });
      stream.write({ name: 'Test User 2', email: 'test2@example.com' });
      
      const result = await stream.complete();
      expect(result).toEqual({ id: '1', name: 'New User' });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle bidirectional streaming', (done) => {
      const results: any[] = [];
      const stream = client.bidiStreamCall('WatchUserUpdates');

      stream.subscribe({
        next: (data) => results.push(data),
        error: (error) => done(error),
        complete: () => {
          expect(results).toEqual([
            { type: 'CREATED', user: { id: '1', name: 'New User' } },
            { type: 'UPDATED', user: { id: '1', name: 'Updated User' } },
          ]);
          expect(mockLogger.error).not.toHaveBeenCalled();
          done();
        },
      });

      stream.write({ userId: '1' });
      stream.complete();
    });
  });

  describe('error handling', () => {
    it('should handle unary call error', async () => {
      mockService.GetUser.mockImplementationOnce((request: any, metadata: Metadata, options: GRPCCallOptions, callback: (error: ServiceError | null, response: any) => void) => {
        callback(new Error('User not found') as ServiceError, null);
      });

      await expect(client.unaryCall('GetUser', { id: 'invalid' }))
        .rejects.toThrow('User not found');
      
      expect(mockLogger.error).toHaveBeenCalledWith('gRPC unary call error: User not found');
    });

    it('should handle server streaming error', (done) => {
      mockService.ListUsers.mockImplementationOnce(() => {
        const stream = new MockStream();
        setTimeout(() => {
          stream.emit('error', new Error('Failed to list users'));
        }, 0);
        return stream;
      });

      client.serverStreamCall('ListUsers', {}).subscribe({
        next: () => done(new Error('Should not emit data')),
        error: (error) => {
          expect(error.message).toBe('Failed to list users');
          done();
        },
        complete: () => done(new Error('Should not complete')),
      });
    });

    it('should handle client streaming error', async () => {
      mockService.CreateUser.mockImplementationOnce((metadata: Metadata, options: GRPCCallOptions, callback: (error: ServiceError | null, response: any) => void) => {
        const stream = new MockStream();
        stream.end.mockImplementation(() => {
          callback(new Error('Failed to create user') as ServiceError, null);
        });
        return stream;
      });

      const stream = client.clientStreamCall('CreateUser');
      stream.write({ name: 'Test User' });

      await expect(stream.complete()).rejects.toThrow('Failed to create user');
    });

    it('should handle bidirectional streaming error', (done) => {
      mockService.WatchUserUpdates.mockImplementationOnce(() => {
        const stream = new MockStream();
        stream.write.mockImplementation(() => {
          stream.emit('error', new Error('Failed to watch updates'));
          return true;
        });
        return stream;
      });

      const stream = client.bidiStreamCall('WatchUserUpdates');

      stream.subscribe({
        next: () => done(new Error('Should not emit data')),
        error: (error) => {
          expect(error.message).toBe('Failed to watch updates');
          done();
        },
        complete: () => done(new Error('Should not complete')),
      });

      stream.write({ userId: '1' });
      stream.complete();
    });

    it('should handle stream cancellation', (done) => {
      const stream = new MockStream();
      mockService.ListUsers.mockImplementationOnce(() => stream);

      const subscription = client.serverStreamCall('ListUsers', {}).subscribe({
        error: (error) => done(error),
        complete: () => {
          expect(stream.cancel).not.toHaveBeenCalled();
          done();
        },
      });

      stream.emit('end');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
}); 