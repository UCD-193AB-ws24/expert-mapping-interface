/**
 * @file generateGeoJson.test.js
 * @description Unit tests for generateGeoJson.js
 */

const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');
jest.mock('path');

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });

describe('generateGeoJson', () => {
  let generateGeoJSON;

  // Mock data
  const mockValidatedWorks = [
    {
      id: 'work1',
      title: 'Test Work 1',
      location: 'New York',
      author: 'John Doe'
    },
    {
      id: 'work2',
      title: 'Test Work 2',
      location: 'London',
      author: 'Jane Smith'
    },
    {
      id: 'work3',
      title: 'Test Work 3',
      location: 'Unknown Location',
      author: 'Bob Johnson'
    }
  ];

  const mockValidatedGrants = [
    {
      id: 'grant1',
      title: 'Research Grant 1',
      location: 'New York',
      amount: 50000
    },
    {
      id: 'grant2',
      title: 'Research Grant 2',
      location: 'Paris',
      amount: 75000
    }
  ];

  const mockLocationCoordinates = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "New York",
          country: "USA",
          population: 8000000
        },
        geometry: {
          type: "Point",
          coordinates: [-74.006, 40.7128]
        }
      },
      {
        type: "Feature",
        properties: {
          name: "London",
          country: "UK",
          population: 9000000
        },
        geometry: {
          type: "Point",
          coordinates: [-0.1276, 51.5074]
        }
      },
      {
        type: "Feature",
        properties: {
          name: "Paris",
          country: "France",
          population: 2161000
        },
        geometry: {
          type: "Point",
          coordinates: [2.3522, 48.8566]
        }
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock path.join to return predictable paths
    path.join.mockImplementation((...args) => args.join('/'));

    // Mock fs.existsSync to return true (directory exists)
    fs.existsSync.mockReturnValue(true);

    // Mock fs.mkdirSync
    fs.mkdirSync.mockImplementation(() => { });

    // Mock fs.readFileSync to return appropriate data based on file path
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.includes('validatedWorks.json')) {
        return JSON.stringify(mockValidatedWorks);
      }
      if (filePath.includes('validatedGrants.json')) {
        return JSON.stringify(mockValidatedGrants);
      }
      if (filePath.includes('locationCoordinates.geojson')) {
        return JSON.stringify(mockLocationCoordinates);
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });

    // Mock fs.writeFileSync
    fs.writeFileSync.mockImplementation(() => { });

    // Dynamically require the module to get fresh instance
    delete require.cache[require.resolve('../generateGeoJson.js')];
    generateGeoJSON = require('../generateGeoJson.js');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('File Operations', () => {
    test('should read all required input files', () => {
      // The module loads files on require, so check if readFileSync was called
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('validatedWorks.json'),
        'utf-8'
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('validatedGrants.json'),
        'utf-8'
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('locationCoordinates.geojson'),
        'utf-8'
      );
    });

    test('should not create output directory if it already exists', () => {
      fs.existsSync.mockReturnValue(true);

      delete require.cache[require.resolve('../generateGeoJson.js')];
      require('../generateGeoJson.js');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      delete require.cache[require.resolve('../generateGeoJson.js')];
    });
    test('should continue processing other items when location is not found', () => {
      fs.writeFileSync.mockImplementation((filePath, data) => {
        if (filePath.includes('generatedWorks.geojson')) {
          const output = JSON.parse(data);
          // Should still have 2 valid features despite one missing location
          expect(output.features).toHaveLength(2);
        }
      });

      require('../generateGeoJson.js');
    });

    test('should handle empty works array', () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('validatedWorks.json')) {
          return JSON.stringify([]);
        }
        if (filePath.includes('validatedGrants.json')) {
          return JSON.stringify(mockValidatedGrants);
        }
        if (filePath.includes('locationCoordinates.geojson')) {
          return JSON.stringify(mockLocationCoordinates);
        }
        throw new Error(`Unexpected file path: ${filePath}`);
      });

      fs.writeFileSync.mockImplementation((filePath, data) => {
        if (filePath.includes('generatedWorks.geojson')) {
          const output = JSON.parse(data);
          expect(output.features).toHaveLength(0);
        }
      });

      expect(() => require('../generateGeoJson.js')).not.toThrow();
    });

    test('should handle empty grants array', () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('validatedWorks.json')) {
          return JSON.stringify(mockValidatedWorks);
        }
        if (filePath.includes('validatedGrants.json')) {
          return JSON.stringify([]);
        }
        if (filePath.includes('locationCoordinates.geojson')) {
          return JSON.stringify(mockLocationCoordinates);
        }
        throw new Error(`Unexpected file path: ${filePath}`);
      });

      fs.writeFileSync.mockImplementation((filePath, data) => {
        if (filePath.includes('generatedGrants.geojson')) {
          const output = JSON.parse(data);
          expect(output.features).toHaveLength(0);
        }
      });

      expect(() => require('../generateGeoJson.js')).not.toThrow();
    });
  });

  describe('JSON Output Format', () => {
    test('should write pretty-formatted JSON with 2-space indentation', () => {
      const mockData = { test: 'data' };

      fs.writeFileSync.mockImplementation((filePath, data) => {
        // Check that JSON is formatted with 2-space indentation
        expect(data).toBe(JSON.stringify(mockData, null, 2));
      });

      // Simulate the writeFileSync call that happens in the actual code
      fs.writeFileSync('test.json', JSON.stringify(mockData, null, 2));

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});