// Tests for dropTables.js
const dropTables = require('../dropTables');
const { Client } = require('pg');

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  }))
}));

describe('dropTables', () => {
  it('should drop tables without error', async () => {
    const client = new Client();
    client.query.mockResolvedValue({});
    await expect(dropTables()).resolves.not.toThrow();
    expect(client.connect).toHaveBeenCalled();
    expect(client.end).toHaveBeenCalled();
  });

  it('should handle query errors', async () => {
    const client = new Client();
    client.query.mockRejectedValue(new Error('fail'));
    await expect(dropTables()).rejects.toThrow('fail');
  });
});
