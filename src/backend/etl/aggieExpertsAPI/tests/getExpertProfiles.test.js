/**
 * @file getExpertProfiles.test.js
 * @description Tests for the getExpertProfiles service (real implementation)
 */

jest.mock('../utils/expertProfileCache', () => ({
  getRecentCachedEntities: jest.fn(),
  getCachedEntities: jest.fn()
}));
const { getRecentCachedEntities, getCachedEntities } = require('../utils/expertProfileCache');
const { getExpertProfiles } = require('../services/getExpertProfiles');

describe('getExpertProfiles (real implementation)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success with profiles (recent=true)', async () => {
    getRecentCachedEntities.mockResolvedValue({
      success: true,
      items: [{ expertId: '1', name: 'John Doe' }],
      sessionId: 'session123'
    });
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.profiles)).toBe(true);
    expect(res.sessionId).toBe('session123');
    expect(res.profiles[0].expertId).toBe('1');
  });

  it('returns success with profiles (recent=false)', async () => {
    getCachedEntities.mockResolvedValue({
      success: true,
      items: [{ expertId: '2', name: 'Jane Smith' }],
      sessionId: 'all-session'
    });
    const res = await getExpertProfiles({ recent: false });
    expect(res.success).toBe(true);
    expect(res.profiles[0].expertId).toBe('2');
    expect(res.sessionId).toBe('all-session');
  });

  it('returns error if cache returns empty items', async () => {
    getRecentCachedEntities.mockResolvedValue({ success: true, items: [] });
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cache is empty/i);
  });

  it('returns error if cache returns success: false', async () => {
    getRecentCachedEntities.mockResolvedValue({ success: false, items: [] });
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cache/i);
  });

  it('returns error if cache throws', async () => {
    getRecentCachedEntities.mockRejectedValue(new Error('Redis error'));
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/redis error/i);
  });

  it('returns error if no options provided and cache fails', async () => {
    getRecentCachedEntities.mockResolvedValue({ success: false, items: [] });
    const res = await getExpertProfiles();
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cache/i);
  });
});
