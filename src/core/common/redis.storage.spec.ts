import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service';
import { RedisStorage } from './redis.storage';
import { Logger } from '@nestjs/common';

// Create a concrete class for testing
class TestRedisStorage extends RedisStorage {
  constructor(cacheService: CacheService) {
    super(cacheService);
  }

  public async testGet<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  public async testSet<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.set(key, value, ttl);
  }

  public async testDelete(key: string): Promise<void> {
    return this.delete(key);
  }

  public async testList<T>(pattern: string): Promise<T[]> {
    return this.list<T>(pattern);
  }

  public async testExists(key: string): Promise<boolean> {
    return this.exists(key);
  }

  public async testPublish(channel: string, message: any): Promise<void> {
    return this.publish(channel, message);
  }

  public async testSubscribe(channel: string, callback: (message: string) => void): Promise<void> {
    return this.subscribe(channel, callback);
  }

  public async testUnsubscribe(channel: string): Promise<void> {
    return this.unsubscribe(channel);
  }

  public async testIncrement(key: string, value?: number): Promise<number> {
    return this.increment(key, value);
  }

  public async testDecrement(key: string, value?: number): Promise<number> {
    return this.decrement(key, value);
  }

  public async testExpire(key: string, seconds: number): Promise<void> {
    return this.expire(key, seconds);
  }
}

describe('RedisStorage', () => {
  let storage: TestRedisStorage;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    // Mock CacheService with proper implementation
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue([]),
      mget: jest.fn().mockResolvedValue([]),
      exists: jest.fn().mockResolvedValue(true),
      expire: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(-1),
    } as unknown as jest.Mocked<CacheService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TestRedisStorage,
          useFactory: () => new TestRedisStorage(cacheService),
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: Logger,
          useValue: {
            error: jest.fn(),
            warn: jest.fn(),
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    storage = module.get<TestRedisStorage>(TestRedisStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should get and parse value', async () => {
      const mockData = { test: 'data' };
      cacheService.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await storage.testGet('test-key');
      expect(result).toEqual(mockData);
      expect(cacheService.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await storage.testGet('non-existent');
      expect(result).toBeNull();
    });

    it('should handle invalid JSON', async () => {
      cacheService.get.mockResolvedValue('invalid json');

      const result = await storage.testGet('test-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should stringify and set value', async () => {
      const mockData = { test: 'data' };
      await storage.testSet('test-key', mockData);

      expect(cacheService.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(mockData),
        undefined
      );
    });

    it('should set value with TTL', async () => {
      const mockData = { test: 'data' };
      await storage.testSet('test-key', mockData, 60);

      expect(cacheService.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(mockData),
        60
      );
    });

    it('should handle set errors', async () => {
      cacheService.set.mockRejectedValue(new Error('Set failed'));

      await expect(storage.testSet('test-key', { test: 'data' })).rejects.toThrow(
        'Set failed'
      );
    });
  });

  describe('delete', () => {
    it('should delete key', async () => {
      await storage.testDelete('test-key');
      expect(cacheService.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle delete errors', async () => {
      cacheService.del.mockRejectedValue(new Error('Delete failed'));

      await expect(storage.testDelete('test-key')).rejects.toThrow(
        'Delete failed'
      );
    });
  });

  describe('list', () => {
    it('should list and parse values', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      cacheService.keys.mockResolvedValue(['key1', 'key2']);
      cacheService.mget.mockImplementation((...keys) => Promise.resolve([
        JSON.stringify(mockData[0]), 
        JSON.stringify(mockData[1])
      ]));

      const result = await storage.testList('test:*');
      expect(result).toEqual(mockData);
      expect(cacheService.keys).toHaveBeenCalledWith('test:*');
      expect(cacheService.mget).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should handle empty results', async () => {
      cacheService.keys.mockResolvedValue([]);

      const result = await storage.testList('test:*');
      expect(result).toEqual([]);
      expect(cacheService.mget).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in results', async () => {
      cacheService.keys.mockResolvedValue(['key1']);
      cacheService.mget.mockResolvedValue(['invalid json']);

      const result = await storage.testList('test:*');
      expect(result).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      cacheService.exists.mockResolvedValue(true);

      const result = await storage.testExists('test-key');
      expect(result).toBe(true);
      expect(cacheService.exists).toHaveBeenCalledWith('test-key');
    });

    it('should handle exists errors', async () => {
      cacheService.exists.mockRejectedValue(new Error('Exists check failed'));

      const result = await storage.testExists('test-key');
      expect(result).toBe(false);
    });
  });

  describe('publish/subscribe', () => {
    it('should publish message', async () => {
      const message = { test: 'data' };
      await storage.testPublish('channel', message);

      expect(cacheService.publish).toHaveBeenCalledWith(
        'channel',
        JSON.stringify(message)
      );
    });

    it('should subscribe to channel', async () => {
      const callback = jest.fn();
      await storage.testSubscribe('channel', callback);

      expect(cacheService.subscribe).toHaveBeenCalledWith('channel', callback);
    });

    it('should unsubscribe from channel', async () => {
      await storage.testUnsubscribe('channel');

      expect(cacheService.unsubscribe).toHaveBeenCalledWith('channel');
    });
  });

  describe('increment/decrement', () => {
    it('should increment value', async () => {
      cacheService.incr.mockResolvedValue(1);

      const result = await storage.testIncrement('counter');
      expect(result).toBe(1);
      expect(cacheService.incr).toHaveBeenCalledWith('counter', 1);
    });

    it('should increment by custom value', async () => {
      cacheService.incr.mockResolvedValue(5);

      const result = await storage.testIncrement('counter', 5);
      expect(result).toBe(5);
      expect(cacheService.incr).toHaveBeenCalledWith('counter', 5);
    });

    it('should decrement value', async () => {
      cacheService.decr.mockResolvedValue(-1);

      const result = await storage.testDecrement('counter');
      expect(result).toBe(-1);
      expect(cacheService.decr).toHaveBeenCalledWith('counter', 1);
    });

    it('should decrement by custom value', async () => {
      cacheService.decr.mockResolvedValue(-5);

      const result = await storage.testDecrement('counter', 5);
      expect(result).toBe(-5);
      expect(cacheService.decr).toHaveBeenCalledWith('counter', 5);
    });
  });

  describe('expire', () => {
    it('should set key expiry', async () => {
      await storage.testExpire('test-key', 60);

      expect(cacheService.expire).toHaveBeenCalledWith('test-key', 60);
    });

    it('should handle expire errors', async () => {
      cacheService.expire.mockRejectedValue(new Error('Expire failed'));

      await expect(storage.testExpire('test-key', 60)).rejects.toThrow(
        'Expire failed'
      );
    });
  });
}); 