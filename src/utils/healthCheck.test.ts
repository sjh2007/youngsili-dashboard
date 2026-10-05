import { todayHealthCheckForElder } from './healthCheck';

test('only the current KST day and matching phone count as this elder’s check', () => {
  const elder = { phone: '010-1234-5678' };
  const checks = [
    { phone: '01012345678', timestamp: '2026-10-01T14:59:59Z', status: 'good' },
    { phone: '01099999999', timestamp: '2026-10-01T15:01:00Z', status: 'bad' },
    { phone: '01012345678', timestamp: '2026-10-01T15:00:01Z', status: 'okay' },
  ];
  expect(todayHealthCheckForElder(elder, checks, new Date('2026-10-02T01:00:00Z'))).toBe(checks[2]);
  expect(todayHealthCheckForElder(elder, checks, new Date('2026-10-03T01:00:00Z'))).toBeUndefined();
  expect(todayHealthCheckForElder({ phone: '' }, checks, new Date('2026-10-02T01:00:00Z'))).toBeUndefined();
});
