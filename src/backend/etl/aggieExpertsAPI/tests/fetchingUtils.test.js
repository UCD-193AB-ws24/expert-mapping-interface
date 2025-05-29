/**
 * @file fetchingUtils.test.js
 * @description Tests for the fetchingUtils module
 */

// Suppress console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = jest.fn();
console.error = jest.fn();

// Mock axios before importing any modules
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn()
  }))
}));

// Import the module under test AFTER mocking dependencies
const fetchingUtils = require('../utils/fetchingUtils');
const axios = require('axios');

describe('fetchingUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('postRequestApi', () => {
    it('successfully makes a POST request', async () => {
      const mockResponse = {
        data: { result: 'success' }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await fetchingUtils.postRequestApi('https://api.example.com/test', { id: '123' });
      
      expect(result).toEqual({ result: 'success' });
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.example.com/test',
        { id: '123' },
        undefined
      );
    });

    it('handles request errors', async () => {
      const mockError = new Error('Network error');
      axios.post.mockRejectedValue(mockError);
      
      await expect(fetchingUtils.postRequestApi('https://api.example.com/test', {})).rejects.toThrow('Network error');
    });

    it('handles requests with custom headers', async () => {
      const mockResponse = {
        data: { result: 'success' }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const headers = { Authorization: 'Bearer token' };
      const result = await fetchingUtils.postRequestApi('https://api.example.com/test', {}, headers);
      
      expect(result).toEqual({ result: 'success' });
      expect(axios.post).toHaveBeenCalledWith('https://api.example.com/test', {}, headers);
    });

    it('handles empty response data', async () => {
      const mockResponse = {
        data: null
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await fetchingUtils.postRequestApi('https://api.example.com/test', {});
      
      expect(result).toBeNull();
    });

    it('handles timeout errors', async () => {
      const timeoutError = new Error('timeout of 1000ms exceeded');
      axios.post.mockRejectedValue(timeoutError);
      
      await expect(fetchingUtils.postRequestApi('https://api.example.com/test', {})).rejects.toThrow('timeout');
    });
    
    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      axios.post.mockRejectedValue(networkError);
      
      await expect(fetchingUtils.postRequestApi('https://api.example.com/test', {})).rejects.toThrow('Network Error');
    });
    
    it('handles HTTP error responses', async () => {
      const httpError = new Error('Request failed with status code 404');
      axios.post.mockRejectedValue(httpError);
      
      await expect(fetchingUtils.postRequestApi('https://api.example.com/test', {})).rejects.toThrow('404');
    });
  });

  describe('fetchFromApi', () => {
    it('successfully makes a GET request', async () => {
      const mockResponse = {
        data: { result: 'success' }
      };
      axios.get.mockResolvedValue(mockResponse);
      const result = await fetchingUtils.fetchFromApi('https://api.example.com/test', { id: '123' });
      expect(result).toEqual({ result: 'success' });
      expect(axios.get).toHaveBeenCalledWith('https://api.example.com/test', { params: { id: '123' }, headers: {} });
    });

    it('handles request errors', async () => {
      const mockError = new Error('Network error');
      axios.get.mockRejectedValue(mockError);
      await expect(fetchingUtils.fetchFromApi('https://api.example.com/test', {})).rejects.toThrow('Network error');
    });

    it('handles requests with custom headers', async () => {
      const mockResponse = {
        data: { result: 'success' }
      };
      axios.get.mockResolvedValue(mockResponse);
      const headers = { Authorization: 'Bearer token' };
      const result = await fetchingUtils.fetchFromApi('https://api.example.com/test', {}, headers);
      expect(result).toEqual({ result: 'success' });
      expect(axios.get).toHaveBeenCalledWith('https://api.example.com/test', { params: {}, headers });
    });

    it('handles empty response data', async () => {
      const mockResponse = {
        data: null
      };
      axios.get.mockResolvedValue(mockResponse);
      const result = await fetchingUtils.fetchFromApi('https://api.example.com/test', {});
      expect(result).toBeNull();
    });

    it('handles timeout errors', async () => {
      const timeoutError = new Error('timeout of 1000ms exceeded');
      axios.get.mockRejectedValue(timeoutError);
      await expect(fetchingUtils.fetchFromApi('https://api.example.com/test', {})).rejects.toThrow('timeout');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      axios.get.mockRejectedValue(networkError);
      await expect(fetchingUtils.fetchFromApi('https://api.example.com/test', {})).rejects.toThrow('Network Error');
    });

    it('handles HTTP error responses', async () => {
      const httpError = new Error('Request failed with status code 404');
      axios.get.mockRejectedValue(httpError);
      await expect(fetchingUtils.fetchFromApi('https://api.example.com/test', {})).rejects.toThrow('404');
    });
  });

  it('exports API_TOKEN as a string', () => {
    expect(typeof fetchingUtils.API_TOKEN).toBe('string');
    expect(fetchingUtils.API_TOKEN.startsWith('Bearer ')).toBe(true);
  });
});
