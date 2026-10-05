type WeatherRow = { source?: string; jurisdiction?: string };
export function institutionWeatherSummary(data: Record<string, WeatherRow>, orgRegion = '') {
  const entries = Object.entries(data || {}).filter(([, row]) => row?.source === 'org' || row?.source === 'both');
  const labels = [...new Set(entries.map(([, row]) => row.jurisdiction).filter(Boolean))];
  const label = labels.length === 1 ? labels[0] : '';
  return { label, text: label ? `${label} 전체 · ${entries.length}개 행정구역` : `${orgRegion || '기관 주소 기준'} · ${entries.length}개 지역` };
}
export function institutionWeatherCardName(region: string, label?: string) {
  return label && region.startsWith(label + ' ') ? region.slice(label.length + 1) : region;
}
