const { syncRedisWithPostgres } = require('../syncRedis');

describe('syncRedisWithPostgres', () => {
   let pgClient, redisClient, organizeRedisMock;

  beforeEach(() => {
    pgClient = {
      query: jest.fn(),
    };
    redisClient = {
      keys: jest.fn(),
      hGetAll: jest.fn(),
      hSet: jest.fn(),
      exists: jest.fn(),
      del: jest.fn().mockResolvedValue(),
      scan: jest.fn().mockResolvedValue(['0', []]),
      set: jest.fn().mockResolvedValue(),
    };
    organizeRedisMock = jest.fn();
    jest.resetModules();
    jest.doMock('../organizeRedis', () => ({
      organizeRedis: organizeRedisMock,
    }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('updates existing work and grant in Redis if updated_at is newer', (done) => {
    pgClient.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Work1',
          properties: { entries: [{ id: 'e1', authors: ['A'], issued: ['2021'] }] },
          geometry: { type: 'Point', coordinates: [0, 0] },
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2022-01-02'),
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          name: 'Grant1',
          properties: { entries: [{ id: 'g1', relatedExperts: ['E'] }] },
          geometry: { type: 'Point', coordinates: [1, 1] },
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2022-01-02'),
        }]
      });
    redisClient.keys
      .mockResolvedValueOnce(['work:1'])
      .mockResolvedValueOnce(['grant:2'])
      .mockResolvedValueOnce([]) // work entry keys
      .mockResolvedValueOnce([]); // grant entry keys
    redisClient.hGetAll
      .mockResolvedValueOnce({ updated_at: '2020-01-01T00:00:00.000Z' }) // work
      .mockResolvedValueOnce({ updated_at: '2020-01-01T00:00:00.000Z' }); // grant
    redisClient.hSet.mockResolvedValue();
    redisClient.exists.mockResolvedValue(false);

    jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      expect(organizeRedisMock).toHaveBeenCalledWith(redisClient);
      done();
    });
  });
});

  it('skips updating if updated_at is not newer', (done) => {
    pgClient.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Work1',
          properties: { entries: [] },
          geometry: { type: 'Point', coordinates: [0, 0] },
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2020-01-02'),
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          name: 'Grant1',
          properties: { entries: [] },
          geometry: { type: 'Point', coordinates: [1, 1] },
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2020-01-02'),
        }]
      });
    redisClient.keys
      .mockResolvedValueOnce(['work:1'])
      .mockResolvedValueOnce(['grant:2'])
      .mockResolvedValueOnce([]) // work entry keys
      .mockResolvedValueOnce([]); // grant entry keys
    redisClient.hGetAll
      .mockResolvedValueOnce({ updated_at: '2022-01-02T00:00:00.000Z' }) // work
      .mockResolvedValueOnce({ updated_at: '2022-01-02T00:00:00.000Z' }); // grant
    redisClient.hSet.mockResolvedValue();

    jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(organizeRedisMock).not.toHaveBeenCalled();
      done();
    });
  });
});
    
  it('skips invalid work and grant entries', (done) => {
    pgClient.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Work1',
          properties: { entries: [null, 123, { id: 'e1' }] },
          geometry: { type: 'Point', coordinates: [0, 0] },
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2020-01-02'),
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          name: 'Grant1',
          properties: { entries: [undefined, 'bad', { id: 'g1' }] },
          geometry: { type: 'Point', coordinates: [1, 1] },
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2020-01-02'),
        }]
      });
    redisClient.keys
      .mockResolvedValueOnce([]) // work keys
      .mockResolvedValueOnce([]) // grant keys
      .mockResolvedValueOnce([]) // work entry keys
      .mockResolvedValueOnce([]); // grant entry keys
    redisClient.hGetAll.mockResolvedValue({});
    redisClient.hSet.mockResolvedValue();
    redisClient.exists.mockResolvedValue(false);
    jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      done();
    });
  });
});

  it('does not call organize if no changes detected', (done) => {
    pgClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    redisClient.keys
      .mockResolvedValueOnce([]) // work keys
      .mockResolvedValueOnce([]); // grant keys
    redisClient.hGetAll.mockResolvedValue({});
    redisClient.hSet.mockResolvedValue();

    jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
    expect(organizeRedisMock).not.toHaveBeenCalled();
    done();
    });
    });
  });

  it('handles missing entries array in properties for new work', (done) => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [{
        id: 1,
        name: 'Work1',
        properties: {}, // No entries
        geometry: { type: 'Point', coordinates: [0, 0] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2020-01-02'),
      }]
    })
    .mockResolvedValueOnce({ rows: [] });
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce([]); // grant keys
  redisClient.hGetAll.mockResolvedValue({});
  redisClient.hSet.mockResolvedValue();
  redisClient.exists.mockResolvedValue(false);

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      done();
    });
  });
});

it('handles non-array entries in properties for new grant', (done) => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [{
        id: 2,
        name: 'Grant1',
        properties: { entries: 'not-an-array' },
        geometry: { type: 'Point', coordinates: [1, 1] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2020-01-02'),
      }]
    });
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce([]); // grant keys
  redisClient.hGetAll.mockResolvedValue({});
  redisClient.hSet.mockResolvedValue();
  redisClient.exists.mockResolvedValue(false);

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      done();
    });
  });
});

