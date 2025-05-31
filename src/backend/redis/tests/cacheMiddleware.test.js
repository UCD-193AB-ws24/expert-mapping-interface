const { writeThroughCache, deleteThroughCache } = require("../cacheMiddleware");

describe("cacheMiddleware", () => {
  let redisClient, pgClient;

  beforeEach(() => {
    redisClient = {
      hSet: jest.fn(),
      del: jest.fn(),
    };
    pgClient = {
      query: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("writeThroughCache", () => {
    it("writes to Postgres and Redis and commits transaction", async () => {
      pgClient.query.mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // query
        .mockResolvedValueOnce(); // COMMIT
      redisClient.hSet.mockResolvedValueOnce();

      await writeThroughCache(redisClient, pgClient, "key1", { foo: "bar" }, "INSERT INTO test VALUES ($1)", ["bar"]);

      expect(pgClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(pgClient.query).toHaveBeenNthCalledWith(2, "INSERT INTO test VALUES ($1)", ["bar"]);
      expect(redisClient.hSet).toHaveBeenCalledWith("key1", { foo: "bar" });
      expect(pgClient.query).toHaveBeenNthCalledWith(3, "COMMIT");
    });

    it("rolls back transaction and throws if Postgres fails", async () => {
      pgClient.query.mockResolvedValueOnce(); // BEGIN
      pgClient.query.mockRejectedValueOnce(new Error("PG error")); // query

      await expect(
        writeThroughCache(redisClient, pgClient, "key2", { foo: "baz" }, "INSERT INTO test VALUES ($1)", ["baz"])
      ).rejects.toThrow("PG error");
      expect(pgClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(redisClient.hSet).not.toHaveBeenCalled();
    });

    it("rolls back transaction and throws if Redis fails", async () => {
      pgClient.query.mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce(); // query
      redisClient.hSet.mockRejectedValueOnce(new Error("Redis error"));

      await expect(
        writeThroughCache(redisClient, pgClient, "key3", { foo: "baz" }, "INSERT INTO test VALUES ($1)", ["baz"])
      ).rejects.toThrow("Redis error");
      expect(pgClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("deleteThroughCache", () => {
    it("deletes from Postgres and Redis and commits transaction", async () => {
      pgClient.query.mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // query
        .mockResolvedValueOnce(); // COMMIT
      redisClient.del.mockResolvedValueOnce();

      await deleteThroughCache(redisClient, pgClient, "key4", "DELETE FROM test WHERE id=$1", [1]);

      expect(pgClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(pgClient.query).toHaveBeenNthCalledWith(2, "DELETE FROM test WHERE id=$1", [1]);
      expect(redisClient.del).toHaveBeenCalledWith("key4");
      expect(pgClient.query).toHaveBeenNthCalledWith(3, "COMMIT");
    });

    it("rolls back transaction and throws if Postgres fails", async () => {
      pgClient.query.mockResolvedValueOnce(); // BEGIN
      pgClient.query.mockRejectedValueOnce(new Error("PG error")); // query

      await expect(
        deleteThroughCache(redisClient, pgClient, "key5", "DELETE FROM test WHERE id=$1", [2])
      ).rejects.toThrow("PG error");
      expect(pgClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    it("rolls back transaction and throws if Redis fails", async () => {
      pgClient.query.mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce(); // query
      redisClient.del.mockRejectedValueOnce(new Error("Redis error"));

      await expect(
        deleteThroughCache(redisClient, pgClient, "key6", "DELETE FROM test WHERE id=$1", [3])
      ).rejects.toThrow("Redis error");
      expect(pgClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });
});