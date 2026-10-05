import { Call } from '../schemas';

/** A failed alert can have only a greeting transcript; a default normal is not an assessment. */
export function alertHealthUnassessed(call: Partial<Call>): boolean {
  return call.alertDelivery?.status === 'failed'
    && !['critical', 'urgent', 'warning'].includes(call.riskLevel || '');
}

export function callRiskMatches(call: Partial<Call>, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'critical') return call.riskLevel === 'critical';
  if (filter === 'urgent') return call.riskLevel === 'urgent' || call.riskLevel === 'warning';
  return !alertHealthUnassessed(call) && (!call.riskLevel || call.riskLevel === 'normal');
}
