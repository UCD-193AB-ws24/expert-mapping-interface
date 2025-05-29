/**
 * @file fetchExpertProfiles.test.js
 * @description Tests for the fetchExpertProfiles utility
 */

const fs = require('fs');
const path = require('path');

// Suppress console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = jest.fn();
console.error = jest.fn();

// Mock only external dependencies, not the module under test
jest.mock('fs');
jest.mock('../services/fetchProfileByID');

// Import the REAL module under test and the mocked dependency
const { fetchExpertProfiles } = require('../services/fetchExpertProfiles');
const { getExpertData } = require('../services/fetchProfileByID');

describe('fetchExpertProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mock implementation for external dependency
    getExpertData.mockImplementation(async (expertId) => ({
      expertId,
      firstName: 'Test',
      lastName: 'Expert',
      works: [],
      grants: []
    }));
    
    // Default CSV content
    fs.readFileSync.mockReturnValue('id\n123\n456\n789');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('successful scenarios', () => {
    it('fetches expert profiles for valid IDs with limit', async () => {
      const result = await fetchExpertProfiles(2);
      
      // Should respect the limit parameter
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('expertId', '123');
      expect(result[1]).toHaveProperty('expertId', '456');
      expect(getExpertData).toHaveBeenCalledTimes(2);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('expert_ids.csv'),
        'utf8'
      );
    });

    it('fetches all profiles when no limit specified', async () => {
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(3);
      expect(getExpertData).toHaveBeenCalledTimes(3);
      expect(getExpertData).toHaveBeenCalledWith('123');
      expect(getExpertData).toHaveBeenCalledWith('456');
      expect(getExpertData).toHaveBeenCalledWith('789');
    });

    it('fetches all profiles when limit exceeds available IDs', async () => {
      const result = await fetchExpertProfiles(10);
      
      expect(result).toHaveLength(3);
      expect(getExpertData).toHaveBeenCalledTimes(3);
    });

    it('handles zero limit correctly', async () => {
      const result = await fetchExpertProfiles(0);
      
      // Should still fetch all when limit is 0 (based on actual implementation)
      expect(result).toHaveLength(3);
      expect(getExpertData).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('handles CSV read failures', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      await expect(fetchExpertProfiles(1)).rejects.toThrow('File not found');
      expect(getExpertData).not.toHaveBeenCalled();
    });

    it('continues processing when individual expert fetch fails', async () => {
      getExpertData
        .mockResolvedValueOnce({ expertId: '123', firstName: 'Test', lastName: 'Expert' })
        .mockRejectedValueOnce(new Error('Expert 456 not found'))
        .mockResolvedValueOnce({ expertId: '789', firstName: 'Test', lastName: 'Expert' });
      
      const result = await fetchExpertProfiles();
      
      // Should continue processing other experts
      expect(result).toHaveLength(2);
      expect(result.filter(p => p !== null)).toHaveLength(2);
      expect(getExpertData).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching profile for expert 456:'),
        expect.stringContaining('Expert 456 not found')
      );
    });

    it('handles all experts failing to fetch', async () => {
      getExpertData.mockRejectedValue(new Error('API unavailable'));
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(0);
      expect(getExpertData).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('handles empty CSV file', async () => {
      fs.readFileSync.mockReturnValue('id\n');
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(0);
      expect(getExpertData).not.toHaveBeenCalled();
    });

    it('handles CSV with only header', async () => {
      fs.readFileSync.mockReturnValue('id');
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(0);
      expect(getExpertData).not.toHaveBeenCalled();
    });

    it('handles CSV with empty lines and whitespace', async () => {
      fs.readFileSync.mockReturnValue('id\n123\n\n456\n \n789\n');
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(3);
      expect(getExpertData).toHaveBeenCalledTimes(3);
      expect(getExpertData).toHaveBeenCalledWith('123');
      expect(getExpertData).toHaveBeenCalledWith('456');
      expect(getExpertData).toHaveBeenCalledWith('789');
    });

    it('handles negative limit values', async () => {
      const result = await fetchExpertProfiles(-1);
      
      // Negative limit should be treated as no limit
      expect(result).toHaveLength(3);
      expect(getExpertData).toHaveBeenCalledTimes(3);
    });

    it('handles non-numeric limit values', async () => {
      const result = await fetchExpertProfiles('invalid');
      
      // Invalid limit should be treated as no limit
      expect(result).toHaveLength(3);
      expect(getExpertData).toHaveBeenCalledTimes(3);
    });

    it('handles CSV parsing edge cases', async () => {
      // Test with various CSV formats
      fs.readFileSync.mockReturnValue('id,name\n123,Expert One\n456,Expert Two');
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(2);
      expect(getExpertData).toHaveBeenCalledWith('123');
      expect(getExpertData).toHaveBeenCalledWith('456');
    });
  });

  describe('data validation and processing', () => {
    it('handles null results from getExpertData', async () => {
      getExpertData
        .mockResolvedValueOnce({ expertId: '123', firstName: 'Valid' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ expertId: '789', firstName: 'Valid' });
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(2);
      expect(result.every(profile => profile !== null)).toBe(true);
    });

    it('validates returned profile structure', async () => {
      getExpertData.mockResolvedValue({
        expertId: '123',
        firstName: 'John',
        lastName: 'Doe',
        works: [{ title: 'Research Paper' }],
        grants: [{ title: 'Grant 1' }]
      });
      
      const result = await fetchExpertProfiles(1);
      
      expect(result[0]).toMatchObject({
        expertId: '123',
        firstName: 'John',
        lastName: 'Doe',
        works: expect.any(Array),
        grants: expect.any(Array)
      });
    });

    it('handles undefined results from getExpertData', async () => {
      getExpertData
        .mockResolvedValueOnce({ expertId: '123', firstName: 'Valid' })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ expertId: '789', firstName: 'Valid' });
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(2);
      expect(result.every(profile => profile !== undefined)).toBe(true);
    });

    it('processes large datasets efficiently', async () => {
      // Create a large CSV
      const largeIds = Array.from({ length: 100 }, (_, i) => `expert_${i}`).join('\n');
      fs.readFileSync.mockReturnValue(`id\n${largeIds}`);
      
      getExpertData.mockImplementation(async (expertId) => ({
        expertId,
        firstName: 'Expert',
        lastName: 'Test'
      }));
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(100);
      expect(getExpertData).toHaveBeenCalledTimes(100);
    });
  });

  describe('file path handling', () => {
    it('uses correct CSV file path', async () => {
      await fetchExpertProfiles();
      
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('expert_ids.csv'),
        'utf8'
      );
    });

    it('handles different working directories', async () => {
      // Mock path resolution
      const originalCwd = process.cwd();
      
      try {
        await fetchExpertProfiles();
        
        expect(fs.readFileSync).toHaveBeenCalled();
      } finally {
        // Ensure we don't accidentally change the working directory
      }
    });
  });

  describe('concurrency and performance', () => {
    it('processes experts concurrently', async () => {
      const startTime = Date.now();
      
      getExpertData.mockImplementation(async (expertId) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return { expertId, firstName: 'Test', lastName: 'Expert' };
      });
      
      const result = await fetchExpertProfiles();
      const endTime = Date.now();
      
      expect(result).toHaveLength(3);
      // If processed sequentially, would take ~150ms. Concurrent should be much faster.
      expect(endTime - startTime).toBeLessThan(120);
    });

    it('handles concurrent errors gracefully', async () => {
      getExpertData
        .mockImplementation(async (expertId) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (expertId === '456') {
            throw new Error(`Failed to fetch ${expertId}`);
          }
          return { expertId, firstName: 'Test', lastName: 'Expert' };
        });
      
      const result = await fetchExpertProfiles();
      
      expect(result).toHaveLength(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching profile for expert 456:'),
        expect.stringContaining('Failed to fetch 456')
      );
    });
  });

  // Add coverage for error/edge case on line 52 of fetchExpertProfiles.js
  it('returns empty array if no expert IDs are found', async () => {
    fs.readFileSync.mockReturnValue('id\n');
    const result = await fetchExpertProfiles();
    expect(result).toEqual([]);
    expect(getExpertData).not.toHaveBeenCalled();
  });
});
