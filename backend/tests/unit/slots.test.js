const { computeSlots, isSlotFree } = require('../../src/domain/slots');
const { toIso, atLocal } = require('../../src/utils/time');

const hours = { opensAt: '09:00', closesAt: '18:00', breakStartsAt: '12:00', breakEndsAt: '13:00', closed: false };
const now = new Date('2026-11-02T08:00:00-03:00');
const base = { date: '2026-11-03', now, hours, durationMinutes: 30, busy: [] };
const hhmm = (slots) => slots.map((s) => toIso(s).slice(11, 16));

describe('computeSlots', () => {
  test('no busy gives 30 slots with lunch excluded', () => {
    const s = computeSlots(base);
    const l = hhmm(s);
    expect(s).toHaveLength(30);
    expect(toIso(s[0])).toBe('2026-11-03T09:00:00-03:00');
    expect(toIso(s[s.length - 1])).toBe('2026-11-03T17:30:00-03:00');
    expect(l).toContain('11:30');
    expect(l).not.toContain('11:45');
    expect(l).not.toContain('12:00');
    expect(l).not.toContain('12:30');
    expect(l).toContain('13:00');
  });
  test('busy interval removes overlapping starts', () => {
    const busy = [{ start: atLocal('2026-11-03', '10:00'), end: atLocal('2026-11-03', '10:30') }];
    const l = hhmm(computeSlots({ ...base, busy }));
    expect(l).not.toContain('09:45');
    expect(l).not.toContain('10:00');
    expect(l).toContain('09:30');
    expect(l).toContain('10:30');
  });
  test('closed or null hours give []', () => {
    expect(computeSlots({ ...base, hours: { ...hours, closed: true } })).toEqual([]);
    expect(computeSlots({ ...base, hours: null })).toEqual([]);
  });
  test('now + 30min lead time', () => {
    const s = computeSlots({ ...base, now: new Date('2026-11-03T09:10:00-03:00') });
    expect(hhmm(s)[0]).toBe('09:45');
  });
  test('past date and 60-day horizon', () => {
    expect(computeSlots({ ...base, date: '2026-11-01' })).toEqual([]);
    expect(computeSlots({ ...base, date: '2027-01-01' }).length).toBeGreaterThan(0);
    expect(computeSlots({ ...base, date: '2027-01-02' })).toEqual([]);
  });
  test('60 min service', () => {
    const l = hhmm(computeSlots({ ...base, durationMinutes: 60 }));
    expect(l).not.toContain('11:15');
    expect(l).toContain('11:00');
    expect(l[l.length - 1]).toBe('17:00');
  });
  test('works without lunch break', () => {
    const l = hhmm(computeSlots({ ...base, hours: { ...hours, breakStartsAt: null, breakEndsAt: null } }));
    expect(l).toContain('12:00');
  });
  test('isSlotFree', () => {
    expect(isSlotFree(base, atLocal('2026-11-03', '10:05'))).toBe(false);
    expect(isSlotFree(base, atLocal('2026-11-03', '10:00'))).toBe(true);
  });
});
