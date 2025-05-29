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
    expect(res.profiles[0].name).toBe('John Doe');
    expect(getRecentCachedEntities).toHaveBeenCalled();
    expect(getCachedEntities).not.toHaveBeenCalled();
  });

  it('returns success with profiles (recent=false)', async () => {
    getCachedEntities.mockResolvedValue({
      success: true,
      items: [{ expertId: '2', name: 'Jane Smith', field: 'Physics' }],
      sessionId: 'all-session'
    });
    const res = await getExpertProfiles({ recent: false });
    expect(res.success).toBe(true);
    expect(res.profiles[0].expertId).toBe('2');
    expect(res.profiles[0].name).toBe('Jane Smith');
    expect(res.profiles[0].field).toBe('Physics');
    expect(res.sessionId).toBe('all-session');
    expect(getCachedEntities).toHaveBeenCalled();
    expect(getRecentCachedEntities).not.toHaveBeenCalled();
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

  it('returns success even if sessionId is missing', async () => {
    getRecentCachedEntities.mockResolvedValue({ success: true, items: [{ expertId: '3', name: 'No Session' }] });
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(true);
    expect(res.sessionId).toBeUndefined();
    expect(res.profiles[0].expertId).toBe('3');
    expect(res.profiles[0].name).toBe('No Session');
  });

  it('returns error if cache result is undefined', async () => {
    getRecentCachedEntities.mockResolvedValue(undefined);
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cache/i);
  });

  it('returns error if cache result is null', async () => {
    getRecentCachedEntities.mockResolvedValue(null);
    const res = await getExpertProfiles({ recent: true });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cache/i);
  });

  it('calls getRecentCachedEntities by default if no options passed', async () => {
    getRecentCachedEntities.mockResolvedValue({ success: true, items: [{ expertId: '4' }], sessionId: 'sid4' });
    const res = await getExpertProfiles();
    expect(getRecentCachedEntities).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.profiles[0].expertId).toBe('4');
  });

  it('propagates thrown error message', async () => {
    getRecentCachedEntities.mockImplementation(() => { throw new Error('unexpected fail'); });
    const res = await getExpertProfiles();
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unexpected fail/);
  });

  it('handles options as undefined and as empty object', async () => {
    getRecentCachedEntities.mockResolvedValue({ success: true, items: [{ expertId: '5', name: 'Five' }], sessionId: 'sid5' });
    const res1 = await getExpertProfiles();
    const res2 = await getExpertProfiles(undefined);
    const res3 = await getExpertProfiles({});
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);
    expect(res1.profiles[0].expertId).toBe('5');
    expect(res1.profiles[0].name).toBe('Five');
    expect(res2.profiles[0].expertId).toBe('5');
    expect(res2.profiles[0].name).toBe('Five');
    expect(res3.profiles[0].expertId).toBe('5');
    expect(res3.profiles[0].name).toBe('Five');
  });
});
