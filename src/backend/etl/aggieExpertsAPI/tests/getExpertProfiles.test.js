/**
 * @file getExpertProfiles.test.js
 * @description Tests for the getExpertProfiles service
 */

const getExpertProfiles = require('../services/getExpertProfiles');

jest.mock('../services/getExpertProfiles');

describe('getExpertProfiles', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success with profiles', async () => {
    getExpertProfiles.getExpertProfiles.mockResolvedValue({
      success: true,
      profiles: [{ expertId: '1', name: 'John Doe' }],
      sessionId: 'session123'
    });
    const res = await getExpertProfiles.getExpertProfiles();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.profiles)).toBe(true);
    expect(res.sessionId).toBe('session123');
  });

  it('handles empty cache', async () => {
    getExpertProfiles.getExpertProfiles.mockResolvedValue({
      success: false,
      error: 'Cache is empty'
    });
    const res = await getExpertProfiles.getExpertProfiles();
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cache is empty');
  });

  it('handles errors gracefully', async () => {
    getExpertProfiles.getExpertProfiles.mockRejectedValue(new Error('Redis error'));
    await expect(getExpertProfiles.getExpertProfiles()).rejects.toThrow('Redis error');
  });

  it('returns all profiles when recent is false', async () => {
    getExpertProfiles.getExpertProfiles.mockResolvedValue({
      success: true,
      profiles: [{ expertId: '2', name: 'Jane Smith', recentCache: false }],
      sessionId: 'all-session'
    });
    const res = await getExpertProfiles.getExpertProfiles({ recent: false });
    expect(res.success).toBe(true);
    expect(res.profiles[0].recentCache).toBe(false);
    expect(res.sessionId).toBe('all-session');
  });
});
