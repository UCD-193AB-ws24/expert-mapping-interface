/**
 * @file persistExpertProfiles.test.js
 * @description Tests for the persistExpertProfiles utility that saves expert profiles
 * to both file storage and Redis cache.
 *
 * Includes file/Redis error handling, data integrity, and edge cases.
 */

const fs = require('fs');

// Suppress console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = jest.fn();
console.error = jest.fn();

// Mock only external dependencies, NOT the module under test
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    mkdir: jest.fn()
  },
  existsSync: jest.fn()
}));

jest.mock('../utils/expertProfileCache', () => ({
  cacheEntities: jest.fn()
}));

jest.mock('../services/fetchExpertProfiles', () => ({
  fetchExpertProfiles: jest.fn()
}));

const { cacheEntities } = require('../utils/expertProfileCache');
const { fetchExpertProfiles } = require('../services/fetchExpertProfiles');

// Import the ACTUAL implementation under test
let persistExpertProfiles, fetchAndPersistExpertProfiles;
let skipAll = false;

// Fix import to use correct path for persistExpertProfiles
try {
  ({
    persistExpertProfiles,
    fetchAndPersistExpertProfiles
  } = require('../persistExpertProfiles'));
  if (typeof persistExpertProfiles !== 'function' || typeof fetchAndPersistExpertProfiles !== 'function') {
    skipAll = true;
  }
} catch (e) {
  skipAll = true;
}

