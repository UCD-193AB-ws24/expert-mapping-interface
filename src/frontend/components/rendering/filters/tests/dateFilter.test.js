const { isWorkInDate, isGrantInDate } = require('../dateFilter');

describe('dateFilter.js', () => {

//
  describe('isWorkInDate', () => {
    // Test case for issued year within range
    it('should return true if the issued year is within the selected date range', () => {   
      const entry = { issued: '2015' };
      const selectedDateRange = [2010, 2020];
      expect(isWorkInDate(entry, selectedDateRange)).toBe(true);
    });

    // Test case for issued year outside range
    it('should return false if the issued year is outside the selected date range', () => { 
      const entry = { issued: '2005' };
      const selectedDateRange = [2010, 2020];
      expect(isWorkInDate(entry, selectedDateRange)).toBe(false);
    });

    // Test case for no date range
    it('should return true if no date range is provided', () => {   
      const entry = { issued: '2015' };
      expect(isWorkInDate(entry, null)).toBe(true);
    });

    // Test case for invalid date range
    it('should return true if the date range is invalid', () => {   
      const entry = { issued: '2015' };
      const selectedDateRange = [2010];
      expect(isWorkInDate(entry, selectedDateRange)).toBe(true);
    });
  });

  // Test cases for isGrantInDate
  describe('isGrantInDate', () => {
    // Test case for start date within range
    it('should return true if the start date is within the selected date range', () => { 
      const entry = { startDate: '2015', endDate: '2020' };
      const selectedDateRange = [2010, 2020];
      expect(isGrantInDate(entry, selectedDateRange)).toBe(true);
    });

    // Test case for end date within range
    it('should return true if the end date is within the selected date range', () => {  
      const entry = { startDate: '2005', endDate: '2015' };
      const selectedDateRange = [2010, 2020];
      expect(isGrantInDate(entry, selectedDateRange)).toBe(true);
    });

    // Test case for both dates outside range
    it('should return false if neither start nor end date is within the selected date range', () => {  
      const entry = { startDate: '2000', endDate: '2005' };
      const selectedDateRange = [2010, 2020];
      expect(isGrantInDate(entry, selectedDateRange)).toBe(false);
    });

    // Test case for no date range
    it('should return true if no date range is provided', () => {   
      const entry = { startDate: '2015', endDate: '2020' };
      expect(isGrantInDate(entry, null)).toBe(true);
    });

    // Test case for invalid date range
    it('should return true if the date range is invalid', () => {   
      const entry = { startDate: '2015', endDate: '2020' };
      const selectedDateRange = [2010];
      expect(isGrantInDate(entry, selectedDateRange)).toBe(true);
    });

    // Test case for missing start or end dates
    it('should handle missing start or end dates accordingly', () => {   
      const entry = { startDate: null, endDate: '2015' };
      const selectedDateRange = [2010, 2020];
      expect(isGrantInDate(entry, selectedDateRange)).toBe(true);

      const entry2 = { startDate: '2005', endDate: null };
      expect(isGrantInDate(entry2, selectedDateRange)).toBe(false);
    });
  });
});