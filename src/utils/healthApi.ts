import { AlertListSchema, HealthCurrentListSchema } from '../schemas';
import { authFetch, SERVER_URL, errMsg } from './api';

/** Both snapshots must succeed: an unavailable alert feed is never an empty safe feed. */
export async function fetchHealthSnapshot() {
  const responses = await Promise.all([
    authFetch(`${SERVER_URL}/health/all`),
    authFetch(`${SERVER_URL}/alerts`),
  ]);
  const data: unknown[] = await Promise.all(responses.map(response => response.json()));
  responses.forEach((response, index) => {
    if (!response.ok) throw new Error(errMsg(data[index], '건강 현황과 알림을 불러오지 못했습니다'));
  });
  const health = HealthCurrentListSchema.safeParse(data[0]);
  const alerts = AlertListSchema.safeParse(data[1]);
  if (!health.success || !alerts.success) throw new Error('건강 현황 응답 형식을 확인할 수 없습니다');
  return { health: health.data, alerts: alerts.data };
}
