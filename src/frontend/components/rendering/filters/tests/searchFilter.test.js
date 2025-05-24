const { getRelatedExperts, matchesKeyword, getMatchedFields } = require('../searchFilter');


describe('searchFilter.js', () => {
  describe('getRelatedExperts', () => {
     // Test case for relatedExperts array
    it('should return relatedExperts array if present', () => { 
      const entry = { relatedExperts: [{ name: 'Expert 1' }, { name: 'Expert 2' }] };
      expect(getRelatedExperts(entry)).toEqual(entry.relatedExperts);
    });

    // Test case for relatedExpert single object
    it('should return an array with relatedExpert if present', () => {  
      const entry = { relatedExpert: { name: 'Expert 1' } };
      expect(getRelatedExperts(entry)).toEqual([entry.relatedExpert]);
    });

    // Test case for no related experts
    it('should return an empty array if no related experts are present', () => {  
      const entry = {};
      expect(getRelatedExperts(entry)).toEqual([]);
    });
  });

  describe('matchesKeyword', () => {
     // Exact match in title
    it('should return true for exact substring matches', () => { 
      const entry = { title: 'Research on AI', abstract: 'AI is the future', funder: 'Tech Fund' };
      expect(matchesKeyword('AI', entry)).toBe(true);
    });

    // Fuzzy match with typo
    it('should return true for fuzzy matches within the allowed Levenshtein distance', () => {  
      const entry = { title: 'Research on Artificial Intelligence', abstract: '', funder: '' };
      expect(matchesKeyword('Artifical', entry)).toBe(true); // Typo in keyword
    });

    // No match in title, abstract, or funder
    it('should return false if no match is found', () => {  
      const entry = { title: 'Research on Biology', abstract: '', funder: '' };
      expect(matchesKeyword('Physics', entry)).toBe(false);
    });

    // Empty keyword or null entry
    it('should return true if keyword is empty or entry is null', () => { 
      expect(matchesKeyword('', null)).toBe(true);
    });
  });

  describe('getMatchedFields', () => {
    // Exact match in title and abstract
    it('should return matched fields for exact matches', () => { 
      const entry = { title: 'AI Research', abstract: 'Study on AI', funder: 'Tech Fund' };
      const result = getMatchedFields('AI', entry);
      expect(result).toEqual([
        { field: 'title', match: 'AI' },
        { field: 'abstract', match: 'AI' },
      ]);
    });

     // Fuzzy match with typo
    it('should return matched fields for fuzzy matches', () => { 
      const entry = { title: 'Artificial Intelligence', abstract: '', funder: '' };
      const result = getMatchedFields('Artifical', entry); // Typo in keyword
      expect(result).toEqual([{ field: 'title', match: 'artificial' }]);
    });

    // No match in title, abstract, or funder
    it('should return an empty array if no matches are found', () => { 
      const entry = { title: 'Biology Research', abstract: '', funder: '' };
      const result = getMatchedFields('Physics', entry);
      expect(result).toEqual([]);
    });

    // Test case for relatedExperts field
    it('should handle relatedExperts field correctly', () => {  
      const entry = {
        relatedExperts: [{ fullName: 'Dr. Smith' }, { fullName: 'Dr. Johnson' }],
      };
      const result = getMatchedFields('Smith', entry);
      expect(result).toEqual([{ field: 'relatedExperts', match: 'Smith' }]);
    });
  });
});