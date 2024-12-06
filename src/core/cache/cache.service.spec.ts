import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

jest.mock('ioredis');

describe('CacheService', () => {
  let service: CacheService;
  let redis: jest.Mocked<Redis>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Mock Redis
    const mockRedis = {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      incr: jest.fn(),
      incrby: jest.fn(),
      decr: jest.fn(),
      decrby: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      multi: jest.fn(),
      exec: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      duplicate: jest.fn(),
    };

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis as any);
    redis = mockRedis as unknown as jest.Mocked<Redis>;

    // Mock ConfigService
    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should setup error handling', () => {
      expect(redis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(redis.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('basic operations', () => {
    it('should get a value', async () => {
      redis.get.mockResolvedValue('value');
      const result = await service.get('key');
      expect(result).toBe('value');
      expect(redis.get).toHaveBeenCalledWith('key');
    });

    it('should set a value', async () => {
      await service.set('key', 'value');
      expect(redis.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should set a value with TTL', async () => {
      await service.set('key', 'value', 60);
      expect(redis.setex).toHaveBeenCalledWith('key', 60, 'value');
    });

    it('should delete a key', async () => {
      await service.del('key');
      expect(redis.del).toHaveBeenCalledWith('key');
    });
  });

  describe('key operations', () => {
    it('should get keys by pattern', async () => {
      redis.keys.mockResolvedValue(['key1', 'key2']);
      const result = await service.keys('pattern*');
      expect(result).toEqual(['key1', 'key2']);
      expect(redis.keys).toHaveBeenCalledWith('pattern*');
    });

    it('should check if key exists', async () => {
      redis.exists.mockResolvedValue(1);
      const result = await service.exists('key');
      expect(result).toBe(true);
      expect(redis.exists).toHaveBeenCalledWith('key');
    });

    it('should set key expiry', async () => {
      await service.expire('key', 60);
      expect(redis.expire).toHaveBeenCalledWith('key', 60);
    });
  });

  describe('multiple operations', () => {
    it('should get multiple values', async () => {
      redis.mget.mockResolvedValue(['value1', 'value2']);
      const result = await service.mget('key1', 'key2');
      expect(result).toEqual(['value1', 'value2']);
      expect(redis.mget).toHaveBeenCalledWith(['key1', 'key2']);
    });

    it('should set multiple values', async () => {
      await service.mset({ key1: 'value1', key2: 'value2' });
      expect(redis.mset).toHaveBeenCalledWith({ key1: 'value1', key2: 'value2' });
    });
  });

  describe('counter operations', () => {
    it('should increment by 1', async () => {
      redis.incr.mockResolvedValue(1);
      const result = await service.incr('key');
      expect(result).toBe(1);
      expect(redis.incr).toHaveBeenCalledWith('key');
    });

    it('should increment by custom value', async () => {
      redis.incrby.mockResolvedValue(5);
      const result = await service.incr('key', 5);
      expect(result).toBe(5);
      expect(redis.incrby).toHaveBeenCalledWith('key', 5);
    });

    it('should decrement by 1', async () => {
      redis.decr.mockResolvedValue(0);
      const result = await service.decr('key');
      expect(result).toBe(0);
      expect(redis.decr).toHaveBeenCalledWith('key');
    });

    it('should decrement by custom value', async () => {
      redis.decrby.mockResolvedValue(-5);
      const result = await service.decr('key', 5);
      expect(result).toBe(-5);
      expect(redis.decrby).toHaveBeenCalledWith('key', 5);
    });
  });

  describe('pub/sub operations', () => {
    let mockSubscriber: jest.Mocked<Redis>;

    beforeEach(() => {
      mockSubscriber = {
        subscribe: jest.fn(),
        on: jest.fn(),
      } as unknown as jest.Mocked<Redis>;

      redis.duplicate.mockReturnValue(mockSubscriber);
    });

    it('should publish message', async () => {
      redis.publish.mockResolvedValue(1);
      const result = await service.publish('channel', 'message');
      expect(result).toBe(1);
      expect(redis.publish).toHaveBeenCalledWith('channel', 'message');
    });

    it('should subscribe to channel', async () => {
      const callback = jest.fn();
      await service.subscribe('channel', callback);
      
      expect(redis.duplicate).toHaveBeenCalled();
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel');
      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));

      // Test callback
      const messageHandler = mockSubscriber.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler('channel', 'message');
        expect(callback).toHaveBeenCalledWith('message');
      }
    });

    it('should unsubscribe from channel', async () => {
      await service.unsubscribe('channel');
      expect(redis.unsubscribe).toHaveBeenCalledWith('channel');
    });
  });

  describe('transaction operations', () => {
    it('should create pipeline', async () => {
      const mockPipeline = {
        exec: jest.fn(),
      };
      redis.multi.mockReturnValue(mockPipeline as any);
      
      const pipeline = await service.multi();
      expect(pipeline).toBe(mockPipeline);
      expect(redis.multi).toHaveBeenCalled();
    });

    it('should execute pipeline', async () => {
      const mockPipeline = {
        exec: jest.fn().mockResolvedValue([
          [null, 'result1'],
          [null, 'result2'],
        ]),
      };

      const results = await service.exec(mockPipeline as any);
      expect(results).toEqual([
        [null, 'result1'],
        [null, 'result2'],
      ]);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    it('should return true when Redis is healthy', async () => {
      redis.ping.mockResolvedValue('PONG');
      const result = await service.healthCheck();
      expect(result).toBe(true);
      expect(redis.ping).toHaveBeenCalled();
    });

    it('should return false when Redis is unhealthy', async () => {
      redis.ping.mockRejectedValue(new Error('Connection failed'));
      const result = await service.healthCheck();
      expect(result).toBe(false);
      expect(redis.ping).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should quit Redis connection on module destroy', async () => {
      await service.onModuleDestroy();
      expect(redis.quit).toHaveBeenCalled();
    });
  });
}); 