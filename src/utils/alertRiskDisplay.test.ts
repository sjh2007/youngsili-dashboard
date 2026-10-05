import { alertHealthUnassessed, callRiskMatches } from './alertRiskDisplay';
import { Call } from '../schemas';

const failed: Partial<Call> = { riskLevel:'normal', alertDelivery:{status:'failed',reason:'playback_unconfirmed',alertType:'cold',includeCare:true} };
test.each(['', '영실이: 안녕하세요.'])('failed alert is unassessed even with greeting %s', transcript => {
  const call = {...failed, transcript};
  expect(alertHealthUnassessed(call)).toBe(true);
  expect(callRiskMatches(call, 'normal')).toBe(false);
  expect(callRiskMatches(call, 'all')).toBe(true);
});
test.each(['critical', 'urgent', 'warning'])('actual %s signal is not hidden by alert failure', riskLevel => {
  const call = {...failed, riskLevel};
  expect(alertHealthUnassessed(call)).toBe(false);
  expect(callRiskMatches(call, riskLevel === 'critical' ? 'critical' : 'urgent')).toBe(true);
});
test('ordinary normal calls retain their risk filter', () => {
  expect(callRiskMatches({riskLevel:'normal'}, 'normal')).toBe(true);
});