it('adds only new entries for updated work', (done) => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [{
        id: 1,
        name: 'Work1',
        properties: { entries: [{ id: 'e1' }, { id: 'e2' }] },
        geometry: { type: 'Point', coordinates: [0, 0] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2022-01-02'),
      }]
    })
    .mockResolvedValueOnce({ rows: [] });
  redisClient.keys
    .mockResolvedValueOnce(['work:1'])
    .mockResolvedValueOnce([]); // grant keys
  redisClient.hGetAll
    .mockResolvedValueOnce({ updated_at: '2020-01-01T00:00:00.000Z' }); // work
  redisClient.hSet.mockResolvedValue();
  redisClient.exists
    .mockResolvedValueOnce(true)  // entry 1 exists
    .mockResolvedValueOnce(false); // entry 2 does not exist

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      done();
    });
  });
});

it('does not call organize if no works or grants in Postgres', (done) => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce([]); // grant keys
  redisClient.hGetAll.mockResolvedValue({});
  redisClient.hSet.mockResolvedValue();

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(organizeRedisMock).not.toHaveBeenCalled();
      done();
    });
  });
});

it('updates existing grant in Redis if updated_at is newer', (done) => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [{
        id: 2,
        name: 'Grant1',
        properties: { entries: [{ id: 'g1', relatedExperts: ['E'] }, { id: 'g2' }] },
        geometry: { type: 'Point', coordinates: [1, 1] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2022-01-02'),
      }]
    });
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(['grant:2'])
    .mockResolvedValueOnce([]); // grant entry keys
  redisClient.hGetAll
    .mockResolvedValueOnce({ updated_at: '2020-01-01T00:00:00.000Z' }); // grant
  redisClient.hSet.mockResolvedValue();
  redisClient.exists
    .mockResolvedValueOnce(true)  // entry 1 exists
    .mockResolvedValueOnce(false); // entry 2 does not exist

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      expect(organizeRedisMock).toHaveBeenCalledWith(redisClient);
      done();
    });
  });
});

it('does not update grant if updated_at is not newer', (done) => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [{
        id: 2,
        name: 'Grant1',
        properties: { entries: [{ id: 'g1', relatedExperts: ['E'] }] },
        geometry: { type: 'Point', coordinates: [1, 1] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2020-01-02'),
      }]
    });
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(['grant:2']);
  redisClient.hGetAll
    .mockResolvedValueOnce({ updated_at: '2022-01-02T00:00:00.000Z' }); // grant
  redisClient.hSet.mockResolvedValue();

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(organizeRedisMock).not.toHaveBeenCalled();
      done();
    });
  });
});

it('covers else branch for no changes needed in both works and grants', (done) => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [{
        id: 1,
        name: 'Work1',
        properties: { entries: [{ id: 'e1' }] },
        geometry: { type: 'Point', coordinates: [0, 0] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2020-01-02'),
      }]
    })
    .mockResolvedValueOnce({
      rows: [{
        id: 2,
        name: 'Grant1',
        properties: { entries: [{ id: 'g1' }] },
        geometry: { type: 'Point', coordinates: [1, 1] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2020-01-02'),
      }]
    });
  redisClient.keys
    .mockResolvedValueOnce(['work:1'])
    .mockResolvedValueOnce(['grant:2']);
  redisClient.hGetAll
    .mockResolvedValueOnce({ updated_at: '2022-01-02T00:00:00.000Z' }) // work
    .mockResolvedValueOnce({ updated_at: '2022-01-02T00:00:00.000Z' }); // grant
  redisClient.hSet.mockResolvedValue();

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(organizeRedisMock).not.toHaveBeenCalled();
      done();
    });
  });
});

it('covers both redisWorkChanged and redisGrantChanged true for organizing', (done) => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [{
        id: 1,
        name: 'Work1',
        properties: { entries: [{ id: 'e1' }] },
        geometry: { type: 'Point', coordinates: [0, 0] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2022-01-02'),
      }]
    })
    .mockResolvedValueOnce({
      rows: [{
        id: 2,
        name: 'Grant1',
        properties: { entries: [{ id: 'g1' }] },
        geometry: { type: 'Point', coordinates: [1, 1] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2022-01-02'),
      }]
    });
  redisClient.keys
    .mockResolvedValueOnce(['work:1'])
    .mockResolvedValueOnce(['grant:2']);
  redisClient.hGetAll
    .mockResolvedValueOnce({ updated_at: '2020-01-01T00:00:00.000Z' }) // work
    .mockResolvedValueOnce({ updated_at: '2020-01-01T00:00:00.000Z' }); // grant
  redisClient.hSet.mockResolvedValue();
  redisClient.exists.mockResolvedValue(false);

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(organizeRedisMock).toHaveBeenCalledWith(redisClient);
      done();
    });
  });
});

it('handles missing properties on a row', (done) => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [{
        id: 1,
        name: 'Work1',
        // properties is missing
        geometry: { type: 'Point', coordinates: [0, 0] },
        created_at: new Date('2020-01-01'),
        updated_at: new Date('2020-01-02'),
      }]
    })
    .mockResolvedValueOnce({ rows: [] });
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce([]); // grant keys
  redisClient.hGetAll.mockResolvedValue({});
  redisClient.hSet.mockResolvedValue();
  redisClient.exists.mockResolvedValue(false);

  jest.isolateModules(() => {
    const { syncRedisWithPostgres } = require('../syncRedis');
    syncRedisWithPostgres(pgClient, redisClient).then(() => {
      expect(redisClient.hSet).toHaveBeenCalled();
      done();
    });
  });
});

});