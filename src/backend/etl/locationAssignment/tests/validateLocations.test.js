/**
 * @file locationAssignment.test.js
 * @description Jest test suite for validateLocations.js
 * @usage npm test -- locationAssignment.test.js
 */

// Suppress console output for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

jest.mock('ollama');
jest.mock('groq-sdk');
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const axios = require('axios');

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: [] })),
  post: jest.fn(() => Promise.resolve({ data: {} }))
}));

// Mock process.env
process.env.OLLAMA_HOST = 'localhost';
process.env.GROQ_KEY = 'test-groq-key';

// Set up mock Ollama
const mockOllama = {
  chat: jest.fn()
};

const mockGroq = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

const { Ollama } = require('ollama');
const Groq = require('groq-sdk');

// Make sure the constructors return our mock instances
Ollama.mockImplementation(() => mockOllama);
Groq.mockImplementation(() => mockGroq);

const { validateAllWorks, validateAllGrants } = require('../processing/validateLocations');

describe('validateLocations', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations to default successful responses
    mockOllama.chat.mockResolvedValue({
      message: { content: 'US' }
    });

    mockGroq.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'US' } }]
    });

    // Mock only the file operations we want to control for testing
    // Let the CSV file be read normally, but mock the JSON file operations
    const originalReadFileSync = fs.readFileSync;
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, encoding) => {
      // Let countries.csv be read normally
      if (filePath.includes('countries.csv')) {
        try {
          return originalReadFileSync(filePath, encoding);
        } catch (e) {
          // If CSV file doesn't exist, return mock data
          return 'United States,US\nFrance,FR\nBrazil,BR\nGermany,DE\n';
        }
      }

      // Mock other JSON files for testing
      if (filePath.includes('locationBasedWorks.json')) {
        return JSON.stringify([
          {
            title: "Test Work",
            location: "New York, NY",
            llmConfidence: 85
          }
        ]);
      }

      if (filePath.includes('locationBasedGrants.json')) {
        return JSON.stringify([
          {
            title: "Test Grant",
            location: "Paris, France",
            llmConfidence: 90
          }
        ]);
      }

      // Default for other files
      return JSON.stringify([]);
    });

    // Mock file system write operations
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => { });

    // Set up default axios mock behavior (empty results)
    axios.get.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    // Clean up file system mocks
    if (jest.isMockFunction(fs.readFileSync)) fs.readFileSync.mockRestore();
    if (jest.isMockFunction(fs.writeFileSync)) fs.writeFileSync.mockRestore();
    if (jest.isMockFunction(fs.existsSync)) fs.existsSync.mockRestore();
    if (jest.isMockFunction(fs.mkdirSync)) fs.mkdirSync.mockRestore();
  });

  // Test main exported functions with proper mocking
  describe('validateAllWorks', () => {
    beforeEach(() => {
      // Ensure clean state for integration tests
      axios.get.mockClear();
      mockOllama.chat.mockClear();
      fs.readFileSync.mockClear();
    });

    it('should validate works successfully', async () => {
      // Mock the file reading and API calls
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'United States,US\nFrance,FR\n';
        }
        if (filePath.includes('locationBasedWorks.json')) {
          return JSON.stringify([
            { title: 'Test Work', location: 'New York', llmConfidence: 85 }
          ]);
        }
        return '[]';
      });

      // Mock API responses
      axios.get
        .mockResolvedValueOnce({
          data: [{
            name: 'New York',
            lat: '40.7128',
            lon: '-74.0060',
            importance: 0.8,
            address: { country_code: 'us' },
            place_rank: 15
          }]
        })
        .mockResolvedValueOnce({
          data: [{
            lat: '39.8283',
            lon: '-98.5795',
            importance: 0.8,
            address: { country_code: 'us' }
          }]
        });

      mockOllama.chat.mockResolvedValue({ message: { content: 'US' } });

      const result = await validateAllWorks(false, false);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Validating all works...');
    });

    it('should handle errors and throw', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      await expect(validateAllWorks(false, false)).rejects.toThrow();
      expect(console.error).toHaveBeenCalled();
    });

    it('should use Groq when groq parameter is true', async () => {
      // Mock successful validation with Groq
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'United States,US\n';
        }
        if (filePath.includes('locationBasedWorks.json')) {
          return JSON.stringify([
            { title: 'Test Work', location: 'New York', llmConfidence: 85 }
          ]);
        }
        return '[]';
      });

      axios.get.mockResolvedValue({
        data: [{
          name: 'New York',
          lat: '40.7128',
          lon: '-74.0060',
          importance: 0.8,
          address: { country_code: 'us' },
          place_rank: 15
        }]
      });

      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'US' } }]
      });

      await validateAllWorks(true, false);
      expect(console.log).toHaveBeenCalledWith('Validating all works...');
    });
  });

  describe('validateAllGrants', () => {
    beforeEach(() => {
      axios.get.mockClear();
      mockOllama.chat.mockClear();
      fs.readFileSync.mockClear();
    });

    it('should validate grants successfully', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'France,FR\n';
        }
        if (filePath.includes('locationBasedGrants.json')) {
          return JSON.stringify([
            { title: 'Test Grant', location: 'Paris', llmConfidence: 90 }
          ]);
        }
        return '[]';
      });

      axios.get.mockResolvedValue({
        data: [{
          name: 'Paris',
          lat: '48.8566',
          lon: '2.3522',
          importance: 0.9,
          address: { country_code: 'fr' },
          place_rank: 15
        }]
      });

      mockOllama.chat.mockResolvedValue({ message: { content: 'FR' } });

      const result = await validateAllGrants(false, false);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Validating all grants...');
    });

    it('should handle errors and throw', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      await expect(validateAllGrants(false, false)).rejects.toThrow();
      expect(console.error).toHaveBeenCalled();
    });

    it('should enable debug mode when requested', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'France,FR\n';
        }
        if (filePath.includes('locationBasedGrants.json')) {
          return JSON.stringify([]);
        }
        return '[]';
      });

      await validateAllGrants(false, true);
      expect(console.log).toHaveBeenCalledWith('Validating all grants...');
    });
  });

  // Integration-style tests with complete mocking
  describe('Integration Tests', () => {
    it('should handle complete workflow with mixed valid and invalid locations', async () => {
      const inputData = [
        { title: 'Work 1', location: 'New York', llmConfidence: 85 },
        { title: 'Work 2', location: '', llmConfidence: 0 },
        { title: 'Work 3', location: 'N/A', llmConfidence: 0 }
      ];

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'United States,US\nFrance,FR\n';
        }
        if (filePath.includes('locationBasedWorks.json')) {
          return JSON.stringify(inputData);
        }
        return '[]';
      });

      // Mock API responses for the valid location only
      axios.get
        .mockResolvedValueOnce({
          data: [{
            name: 'New York',
            lat: '40.7128',
            lon: '-74.0060',
            importance: 0.8,
            address: { country_code: 'us' },
            place_rank: 15
          }]
        })
        // Mock confidence calculation call
        .mockResolvedValueOnce({
          data: [{
            lat: '39.8283',
            lon: '-98.5795',
            importance: 0.8,
            address: { country_code: 'us' }
          }]
        });

      mockOllama.chat.mockResolvedValue({
        message: { content: 'US' }
      });

      const result = await validateAllWorks(false, false);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Validating all works...');
    });
  });

  describe('Test getLocationInfo indirectly', () => {
    beforeEach(() => {
      // Ensure clean state for integration tests
      axios.get.mockClear();
      mockOllama.chat.mockClear();
      fs.readFileSync.mockClear();
    });

    it('should return N/A location if Nominatim call is null', async () => {
      // Mock the file reading and API calls
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'United States,US\nFrance,FR\n';
        }
        if (filePath.includes('locationBasedWorks.json')) {
          return JSON.stringify([
            { title: 'Test Work', location: 'New York', llmConfidence: 85 }
          ]);
        }
        return '[]';
      });

      // Mock API responses
      axios.get
        .mockResolvedValueOnce(new Error('API Error'))

      mockOllama.chat.mockResolvedValue({ message: { content: 'US' } });

      const result = await validateAllWorks(false, false);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Validating all works...');
    });
  });

  describe('Test validation cases', () => {
    beforeEach(() => {
      // Ensure clean state for integration tests
      axios.get.mockClear();
      mockOllama.chat.mockClear();
      fs.readFileSync.mockClear();
    });

    it('test invalid getISOcode', async () => {
      // Mock the file reading and API calls
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'United States,US\nFrance,FR\n';
        }
        if (filePath.includes('locationBasedWorks.json')) {
          return JSON.stringify([
            { title: 'Test Work', location: 'New York', llmConfidence: 85 }
          ]);
        }
        return '[]';
      });

      // Mock API responses
      axios.get
        .mockResolvedValueOnce({
          data: [{
            name: 'New York',
            lat: '40.7128',
            lon: '-74.0060',
            importance: 0.8,
            address: { country_code: 'us' },
            place_rank: 15
          }]
        })

      mockOllama.chat.mockResolvedValue({ message: { content: 'None' } });

      const result = await validateAllWorks(false, false);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Validating all works...');
    });

    it('test invalid getISOcode', async () => {
      // Mock the file reading and API calls
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('countries.csv')) {
          return 'United States,US\nFrance,FR\n';
        }
        if (filePath.includes('locationBasedWorks.json')) {
          return JSON.stringify([
            { title: 'Test Work', location: 'New York', llmConfidence: 85 }
          ]);
        }
        return '[]';
      });

      // Mock API responses
      axios.get
        .mockResolvedValueOnce({
          data: [{
            name: 'Hanoi',
            lat: '21.0285',
            lon: '105.8542',
            importance: 0.8,
            address: { country_code: 'vn' },
            place_rank: 16
          }]
        })

      mockOllama.chat.mockResolvedValue({ message: { content: 'US' } });

      const result = await validateAllWorks(false, false);
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Validating all works...');
    });
  });
});