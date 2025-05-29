const { getExpertFeatures, extractResearchInterests, extractEducation, extractAffiliations } = require('../getExpertFeatures');

jest.mock('../services/formatFeatures', () => ({
  formatFeatures: jest.fn(profiles => ({
    works: profiles.map(p => ({ id: p.expertId || p.id || 'test', type: 'work' })),
    grants: profiles.map(p => ({ id: p.expertId || p.id || 'test', type: 'grant' }))
  }))
}));
jest.mock('../services/getExpertProfiles', () => ({
  getExpertProfiles: jest.fn()
}));
const { formatFeatures } = require('../services/formatFeatures');
const { getExpertProfiles } = require('../services/getExpertProfiles');

describe('getExpertFeatures', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns empty works/grants for null input', async () => {
    const result = await getExpertFeatures(null);
    expect(result).toEqual({ works: [], grants: [] });
  });

  it('formats direct expert object input', async () => {
    const expert = { expertId: 'abc', name: 'Test' };
    const result = await getExpertFeatures(expert);
    expect(result.works[0].id).toBe('abc');
    expect(result.grants[0].id).toBe('abc');
  });

  it('formats direct expert array input', async () => {
    const experts = [{ expertId: 'a' }, { expertId: 'b' }];
    const result = await getExpertFeatures(experts);
    expect(result.works.length).toBe(2);
    expect(result.grants.length).toBe(2);
  });

  it('calls getExpertProfiles and formats features (success)', async () => {
    getExpertProfiles.mockResolvedValue({ success: true, profiles: [{ expertId: 'x' }], sessionId: 'sid' });
    const result = await getExpertFeatures({ recent: true });
    expect(getExpertProfiles).toHaveBeenCalledWith({ recent: true });
    expect(formatFeatures).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.features.works[0].id).toBe('x');
    expect(result.sessionId).toBe('sid');
    expect(result.timing).toBeDefined();
  });

  it('handles getExpertProfiles failure', async () => {
    getExpertProfiles.mockResolvedValue({ success: false, error: 'fail' });
    const result = await getExpertFeatures({ recent: false });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
    expect(result.timing).toBeDefined();
  });

  it('returns empty works/grants on error for direct input', async () => {
    formatFeatures.mockImplementationOnce(() => { throw new Error('bad format'); });
    const expert = { expertId: 'err' };
    const result = await getExpertFeatures(expert);
    expect(result).toEqual({ works: [], grants: [] });
  });
});

describe('extractResearchInterests', () => {
  it('returns interests array if present', () => {
    expect(extractResearchInterests({ interests: ['a', 'b'] })).toEqual(['a', 'b']);
  });
  it('extracts words from overview string', () => {
    expect(extractResearchInterests({ overview: 'foo bar' })).toEqual(['foo', 'bar']);
  });
  it('returns [] for missing/invalid input', () => {
    expect(extractResearchInterests(null)).toEqual([]);
    expect(extractResearchInterests({})).toEqual([]);
  });
});

describe('extractEducation', () => {
  it('returns education array if present', () => {
    expect(extractEducation({ education: [1, 2] })).toEqual([1, 2]);
  });
  it('returns [] for missing/invalid input', () => {
    expect(extractEducation(null)).toEqual([]);
    expect(extractEducation({})).toEqual([]);
  });
});

describe('extractAffiliations', () => {
  it('returns affiliations array if present', () => {
    expect(extractAffiliations({ affiliations: [1, 2] })).toEqual([1, 2]);
  });
  it('returns [] for missing/invalid input', () => {
    expect(extractAffiliations(null)).toEqual([]);
    expect(extractAffiliations({})).toEqual([]);
  });
});