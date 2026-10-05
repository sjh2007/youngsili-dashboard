import { institutionWeatherSummary, institutionWeatherCardName } from './weatherJurisdiction';
it('counts only institution areas and names the city instead of the whole province', () => {
  const result = institutionWeatherSummary({
    '경북 포항시 남구 상대동': { source: 'org', jurisdiction: '경북 포항시' },
    '경북 포항시 북구 중앙동': { source: 'both', jurisdiction: '경북 포항시' },
    '대구 중구': { source: 'elder' },
  }, '경북 포항시 남구');
  expect(result.text).toBe('경북 포항시 전체 · 2개 행정구역');
  expect(institutionWeatherCardName('경북 포항시 북구 중앙동', result.label)).toBe('북구 중앙동');
});
it('does not claim complete city coverage for a legacy/fallback response', () => {
  expect(institutionWeatherSummary({ '강원 강릉시': { source: 'org' } }, '강원 강릉시').text).toBe('강원 강릉시 · 1개 지역');
});
