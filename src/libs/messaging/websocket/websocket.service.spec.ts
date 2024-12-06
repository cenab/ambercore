import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { WebSocketService } from './websocket.service';
import WebSocket from 'ws';

jest.mock('ws');

type MockWebSocket = {
  on: jest.Mock;
  send: jest.Mock;
  close: jest.Mock;
  readyState: number;
  pong: jest.Mock;
  ping: jest.Mock;
};

describe('WebSocketService', () => {
  let service: WebSocketService;
  let configService: jest.Mocked<ConfigService>;
  let metricsService: jest.Mocked<MetricsService>;
  let mockWs: MockWebSocket;

  beforeEach(async () => {
    jest.useFakeTimers();

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'WS_HEARTBEAT_INTERVAL':
            return 30000;
          case 'WS_RECONNECT_INTERVAL':
            return 5000;
          case 'WS_MAX_RETRIES':
            return 5;
          default:
            return undefined;
        }
      }),
      getOrThrow: jest.fn(),
      set: jest.fn(),
      setEnvFilePaths: jest.fn(),
      changes$: jest.fn() as any,
      internalConfig: {},
      isCacheEnabled: false,
      cache: {},
      _changes$: jest.fn() as any,
      loadEnvFile: jest.fn(),
      validationSchema: null,
      validationOptions: {},
      load: jest.fn(),
      _getFromCache: jest.fn(),
      _getFromEnvValue: jest.fn(),
      _getFromProcessEnv: jest.fn(),
      _getFromInternalConfig: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    metricsService = {
      setActiveConnections: jest.fn(),
      recordHttpError: jest.fn(),
      onModuleInit: jest.fn(),
      observeHttpRequest: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
      recordMetric: jest.fn(),
      getMetrics: jest.fn(),
      cleanupOldMetrics: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: MetricsService,
          useValue: metricsService,
        },
      ],
    }).compile();

    service = module.get<WebSocketService>(WebSocketService);

    // Create a default mock WebSocket
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      pong: jest.fn(),
      ping: jest.fn(),
    };

    // Reset the WebSocket mock implementation
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(async () => {
    // Clean up any remaining connections
    try {
      service.disconnectAll();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Restore real timers
    jest.useRealTimers();
  });

  describe('connect', () => {
    it('should connect to WebSocket server', async () => {
      const url = 'ws://localhost:8080';
      const ws = await service.connect(url);

      expect(ws).toBeDefined();
      expect(WebSocket).toHaveBeenCalledWith(url);
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(metricsService.setActiveConnections).toHaveBeenCalledWith('websocket', 1);

      // Test event handlers
      const openHandler = mockWs.on.mock.calls.find((call: [string, Function]) => call[0] === 'open')?.[1];
      openHandler?.();

      // Advance timers to trigger heartbeat
      jest.advanceTimersByTime(30000);
      expect(mockWs.ping).toHaveBeenCalled();

      const closeHandler = mockWs.on.mock.calls.find((call: [string, Function]) => call[0] === 'close')?.[1];
      closeHandler?.();
      expect(metricsService.setActiveConnections).toHaveBeenCalledWith('websocket', 0);

      const errorHandler = mockWs.on.mock.calls.find((call: [string, Function]) => call[0] === 'error')?.[1];
      const wsError = new Error('WebSocket error');
      errorHandler?.(wsError);
      expect(metricsService.recordHttpError).toHaveBeenCalledWith('WS', 'connection', wsError.message);

      const pingHandler = mockWs.on.mock.calls.find((call: [string, Function]) => call[0] === 'ping')?.[1];
      pingHandler?.();
      expect(mockWs.pong).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      (WebSocket as unknown as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });

      await expect(service.connect('ws://localhost:8080')).rejects.toThrow(error);
      expect(metricsService.recordHttpError).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('should send message to WebSocket', async () => {
      mockWs.send.mockImplementation((data: string | Buffer, callback: (err?: Error) => void) => callback());

      await service.send(mockWs as unknown as WebSocket, 'test message');
      expect(mockWs.send).toHaveBeenCalledWith('test message', expect.any(Function));
    });

    it('should handle closed connection', async () => {
      mockWs.readyState = WebSocket.CLOSED;

      await expect(service.send(mockWs as unknown as WebSocket, 'test')).rejects.toThrow('WebSocket is not open');
    });

    it('should handle send errors', async () => {
      const error = new Error('Send failed');
      mockWs.send.mockImplementation((data: string | Buffer, callback: (err?: Error) => void) => callback(error));

      await expect(service.send(mockWs as unknown as WebSocket, 'test')).rejects.toThrow(error);
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all connected clients', async () => {
      // Create two mock WebSockets
      const mockWs1: MockWebSocket = {
        ...mockWs,
        send: jest.fn().mockImplementation((data: string | Buffer, callback: (err?: Error) => void) => callback()),
      };
      const mockWs2: MockWebSocket = {
        ...mockWs,
        send: jest.fn().mockImplementation((data: string | Buffer, callback: (err?: Error) => void) => callback()),
      };

      // Mock WebSocket constructor to return different instances
      (WebSocket as unknown as jest.Mock)
        .mockImplementationOnce(() => mockWs1)
        .mockImplementationOnce(() => mockWs2);

      await service.connect('ws://localhost:8080');
      await service.connect('ws://localhost:8080');

      await service.broadcast('test message');

      expect(mockWs1.send).toHaveBeenCalledWith('test message', expect.any(Function));
      expect(mockWs2.send).toHaveBeenCalledWith('test message', expect.any(Function));
    });

    it('should handle broadcast errors', async () => {
      const error = new Error('Send failed');
      mockWs.send.mockImplementation((data: string | Buffer, callback: (err?: Error) => void) => callback(error));

      await service.connect('ws://localhost:8080');
      await expect(service.broadcast('test')).rejects.toThrow(error);
    });
  });

  describe('disconnect', () => {
    it('should disconnect WebSocket', () => {
      service.disconnect(mockWs as unknown as WebSocket);
      expect(mockWs.close).toHaveBeenCalled();
      expect(metricsService.setActiveConnections).toHaveBeenCalledWith('websocket', 0);
    });

    it('should handle disconnect errors', () => {
      const error = new Error('Close failed');
      mockWs.close.mockImplementation(() => {
        throw error;
      });

      expect(() => service.disconnect(mockWs as unknown as WebSocket)).toThrow(error);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all WebSockets', async () => {
      // Create two mock WebSockets
      const mockWs1: MockWebSocket = {
        ...mockWs,
        close: jest.fn(),
      };
      const mockWs2: MockWebSocket = {
        ...mockWs,
        close: jest.fn(),
      };

      // Mock WebSocket constructor to return different instances
      (WebSocket as unknown as jest.Mock)
        .mockImplementationOnce(() => mockWs1)
        .mockImplementationOnce(() => mockWs2);

      await service.connect('ws://localhost:8080');
      await service.connect('ws://localhost:8080');

      service.disconnectAll();

      expect(mockWs1.close).toHaveBeenCalled();
      expect(mockWs2.close).toHaveBeenCalled();
      expect(metricsService.setActiveConnections).toHaveBeenCalledWith('websocket', 0);
    });

    it('should handle disconnectAll errors', async () => {
      const error = new Error('Close failed');
      mockWs.close.mockImplementation(() => {
        throw error;
      });

      await service.connect('ws://localhost:8080');
      expect(() => service.disconnectAll()).toThrow(error);
    });
  });

  describe('getActiveConnections', () => {
    it('should return number of active connections', async () => {
      // Create two mock WebSockets
      const mockWs1: MockWebSocket = { ...mockWs };
      const mockWs2: MockWebSocket = { ...mockWs };

      // Mock WebSocket constructor to return different instances
      (WebSocket as unknown as jest.Mock)
        .mockImplementationOnce(() => mockWs1)
        .mockImplementationOnce(() => mockWs2);

      await service.connect('ws://localhost:8080');
      await service.connect('ws://localhost:8080');

      expect(service.getActiveConnections()).toBe(2);
    });
  });
}); 