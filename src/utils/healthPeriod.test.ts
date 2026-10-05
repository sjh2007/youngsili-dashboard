import { healthPeriod, koreanDate, validateHealthDates } from './healthPeriod';

it('uses Korean midnight rather than UTC or the workstation timezone', () => {
  expect(koreanDate(new Date('2026-10-01T14:59:59Z'))).toBe('2026-10-01');
  expect(koreanDate(new Date('2026-10-01T15:00:00Z'))).toBe('2026-10-02');
});
it('uses Monday through today, including Sunday and year boundaries', () => {
  expect(healthPeriod('week','2026-10-02')).toMatchObject({from:'2026-09-28',to:'2026-10-02',previousFrom:'2026-09-23',previousTo:'2026-09-27'});
  expect(healthPeriod('week','2026-10-04').from).toBe('2026-09-28');
  expect(healthPeriod('week','2026-10-05').from).toBe('2026-10-05');
  expect(healthPeriod('week','2026-01-01').from).toBe('2025-12-29');
});
it('uses calendar months, including leap years and cross-year three month ranges', () => {
  expect(healthPeriod('month','2026-10-02').from).toBe('2026-10-01');
  expect(healthPeriod('quarter','2026-10-02').from).toBe('2026-08-01');
  expect(healthPeriod('quarter','2026-01-31').from).toBe('2025-11-01');
  expect(healthPeriod('quarter','2024-02-29').from).toBe('2023-12-01');
});

it('validates inclusive 92 days, invalid calendar dates, reversed and future ranges',()=>{
  expect(validateHealthDates('2026-07-01','2026-09-30','2026-10-02')).toBe('');
  expect(validateHealthDates('2026-06-30','2026-09-30','2026-10-02')).toContain('92일');
  expect(validateHealthDates('2026-02-30','2026-03-01','2026-10-02')).toContain('올바르게');
  expect(validateHealthDates('','2026-03-01','2026-10-02')).toContain('올바르게');
  expect(validateHealthDates('2026-10-02','2026-10-01','2026-10-02')).toContain('빠를 수');
  expect(validateHealthDates('2026-10-02','2026-10-03','2026-10-02')).toContain('오늘 이후');
  expect(validateHealthDates('2026-10-02','2026-10-02','2026-10-02')).toBe('');
});
