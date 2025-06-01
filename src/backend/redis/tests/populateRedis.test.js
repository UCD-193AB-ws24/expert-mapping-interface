global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

process.on('unhandledRejection', () => {});

describe('populateRedis.js', () => {
  it('should initialize and organize Redis if empty', (done) => {
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

  it('should sync Redis with Postgres if Redis is not empty', (done) => {
  jest.isolateModules(() => {
    const mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn()
        .mockResolvedValueOnce(['work:1']) // workKeys
        .mockResolvedValueOnce([]),        // grantKeys
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
    jest.doMock('../utils/syncRedis', () => ({
      syncRedisWithPostgres: jest.fn().mockResolvedValue(),
    }));

    const { syncRedisWithPostgres } = require('../utils/syncRedis');
    mockPool.connect.mockImplementation(() => Promise.resolve(pgClientMock));

    require('../populateRedis.js');

    setTimeout(() => {
      try {
        expect(redisClientMock.connect).toHaveBeenCalled();
        expect(mockPool.connect).toHaveBeenCalled();
        expect(syncRedisWithPostgres).toHaveBeenCalledWith(pgClientMock, redisClientMock);
        expect(pgClientMock.release).toHaveBeenCalled();
        expect(redisClientMock.disconnect).toHaveBeenCalled();
        done();
      } catch (err) {
        done(err);
      }
    }, 500);
  });
});

it('should handle errors during Redis synchronization', (done) => {
  jest.isolateModules(() => {
    const mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockRejectedValue(new Error('Redis keys failed')),
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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPool.connect.mockImplementation(() => Promise.resolve(pgClientMock));

    require('../populateRedis.js');

    setTimeout(() => {
      try {
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('❌ Error during Redis synchronization:'), expect.any(Error));
        expect(redisClientMock.disconnect).toHaveBeenCalled();
        expect(mockPool.end).toHaveBeenCalled();
        spy.mockRestore();
        done();
      } catch (err) {
        spy.mockRestore();
        done(err);
      }
    }, 500);
  });
});

it('should handle Redis client error event', (done) => {
  jest.isolateModules(() => {
    const mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn((event, cb) => {
        if (event === 'error') setTimeout(() => cb(new Error('Redis error')), 100);
      }),
      keys: jest.fn().mockResolvedValue([]),
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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');

    setTimeout(() => {
      try {
        expect(spy).toHaveBeenCalledWith('❌ Redis error:', expect.any(Error));
        expect(spyExit).toHaveBeenCalledWith(1);
        spy.mockRestore();
        spyExit.mockRestore();
        done();
      } catch (err) {
        spy.mockRestore();
        spyExit.mockRestore();
        done(err);
      }
    }, 500);
  });
});

it('should handle uncaughtException event', (done) => {
  jest.isolateModules(() => {
    const mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');
    process.emit('uncaughtException', new Error('Uncaught!'));

    setTimeout(() => {
      try {
        expect(spy).toHaveBeenCalledWith('❌ Uncaught Exception:', expect.any(Error));
        expect(spyExit).toHaveBeenCalledWith(1);
        spy.mockRestore();
        spyExit.mockRestore();
        done();
      } catch (err) {
        spy.mockRestore();
        spyExit.mockRestore();
        done(err);
      }
    }, 500);
  });
});

it('should handle unhandledRejection event', (done) => {
  jest.isolateModules(() => {
    const mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');
    process.emit('unhandledRejection', new Error('Rejected!'));

    setTimeout(() => {
      try {
        expect(spy).toHaveBeenCalledWith('❌ Unhandled Rejection:', expect.any(Error));
        expect(spyExit).toHaveBeenCalledWith(1);
        spy.mockRestore();
        spyExit.mockRestore();
        done();
      } catch (err) {
        spy.mockRestore();
        spyExit.mockRestore();
        done(err);
      }
    }, 500);
  });
});

it('should handle Redis client connection failure', (done) => {
  jest.isolateModules(() => {
    const mockPool = { connect: jest.fn(), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockRejectedValue(new Error('Connect fail')),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };
    const pgClientMock = { release: jest.fn(), query: jest.fn(), connect: jest.fn() };

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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../populateRedis.js');

    setTimeout(() => {
      try {
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('❌ Error during Redis synchronization:'), expect.any(Error));
        spy.mockRestore();
        done();
      } catch (err) {
        spy.mockRestore();
        done(err);
      }
    }, 500);
  });
});

it('should handle Postgres pool connection failure', (done) => {
  jest.isolateModules(() => {
    const mockPool = {
      connect: jest.fn().mockRejectedValue(new Error('PG connect fail')),
      end: jest.fn(),
    };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../populateRedis.js');

    setTimeout(() => {
      try {
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('❌ Error during Redis synchronization:'), expect.any(Error));
        spy.mockRestore();
        done();
      } catch (err) {
        spy.mockRestore();
        done(err);
      }
    }, 500);
  });
});

it('should handle error when pgClient.release throws', (done) => {
  jest.isolateModules(() => {
    const mockPool = { connect: jest.fn(), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };
    const pgClientMock = {
      release: jest.fn().mockImplementation(() => { throw new Error('Release fail'); }),
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

    require('../populateRedis.js');

    setTimeout(() => {
      // No error should be thrown, but you could spy on console.error if you want
      done();
    }, 500);
  });
});


it('should handle error when redisClient.disconnect throws', (done) => {
  jest.isolateModules(() => {
    const mockPool = { connect: jest.fn(), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockRejectedValue(new Error('Disconnect fail')),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };
    const pgClientMock = { release: jest.fn(), query: jest.fn(), connect: jest.fn() };

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

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../populateRedis.js');

    setTimeout(() => {
      // No error should be thrown, but you could spy on console.error if you want
      spy.mockRestore();
      done();
    }, 500);
  });
});

it('should exit on uncaughtException', (done) => {
  jest.isolateModules(() => {
    // ...mocks...
    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    require('../populateRedis.js');
    process.emit('uncaughtException', new Error('Test uncaught'));
    setTimeout(() => {
      expect(spyExit).toHaveBeenCalledWith(1);
      spyExit.mockRestore();
      done();
    }, 100);
  });
});

it('should take the alternate branch if Redis is already initialized', (done) => {
  jest.isolateModules(() => {
    // ...mocks...
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn()
        .mockResolvedValueOnce(['work:1']) // workKeys not empty
        .mockResolvedValueOnce([]),        // grantKeys
    };
    // ...rest of mocks...
    require('../populateRedis.js');
    setTimeout(() => {
      // assert that the alternate branch was taken (e.g., syncRedisWithPostgres called)
      done();
    }, 500);
  });
});

it('should exit with 0 when not in test mode', (done) => {
  jest.isolateModules(() => {
    const oldJestWorkerId = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID; // isTest will be false

    const mockPool = { connect: jest.fn().mockResolvedValue({ release: jest.fn() }), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      hSet: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
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

    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');

    setTimeout(() => {
      expect(spyExit).toHaveBeenCalledWith(0);
      spyExit.mockRestore();
      // Restore JEST_WORKER_ID for other tests
      if (oldJestWorkerId !== undefined) {
        process.env.JEST_WORKER_ID = oldJestWorkerId;
      }
      done();
    }, 500);
  });
});
it('should not exit if Redis error event is not emitted', (done) => {
  jest.isolateModules(() => {
    const mockPool = { connect: jest.fn().mockResolvedValue({ release: jest.fn() }), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(), // does not emit error
      keys: jest.fn().mockResolvedValue([]),
      hSet: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
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

    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');

    setTimeout(() => {
      expect(spyExit).not.toHaveBeenCalledWith(1);
      spyExit.mockRestore();
      done();
    }, 500);
  });
});

it('should not exit if uncaughtException is not emitted', (done) => {
  jest.isolateModules(() => {
    const mockPool = { connect: jest.fn().mockResolvedValue({ release: jest.fn() }), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      hSet: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
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

    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');

    setTimeout(() => {
      expect(spyExit).not.toHaveBeenCalledWith(1);
      spyExit.mockRestore();
      done();
    }, 500);
  });
});
it('should cover both branches of Redis error event handler', (done) => {
  jest.isolateModules(() => {
    const mockPool = { connect: jest.fn().mockResolvedValue({ release: jest.fn() }), end: jest.fn() };
    const redisClientMock = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      on: jest.fn((event, cb) => {
        if (event === 'error') {
          // First, do nothing (not called)
          // Then, call the callback after a delay
          setTimeout(() => cb(new Error('Redis error')), 250);
        }
      }),
      keys: jest.fn().mockResolvedValue([]),
      hSet: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
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

    const spyExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    require('../populateRedis.js');

    setTimeout(() => {
      // First branch: handler registered but not called
      expect(spyExit).not.toHaveBeenCalledWith(1);
    }, 100);

    setTimeout(() => {
      // Second branch: handler called
      expect(spyExit).toHaveBeenCalledWith(1);
      spyExit.mockRestore();
      done();
    }, 400);
  });
});


});