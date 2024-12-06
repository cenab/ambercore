import { Test, TestingModule } from '@nestjs/testing';
import { SSEService } from './sse.service';
import { SSEConfig, SSEClient, SSEEvent } from './sse.types';
import { Response } from 'express';
import { Logger } from '@nestjs/common';
import { Socket } from 'net';

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

describe('SSEService', () => {
  let service: SSEService;
  let mockResponse: Partial<Response>;
  let mockSocket: Partial<Socket>;

  const mockConfig: SSEConfig = {
    enabled: true,
    debug: true,
    heartbeatInterval: 100, // Shorter interval for testing
    retryInterval: 3000,
    maxEventSize: 1024, // Smaller size for testing
    compression: false,
    maxClients: 1000,
    retryAfter: 1000,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock setInterval
    jest.spyOn(global, 'setInterval');

    // Mock socket object
    mockSocket = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      destroy: jest.fn(),
      setTimeout: jest.fn(),
      setNoDelay: jest.fn(),
      setKeepAlive: jest.fn(),
    };

    // Mock response object
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      connection: mockSocket as Socket,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SSEService,
          useFactory: () => {
            const service = new SSEService(mockConfig);
            return service;
          },
        },
      ],
    }).compile();

    service = module.get<SSEService>(SSEService);
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    service.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default config when none provided', () => {
      const defaultService = new SSEService();
      expect(defaultService).toBeDefined();
    });

    it('should handle disabled state', () => {
      const disabledService = new SSEService({ ...mockConfig, enabled: false });
      expect(() => disabledService.addClient(mockResponse as Response)).toThrow('SSE service is disabled');
    });

    it('should start heartbeat on initialization', async () => {
      const service = new SSEService(mockConfig);
      await service.onModuleInit();
      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), mockConfig.heartbeatInterval);
    });
  });

  describe('client management', () => {
    it('should add a new client connection', () => {
      const clientId = service.addClient(mockResponse as Response);
      expect(clientId).toBeDefined();
      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      });
    });

    it('should add client with compression if enabled', () => {
      const compressedService = new SSEService({ ...mockConfig, compression: true });
      const clientId = compressedService.addClient(mockResponse as Response);
      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Encoding': 'gzip',
      }));
    });

    it('should handle client disconnection', () => {
      const clientId = service.addClient(mockResponse as Response);
      service.removeClient(clientId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Client disconnected: ${clientId}`
      );
    });

    it('should enforce max clients limit', () => {
      // Create max number of clients
      for (let i = 0; i < mockConfig.maxClients!; i++) {
        service.addClient(mockResponse as Response);
      }

      // Try to create one more client
      expect(() => service.addClient(mockResponse as Response)).toThrow(
        'Maximum number of clients reached'
      );
    });

    it('should cleanup client resources on removal', () => {
      const clientId = service.addClient(mockResponse as Response);
      const topics = ['topic1', 'topic2'];
      service.subscribe(clientId, topics);

      service.removeClient(clientId);

      expect(service.getClient(clientId)).toBeUndefined();
      expect(service.getActiveTopics()).not.toContain(topics[0]);
      expect(service.getActiveTopics()).not.toContain(topics[1]);
    });
  });

  describe('heartbeat mechanism', () => {
    it('should send heartbeat to connected clients', () => {
      const clientId = service.addClient(mockResponse as Response);
      (mockResponse.write as jest.Mock).mockClear();
      
      jest.advanceTimersByTime(mockConfig.heartbeatInterval!);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: heartbeat')
      );
    });

    it('should update client lastHeartbeatAt timestamp', () => {
      const clientId = service.addClient(mockResponse as Response);
      const initialTimestamp = service.getClient(clientId)?.lastHeartbeatAt;
      
      jest.advanceTimersByTime(mockConfig.heartbeatInterval!);
      
      const newTimestamp = service.getClient(clientId)?.lastHeartbeatAt;
      expect(newTimestamp).not.toBe(initialTimestamp);
    });

    it('should remove client on heartbeat failure', () => {
      const clientId = service.addClient(mockResponse as Response);
      (mockResponse.write as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection lost');
      });

      jest.advanceTimersByTime(mockConfig.heartbeatInterval!);

      expect(service.getClient(clientId)).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send heartbeat to client'),
        expect.any(Error)
      );
    });
  });

  describe('event handling', () => {
    let clientId: string;

    beforeEach(() => {
      clientId = service.addClient(mockResponse as Response);
      (mockResponse.write as jest.Mock).mockClear();
    });

    it('should send event to client', () => {
      const event: SSEEvent = {
        id: '1',
        event: 'test',
        data: { message: 'Hello World' },
      };

      service.sendToClient(clientId, event);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('id: 1')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: test')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('data: {"message":"Hello World"}')
      );
    });

    it('should enforce event size limit', () => {
      const largeData = 'x'.repeat(mockConfig.maxEventSize! + 1);
      const event: SSEEvent = {
        data: largeData,
      };

      service.sendToClient(clientId, event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending event to client'),
        expect.any(Error)
      );
    });

    it('should handle topic subscriptions with filters', () => {
      const topics = ['test-topic'];
      const filter = (event: SSEEvent) => (event.data as any).priority === 'high';
      
      service.subscribe(clientId, topics);
      const subscription = service.getSubscriptions()[0];
      subscription.filter = filter;

      (mockResponse.write as jest.Mock).mockClear();

      // Send filtered event
      service.broadcast({
        topic: topics[0],
        data: { message: 'High Priority', priority: 'high' },
      });

      // Send non-filtered event
      service.broadcast({
        topic: topics[0],
        data: { message: 'Low Priority', priority: 'low' },
      });

      const writeCallArgs = (mockResponse.write as jest.Mock).mock.calls;
      const dataWrites = writeCallArgs.filter(args => 
        args[0].includes('data:')
      );
      expect(dataWrites).toHaveLength(1);
      expect(dataWrites[0][0]).toContain('High Priority');
    });

    it('should handle topic subscriptions with transformations', () => {
      const topics = ['test-topic'];
      const transform = (event: SSEEvent) => ({
        ...event,
        data: { ...event.data, transformed: true },
      });
      
      service.subscribe(clientId, topics);
      const subscription = service.getSubscriptions()[0];
      subscription.transform = transform;

      (mockResponse.write as jest.Mock).mockClear();

      service.broadcast({
        topic: topics[0],
        data: { message: 'Original' },
      });

      const writeCallArgs = (mockResponse.write as jest.Mock).mock.calls;
      const dataWrite = writeCallArgs.find(args => 
        args[0].includes('data:')
      );
      expect(dataWrite[0]).toContain('transformed":true');
    });

    it('should broadcast event to topic subscribers', () => {
      const topic = 'broadcast-topic';
      const event: SSEEvent = {
        id: '2',
        event: 'broadcast',
        data: { message: 'Broadcast Message' },
        topic,
      };

      // Create multiple clients and subscribe them to the topic
      const client1 = service.addClient(mockResponse as Response);
      const client2 = service.addClient(mockResponse as Response);
      service.subscribe(client1, [topic]);
      service.subscribe(client2, [topic]);

      // Reset write mock to only count broadcast writes
      (mockResponse.write as jest.Mock).mockClear();

      service.broadcast(event);

      // Each subscribed client should receive the event
      expect(mockResponse.write).toHaveBeenCalledTimes(2);
    });

    it('should handle retry intervals', () => {
      const event: SSEEvent = {
        id: '3',
        data: { message: 'Test' },
        retry: 5000,
      };

      service.sendToClient(clientId, event);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('retry: 5000')
      );
    });

    it('should handle event comments', () => {
      const event: SSEEvent = {
        data: { message: 'Test' },
        comment: 'Debug info',
      };

      service.sendToClient(clientId, event);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining(': Debug info')
      );
    });
  });

  describe('error handling', () => {
    it('should handle client write errors', () => {
      const clientId = service.addClient(mockResponse as Response);
      (mockResponse.write as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Write error');
      });

      const event: SSEEvent = {
        id: '4',
        data: { message: 'Error Test' },
      };

      service.sendToClient(clientId, event);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending event to client'),
        expect.any(Error)
      );
    });

    it('should handle invalid event data', () => {
      const clientId = service.addClient(mockResponse as Response);
      const event: SSEEvent = {
        id: '5',
        data: { circular: {} },
      };
      (event.data as any).circular.self = event.data;

      service.sendToClient(clientId, event);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending event to client'),
        expect.any(Error)
      );
    });

    it('should handle client cleanup on error', () => {
      const clientId = service.addClient(mockResponse as Response);
      (mockResponse.write as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection error');
      });

      service.sendToClient(clientId, { data: 'test' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending event to client'),
        expect.any(Error)
      );
      
      // Try to send another event to the same client
      service.sendToClient(clientId, { data: 'test2' });
      // The client should be removed after the error
      expect(service.getClient(clientId)).toBeUndefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      const clientId = service.addClient(mockResponse as Response);
      (mockResponse.end as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Cleanup error');
      });

      await service.onModuleDestroy();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error removing client'),
        expect.any(Error)
      );
    });
  });

  describe('service lifecycle', () => {
    it('should cleanup resources on module destroy', async () => {
      const clientId = service.addClient(mockResponse as Response);

      await service.onModuleDestroy();

      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        'SSE service cleaned up successfully'
      );
      expect(service.getClients()).toHaveLength(0);
      expect(service.getActiveTopics()).toHaveLength(0);
      expect(service.getSubscriptions()).toHaveLength(0);
    });

    it('should clear heartbeat interval on destroy', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      await service.onModuleDestroy();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle disabled service state', async () => {
      const disabledService = new SSEService({ ...mockConfig, enabled: false });
      await disabledService.onModuleInit();
      expect(mockLogger.warn).toHaveBeenCalledWith('SSE service is disabled');
    });
  });
}); 