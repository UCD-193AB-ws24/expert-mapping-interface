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
    quit: jest.fn().mockResolvedValue(undefined)
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

      // Mock implementation of cacheItems
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
      
      const result = await cacheEntities('expert', mockEntities);
      
      expect(result).toEqual({
        success: false,
        error: 'Cache error'
      });
    });
  });

  describe('getCachedEntities', () => {
    it('should retrieve all cached entities', async () => {
      redisUtils.getCachedItems.mockResolvedValueOnce([
        { expertId: '123', fullName: 'John Doe' },
        { expertId: '456', fullName: 'Jane Smith' }
      ]);

      const result = await getCachedEntities();

      expect(redisUtils.getCachedItems).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          entityType: 'expert'
        })
      );

      expect(result).toEqual({
        success: true,
        items: [
          { expertId: '123', fullName: 'John Doe' },
          { expertId: '456', fullName: 'Jane Smith' }
        ],
        sessionId: undefined
      });
    });

    it('should handle empty results', async () => {
      redisUtils.getCachedItems.mockResolvedValueOnce([]);
      
      const result = await getCachedEntities();
      
      expect(result).toEqual({
        success: true,
        items: [],
        sessionId: undefined
      });
    });
  });

  describe('getRecentCachedEntities', () => {
    it('should retrieve only the most recent cached entities', async () => {
      // Mock the Redis client to return metadata with last session
      mockRedisClient.hGetAll.mockResolvedValueOnce({
        last_session: 'session_12345'
      });

      redisUtils.getCachedItems.mockResolvedValueOnce([
        { expertId: '123', session: 'session_12345' },
        { expertId: '456', session: 'session_12345' }
      ]);

      const result = await getRecentCachedEntities();

      expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('expert:metadata');
      expect(result).toEqual({
        success: true,
        items: [
          { expertId: '123', session: 'session_12345' },
          { expertId: '456', session: 'session_12345' }
        ],
        sessionId: 'session_12345'
      });
    });

    it('should handle missing metadata', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});
      
      const result = await getRecentCachedEntities();
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('No session ID found')
      });
    });
  });
});
