const { insertWork, insertGrant } = require("../insertData");

jest.mock("../../cacheMiddleware", () => ({
  writeThroughCache: jest.fn(),
}));

const { writeThroughCache } = require("../../cacheMiddleware");

describe("insertData utility functions", () => {
  let client, redisClient;
  beforeEach(() => {
    client = {};
    redisClient = {};
    jest.clearAllMocks();
  });

  it("insertWork calls writeThroughCache with correct arguments and logs success", async () => {
    writeThroughCache.mockResolvedValueOnce();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await insertWork(client, redisClient, "WorkName", { type: "Point", coordinates: [0, 0] }, { id: 1, foo: "bar" });

    expect(writeThroughCache).toHaveBeenCalledWith(
      "work:1",
      expect.objectContaining({ id: 1, name: "WorkName", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }), foo: "bar" }),
      expect.stringContaining("INSERT INTO locations_works"),
      expect.any(Array)
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Successfully inserted/updated work"));
    logSpy.mockRestore();
  });

  it("insertWork throws and logs error if writeThroughCache fails", async () => {
    writeThroughCache.mockRejectedValueOnce(new Error("fail!"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      insertWork(client, redisClient, "WorkName", { type: "Point", coordinates: [0, 0] }, { id: 2, foo: "bar" })
    ).rejects.toThrow("fail!");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to insert/update work"));
    errorSpy.mockRestore();
  });

  it("insertGrant calls writeThroughCache with correct arguments and logs success", async () => {
    writeThroughCache.mockResolvedValueOnce();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await insertGrant(client, redisClient, "GrantName", { type: "Point", coordinates: [1, 1] }, { id: 3, foo: "baz" });

    expect(writeThroughCache).toHaveBeenCalledWith(
      "grant:3",
      expect.objectContaining({ id: 3, name: "GrantName", geometry: JSON.stringify({ type: "Point", coordinates: [1, 1] }), foo: "baz" }),
      expect.stringContaining("INSERT INTO locations_grants"),
      expect.any(Array)
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Successfully inserted/updated grant"));
    logSpy.mockRestore();
  });

  it("insertGrant throws and logs error if writeThroughCache fails", async () => {
    writeThroughCache.mockRejectedValueOnce(new Error("fail!"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      insertGrant(client, redisClient, "GrantName", { type: "Point", coordinates: [1, 1] }, { id: 4, foo: "baz" })
    ).rejects.toThrow("fail!");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to insert/update grant"));
    errorSpy.mockRestore();
  });

  it("insertWork uses name as Redis key if id is missing", async () => {
    writeThroughCache.mockResolvedValueOnce();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await insertWork(client, redisClient, "NoIdWork", { type: "Point", coordinates: [2, 2] }, { foo: "bar" });

    expect(writeThroughCache).toHaveBeenCalledWith(
      "work:NoIdWork",
      expect.objectContaining({ id: "NoIdWork", name: "NoIdWork", geometry: JSON.stringify({ type: "Point", coordinates: [2, 2] }), foo: "bar" }),
      expect.any(String),
      expect.any(Array)
    );
    logSpy.mockRestore();
  });

  it("insertGrant uses name as Redis key if id is missing", async () => {
    writeThroughCache.mockResolvedValueOnce();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await insertGrant(client, redisClient, "NoIdGrant", { type: "Point", coordinates: [3, 3] }, { foo: "baz" });

    expect(writeThroughCache).toHaveBeenCalledWith(
      "grant:NoIdGrant",
      expect.objectContaining({ id: "NoIdGrant", name: "NoIdGrant", geometry: JSON.stringify({ type: "Point", coordinates: [3, 3] }), foo: "baz" }),
      expect.any(String),
      expect.any(Array)
    );
    logSpy.mockRestore();
  });
});