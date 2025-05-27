const { isHighConfidence } = require('../confidenceFilter');

describe('confidenceFilter.js', () => {
  describe('isHighConfidence', () => {
    // This function checks if the confidence of an entry is 70 or higher
    it('should return true if confidence is greater than or equal to 70', () => {
      const entry = { confidence: 80 };
      expect(isHighConfidence(entry)).toBe(true);
    });

    // This function checks if the confidence of an entry is less than 70
    it('should return false if confidence is less than 70', () => {
      const entry = { confidence: 60 };
      expect(isHighConfidence(entry)).toBe(false);
    });

    // This function checks if the confidence of an entry is exactly 70
    it('should return true if confidence is exactly 70', () => {
      const entry = { confidence: 70 };
      expect(isHighConfidence(entry)).toBe(true);
    });

    // This function checks if the confidence of an entry is not a number or missing
    it('should return false if confidence is not a number', () => {
      const entry = { confidence: 'invalid' };
      expect(isHighConfidence(entry)).toBe(false);
    });

    // This function checks if the confidence property is missing from the entry
    it('should return false if confidence is missing', () => {
      const entry = {};
      expect(isHighConfidence(entry)).toBe(false);
    });

    // This function checks if the confidence is a string that can be parsed as a number
    it('should handle confidence as a string and return true if it is >= 70', () => {
      const entry = { confidence: '75' };
      expect(isHighConfidence(entry)).toBe(true);
    });
  });
});