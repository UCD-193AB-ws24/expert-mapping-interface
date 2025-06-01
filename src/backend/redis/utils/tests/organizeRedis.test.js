const { flushSelectedRedisKeys, organizeRedis, saveLayerSpecificityMapsToRedis } = require('../organizeRedis');

describe('organizeRedis.js', () => {
  let redisClient;

  beforeEach(() => {
    redisClient = {
      set: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
      scan: jest.fn().mockResolvedValue(['0', []]),
    };
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should save all layer specificity maps to Redis', async () => {
    const maps = {
      fooMap: new Map([['a', 1]]),
      barMap: new Map([['b', 2]])
    };
    await saveLayerSpecificityMapsToRedis(redisClient, maps, 'testType');
    expect(redisClient.set).toHaveBeenCalledWith(
      'layer:testType:foo',
      JSON.stringify({ a: 1 })
    );
    expect(redisClient.set).toHaveBeenCalledWith(
      'layer:testType:bar',
      JSON.stringify({ b: 2 })
    );
  });

  it('should flush selected Redis keys with no layer keys', async () => {
    const { flushSelectedRedisKeys } = require('../organizeRedis');
    await flushSelectedRedisKeys(redisClient);
    expect(redisClient.del).toHaveBeenCalledWith('expertsMap', 'worksMap', 'grantsMap');
  });

  it('should flush selected Redis keys with some layer keys', async () => {
    const { flushSelectedRedisKeys } = require('../organizeRedis');
    redisClient.scan
      .mockResolvedValueOnce(['1', ['layer:foo', 'layer:bar']])
      .mockResolvedValueOnce(['0', []]);
    await flushSelectedRedisKeys(redisClient);
    expect(redisClient.del).toHaveBeenCalledWith('layer:foo', 'layer:bar');
  });

  it('should organize redis and save all maps', async () => {
    // Mock buildRedisMaps
    jest.doMock('../organizeRedisMaps.js', () => ({
      buildRedisMaps: jest.fn().mockResolvedValue({
        expertsMap: new Map([['a', 1]]),
        grantsMap: new Map([['b', 2]]),
        worksMap: new Map([['c', 3]]),
        workLayerSpecificityMaps: { fooMap: new Map([['x', 1]]) },
        grantLayerSpecificityMaps: { barMap: new Map([['y', 2]]) },
        combinedLayerSpecificityMaps: { bazMap: new Map([['z', 3]]) },
        overlapWorkLayerSpecificityMaps: { quxMap: new Map([['w', 4]]) },
        overlapGrantLayerSpecificityMaps: { quuxMap: new Map([['v', 5]]) },
      }),
    }));
    // Re-require after mocking
    const { organizeRedis } = require('../organizeRedis');
    await organizeRedis(redisClient);
    expect(redisClient.set).toHaveBeenCalledWith('expertsMap', JSON.stringify({ a: 1 }));
    expect(redisClient.set).toHaveBeenCalledWith('worksMap', JSON.stringify({ c: 3 }));
    expect(redisClient.set).toHaveBeenCalledWith('grantsMap', JSON.stringify({ b: 2 }));
  });

  it('should handle error in organizeRedis', async () => {
    jest.doMock('../organizeRedisMaps.js', () => ({
      buildRedisMaps: jest.fn().mockRejectedValue(new Error('fail')),
    }));
    const { organizeRedis } = require('../organizeRedis');
    await expect(organizeRedis(redisClient)).rejects.toThrow('fail');
  });
  it('should handle error in organizeRedis', async () => {
    jest.doMock('../organizeRedisMaps.js', () => ({
      buildRedisMaps: jest.fn().mockRejectedValue(new Error('fail')),
    }));

    // Now require after mocking
    const { organizeRedis } = require('../organizeRedis');
    await expect(organizeRedis(redisClient)).rejects.toThrow('fail');
  });

  
});