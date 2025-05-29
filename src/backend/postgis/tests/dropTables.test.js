// Tests for dropTables.js
const { dropTables, main } = require('../dropTables');
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
  const originalExit = process.exit;
  let exitMock;
  // Import the module once for all tests in this describe block
  const dropTablesModule = require('../dropTables');
  
  beforeAll(() => {
    exitMock = jest.fn();
    process.exit = exitMock;
  });
  
  afterAll(() => {
    process.exit = originalExit;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log warnings and run dropTables in main() successfully', async () => {
    // Spy on the dropTables function and make it resolve
    const mockDropTables = jest.spyOn(dropTablesModule, 'dropTables')
      .mockImplementation(() => Promise.resolve());
    
    // Run main
    await dropTablesModule.main();
    
    // Verify correct logs are shown
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('⚠️  WARNING: This will delete all research location data!'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('🚀 Starting table cleanup process...'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✨ Cleanup completed successfully'));
    
    // Verify dropTables was called
    expect(mockDropTables).toHaveBeenCalledTimes(1);
    
    // Verify process.exit was not called
    expect(exitMock).not.toHaveBeenCalled();
    
    // Restore the original implementation
    mockDropTables.mockRestore();
  });
  
  it('should handle errors in main() and call process.exit(1)', async () => {
    // Create a test error
    const testError = new Error('drop tables test error');
    
    // Mock the dropTables function to reject with our error
    const mockDropTables = jest.spyOn(dropTablesModule, 'dropTables')
      .mockImplementation(() => Promise.reject(testError));
    
    // Reset the console.error mock to ensure it captures our calls
    consoleError.mockClear();

    // Run main (which should handle the error)
    await dropTablesModule.main();
    
    // Verify error logging format is correct (with \n prefix and exact format)
    expect(consoleError).toHaveBeenCalledWith('\n❌ Cleanup failed:', testError);
    
    // Verify process.exit was called with code 1
    expect(exitMock).toHaveBeenCalledWith(1);
    
    // Restore the original implementation
    mockDropTables.mockRestore();
  });
});
