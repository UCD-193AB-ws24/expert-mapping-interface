/**
 * @file expertProfileCache.test.js
 * @description Tests for the expertProfileCache module
 */

// Mock the entire redis module
jest.mock('redis', () => {
  // Create a proper mock Redis client with all methods that we need
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    hSet: jest.fn().mockResolvedValue(1),
    hGetAll: jest.fn().mockImplementation((key) => {
      if (key === 'expert:metadata') {
        return Promise.resolve({ last_session: 'session123' });
      }
      return Promise.resolve({ 
        id: '1', 
        first_name: 'Test', 
        last_name: 'Expert',
        cache_session: 'session123',
        works: '[]',
        grants: '[]'
      });
    }),
    hMSet: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue(['expert:1', 'expert:2']),
    exists: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('{"data":"value"}'),
    mSet: jest.fn().mockResolvedValue('OK'),
    mGet: jest.fn().mockResolvedValue(['{"data":"value"}'])
  };

  return {
    createClient: jest.fn().mockReturnValue(mockClient)
  };
});

// Mock Redis utility functions
jest.mock('../utils/redisUtils', () => {
  return {
    createRedisClient: jest.fn().mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      hSet: jest.fn().mockResolvedValue(1),
      hGetAll: jest.fn().mockResolvedValue({ id: '1', first_name: 'Test' }),
      hMSet: jest.fn().mockResolvedValue('OK'),
      keys: jest.fn().mockResolvedValue(['expert:1']),
      exists: jest.fn().mockResolvedValue(0),
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('{"data":"value"}')
    }),
    getCachedItems: jest.fn().mockResolvedValue([
      { id: '1', first_name: 'Test', last_name: 'Expert', cache_session: 'session123' }
    ]),
    cacheItems: jest.fn().mockResolvedValue({
      success: true,
      count: 1,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      sessionId: 'session123'
    })
  };
});

// Now import the module under test
const { cacheEntities, getCachedEntities, getRecentCachedEntities } = require('../utils/expertProfileCache');
const redisUtils = require('../utils/redisUtils');

// Mock the Redis utilities
jest.mock('../utils/redisUtils', () => ({
  createRedisClient: jest.fn(),
  cacheItems: jest.fn(),
  getCachedItems: jest.fn(),
  sanitizeString: jest.fn(str => str)
}));

