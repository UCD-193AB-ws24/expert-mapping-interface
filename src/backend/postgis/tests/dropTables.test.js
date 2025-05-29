// Tests for dropTables.js
const { dropTables } = require('../dropTables');
const { Pool } = require('pg');

jest.mock('pg', () => {
  // Mock client returned by pool.connect()
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    Pool: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    })),
  };
});

// Spy on console methods but don't mock implementation
// This allows us to verify calls while still seeing output during test debugging
let consoleLog;
let consoleError;

beforeAll(() => {
  // Setup spies before all tests
  consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods after all tests
  consoleLog.mockRestore();
  consoleError.mockRestore();
});

describe('dropTables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should drop tables without error and log output', async () => {
    const pool = new Pool();
    pool.query.mockResolvedValue({});
    await expect(dropTables()).resolves.not.toThrow();
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('🗑️  Starting cleanup...'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✅ All tables and related objects dropped successfully'));
  });

  it('should handle query errors and call rollback', async () => {
    const pool = new Pool();
    const client = await pool.connect();
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('fail')); // error on first query after BEGIN
    await expect(dropTables()).rejects.toThrow('fail');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('❌ Error dropping tables:'), expect.any(Error));
  });
});

describe('main function', () => {
  // Removed tests for main() as requested
});
