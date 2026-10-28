const {
  toIso, localDateOf, atLocal, weekdayOf, startOfLocalDay, endOfLocalDay,
  addMinutes, addDaysToLocalDate, overlaps,
} = require('../../src/utils/time');

describe('time utils', () => {
  test('toIso formats in SP offset without milliseconds', () => {
    expect(toIso(new Date('2026-11-03T13:30:00Z'))).toBe('2026-11-03T10:30:00-03:00');
  });
  test('localDateOf uses the SP calendar date', () => {
    expect(localDateOf(new Date('2026-11-04T01:30:00Z'))).toBe('2026-11-03');
  });
  test('atLocal converts SP wall time to Date', () => {
    expect(atLocal('2026-11-03', '09:00').toISOString()).toBe('2026-11-03T12:00:00.000Z');
  });
  test('weekdayOf is 0 for Sunday', () => {
    expect(weekdayOf('2026-11-03')).toBe(2);
    expect(weekdayOf('2026-11-01')).toBe(0);
  });
  test('start/end of local day', () => {
    expect(startOfLocalDay('2026-11-03').toISOString()).toBe('2026-11-03T03:00:00.000Z');
    expect(endOfLocalDay('2026-11-03').toISOString()).toBe('2026-11-04T03:00:00.000Z');
  });
  test('addMinutes and addDaysToLocalDate', () => {
    expect(addMinutes(new Date('2026-11-03T12:00:00Z'), 30).toISOString()).toBe('2026-11-03T12:30:00.000Z');
    expect(addDaysToLocalDate('2026-11-02', 60)).toBe('2027-01-01');
  });
  test('overlaps is half-open', () => {
    const t = (h) => new Date(`2026-11-03T${h}:00:00Z`);
    expect(overlaps(t('10'), t('11'), t('11'), t('12'))).toBe(false);
    expect(overlaps(t('10'), t('11'), t('10'), t('12'))).toBe(true);
  });
});
