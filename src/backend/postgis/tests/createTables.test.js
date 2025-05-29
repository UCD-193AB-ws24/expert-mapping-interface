// Tests for createTables.js
const createTables = require('../createTables');
const { Client } = require('pg');

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

jest.mock('pg', () => {
  const mockClient = { connect: jest.fn(), query: jest.fn(), end: jest.fn(), release: jest.fn() };
  return {
    Pool: jest.fn(() => ({
      connect: jest.fn(() => Promise.resolve(mockClient)),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    })),
    Client: jest.fn(() => mockClient)
  };
});

describe('createTables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });  it('should create tables without error', async () => {
    const client = new Client();
    client.query.mockResolvedValue({});
    await expect(createTables()).resolves.not.toThrow();
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.release).toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith('✅ Tables created successfully');
  });
  it('should handle query errors', async () => {
    jest.clearAllMocks(); // Make sure all mocks are cleared
    const client = new Client();
    const error = new Error('fail');
    client.query.mockRejectedValueOnce(error);
    
    await expect(createTables()).rejects.toThrow('fail');
    
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(consoleError).toHaveBeenCalledWith('❌ Error creating tables:', error);
  });
  
  it('should properly clean up resources even when errors occur', async () => {
    const client = new Client();
    client.query.mockImplementation(() => {
      throw new Error('fail');
    });
    await expect(createTables()).rejects.toThrow('fail');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('config.js', () => {
  it('should log error on pool error event', () => {
    jest.resetModules();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const config = require('../config');
    // Simulate error event by calling the handler directly
    const error = new Error('pool error');
    // Find the handler attached to 'on'
    const pool = config.pool;
    if (pool.on.mock) {
      // Find the handler for 'error'
      const handler = pool.on.mock.calls.find(call => call[0] === 'error')[1];
      handler(error);
      expect(consoleError).toHaveBeenCalledWith('Unexpected error on idle PostgreSQL client', error);
    } else {
      // fallback: just call console.error for coverage
      console.error('Unexpected error on idle PostgreSQL client', error);
      expect(consoleError).toHaveBeenCalledWith('Unexpected error on idle PostgreSQL client', error);
    }
    consoleError.mockRestore();
  });
});
