const { formatTime, createTimer } = require('../utils/timingUtils');

describe('formatTime', () => {
  it('formats milliseconds less than 1000', () => {
    expect(formatTime(123.456789)).toBe('123.4568ms');
    expect(formatTime(0.123456)).toBe('0.123ms');
  });

  it('formats milliseconds as seconds', () => {
    expect(formatTime(1234.5678)).toMatch(/^1\.235s$/);
    expect(formatTime(59999)).toMatch(/^59\.999s$/);
  });

  it('formats milliseconds as minutes and seconds', () => {
    expect(formatTime(61000)).toMatch(/^1m 1\.000s$/);
    expect(formatTime(125678)).toMatch(/^2m 5\.68s$/);
  });

  it('caps at 4 digits past decimal', () => {
    expect(formatTime(1.123456)).toBe('1.1235ms');
    expect(formatTime(1001.123456)).toMatch(/^1\.001s$/);
  });
});

describe('createTimer', () => {
  let originalPerformanceNow;
  beforeAll(() => {
    originalPerformanceNow = global.performance.now;
    global.performance.now = jest.fn();
  });
  afterAll(() => {
    global.performance.now = originalPerformanceNow;
  });

  it('measures elapsed time (raw ms)', () => {
    global.performance.now
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1500);
    const timer = createTimer();
    timer.start();
    const elapsed = timer.stop(false);
    expect(elapsed).toBeCloseTo(500, 5);
  });

  it('measures elapsed time (formatted)', () => {
    global.performance.now
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3500);
    const timer = createTimer();
    timer.start();
    const formatted = timer.stop(true);
    expect(typeof formatted).toBe('string');
    expect(formatted).toMatch(/1\.5/);
  });
});
