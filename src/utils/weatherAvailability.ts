export type WeatherRow = {noData?: boolean; stale?: boolean; unavailableReason?: unknown; alert?: unknown; alertText?: string; temp?: unknown; condition?: string};
export function weatherUnavailableMessage(row?: WeatherRow): string {
  if (!row) return '날씨 정보 확인 불가';
  const reason = {
    not_configured: '날씨 API 인증키 미설정', grid_unavailable: '지역 날씨 좌표 확인 불가',
    key_expired: '날씨 API 인증키 만료 · 운영자에게 갱신 요청',
    authentication_failed: '날씨 API 인증 실패 · 운영자 확인 필요',
    rate_limited: '날씨 API 요청 한도 초과', upstream_error: '기상청 날씨 연동 지연',
  }[String(row.unavailableReason || '')];
  if (reason) return reason;
  return row.noData ? '날씨 정보 확인 불가' : row.stale ? '연동 지연 · 마지막 수신 데이터' : '';
}
export function weatherRefreshDecision(data: Record<string, WeatherRow>) {
  const rows = Object.values(data);
  const fresh = rows.filter(row => row && !row.noData && !row.stale && !row.unavailableReason);
  const complete = rows.length > 0 && fresh.length === rows.length;
  const automaticAlert = ['heatwave','cold','rain'].find(alert => fresh.some(row => row.alert === alert)) || (complete ? 'none' : null);
  return {stale: !complete, updateTime: complete, automaticAlert};
}
export function weatherStatusText(row?: WeatherRow) {
  return weatherUnavailableMessage(row) || row?.alertText || '특보 없음';
}
