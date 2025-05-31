const { initializeRedis, sanitizeRedisData } = require("../initializeRedis");

describe("initializeRedis", () => {
  let redisClient, pgClient, logSpy, errorSpy, warnSpy;

  beforeEach(() => {
    redisClient = {
      hSet: jest.fn().mockResolvedValue(),
    };
    pgClient = {
      query: jest.fn(),
    };
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it("loads works and grants into Redis, including entries", async () => {
    const now = new Date();
    pgClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            name: "Work1",
            properties: {
              foo: "bar",
              entries: [
                {
                  id: "e1",
                  title: "Entry1",
                  issued: ["2020"],
                  authors: ["A"],
                  abstract: "abs",
                  confidence: "high",
                  relatedExperts: ["ex1"],
                },
              ],
            },
            geometry: { type: "Point", coordinates: [0, 0] },
            created_at: now,
            updated_at: now,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "2",
            name: "Grant1",
            properties: {
              baz: "qux",
              entries: [
                {
                  id: "g1",
                  url: "http://grant.com",
                  title: "GrantEntry",
                  funder: "NSF",
                  endDate: "2022",
                  startDate: "2021",
                  confidence: "medium",
                  relatedExperts: ["ex2"],
                },
              ],
            },
            geometry: { type: "Point", coordinates: [1, 1] },
            created_at: now,
            updated_at: now,
          },
        ],
      });

    await initializeRedis(redisClient, pgClient);

    // Main hashes
    expect(redisClient.hSet).toHaveBeenCalledWith(
      "work:1",
      expect.objectContaining({
        id: "1",
        name: "Work1",
        foo: "bar",
        geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
    );
    expect(redisClient.hSet).toHaveBeenCalledWith(
      "grant:2",
      expect.objectContaining({
        id: "2",
        name: "Grant1",
        baz: "qux",
        geometry: JSON.stringify({ type: "Point", coordinates: [1, 1] }),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
    );
    // Entry hashes
    expect(redisClient.hSet).toHaveBeenCalledWith(
      "work:1:entry:1",
      expect.objectContaining({
        id: "e1",
        title: "Entry1",
        issued: JSON.stringify(["2020"]),
        authors: JSON.stringify(["A"]),
        abstract: "abs",
        confidence: "high",
        relatedExperts: JSON.stringify(["ex1"]),
      })
    );
    expect(redisClient.hSet).toHaveBeenCalledWith(
      "grant:2:entry:1",
      expect.objectContaining({
        id: "g1",
        url: "http://grant.com",
        title: "GrantEntry",
        funder: "NSF",
        endDate: "2022",
        startDate: "2021",
        confidence: "medium",
        relatedExperts: JSON.stringify(["ex2"]),
      })
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Successfully loaded all data into Redis!"));
  });

  it("handles missing or null properties and geometry", async () => {
    const now = new Date();
    pgClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            name: "NoProps",
            properties: null,
            geometry: null,
            created_at: now,
            updated_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    await initializeRedis(redisClient, pgClient);

    expect(redisClient.hSet).toHaveBeenCalledWith(
      "work:3",
      expect.objectContaining({
        id: "3",
        name: "NoProps",
        geometry: '{}',
        created_at: now.toISOString(),
        updated_at: "",
      })
    );
  });

  it("skips invalid entries and warns", async () => {
    const now = new Date();
    pgClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "4",
            name: "WorkWithBadEntry",
            properties: {
              entries: [null, 123, undefined, { id: "ok", title: "Good" }],
            },
            geometry: { type: "Point", coordinates: [2, 2] },
            created_at: now,
            updated_at: now,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await initializeRedis(redisClient, pgClient);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), 123);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), undefined);
    expect(redisClient.hSet).toHaveBeenCalledWith(
      "work:4:entry:4",
      expect.objectContaining({ id: "ok", title: "Good" })
    );
  });

  it("logs and throws on error", async () => {
    pgClient.query.mockRejectedValueOnce(new Error("fail!"));
    await expect(initializeRedis(redisClient, pgClient)).rejects.toThrow("fail!");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Error loading data into Redis:"), expect.any(Error));
  });

  it("handles when properties.entries is missing", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "5",
          name: "NoEntries",
          properties: { foo: "bar" }, // no entries key
          geometry: { type: "Point", coordinates: [3, 3] },
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:5",
    expect.objectContaining({
      id: "5",
      name: "NoEntries",
      foo: "bar",
      geometry: JSON.stringify({ type: "Point", coordinates: [3, 3] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles when properties.entries is not an array", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "6",
          name: "BadEntries",
          properties: { entries: "not-an-array" },
          geometry: { type: "Point", coordinates: [4, 4] },
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:6",
    expect.objectContaining({
      id: "6",
      name: "BadEntries",
      geometry: JSON.stringify({ type: "Point", coordinates: [4, 4] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles missing created_at and updated_at", async () => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "7",
          name: "NoDates",
          properties: {},
          geometry: { type: "Point", coordinates: [5, 5] },
          // no created_at or updated_at
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:7",
    expect.objectContaining({
      id: "7",
      name: "NoDates",
      geometry: JSON.stringify({ type: "Point", coordinates: [5, 5] }),
      created_at: "",
      updated_at: "",
    })
  );
});

it("handles empty geometry object", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "8",
          name: "EmptyGeom",
          properties: {},
          geometry: {},
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:8",
    expect.objectContaining({
      id: "8",
      name: "EmptyGeom",
      geometry: JSON.stringify({}),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles properties as a non-object (string)", async () => {
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "9",
          name: "BadProps",
          properties: "not-an-object",
          geometry: { type: "Point", coordinates: [9, 9] },
          created_at: undefined,
          updated_at: undefined,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:9",
    expect.objectContaining({
      id: "9",
      name: "BadProps",
      geometry: JSON.stringify({ type: "Point", coordinates: [9, 9] }),
      created_at: "",
      updated_at: "",
    })
  );
});

it("handles empty entries array", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "10",
          name: "EmptyEntries",
          properties: { entries: [] },
          geometry: { type: "Point", coordinates: [10, 10] },
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:10",
    expect.objectContaining({
      id: "10",
      name: "EmptyEntries",
      geometry: JSON.stringify({ type: "Point", coordinates: [10, 10] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
  // No entry hashes should be created
  expect(redisClient.hSet).toHaveBeenCalledTimes(1);
});

it("handles grant with missing created_at and updated_at", async () => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "11",
          name: "GrantNoDates",
          properties: {},
          geometry: { type: "Point", coordinates: [11, 11] },
          // no created_at or updated_at
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:11",
    expect.objectContaining({
      id: "11",
      name: "GrantNoDates",
      geometry: JSON.stringify({ type: "Point", coordinates: [11, 11] }),
      created_at: "",
      updated_at: "",
    })
  );
});

it("handles grant with null properties", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "12",
          name: "GrantNullProps",
          properties: null,
          geometry: { type: "Point", coordinates: [12, 12] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:12",
    expect.objectContaining({
      id: "12",
      name: "GrantNullProps",
      geometry: JSON.stringify({ type: "Point", coordinates: [12, 12] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles grant with entries not an array", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "13",
          name: "GrantBadEntries",
          properties: { entries: "not-an-array" },
          geometry: { type: "Point", coordinates: [13, 13] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:13",
    expect.objectContaining({
      id: "13",
      name: "GrantBadEntries",
      geometry: JSON.stringify({ type: "Point", coordinates: [13, 13] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles grant with properties as a non-object (string)", async () => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "14",
          name: "GrantBadProps",
          properties: "not-an-object",
          geometry: { type: "Point", coordinates: [14, 14] },
          created_at: undefined,
          updated_at: undefined,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:14",
    expect.objectContaining({
      id: "14",
      name: "GrantBadProps",
      geometry: JSON.stringify({ type: "Point", coordinates: [14, 14] }),
      created_at: "",
      updated_at: "",
    })
  );
});

it("handles grant with empty entries array", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "15",
          name: "GrantEmptyEntries",
          properties: { entries: [] },
          geometry: { type: "Point", coordinates: [15, 15] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:15",
    expect.objectContaining({
      id: "15",
      name: "GrantEmptyEntries",
      geometry: JSON.stringify({ type: "Point", coordinates: [15, 15] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
  // No entry hashes should be created
  expect(redisClient.hSet).toHaveBeenCalledTimes(1 + /* previous calls in this test */ 0);
});

it("handles grant with null geometry", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "16",
          name: "GrantNullGeom",
          properties: {},
          geometry: null,
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:16",
    expect.objectContaining({
      id: "16",
      name: "GrantNullGeom",
      geometry: '{}',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles grant with empty geometry object", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "17",
          name: "GrantEmptyGeom",
          properties: {},
          geometry: {},
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:17",
    expect.objectContaining({
      id: "17",
      name: "GrantEmptyGeom",
      geometry: JSON.stringify({}),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles work with entries as null", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "18",
          name: "WorkNullEntries",
          properties: { entries: null },
          geometry: { type: "Point", coordinates: [18, 18] },
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:18",
    expect.objectContaining({
      id: "18",
      name: "WorkNullEntries",
      geometry: JSON.stringify({ type: "Point", coordinates: [18, 18] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles work with properties as undefined", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "19",
          name: "WorkUndefinedProps",
          // properties is undefined
          geometry: { type: "Point", coordinates: [19, 19] },
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:19",
    expect.objectContaining({
      id: "19",
      name: "WorkUndefinedProps",
      geometry: JSON.stringify({ type: "Point", coordinates: [19, 19] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles grant with properties as undefined", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "20",
          name: "GrantUndefinedProps",
          // properties is undefined
          geometry: { type: "Point", coordinates: [20, 20] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:20",
    expect.objectContaining({
      id: "20",
      name: "GrantUndefinedProps",
      geometry: JSON.stringify({ type: "Point", coordinates: [20, 20] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles work with geometry as undefined", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "21",
          name: "WorkNoGeom",
          properties: {},
          // geometry is undefined
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:21",
    expect.objectContaining({
      id: "21",
      name: "WorkNoGeom",
      geometry: '{}',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles grant with geometry as undefined", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "22",
          name: "GrantNoGeom",
          properties: {},
          // geometry is undefined
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:22",
    expect.objectContaining({
      id: "22",
      name: "GrantNoGeom",
      geometry: '{}',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles work with entries as an empty string", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({
      rows: [
        {
          id: "23",
          name: "WorkEntriesEmptyString",
          properties: { entries: "" },
          geometry: { type: "Point", coordinates: [23, 23] },
          created_at: now,
          updated_at: now,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "work:23",
    expect.objectContaining({
      id: "23",
      name: "WorkEntriesEmptyString",
      geometry: JSON.stringify({ type: "Point", coordinates: [23, 23] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("logs and continues if sanitizeRedisData throws", async () => {
    const now = new Date();
    jest.spyOn(require("../initializeRedis"), "sanitizeRedisData").mockImplementation(() => { throw new Error("sanitize error"); });

    pgClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "25",
            name: "WorkSanitizeError",
            properties: {},
            geometry: { type: "Point", coordinates: [25, 25] },
            created_at: now,
            updated_at: now,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(initializeRedis(redisClient, pgClient)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Error sanitizing data"), expect.any(Error));

    require("../initializeRedis").sanitizeRedisData.mockRestore();
});


it("handles empty works and grants result sets", async () => {
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Successfully loaded all data into Redis!"));
});

it("handles grant with valid entries array", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "30",
          name: "GrantWithEntries",
          properties: {
            entries: [
              { id: "gentry1", title: "Grant Entry 1" }
            ]
          },
          geometry: { type: "Point", coordinates: [30, 30] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:30:entry:1",
    expect.objectContaining({
      id: "gentry1",
      title: "Grant Entry 1"
    })
  );
});
it("warns and skips invalid grant entries", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "31",
          name: "GrantWithBadEntry",
          properties: {
            entries: [null, 123, undefined, { id: "ok", title: "Good" }]
          },
          geometry: { type: "Point", coordinates: [31, 31] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), null);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), 123);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), undefined);
  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:31:entry:4",
    expect.objectContaining({ id: "ok", title: "Good" })
  );
});
it("warns and skips invalid grant entries", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "31",
          name: "GrantWithBadEntry",
          properties: {
            entries: [null, 123, undefined, { id: "ok", title: "Good" }]
          },
          geometry: { type: "Point", coordinates: [31, 31] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), null);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), 123);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), undefined);
  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:31:entry:4",
    expect.objectContaining({ id: "ok", title: "Good" })
  );
});

it("warns and skips invalid grant entries", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "31",
          name: "GrantWithBadEntry",
          properties: {
            entries: [null, 123, undefined, { id: "ok", title: "Good" }]
          },
          geometry: { type: "Point", coordinates: [31, 31] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), null);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), 123);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), undefined);
  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:31:entry:4",
    expect.objectContaining({ id: "ok", title: "Good" })
  );
});

it("handles grant with entries as a number", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "34",
          name: "GrantEntriesNumber",
          properties: { entries: 42 },
          geometry: { type: "Point", coordinates: [34, 34] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:34",
    expect.objectContaining({
      id: "34",
      name: "GrantEntriesNumber",
      geometry: JSON.stringify({ type: "Point", coordinates: [34, 34] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});
it("handles grant with entries as an object", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "35",
          name: "GrantEntriesObject",
          properties: { entries: { foo: "bar" } },
          geometry: { type: "Point", coordinates: [35, 35] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:35",
    expect.objectContaining({
      id: "35",
      name: "GrantEntriesObject",
      geometry: JSON.stringify({ type: "Point", coordinates: [35, 35] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});

it("handles grant with entries array of only invalid entries", async () => {
  const now = new Date();
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "36",
          name: "GrantOnlyInvalidEntries",
          properties: { entries: [null, undefined, 123] },
          geometry: { type: "Point", coordinates: [36, 36] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await initializeRedis(redisClient, pgClient);

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), null);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), undefined);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid entry"), 123);
  // Only the main hash should be set
  expect(redisClient.hSet).toHaveBeenCalledWith(
    "grant:36",
    expect.objectContaining({
      id: "36",
      name: "GrantOnlyInvalidEntries",
      geometry: JSON.stringify({ type: "Point", coordinates: [36, 36] }),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
  );
});
it("logs and continues if redisClient.hSet throws for a grant entry", async () => {
  const now = new Date();
  redisClient.hSet
    .mockResolvedValueOnce() // for main grant hash
    .mockRejectedValueOnce(new Error("Grant entry error")); // for entry
  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "40",
          name: "GrantWithEntryError",
          properties: { entries: [{ id: "bad", title: "BadEntry" }] },
          geometry: { type: "Point", coordinates: [40, 40] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await expect(initializeRedis(redisClient, pgClient)).resolves.toBeUndefined();
  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Error writing entry to Redis"), expect.any(Error));
});

it("logs and continues if sanitizeRedisData throws for a grant", async () => {
  const now = new Date();
  jest.spyOn(require("../initializeRedis"), "sanitizeRedisData").mockImplementation(() => { throw new Error("sanitize error"); });

  pgClient.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "41",
          name: "GrantSanitizeError",
          properties: {},
          geometry: { type: "Point", coordinates: [41, 41] },
          created_at: now,
          updated_at: now,
        },
      ],
    });

  await expect(initializeRedis(redisClient, pgClient)).resolves.toBeUndefined();
  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Error sanitizing data"), expect.any(Error));

  require("../initializeRedis").sanitizeRedisData.mockRestore();
});

});