global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

describe('populateRedis.js', () => {
  it('should initialize and organize Redis if empty', () => {
    jest.isolateModules(() => {
      // Define mocks INSIDE the isolateModules callback
      const mockPool = {
        connect: jest.fn(),
        end: jest.fn(),
      };
      const redisClientMock = {
        connect: jest.fn().mockResolvedValue(),
        disconnect: jest.fn().mockResolvedValue(),
        on: jest.fn(),
        keys: jest.fn().mockResolvedValue([]),
        hSet: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(0),
        set: jest.fn().mockResolvedValue('OK'),
      };
      const pgClientMock = {
        release: jest.fn(),
        query: jest.fn().mockResolvedValue({ rows: [] }),
        connect: jest.fn(),
      };

      jest.doMock('../../postgis/config.js', () => ({ pool: mockPool }));
      jest.doMock('../../etl/aggieExpertsAPI/utils/redisUtils', () => ({
        createRedisClient: jest.fn(() => redisClientMock),
      }));
      jest.doMock('../utils/organizeRedis', () => ({
        organizeRedis: jest.fn().mockResolvedValue(),
      }));
      jest.doMock('../utils/initializeRedis', () => ({
        initializeRedis: jest.fn().mockResolvedValue(),
      }));

      // Now require after all mocks are set up
      const { organizeRedis } = require('../utils/organizeRedis');
      const { initializeRedis } = require('../utils/initializeRedis');
       mockPool.connect.mockImplementation(() => {
      console.log('MOCK POOL.CONNECT CALLED');
      return Promise.resolve(pgClientMock);
    });

    // Trigger the top-level script
    require('../populateRedis.js');

    // Wait for the async logic in the file to complete
    setTimeout(() => {
      try {
        expect(redisClientMock.connect).toHaveBeenCalled();
        expect(mockPool.connect).toHaveBeenCalled();
        expect(initializeRedis).toHaveBeenCalledWith(redisClientMock, pgClientMock);
        expect(organizeRedis).toHaveBeenCalledWith(redisClientMock);
        expect(pgClientMock.release).toHaveBeenCalled();
        expect(redisClientMock.disconnect).toHaveBeenCalled();
        done();
      } catch (err) {
        done(err); // let Jest report the error
      }
    }, 500); // ✅ small delay to let the async logic complete
    });
  });
});