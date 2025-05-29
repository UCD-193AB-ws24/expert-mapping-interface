const {
  createRedisClient,
  sanitizeString,
  buildExistingRecordsMap,
  updateMetadata,
  cacheItems,
  getCachedItems,
  getCacheStats
} = require('../utils/redisUtils');

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  hGetAll: jest.fn(),
  hSet: jest.fn().mockResolvedValue(undefined),
  keys: jest.fn(),
  isOpen: true,
  multi: jest.fn(() => ({
    hGetAll: jest.fn().mockReturnThis(),
    keys: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  })),
  on: jest.fn() // Add a no-op .on method to the mockRedisClient for compatibility
};

// Mock redis library
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

// Define a shared options object for tests that use it
const options = {
  entityType: 'expert',
  getItemId: (item, i) => item.id || i,
  isItemUnchanged: () => false,
  formatItemForCache: (item, sessionId) => ({ ...item, sessionId }),
  formatItemFromCache: (data) => data
};

describe('redisUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRedisClient', () => {
    it('should create a Redis client with the correct configuration', () => {
      const client = createRedisClient();
      expect(client).toBe(mockRedisClient);
    });
  });

  describe('sanitizeString', () => {
    it('should remove special characters from a string', () => {
      expect(sanitizeString('Hello, World!')).toBe('Hello World');
      expect(sanitizeString('Test@123')).toBe('Test123');
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('cacheItems', () => {
    it('should cache items and return success result', async () => {
      const mockItems = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ];

      const mockOptions = {
        entityType: 'test',
        getItemId: (item) => item.id,
        isItemUnchanged: () => false,
        formatItemForCache: (item) => ({ id: item.id, name: item.name })
      };

      mockRedisClient.keys.mockResolvedValue(['test:1', 'test:2']);
      mockRedisClient.hGetAll.mockImplementation(async (key) => {
        if (key === 'test:1') return { id: '1', name: 'Old Item 1' };
        if (key === 'test:2') return { id: '2', name: 'Old Item 2' };
        return {};
      });

      const result = await cacheItems(mockItems, mockOptions);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockRedisClient.hSet).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during caching', async () => {
      const mockItems = [{ id: '1', name: 'Item 1' }];
      const mockOptions = {
        entityType: 'test',
        getItemId: (item) => item.id,
        isItemUnchanged: () => false,
        formatItemForCache: () => { throw new Error('fail'); }
      };

      const result = await cacheItems(mockItems, mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('fail');
    });

    it('caches items successfully', async () => {
      mockRedisClient.hSet.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue(['expert:1']);
      mockRedisClient.hGetAll.mockResolvedValue({});
      const items = [{ id: '1', foo: 'bar' }];
      const result = await cacheItems(items, options);
      expect(result.success).toBe(true);
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
    it('handles error and calls quit', async () => {
      mockRedisClient.hSet.mockRejectedValueOnce(new Error('fail'));
      const items = [{ id: '1', foo: 'bar' }];
      const result = await cacheItems(items, options);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/fail/);
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('getCachedItems', () => {
    it('should retrieve cached items by ID', async () => {
      const mockIds = ['1', '2'];
      const mockOptions = {
        entityType: 'test',
        formatItemFromCache: (data) => ({ id: data.id, name: data.name })
      };

      mockRedisClient.hGetAll.mockImplementation(async (key) => {
        if (key === 'test:1') return { id: '1', name: 'Item 1' };
        if (key === 'test:2') return { id: '2', name: 'Item 2' };
        return {};
      });

      const result = await getCachedItems(mockIds, mockOptions);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', name: 'Item 1' });
      expect(result[1]).toEqual({ id: '2', name: 'Item 2' });
    });

    it('should handle errors during retrieval', async () => {
      const mockOptions = {
        entityType: 'test',
        formatItemFromCache: () => { throw new Error('fail'); }
      };

      const result = await getCachedItems(null, mockOptions);

      expect(result).toEqual([]);
    });

    it('gets items successfully', async () => {
      mockRedisClient.keys.mockResolvedValue(['expert:1']);
      mockRedisClient.hGetAll.mockResolvedValue({ id: '1', foo: 'bar' });
      const result = await getCachedItems(null, { ...options, formatItemFromCache: (d) => d });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(expect.objectContaining({ id: '1', foo: 'bar' }));
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
    it('handles error and calls disconnect', async () => {
      mockRedisClient.keys.mockRejectedValueOnce(new Error('fail'));
      const result = await getCachedItems(null, options);
      expect(result).toEqual([]);
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should retrieve cache statistics', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({
        total_count: '100',
        new_count: '50',
        updated_count: '20',
        unchanged_count: '30',
        timestamp: '2023-01-01T00:00:00.000Z'
      });

      const result = await getCacheStats();

      expect(result.experts.total).toBe(100);
      expect(result.experts.new).toBe(50);
      expect(result.experts.updated).toBe(20);
      expect(result.experts.unchanged).toBe(30);
      expect(result.experts.lastUpdate).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should handle errors during retrieval', async () => {
      mockRedisClient.hGetAll.mockImplementation(() => {
        throw new Error('fail');
      });

      const result = await getCacheStats();

      expect(result.error).toBe('fail');
    });

    it('returns stats successfully', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({
        total_count: '2',
        new_count: '1',
        updated_count: '1',
        unchanged_count: '0',
        timestamp: 'now'
      });
      const result = await getCacheStats();
      expect(result).toHaveProperty('experts');
      expect(result.experts.total).toBe(2);
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
    it('handles error and calls disconnect', async () => {
      mockRedisClient.hGetAll.mockRejectedValueOnce(new Error('fail'));
      const result = await getCacheStats();
      expect(result).toHaveProperty('error');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});
