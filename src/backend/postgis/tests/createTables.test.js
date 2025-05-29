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
    const client = new Client();
    client.query.mockRejectedValue(new Error('fail'));
    await expect(createTables()).rejects.toThrow('fail');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(consoleError).toHaveBeenCalledWith('❌ Error creating tables:', expect.any(Error));
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

describe('module execution', () => {
  let originalExitFn;
  let mockExit;

  beforeAll(() => {
    originalExitFn = process.exit;
    mockExit = jest.fn();
    process.exit = mockExit;
  });

  afterAll(() => {
    process.exit = originalExitFn;
  });

  it('should call process.exit when run as main module', async () => {
    const client = new Client();
    client.query.mockResolvedValue({});

    // Use jest.isolateModules to simulate running as main
    jest.isolateModules(() => {
      // Mock require.main === module by setting module.exports === require.main.exports
      const thisModule = { ...module, exports: {} };
      Object.defineProperty(thisModule, 'exports', {
        value: {},
        writable: true,
        configurable: true,
        enumerable: true
      });
      // Patch require.main to thisModule for this isolated context
      Object.defineProperty(require, 'main', {
        value: thisModule,
        configurable: true
      });
      require('../createTables');
    });

    // Allow the async code to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockExit).toHaveBeenCalled();
  });
});
