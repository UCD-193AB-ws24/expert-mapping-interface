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

const { extractLocation, processAllWorks, processAllGrants } = require('../processing/extractLocations')

describe('extractLocations', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    // Mock fs methods for extractLocations tests
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { });
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify([]));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('extractLocation function', () => {
    it('test extractLocation default', async () => {
      mockOllama.chat.mockResolvedValue({
        message: {
          content: '{"Location": "Los Angeles", "Confidence": 85}'
        }
      });

      const result = await extractLocation('Research conducted in Los Angeles, California');

      expect(result).toBe('{"Location": "Los Angeles", "Confidence": 85}');
    });

    it('return null on error', async () => {
      mockOllama.chat.mockRejectedValue(new Error('API Error'));

      const result = await extractLocation('Research conducted in Los Angeles, California');

      expect(result).toBeNull();
    });
  });

  describe('processAllWorks function', () => {
    it('test processAllWorks basic', async () => {
      const mockWorksData = [
        {
          title: "Climate Change Research in California",
          abstract: ""
        },
        {
          title: "AI Development",
          abstract: ""
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockWorksData));

      // Mock API responses
      mockOllama.chat
        .mockResolvedValueOnce({
          message: {
            content: '{"Location": "California", "Confidence": 85}'
          }
        })
        .mockResolvedValueOnce({
          message: {
            content: '{"Location": "N/A", "Confidence": 100}'
          }
        });

      await processAllWorks(false, false); // groq=false, debug=false

      // Verify API calls
      expect(mockOllama.chat).toHaveBeenCalledTimes(2);

      // Verify console output
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: California');
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: N/A');

      // Verify file was written (called once with complete data)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Verify the actual data structure written
      const writtenDataString = fs.writeFileSync.mock.calls[0][1];
      const writtenData = JSON.parse(writtenDataString);

      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual({
        title: "Climate Change Research in California",
        abstract: "",
        location: "California",
        llmConfidence: 85
      });
      expect(writtenData[1]).toEqual({
        title: "AI Development",
        abstract: "",
        location: "N/A",
        llmConfidence: 100
      });
    });

    it('test processAllWorks with Groq', async () => {
      const mockWorksData = [
        {
          title: "Climate Change Research in California",
          abstract: ""
        },
        {
          title: "AI Development",
          abstract: ""
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockWorksData));

      // Mock API responses
      mockGroq.chat.completions.create
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: '{"Location": "California", "Confidence": 85}'
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: '{"Location": "N/A", "Confidence": 100}'
              }
            }
          ]
        });

      await processAllWorks(true, false); // groq=false, debug=false

      // Verify API calls
      expect(mockGroq.chat.completions.create).toHaveBeenCalledTimes(2);

      // Verify console output
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: California');
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: N/A');

      // Verify file was written (called once with complete data)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Verify the actual data structure written
      const writtenDataString = fs.writeFileSync.mock.calls[0][1];
      const writtenData = JSON.parse(writtenDataString);

      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual({
        title: "Climate Change Research in California",
        abstract: "",
        location: "California",
        llmConfidence: 85
      });
      expect(writtenData[1]).toEqual({
        title: "AI Development",
        abstract: "",
        location: "N/A",
        llmConfidence: 100
      });
    });
  });

  describe('processAllGrants function', () => {
    it('test processAllGrants basic', async () => {
      const mockGrantsData = [
        {
          title: "Climate Change Research in California"
        },
        {
          title: "AI Development"
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockGrantsData));

      // Mock API responses
      mockOllama.chat
        .mockResolvedValueOnce({
          message: {
            content: '{"Location": "California", "Confidence": 85}'
          }
        })
        .mockResolvedValueOnce({
          message: {
            content: '{"Location": "N/A", "Confidence": 100}'
          }
        });

      await processAllGrants(false, false); // groq=false, debug=false

      // Verify API calls
      expect(mockOllama.chat).toHaveBeenCalledTimes(2);

      // Verify console output
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: California');
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: N/A');

      // Verify file was written (called once with complete data)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Verify the actual data structure written
      const writtenDataString = fs.writeFileSync.mock.calls[0][1];
      const writtenData = JSON.parse(writtenDataString);

      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual({
        title: "Climate Change Research in California",
        location: "California",
        llmConfidence: 85
      });
      expect(writtenData[1]).toEqual({
        title: "AI Development",
        location: "N/A",
        llmConfidence: 100
      });
    });

    it('test processAllGrants with Groq', async () => {
      const mockGrantsData = [
        {
          title: "Climate Change Research in California"
        },
        {
          title: "AI Development"
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockGrantsData));

      // Mock API responses
      mockGroq.chat.completions.create
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: '{"Location": "California", "Confidence": 85}'
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: '{"Location": "N/A", "Confidence": 100}'
              }
            }
          ]
        });

      await processAllGrants(true, false); // groq=false, debug=false

      // Verify API calls
      expect(mockGroq.chat.completions.create).toHaveBeenCalledTimes(2);

      // Verify console output
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: California');
      expect(consoleLogSpy).toHaveBeenCalledWith('Location: N/A');

      // Verify file was written (called once with complete data)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Verify the actual data structure written
      const writtenDataString = fs.writeFileSync.mock.calls[0][1];
      const writtenData = JSON.parse(writtenDataString);

      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual({
        title: "Climate Change Research in California",
        location: "California",
        llmConfidence: 85
      });
      expect(writtenData[1]).toEqual({
        title: "AI Development",
        location: "N/A",
        llmConfidence: 100
      });
    });
  });

  describe('processAllWorks with debug mode', () => {
    it('should output debug information when debug mode is enabled', async () => {
      const mockWorksData = [
        {
          title: "Marine Biology Research in Australia",
          abstract: "Study of coral reefs"
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockWorksData));

      mockOllama.chat.mockResolvedValue({
        message: {
          content: '{"Location": "Australia", "Confidence": 90}'
        }
      });

      await processAllWorks(false, true); // groq=false, debug=true

      // Verify debug output appears
      expect(consoleLogSpy).toHaveBeenCalledWith('\n--- Begin Extraction Debug (Works) ---\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n--- End Extraction Debug (Works) ---\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('Debug info:', { location: 'Australia', confidence: 90 });
    });

    it('should handle extraction count correctly', async () => {
      const mockWorksData = [
        { title: "Research in Paris", abstract: "" },
        { title: "Generic AI Study", abstract: "" },
        { title: "Study in Tokyo", abstract: "" }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockWorksData));

      mockOllama.chat
        .mockResolvedValueOnce({
          message: { content: '{"Location": "Paris, France", "Confidence": 85}' }
        })
        .mockResolvedValueOnce({
          message: { content: '{"Location": "N/A", "Confidence": 100}' }
        })
        .mockResolvedValueOnce({
          message: { content: '{"Location": "Tokyo, Japan", "Confidence": 92}' }
        });

      await processAllWorks(false, false);

      // Should show 2 extracted locations out of 3 total
      expect(consoleLogSpy).toHaveBeenCalledWith('Extracted locations (non-N/A): 2 / 3');
    });

    it('should handle empty works data', async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify([]));

      await processAllWorks(false, false);

      expect(mockOllama.chat).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Extracted locations (non-N/A): 0 / 0');
    });
  });

  describe('processAllGrants with debug mode', () => {
    it('should output debug information when debug mode is enabled', async () => {
      const mockGrantsData = [
        {
          title: "Environmental Research in Brazil"
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockGrantsData));

      mockOllama.chat.mockResolvedValue({
        message: {
          content: '{"Location": "Brazil", "Confidence": 88}'
        }
      });

      await processAllGrants(false, true); // groq=false, debug=true

      // Verify debug output appears
      expect(consoleLogSpy).toHaveBeenCalledWith('\n--- Begin Extraction Debug (Grants) ---\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n--- End Extraction Debug (Grants) ---\n');
      expect(consoleLogSpy).toHaveBeenCalledWith('Debug info:', { location: 'Brazil', confidence: 88 });
    });

    it('should handle "None" as non-extracted location', async () => {
      const mockGrantsData = [
        { title: "Generic Research Grant" },
        { title: "Study in London" }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockGrantsData));

      mockOllama.chat
        .mockResolvedValueOnce({
          message: { content: '{"Location": "None", "Confidence": 95}' }
        })
        .mockResolvedValueOnce({
          message: { content: '{"Location": "London, UK", "Confidence": 87}' }
        });

      await processAllGrants(false, false);

      // Should show 1 extracted location (London) out of 2 total, treating "None" as non-extracted
      expect(consoleLogSpy).toHaveBeenCalledWith('Extracted locations (non-N/A): 1 / 2');
    });

    it('should handle empty grants data', async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify([]));

      await processAllGrants(false, false);

      expect(mockOllama.chat).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Extracted locations (non-N/A): 0 / 0');
    });
  });

  describe('Error handling in processing functions', () => {
    it('should handle file read errors gracefully in processAllWorks', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(processAllWorks(false, false)).rejects.toThrow('File not found');
    });

    it('should handle file read errors gracefully in processAllGrants', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(processAllGrants(false, false)).rejects.toThrow('File not found');
    });

    it('should handle malformed JSON in works file', async () => {
      fs.readFileSync.mockReturnValue('invalid json');

      await expect(processAllWorks(false, false)).rejects.toThrow();
    });

    it('should handle malformed JSON in grants file', async () => {
      fs.readFileSync.mockReturnValue('invalid json');

      await expect(processAllGrants(false, false)).rejects.toThrow();
    });
  });

  describe('LLM API response variations', () => {
    it('should handle response with complex nested JSON', async () => {
      const mockWorksData = [
        { title: "Research study", abstract: "Complex analysis" }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockWorksData));

      // Response with nested JSON structure
      mockOllama.chat.mockResolvedValue({
        message: {
          content: 'Analysis complete: {"Location": "New York, NY", "Confidence": 76, "extras": {"method": "NLP"}}'
        }
      });

      await processAllWorks(false, false);

      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData[0].location).toBe("N/A");
      expect(writtenData[0].llmConfidence).toBe(0);
    });

    it('should handle multiple JSON objects in response', async () => {
      const mockGrantsData = [
        { title: "AI Research Grant" }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockGrantsData));

      // Response with multiple JSON objects - should pick the first one
      mockOllama.chat.mockResolvedValue({
        message: {
          content: '{"Location": "Boston, MA", "Confidence": 82} {"Location": "Chicago, IL", "Confidence": 70}'
        }
      });

      await processAllGrants(false, false);

      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData[0].location).toBe("Boston, MA");
      expect(writtenData[0].llmConfidence).toBe(82);
    });
  });

  describe('Works vs Grants processing differences', () => {
    it('should process works with title and abstract combined', async () => {
      const mockWorksData = [
        {
          title: "Climate Research",
          abstract: "Conducted in Antarctica"
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockWorksData));

      mockOllama.chat.mockResolvedValue({
        message: {
          content: '{"Location": "Antarctica", "Confidence": 95}'
        }
      });

      await processAllWorks(false, false);

      // Verify that the API was called with combined title and abstract
      expect(mockOllama.chat).toHaveBeenCalledWith({
        model: 'llama3.1',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Extract from this text: Climate Research. Conducted in Antarctica'
          })
        ]),
        temperature: 0,
        stream: false
      });
    });

    it('should process grants with title only', async () => {
      const mockGrantsData = [
        {
          title: "Marine Research in Mediterranean Sea"
        }
      ];

      fs.readFileSync.mockReturnValue(JSON.stringify(mockGrantsData));

      mockOllama.chat.mockResolvedValue({
        message: {
          content: '{"Location": "Mediterranean", "Confidence": 88}'
        }
      });

      await processAllGrants(false, false);

      // Verify that the API was called with title only
      expect(mockOllama.chat).toHaveBeenCalledWith({
        model: 'llama3.1',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Extract from this text: Marine Research in Mediterranean Sea'
          })
        ]),
        temperature: 0,
        stream: false
      });
    });
  });
});