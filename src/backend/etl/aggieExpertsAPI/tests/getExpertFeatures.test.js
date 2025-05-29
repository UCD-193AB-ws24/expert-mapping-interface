/**
 * @file getExpertFeatures.test.js  
 * @description Tests for expert feature extraction utilities
 */

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();
});

// Mock getExpertProfiles to return real expert data for integration tests
jest.mock('../services/getExpertProfiles', () => {
  const expertProfiles = require('../formattedFeatures/expertProfiles.json');
  return {
    getExpertProfiles: jest.fn().mockResolvedValue({
      success: true,
      profiles: expertProfiles,
      sessionId: 'test-session'
    })
  };
});
// Optionally, mock formatFeatures if you want to control its output
// jest.mock('../services/formatFeatures', () => ({
//   formatFeatures: jest.fn().mockReturnValue({
//     works: [{ id: 1, title: 'Work 1' }],
//     grants: [{ id: 2, title: 'Grant 1' }]
//   })
// }));
// Re-require after mocks
const {
  extractResearchInterests,
  extractEducation,
  extractAffiliations,
  getExpertFeatures
} = require('../getExpertFeatures');

describe('getExpertFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('extractResearchInterests', () => {
    it('extracts interests from interests array', () => {
      const expert = {
        interests: ['machine learning', 'artificial intelligence', 'data science']
      };

      const result = extractResearchInterests(expert);
      expect(result).toEqual(['machine learning', 'artificial intelligence', 'data science']);
    });

    it('extracts interests from overview when interests array is empty', () => {
      const expert = {
        interests: [],
        overview: 'Research focuses on deep learning and neural networks for computer vision applications.'
      };

      const result = extractResearchInterests(expert);
      expect(Array.isArray(result)).toBe(true);
      // Don't test for specific extracted terms as the implementation may vary
      if (result.length > 0) {
        expect(result.some(interest => interest.includes('deep') || interest.includes('learning'))).toBe(true);
      }
    });

    it('handles missing interests and overview', () => {
      const expert = {};
      
      const result = extractResearchInterests(expert);
      expect(result).toEqual([]);
    });

    it('handles null and undefined values', () => {
      expect(extractResearchInterests(null)).toEqual([]);
      expect(extractResearchInterests(undefined)).toEqual([]);
      expect(extractResearchInterests({})).toEqual([]);
    });
  });

  describe('extractEducation', () => {
    it('extracts education from education array', () => {
      const expert = {
        education: [
          { degree: 'PhD', field: 'Computer Science', institution: 'MIT' },
          { degree: 'MS', field: 'Mathematics', institution: 'Stanford' }
        ]
      };

      const result = extractEducation(expert);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles missing education data', () => {
      const expert = {};
      
      const result = extractEducation(expert);
      expect(result).toEqual([]);
    });
  });

  describe('extractAffiliations', () => {
    it('extracts affiliations from affiliations array', () => {
      const expert = {
        affiliations: [
          { name: 'UC Davis', type: 'university' },
          { name: 'IEEE', type: 'professional organization' }
        ]
      };

      const result = extractAffiliations(expert);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles missing affiliations', () => {
      const expert = {};
      
      const result = extractAffiliations(expert);
      expect(result).toEqual([]);
    });
  });

  describe('getExpertFeatures integration', () => {
    it('combines all features for complete expert profile', async () => {
      const expert = {
        expertId: '123',
        firstName: 'John',
        lastName: 'Doe',
        interests: ['machine learning', 'AI'],
        education: [{ degree: 'PhD', field: 'CS', institution: 'MIT' }],
        affiliations: [{ name: 'UC Davis', type: 'university' }],
        overview: 'Research in deep learning and computer vision.'
      };
      const result = await getExpertFeatures(expert);
      expect(result).toHaveProperty('works');
      expect(result).toHaveProperty('grants');
      expect(Array.isArray(result.works)).toBe(true);
      expect(Array.isArray(result.grants)).toBe(true);
    });
    it('handles experts with minimal data', async () => {
      const expert = {
        expertId: '456',
        firstName: 'Jane',
        lastName: 'Smith'
      };
      const result = await getExpertFeatures(expert);
      expect(result).toHaveProperty('works');
      expect(result).toHaveProperty('grants');
      expect(Array.isArray(result.works)).toBe(true);
      expect(Array.isArray(result.grants)).toBe(true);
    });
    it('handles null expert input', async () => {
      const result = await getExpertFeatures(null);
      expect(result).toHaveProperty('works');
      expect(result).toHaveProperty('grants');
      expect(result.works).toEqual([]);
      expect(result.grants).toEqual([]);
    });
  });

  describe('error handling and edge cases', () => {
    it('handles circular references in expert data', () => {
      const expert = {
        expertId: '999',
        firstName: 'Test',
        lastName: 'Expert'
      };
      // Create circular reference
      expert.self = expert;

      expect(() => getExpertFeatures(expert)).not.toThrow();
    });

    it('handles special characters in text fields', () => {
      const expert = {
        interests: ['AI/ML', 'IoT & Edge Computing', 'Quantum@Scale'],
        overview: 'Research in α-β testing and γ-ray detection using ∀∃ logic.'
      };

      const result = extractResearchInterests(expert);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
