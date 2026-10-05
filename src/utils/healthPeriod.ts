export type HealthPeriod = 'week' | 'month' | 'quarter';
const DAY = 86_400_000;
/** Calendar boundaries are always Korean dates, independent of the browser timezone. */
export function koreanDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}
export function healthPeriod(period: HealthPeriod, today = koreanDate()) {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else {
    start.setUTCDate(1);
    if (period === 'quarter') start.setUTCMonth(start.getUTCMonth() - 2);
  }
  const days = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  return {
    from: start.toISOString().slice(0, 10), to: today,
    previousFrom: new Date(start.getTime() - days * DAY).toISOString().slice(0, 10),
    previousTo: new Date(start.getTime() - DAY).toISOString().slice(0, 10),
    description: period === 'week' ? '월요일부터 오늘까지' : period === 'month' ? '이번 달 1일부터 오늘까지' : '이번 달 포함 3개월',
  };
}
export const displayHealthDate = (date: string) => date.replace(/-/g, '.');

export function validateHealthDates(from: string, to: string, today = koreanDate()): string {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return '시작일과 종료일을 올바르게 선택해 주세요.';
  if (from > to) return '종료일은 시작일보다 빠를 수 없습니다.';
  if (to > today) return '오늘 이후 날짜는 조회할 수 없습니다.';
  if ((Date.parse(to) - Date.parse(from)) / DAY + 1 > 92) return '조회 기간은 시작일과 종료일을 포함해 최대 92일입니다.';
  return '';
}

export function customHealthPeriod(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - start) / DAY) + 1;
  return { from, to, description: '직접 선택한 기간',
    previousFrom: new Date(start - days * DAY).toISOString().slice(0, 10),
    previousTo: new Date(start - DAY).toISOString().slice(0, 10) };
}
