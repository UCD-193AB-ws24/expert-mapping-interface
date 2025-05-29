// Tests for createTables.js
const createTables = require('../createTables');
const { Client } = require('pg');

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  }))
}));

describe('createTables', () => {
  it('should create tables without error', async () => {
    const client = new Client();
    client.query.mockResolvedValue({});
    await expect(createTables()).resolves.not.toThrow();
    expect(client.connect).toHaveBeenCalled();
    expect(client.end).toHaveBeenCalled();
  });

  it('should handle query errors', async () => {
    const client = new Client();
    client.query.mockRejectedValue(new Error('fail'));
    await expect(createTables()).rejects.toThrow('fail');
  });
});