describe('expertProfileCache', () => {
  const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    hGetAll: jest.fn(),
    isOpen: true,
    quit: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn().mockResolvedValue(['expert:1', 'expert:2']) // <-- add keys method
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisUtils.createRedisClient.mockReturnValue(mockRedisClient);
  });

  describe('cacheEntities', () => {
    it('should cache expert entities and return success result', async () => {
      const mockEntities = [
        { expertId: '123', fullName: 'John Doe', works: [], grants: [] },
        { expertId: '456', fullName: 'Jane Smith', works: [], grants: [] }
      ];

      redisUtils.cacheItems.mockResolvedValueOnce({
        success: true,
        count: 2,
        newCount: 1,
        updatedCount: 1,
        unchangedCount: 0,
        sessionId: 'test-session'
      });

      const result = await cacheEntities('expert', mockEntities);

      expect(redisUtils.cacheItems).toHaveBeenCalledWith(
        mockEntities,
        expect.objectContaining({
          entityType: 'expert'
        })
      );

      expect(result).toEqual({
        success: true,
        count: 2,
        newCount: 1,
        updatedCount: 1,
        unchangedCount: 0,
        sessionId: 'test-session'
      });
    });

    it('should handle errors during caching', async () => {
      const mockEntities = [{ expertId: '123' }];
      redisUtils.cacheItems.mockRejectedValueOnce(new Error('Cache error'));
      try {
        await cacheEntities('expert', mockEntities);
      } catch (err) {
        expect(err.message).toBe('Cache error');
      }
    });
  });

  describe('getCachedEntities', () => {
    it('should retrieve all cached entities', async () => {
      redisUtils.getCachedItems.mockResolvedValueOnce([
        { id: '123', first_name: 'John', last_name: 'Doe', works: [], grants: [] },
        { id: '456', first_name: 'Jane', last_name: 'Smith', works: [], grants: [] }
      ]);

      const result = await getCachedEntities();

      expect(redisUtils.getCachedItems).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          entityType: 'expert'
        })
      );

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.items[0]).toEqual(expect.objectContaining({
        expertId: '123',
        firstName: 'John',
        lastName: 'Doe',
        works: [],
        grants: []
      }));
      expect(result.items[1]).toEqual(expect.objectContaining({
        expertId: '456',
        firstName: 'Jane',
        lastName: 'Smith',
        works: [],
        grants: []
      }));
    });

    it('should handle empty results', async () => {
      redisUtils.getCachedItems.mockResolvedValueOnce([]);
      const result = await getCachedEntities();
      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
    });

    it('should handle errors thrown by getCachedItems (catch branch)', async () => {
      redisUtils.getCachedItems.mockRejectedValueOnce(new Error('getCachedItems error'));
      const result = await getCachedEntities();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/getCachedItems error/);
      expect(result.items).toEqual([]);
    });
  });

  describe('getRecentCachedEntities', () => {
    it('should retrieve only the most recent cached entities', async () => {
      mockRedisClient.hGetAll.mockImplementation(async (key) => {
        if (key === 'expert:metadata') return { last_session: 'session_12345' };
        return {
          id: '123', first_name: 'John', last_name: 'Doe', works: '[]', grants: '[]', cache_session: 'session_12345'
        };
      });
      mockRedisClient.keys.mockResolvedValue(['expert:1', 'expert:2', 'expert:metadata']);

      const result = await getRecentCachedEntities();
      expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('expert:metadata');
      expect(result.success).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toEqual(expect.objectContaining({
        expertId: '123',
        firstName: 'John',
        lastName: 'Doe',
        works: [],
        grants: []
      }));
      expect(result.sessionId).toBe('session_12345');
    });

    it('should handle missing metadata', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});
      const result = await getRecentCachedEntities();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No recent cache session found/);
      expect(result.items).toEqual([]);
    });

    it('should skip empty/invalid Redis data (continue branch)', async () => {
      mockRedisClient.hGetAll.mockImplementation(async (key) => {
        if (key === 'expert:metadata') return { last_session: 'session_12345' };
        return {}; // Simulate empty data for an entity key
      });
      mockRedisClient.keys.mockResolvedValue(['expert:1', 'expert:2', 'expert:metadata']);
      const result = await getRecentCachedEntities();
      expect(result.success).toBe(true);
      expect(result.items).toEqual([]); // No valid items
    });

    it('should handle errors thrown by redisClient.keys (catch branch)', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({ last_session: 'session_12345' });
      mockRedisClient.keys.mockRejectedValueOnce(new Error('Redis keys error'));
      const result = await getRecentCachedEntities();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Redis keys error/);
      expect(result.items).toEqual([]);
    });
  });

  // Directly import the expertConfig for helper tests
  const expertProfileCacheModule = require('../utils/expertProfileCache');
  const expertConfig = expertProfileCacheModule.expertConfig;

  describe('expertConfig methods', () => {
    it('getItemId returns id from url, expertId, or index', () => {
      expect(expertConfig.getItemId({ url: 'http://foo.com/123' }, 5)).toBe('123');
      expect(expertConfig.getItemId({ expertId: 'abc' }, 2)).toBe('abc');
      expect(expertConfig.getItemId({}, 7)).toBe('7');
    });

    it('isItemUnchanged returns true for matching content', () => {
      const expert = { firstName: 'A', lastName: 'B', title: 'T', organizationUnit: 'U', works: [1,2], grants: [3], lastModified: 'd' };
      const existing = { first_name: 'A', last_name: 'B', title: 'T', organization_unit: 'U', works: '[1,2]', grants: '[3]', last_modified: 'd' };
      expect(expertConfig.isItemUnchanged(expert, existing)).toBe(true);
    });
    it('isItemUnchanged returns false for different content', () => {
      const expert = { firstName: 'A', lastName: 'B', title: 'T', organizationUnit: 'U', works: [1,2], grants: [3], lastModified: 'd' };
      const existing = { first_name: 'A', last_name: 'B', title: 'T', organization_unit: 'U', works: '[1]', grants: '[3]', last_modified: 'd' };
      expect(expertConfig.isItemUnchanged(expert, existing)).toBe(false);
    });

    it('formatItemForCache returns expected structure', () => {
      const expert = { expertId: 'id', firstName: 'A', lastName: 'B', works: [{ type: 'WorkType' }], grants: [{ grantRole: 'GrantRole' }], lastModified: 'd' };
      const result = expertConfig.formatItemForCache(expert, 'sess');
      expect(result).toEqual(expect.objectContaining({
        id: 'id',
        first_name: 'A',
        last_name: 'B',
        works: [{ type: 'Work Type' }],
        grants: [{ grantRole: 'Grant Role' }],
        last_modified: 'd',
        cache_session: 'sess'
      }));
    });

    it('formatItemFromCache returns expected structure', () => {
      const cached = { id: 'id', first_name: 'A', last_name: 'B', works: '[{"type":"Work Type"}]', grants: '[{"grantRole":"Grant Role"}]', last_modified: 'd', cache_session: 'sess', cached_at: 'now' };
      const result = expertConfig.formatItemFromCache(cached);
      expect(result).toEqual(expect.objectContaining({
        expertId: 'id',
        firstName: 'A',
        lastName: 'B',
        works: [{ type: 'Work Type' }],
        grants: [{ grantRole: 'Grant Role' }],
        lastModified: 'd',
        cache_session: 'sess',
        cachedAt: 'now'
      }));
    });
  });

  describe('cacheEntities error/edge', () => {
    it('throws for non-expert entityType', async () => {
      await expect(cacheEntities('not-expert', [{ id: 1 }])).rejects.toThrow(/only supports caching expert profiles/);
    });
  });
});
