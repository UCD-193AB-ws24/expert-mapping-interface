/**
 * @file extractLocations.test.js
 * @description Jest test suite for extractLocations.js
 * @usage npm test -- extractLocations.test.js
 */

const fs = require('fs');
const path = require('path');
const rewire = require('rewire');

// Mock dependencies
jest.mock('ollama');
jest.mock('groq-sdk');
jest.mock('fs');
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock process.env
process.env.OLLAMA_HOST = 'localhost';
process.env.GROQ_KEY = 'test-groq-key';

// Set up mock Llama
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

Ollama.mockImplementation(() => mockOllama);
Groq.mockImplementation(() => mockGroq);

const { extractLocation, processAllWorks, processAllGrants } = require('../processing/extractLocations');

describe('extractLocations', () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

    // Mock fs methods
    fs.existsSync.mockReturnValue(true);
    fs.writeFileSync.mockImplementation(() => { });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('extractLocation function', () => {
    it('test extractLocation using Ollama', async () => {
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
});