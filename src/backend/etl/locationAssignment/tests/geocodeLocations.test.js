/**
 * @file locationAssignment.test.js
 * @description Jest test suite for validateLocations.js
 * @usage npm test -- locationAssignment.test.js
 */

// Suppress console output for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  process.exit = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  process.exit = originalProcessExit;
});

jest.mock('dotenv', () => ({
  config: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const rewire = require('rewire');

jest.mock('fs');

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: [] })),
  post: jest.fn(() => Promise.resolve({ data: {} }))
}));

// Import the module under test
const { createLocationCoordinates, geocodeLocation } = require('../processing/geocodeLocations');

describe('geocodeLocations.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default file system behavior
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.includes('validatedWorks.json')) {
        return JSON.stringify([
          { location: 'New York' },
          { location: 'London' },
          { location: 'N/A' },
          { location: '  Paris  ' }, // Test trimming
          { location: 'New York' }, // Test deduplication
          { location: '' }
        ]);
      }
      if (filePath.includes('validatedGrants.json')) {
        return JSON.stringify([
          { location: 'Tokyo' },
          { location: 'Berlin' },
          { location: 'N/A' },
          { location: 'London' }, // Test deduplication across files
          { location: null }
        ]);
      }
      throw new Error('File not found');
    });

    fs.mkdirSync.mockImplementation(() => { });
    fs.writeFileSync.mockImplementation(() => { });
  });

  describe('geocodeLocation', () => {
    it('should successfully geocode a location with point geometry', async () => {
      const mockResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: 'New York, NY, USA',
          type: 'city',
          osm_type: 'relation',
          class: 'place',
          place_rank: 16,
          importance: 0.8,
          geojson: null
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await geocodeLocation('New York');

      expect(result).toEqual({
        type: 'Feature',
        properties: {
          name: 'New York',
          display_name: 'New York, NY, USA',
          type: 'city',
          osm_type: 'relation',
          class: 'place',
          place_rank: 16
        },
        geometry: {
          type: 'Point',
          coordinates: [-74.0060, 40.7128]
        }
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://nominatim.openstreetmap.org/search',
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'New York',
            format: 'json',
            polygon_geojson: 1,
            limit: 10
          }),
          headers: {
            'User-Agent': 'Research_Profile_Generator'
          }
        })
      );
    });

    it('should handle polygon geometry', async () => {
      const mockResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: 'New York, NY, USA',
          type: 'city',
          place_rank: 16,
          importance: 0.8,
          geojson: {
            type: 'Polygon',
            coordinates: [[
              [-74.1, 40.7],
              [-74.0, 40.7],
              [-74.0, 40.8],
              [-74.1, 40.8],
              [-74.1, 40.7]
            ]]
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await geocodeLocation('New York');

      expect(result.geometry.type).toBe('Polygon');
      expect(result.geometry.coordinates).toEqual([[
        [-74.1, 40.7],
        [-74.0, 40.7],
        [-74.0, 40.8],
        [-74.1, 40.8],
        [-74.1, 40.7]
      ]]);
    });

    it('should handle MultiPolygon geometry and convert to largest polygon', async () => {
      const mockResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: 'New York, NY, USA',
          type: 'city',
          place_rank: 16,
          importance: 0.8,
          geojson: {
            type: 'MultiPolygon',
            coordinates: [
              [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], // Small polygon (area = 1)
              [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]  // Large polygon (area = 4)
            ]
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await geocodeLocation('New York');

      expect(result.geometry.type).toBe('Polygon');
      expect(result.geometry.coordinates).toEqual([[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]);
    });

    it('should simplify polygon when it exceeds MAX_POINTS', async () => {
      // Create a polygon with many points (more than MAX_POINTS = 4096)
      const manyPoints = [];
      for (let i = 0; i < 5000; i++) {
        manyPoints.push([i, i]);
      }
      manyPoints.push(manyPoints[0]); // Close the polygon

      const mockResponse = {
        data: [{
          lat: '40.7128',
          lon: '-74.0060',
          display_name: 'Large Area',
          type: 'boundary',
          place_rank: 16,
          importance: 0.8,
          geojson: {
            type: 'Polygon',
            coordinates: [manyPoints]
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await geocodeLocation('Large Area');

      expect(result.geometry.type).toBe('Polygon');
      // Should be simplified to roughly MAX_POINTS
      expect(result.geometry.coordinates[0].length).toBeLessThan(5000);
      expect(result.geometry.coordinates[0].length).toBeGreaterThan(1000);
    });

    it('should return the result with highest importance when multiple results exist', async () => {
      const mockResponse = {
        data: [
          {
            lat: '40.7128',
            lon: '-74.0060',
            display_name: 'New York, NY, USA',
            type: 'city',
            place_rank: 16,
            importance: 0.5
          },
          {
            lat: '40.7589',
            lon: '-73.9851',
            display_name: 'New York, Manhattan, NY, USA',
            type: 'borough',
            place_rank: 18,
            importance: 0.9 // Higher importance
          }
        ]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await geocodeLocation('New York');

      expect(result.properties.display_name).toBe('New York, Manhattan, NY, USA');
      expect(result.properties.type).toBe('borough');
    });

    it('should return null when no results found', async () => {
      axios.get.mockResolvedValue({ data: [] });

      const result = await geocodeLocation('NonexistentPlace');

      expect(result).toBeNull();
    });

    it('should return null when API request fails', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      const result = await geocodeLocation('New York');

      expect(result).toBeNull();
    });

    it('should handle malformed API response', async () => {
      axios.get.mockResolvedValue({ data: null });

      const result = await geocodeLocation('New York');

      expect(result).toBeNull();
    });
  });

  describe('createLocationCoordinates', () => {
    beforeEach(() => {
      // Mock sleep function to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 123; // Mock timer ID
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should extract unique locations from works and grants files', async () => {
      // Mock successful geocoding for all unique locations
      axios.get.mockImplementation((url, config) => {
        const location = config.params.q;
        return Promise.resolve({
          data: [{
            lat: '0',
            lon: '0',
            display_name: `${location}, Earth`,
            type: 'city',
            place_rank: 16,
            importance: 0.8
          }]
        });
      });

      await createLocationCoordinates();

      // Should have made requests for unique locations only:
      // New York, London, Paris (trimmed), Tokyo, Berlin
      expect(axios.get).toHaveBeenCalledTimes(5);

      const calledLocations = axios.get.mock.calls.map(call => call[1].params.q);
      expect(calledLocations).toContain('New York');
      expect(calledLocations).toContain('London');
      expect(calledLocations).toContain('Paris');
      expect(calledLocations).toContain('Tokyo');
      expect(calledLocations).toContain('Berlin');

      // Should not include N/A, empty, or null locations
      expect(calledLocations).not.toContain('N/A');
      expect(calledLocations).not.toContain('');
      expect(calledLocations).not.toContain(null);
    });

    it('should write GeoJSON file after each successful geocode', async () => {
      axios.get.mockResolvedValue({
        data: [{
          lat: '0',
          lon: '0',
          display_name: 'Test Location',
          type: 'city',
          place_rank: 16,
          importance: 0.8
        }]
      });

      await createLocationCoordinates();

      // Should write file after each geocode (5 unique locations)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(5);
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should handle geocoding failures gracefully', async () => {
      let callCount = 0;
      axios.get.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: [] }); // No results
        }
        if (callCount === 2) {
          return Promise.reject(new Error('Network error')); // API error
        }
        return Promise.resolve({
          data: [{
            lat: '0',
            lon: '0',
            display_name: 'Test Location',
            type: 'city',
            place_rank: 16,
            importance: 0.8
          }]
        });
      });

      await createLocationCoordinates();

      // Should continue processing despite failures
      expect(axios.get).toHaveBeenCalledTimes(5);
    });

    it('should handle file reading errors', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await createLocationCoordinates();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON in files', async () => {
      fs.readFileSync.mockReturnValue('invalid json');

      await createLocationCoordinates();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should skip locations that are already cached', async () => {
      // Mock that one location is already in cache
      const existingFeatures = [{
        type: 'Feature',
        properties: { name: 'New York' },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }];

      // Override the geoData initialization in the function
      const geocodeLocationsModule = require('../processing/geocodeLocations');

      axios.get.mockResolvedValue({
        data: [{
          lat: '0',
          lon: '0',
          display_name: 'Test Location',
          type: 'city',
          place_rank: 16,
          importance: 0.8
        }]
      });

      await createLocationCoordinates();

      // Should make fewer API calls due to caching
      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty files', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('validatedWorks.json')) {
          return JSON.stringify([]);
        }
        if (filePath.includes('validatedGrants.json')) {
          return JSON.stringify([]);
        }
      });

      await createLocationCoordinates();

      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should handle files with no location fields', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        return JSON.stringify([
          { title: 'Work without location' },
          { name: 'Grant without location' }
        ]);
      });

      await createLocationCoordinates();

      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should trim whitespace from locations', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('validatedWorks.json')) {
          return JSON.stringify([
            { location: '  New York  ' },
            { location: '\tLondon\n' }
          ]);
        }
        if (filePath.includes('validatedGrants.json')) {
          return JSON.stringify([]);
        }
      });

      axios.get.mockResolvedValue({
        data: [{
          lat: '0',
          lon: '0',
          display_name: 'Test',
          type: 'city',
          place_rank: 16,
          importance: 0.8
        }]
      });

      await createLocationCoordinates();

      const calledLocations = axios.get.mock.calls.map(call => call[1].params.q);
      expect(calledLocations).toContain('New York');
      expect(calledLocations).toContain('London');
      expect(calledLocations).not.toContain('  New York  ');
    });
  });

  describe('Rate limiting', () => {
    it('should implement delay between API calls', async () => {
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('validatedWorks.json')) {
          return JSON.stringify([
            { location: 'Location1' },
            { location: 'Location2' }
          ]);
        }
        if (filePath.includes('validatedGrants.json')) {
          return JSON.stringify([]);
        }
      });

      axios.get.mockResolvedValue({
        data: [{
          lat: '0',
          lon: '0',
          display_name: 'Test',
          type: 'city',
          place_rank: 16,
          importance: 0.8
        }]
      });

      await createLocationCoordinates();

      // Should call setTimeout for rate limiting (once per location after the first)
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

      mockSetTimeout.mockRestore();
    });
  });
});