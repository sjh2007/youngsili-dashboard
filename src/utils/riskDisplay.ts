/** Hide internal severity codes in care-facing text while retaining the useful description. */
export function riskDisplayText(value: unknown, level?: string): string {
  const raw = String(value ?? '').trim();
  const severity = level === 'critical' ? '긴급' : '주의';
  if (/^\(?\s*(critical|urgent|warning|normal)\s*\)?$/i.test(raw)) {
    return `${severity} 신호 확인 필요`;
  }
  return raw.replace(/\s*\((critical|urgent|warning|normal)\)\s*$/i, (_, code: string) => {
    const label = code.toLowerCase() === 'critical' ? '긴급' : code.toLowerCase() === 'normal' ? '정상' : '주의';
    return ` · ${label}`;
  });
}
