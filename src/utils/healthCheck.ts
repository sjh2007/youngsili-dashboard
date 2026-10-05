type ElderIdentity = { phone?: string };
type HealthCheck = { phone?: string; timestamp?: string; status?: string };

const phoneDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

function kstDay(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function todayHealthCheckForElder<T extends HealthCheck>(
  elder: ElderIdentity,
  checks: T[],
  now = new Date(),
): T | undefined {
  const phone = phoneDigits(elder.phone);
  const today = kstDay(now);
  if (!phone || !today) return undefined;
  return checks.find(check =>
    phoneDigits(check.phone) === phone && kstDay(check.timestamp ?? '') === today,
  );
}