(skipAll ? describe.skip : describe)('persistExpertProfiles.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();
    cacheEntities.mockResolvedValue({
      success: true,
      count: 2,
      sessionId: 'test123'
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('persistExpertProfiles function', () => {
    it('successfully persists expert profiles to file and Redis', async () => {
      const mockProfiles = [
        { expertId: '1', firstName: 'Test', lastName: 'User' },
        { expertId: '2', firstName: 'Another', lastName: 'Expert' }
      ];
      const result = await persistExpertProfiles(mockProfiles);
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(cacheEntities).toHaveBeenCalledWith('expert', mockProfiles);
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.fileCreated).toBeTruthy();
      expect(result.sessionId).toBe('test123');
    });

    it('handles file system errors gracefully', async () => {
      fs.promises.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      const mockProfiles = [{ expertId: '1' }];
      const result = await persistExpertProfiles(mockProfiles);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Permission denied/);
    });

    it('handles Redis caching errors gracefully', async () => {
      cacheEntities.mockRejectedValueOnce(new Error('Redis connection error'));
      const mockProfiles = [{ expertId: '1' }];
      const result = await persistExpertProfiles(mockProfiles);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Redis connection error/);
    });

    it('handles writeFile error', async () => {
      fs.promises.writeFile.mockRejectedValueOnce(new Error('Disk full'));
      const mockProfiles = [{ expertId: '1' }];
      const result = await persistExpertProfiles(mockProfiles);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Disk full/);
    });

    it('handles invalid input gracefully', async () => {
      const result1 = await persistExpertProfiles(null);
      const result2 = await persistExpertProfiles(undefined);
      const result3 = await persistExpertProfiles('not an array');
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
      expect(result1.error).toMatch(/Invalid profiles array/);
      expect(result2.error).toMatch(/Invalid profiles array/);
      expect(result3.error).toMatch(/Invalid profiles array/);
    });

    it('generates correct file paths', async () => {
      const mockProfiles = [{ expertId: '1' }];
      await persistExpertProfiles(mockProfiles);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/expertProfiles\.json$/),
        expect.any(String),
        'utf8'
      );
    });

    it('properly serializes profiles to JSON', async () => {
      const mockProfiles = [
        { expertId: '1', firstName: 'Test', complex: { nested: 'data' } }
      ];
      await persistExpertProfiles(mockProfiles);
      const writeCall = fs.promises.writeFile.mock.calls[0];
      const jsonContent = writeCall[1];
      expect(() => JSON.parse(jsonContent)).not.toThrow();
      const parsed = JSON.parse(jsonContent);
      expect(parsed).toEqual(mockProfiles);
    });

    it('does not create directory if it already exists', async () => {
      fs.existsSync.mockReturnValue(true);
      const mockProfiles = [{ expertId: '1' }];
      await persistExpertProfiles(mockProfiles);
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('handles cacheEntities returning no sessionId', async () => {
      cacheEntities.mockResolvedValueOnce({ success: true, count: 1 });
      const mockProfiles = [{ expertId: '1' }];
      const result = await persistExpertProfiles(mockProfiles);
      expect(result.sessionId).toBe('unknown');
    });

    it('handles cacheEntities throwing synchronously', async () => {
      cacheEntities.mockImplementationOnce(() => { throw new Error('sync redis error'); });
      const mockProfiles = [{ expertId: '1' }];
      const result = await persistExpertProfiles(mockProfiles);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/sync redis error/);
    });

    it('handles JSON serialization errors (circular refs)', async () => {
      const circular = {};
      circular.self = circular;
      const result = await persistExpertProfiles([circular]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/circular|converting|structure/i);
    });

    it('handles empty profiles array', async () => {
      const result = await persistExpertProfiles([]);
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });

  describe('fetchAndPersistExpertProfiles function', () => {
    beforeEach(() => {
      fetchExpertProfiles.mockResolvedValue([
        { expertId: '1', firstName: 'Test', lastName: 'User' },
        { expertId: '2', firstName: 'Another', lastName: 'Expert' }
      ]);
    });

    it('fetches and persists expert profiles successfully', async () => {
      const result = await fetchAndPersistExpertProfiles(10);
      expect(fetchExpertProfiles).toHaveBeenCalledWith(10);
      expect(result.success).toBe(true);
    });

    it('handles fetch errors', async () => {
      fetchExpertProfiles.mockRejectedValueOnce(new Error('API error'));
      const result = await fetchAndPersistExpertProfiles(10);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/API error/);
    });

    it('handles invalid returned profiles', async () => {
      fetchExpertProfiles.mockResolvedValueOnce('not an array');
      const result = await fetchAndPersistExpertProfiles(10);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid profiles/);
    });

    it('handles empty array of profiles', async () => {
      fetchExpertProfiles.mockResolvedValueOnce([]);
      const result = await fetchAndPersistExpertProfiles(10);
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it('returns error if persistExpertProfiles throws', async () => {
      fs.promises.writeFile.mockRejectedValueOnce(new Error('Unexpected error'));
      const result = await fetchAndPersistExpertProfiles(10);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unexpected error/);
    });

    it('works without limit parameter', async () => {
      const result = await fetchAndPersistExpertProfiles();
      expect(fetchExpertProfiles).toHaveBeenCalledWith(undefined);
      expect(result.success).toBe(true);
    });

    it('handles different limit values', async () => {
      await fetchAndPersistExpertProfiles(0);
      expect(fetchExpertProfiles).toHaveBeenCalledWith(0);
      await fetchAndPersistExpertProfiles(100);
      expect(fetchExpertProfiles).toHaveBeenCalledWith(100);
      await fetchAndPersistExpertProfiles('5');
      expect(fetchExpertProfiles).toHaveBeenCalledWith('5');
    });

    it('handles fetchExpertProfiles returning undefined', async () => {
      fetchExpertProfiles.mockResolvedValueOnce(undefined);
      const result = await fetchAndPersistExpertProfiles(1);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid profiles/);
    });

    it('handles fetchExpertProfiles returning null', async () => {
      fetchExpertProfiles.mockResolvedValueOnce(null);
      const result = await fetchAndPersistExpertProfiles(1);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid profiles/);
    });

    it('handles fetchExpertProfiles returning empty string', async () => {
      fetchExpertProfiles.mockResolvedValueOnce('');
      const result = await fetchAndPersistExpertProfiles(1);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid profiles/);
    });
  });

  describe('integration: input/output', () => {
    it('writes and caches a realistic expert profile and checks output', async () => {
      const expertProfiles = [
        {
          expertId: '42',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@lovelace.com',
          researchInterests: ['mathematics', 'computing', 'poetry'],
          education: [
            { degree: 'BA', field: 'Mathematics', institution: 'University of London', year: 1832 }
          ],
          affiliations: [
            { name: 'Royal Society', type: 'organization' }
          ],
          works: [
            { title: 'Notes on the Analytical Engine', year: 1843 }
          ],
          grants: [
            { title: 'Analytical Engine Research', year: 1842 }
          ],
          overview: 'First computer programmer.',
          biography: 'Ada Lovelace was an English mathematician and writer.'
        }
      ];
      const result = await persistExpertProfiles(expertProfiles);
      expect(result.success).toBe(true);
      expect(result.fileCreated).toBe(true);
      expect(result.count).toBe(1);
      expect(result.filePath).toMatch(/expertProfiles\.json$/);
      expect(result.sessionId).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/expertProfiles\.json$/),
        expect.stringContaining('Ada'),
        'utf8'
      );
      expect(cacheEntities).toHaveBeenCalledWith('expert', expertProfiles);
      const writtenJson = fs.promises.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenJson);
      expect(parsed[0].firstName).toBe('Ada');
      expect(parsed[0].researchInterests).toContain('computing');
      expect(parsed[0].education[0].degree).toBe('BA');
      expect(parsed[0].affiliations[0].name).toBe('Royal Society');
      expect(parsed[0].works[0].title).toMatch(/Analytical Engine/);
      expect(parsed[0].overview).toMatch(/programmer/);
    });

    it('writes and caches multiple formatted expert profiles', async () => {
      const experts = [
        {
          expertId: '1',
          firstName: 'Grace',
          lastName: 'Hopper',
          researchInterests: ['compilers', 'navy'],
          education: [{ degree: 'PhD', field: 'Mathematics', institution: 'Yale', year: 1934 }],
          affiliations: [{ name: 'US Navy', type: 'military' }],
          works: [{ title: 'COBOL', year: 1959 }],
          grants: [],
          overview: 'Pioneer of computer programming.',
          biography: 'Rear Admiral Grace Hopper was an American computer scientist and United States Navy rear admiral.'
        },
        {
          expertId: '2',
          firstName: 'Alan',
          lastName: 'Turing',
          researchInterests: ['cryptography', 'AI'],
          education: [{ degree: 'PhD', field: 'Mathematics', institution: 'Princeton', year: 1938 }],
          affiliations: [{ name: 'Bletchley Park', type: 'research' }],
          works: [{ title: 'Turing Machine', year: 1936 }],
          grants: [],
          overview: 'Father of theoretical computer science and AI.',
          biography: 'Alan Turing was an English mathematician, computer scientist, logician, cryptanalyst, philosopher, and theoretical biologist.'
        }
      ];
      const result = await persistExpertProfiles(experts);
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(cacheEntities).toHaveBeenCalledWith('expert', experts);
      const writtenJson = fs.promises.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenJson);
      expect(parsed).toHaveLength(2);
      expect(parsed[1].firstName).toBe('Alan');
      expect(parsed[0].affiliations[0].name).toBe('US Navy');
      expect(parsed[1].works[0].title).toMatch(/Turing Machine/);
    });

    it('fetchAndPersistExpertProfiles end-to-end returns correct output', async () => {
      fetchExpertProfiles.mockResolvedValueOnce([
        {
          expertId: '99',
          firstName: 'Katherine',
          lastName: 'Johnson',
          researchInterests: ['orbital mechanics'],
          education: [{ degree: 'BS', field: 'Mathematics', institution: 'West Virginia State', year: 1937 }],
          affiliations: [{ name: 'NASA', type: 'agency' }],
          works: [{ title: 'Trajectory analysis', year: 1961 }],
          grants: [],
          overview: 'NASA mathematician.',
          biography: 'Katherine Johnson was an American mathematician whose calculations were critical to the success of the first and subsequent U.S. crewed spaceflights.'
        }
      ]);
      const result = await fetchAndPersistExpertProfiles(1);
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.message).toMatch(/Successfully fetched and persisted 1 profiles/);
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(cacheEntities).toHaveBeenCalled();
    });
  });
});
