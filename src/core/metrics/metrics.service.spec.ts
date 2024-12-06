import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { CacheService } from '../cache/cache.service';
import * as promClient from 'prom-client';

// Create mock registry type
interface MockRegistry {
  metrics: jest.Mock;
  registerMetric: jest.Mock;
  getSingleMetric: jest.Mock;
}

// Create mock CacheService type
type MockCacheService = {
  [K in keyof CacheService]: jest.Mock;
} & {
  list: jest.Mock;
  delete: jest.Mock;
};

jest.mock('prom-client', () => {
  const mockRegistry = {
    metrics: jest.fn().mockResolvedValue('metrics data'),
    registerMetric: jest.fn(),
    getSingleMetric: jest.fn(),
  };

  const mockGauge = {
    set: jest.fn(),
  };

  const mockHistogram = {
    observe: jest.fn(),
  };

  const mockCounter = {
    inc: jest.fn(),
  };

  return {
    ...jest.requireActual('prom-client'),
    Registry: jest.fn().mockImplementation(() => mockRegistry),
    Histogram: jest.fn().mockImplementation(() => mockHistogram),
    Counter: jest.fn().mockImplementation(() => mockCounter),
    Gauge: jest.fn().mockImplementation(() => mockGauge),
    collectDefaultMetrics: jest.fn(),
  };
});

