/**
 * @file fetchFeatures.test.js
 * @description Tests for fetchFeatures.js including:
 *   - Feature fetching and processing
 *   - File and API error handling
 *   - Coordinate structure description
 *   - Save and process logic
 *
 * Includes edge cases and mocks for robust backend feature import.
 */

const fs = require('fs');
const path = require('path');

jest.mock('fs');

global.fetch = jest.fn();

const fetchFeatures = require('../fetchFeatures');

// Silence all console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console.log.mockClear();
  console.error.mockClear();
});
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

describe('fetchAndSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
  });

  it('fetches and saves features for both endpoints', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        features: [
          { geometry: { type: 'Point' } },
          { geometry: { type: 'Polygon' } }
        ]
      })
    });
    await fetchFeatures.fetchAndSave();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('creates directory if it does not exist', async () => {
    fs.existsSync.mockReturnValue(false);
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ features: [] })
    });
    await fetchFeatures.fetchAndSave();
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('logs error if fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('network error'));
    await fetchFeatures.fetchAndSave();
    expect(console.error).toHaveBeenCalled();
  });

  it('logs error if response is not ok', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({})
    });
    await fetchFeatures.fetchAndSave();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('getCoordinatesStructureDescription', () => {
  it('describes Point geometry', () => {
    const { getCoordinatesStructureDescription } = fetchFeatures;
    expect(getCoordinatesStructureDescription({ type: 'Point', coordinates: [1, 2] })).toContain('longitude');
  });
  it('describes Polygon geometry', () => {
    const { getCoordinatesStructureDescription } = fetchFeatures;
    expect(getCoordinatesStructureDescription({ type: 'Polygon', coordinates: [[[0,0],[1,1],[0,1],[0,0]]] })).toContain('rings');
  });
  it('handles unknown geometry type', () => {
    const { getCoordinatesStructureDescription } = fetchFeatures;
    expect(getCoordinatesStructureDescription({ type: 'Unknown', coordinates: [] })).toContain('Unknown geometry type');
  });
  it('handles invalid geometry structure', () => {
    const { getCoordinatesStructureDescription } = fetchFeatures;
    expect(getCoordinatesStructureDescription(null)).toBe('Invalid geometry structure');
  });
});