describe('MetricsService', () => {
  let service: MetricsService;
  let cacheService: MockCacheService;
  let registry: MockRegistry;
  let mockLogger: { error: jest.Mock; warn: jest.Mock; log: jest.Mock };
  let mockGauge: { set: jest.Mock };
  let mockHistogram: { observe: jest.Mock };
  let mockCounter: { inc: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();

    // Mock CacheService
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      mget: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    } as unknown as MockCacheService;

    // Mock Logger
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    registry = (promClient.Registry as unknown as jest.Mock).mock.results[0].value;
    mockGauge = (promClient.Gauge as jest.Mock).mock.results[0].value;
    mockHistogram = (promClient.Histogram as jest.Mock).mock.results[0].value;
    mockCounter = (promClient.Counter as jest.Mock).mock.results[0].value;

    // Replace the logger with our mock
    (service as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize metrics', () => {
      expect(promClient.Histogram).toHaveBeenCalledWith({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      });

      expect(promClient.Counter).toHaveBeenCalledWith({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      });

      expect(promClient.Gauge).toHaveBeenCalledWith({
        name: 'memory_usage_bytes',
        help: 'Process memory usage',
        labelNames: ['type'],
      });

      // Reset mocks after initialization checks
      jest.clearAllMocks();
      mockGauge.set.mockReset();
      mockHistogram.observe.mockReset();
      mockCounter.inc.mockReset();
      registry.metrics.mockResolvedValue('metrics data');
    });

    it('should start collecting default metrics', async () => {
      await service.onModuleInit();
      expect(promClient.collectDefaultMetrics).toHaveBeenCalledWith({
        register: expect.any(Object),
        prefix: 'app_',
      });
    });

    it('should start memory metrics collection', async () => {
      const mockMemoryUsage = {
        rss: 1024,
        heapTotal: 2048,
        heapUsed: 1536,
        external: 512,
      };

      jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage as any);

      await service.onModuleInit();
      jest.advanceTimersByTime(10000); // Advance timer by 10 seconds

      expect(mockGauge.set).toHaveBeenCalledWith({ type: 'rss' }, mockMemoryUsage.rss);
      expect(mockGauge.set).toHaveBeenCalledWith({ type: 'heapTotal' }, mockMemoryUsage.heapTotal);
      expect(mockGauge.set).toHaveBeenCalledWith({ type: 'heapUsed' }, mockMemoryUsage.heapUsed);
      expect(mockGauge.set).toHaveBeenCalledWith({ type: 'external' }, mockMemoryUsage.external);
    });
  });

  describe('HTTP metrics', () => {
    it('should observe HTTP request duration', () => {
      service.observeHttpRequest('GET', '/api/test', 200, 0.5);
      expect(mockHistogram.observe).toHaveBeenCalledWith(
        { method: 'GET', route: '/api/test', status_code: 200 },
        0.5
      );
    });

    it('should record HTTP request total', () => {
      service.observeHttpRequest('GET', '/api/test', 200, 0.5);
      expect(mockCounter.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/test',
        status_code: 200,
      });
    });

    it('should record HTTP errors', () => {
      service.recordHttpError('GET', '/api/test', 'NOT_FOUND');
      expect(mockCounter.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/test',
        error_code: 'NOT_FOUND',
      });
    });

    it('should handle metric recording errors', () => {
      mockHistogram.observe.mockImplementation(() => {
        throw new Error('Failed to observe');
      });

      service.observeHttpRequest('GET', '/api/test', 200, 0.5);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Cache metrics', () => {
    it('should record cache hits', () => {
      service.recordCacheHit('redis');
      expect(mockCounter.inc).toHaveBeenCalledWith({ cache_type: 'redis' });
    });

    it('should record cache misses', () => {
      service.recordCacheMiss('redis');
      expect(mockCounter.inc).toHaveBeenCalledWith({ cache_type: 'redis' });
    });

    it('should handle cache metric errors', () => {
      mockCounter.inc.mockImplementation(() => {
        throw new Error('Failed to increment');
      });

      service.recordCacheHit('redis');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Connection metrics', () => {
    it('should set active connections', () => {
      service.setActiveConnections('websocket', 5);
      expect(mockGauge.set).toHaveBeenCalledWith({ type: 'websocket' }, 5);
    });

    it('should handle connection metric errors', () => {
      mockGauge.set.mockImplementation(() => {
        throw new Error('Failed to set');
      });

      service.setActiveConnections('websocket', 5);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Custom metrics', () => {
    it('should record custom metric', async () => {
      const metric = {
        name: 'custom_metric',
        value: 42,
        labels: { label: 'test' },
        help: 'Test metric',
      };

      await service.recordMetric(
        metric.name,
        metric.value,
        metric.labels,
        metric.help
      );

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(metric.name),
        expect.stringMatching(/"value":42/),
        300
      );
    });

    it('should handle metric recording errors', async () => {
      cacheService.set.mockRejectedValue(new Error('Failed to set metric'));
      await service.recordMetric('test', 1);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle invalid metric values', async () => {
      await service.recordMetric('test', NaN);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('Metrics retrieval', () => {
    it('should get all metrics', async () => {
      const mockMetrics = [
        {
          name: 'test_metric',
          value: 42,
          labels: { test: 'label' },
          timestamp: Date.now(),
        },
      ];

      cacheService.keys.mockResolvedValue(['metrics:test']);
      cacheService.mget.mockResolvedValue([JSON.stringify(mockMetrics[0])]);
      mockGauge.set.mockImplementation(() => {}); // Reset the mock
      registry.metrics.mockResolvedValue('metrics data');

      const result = await service.getMetrics();
      expect(result).toBe('metrics data');
    });

    it('should handle metrics retrieval errors', async () => {
      const error = new Error('Failed to get metrics');
      cacheService.keys.mockRejectedValue(error);
      registry.metrics.mockRejectedValue(error);

      await expect(service.getMetrics()).rejects.toThrow('Failed to get metrics');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list keys with pattern metrics:*:', error);
    });

    it('should handle invalid metric data', async () => {
      const invalidMetric = { invalid: 'data' };
      cacheService.keys.mockResolvedValue(['metrics:invalid']);
      cacheService.mget.mockResolvedValue([JSON.stringify(invalidMetric)]);
      mockGauge.set.mockImplementation(() => {}); // Reset the mock
      registry.metrics.mockResolvedValue('metrics data');

      const result = await service.getMetrics();
      expect(result).toBe('metrics data');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid metric data:',
        invalidMetric
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old metrics', async () => {
      const now = Date.now();
      const mockMetrics = [
        {
          name: 'old_metric',
          value: 42,
          labels: {},
          timestamp: now - 7200000, // 2 hours old
        },
      ];

      cacheService.keys.mockResolvedValue(['metrics:old_metric']);
      cacheService.mget.mockResolvedValue([JSON.stringify(mockMetrics[0])]);

      await service.cleanupOldMetrics(3600000); // 1 hour max age
      expect(cacheService.del).toHaveBeenCalledWith(
        `metrics:old_metric:${JSON.stringify({})}`
      );
    });

    it('should handle cleanup errors', async () => {
      const error = new Error('Failed to cleanup');
      cacheService.keys.mockRejectedValue(error);

      await service.cleanupOldMetrics();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list keys with pattern metrics:*:', error);
    });

    it('should not delete recent metrics', async () => {
      const now = Date.now();
      const mockMetrics = [
        {
          name: 'recent_metric',
          value: 42,
          labels: {},
          timestamp: now - 1800000, // 30 minutes old
        },
      ];

      cacheService.keys.mockResolvedValue(['metrics:recent_metric']);
      cacheService.mget.mockResolvedValue([JSON.stringify(mockMetrics[0])]);

      await service.cleanupOldMetrics(3600000); // 1 hour max age
      expect(cacheService.del).not.toHaveBeenCalled();
    });
  });
}); 