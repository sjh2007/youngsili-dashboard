import { render, screen } from '@testing-library/react';
import AlertDeliveryStatus from './AlertDeliveryStatus';
import { CallSchema } from '../../schemas';

test('ordinary completed call is not evidence of alert playback', () => {
  const { container } = render(<AlertDeliveryStatus call={{ status:'completed', riskLevel:'normal', alertType:'none' }} />);
  expect(container).toBeEmptyDOMElement();
});

test('legacy alert with no playback evidence remains unconfirmed', () => {
  render(<AlertDeliveryStatus call={{ isAlert:true, status:'completed' }} />);
  expect(screen.getByText('경보 재생 확인 안 됨')).toBeInTheDocument();
  expect(screen.queryByText('경보 재생 완료')).not.toBeInTheDocument();
});

test('completed playback does not imply recipient comprehension or completed care questions', () => {
  render(<AlertDeliveryStatus call={{ alertDelivery:{ status:'completed', includeCare:true, alertType:'cold' } }} />);
  expect(screen.getByText('경보 재생 완료')).toBeInTheDocument();
  expect(screen.getByText(/청취·이해 여부는 별도 확인/)).toBeInTheDocument();
  expect(screen.queryByText('안부 질문 완료')).not.toBeInTheDocument();
});

test.each([
  ['audio_generation_failed', '경보 음성을 만들지 못했습니다.'],
  ['playback_unconfirmed', '경보 음성이 끝까지 재생됐는지 확인하지 못했습니다.'],
  ['interrupted', '경보 재생 중 통화가 종료되거나 중단됐습니다.'],
  ['unsupported_engine', '이 통화 경로에서는 경보 재생 완료를 확인할 수 없습니다.'],
])('failure %s remains visible even when call connected', (reason, text) => {
  render(<AlertDeliveryStatus call={{ status:'completed', alertDelivery:{ status:'failed', reason, includeCare:false, alertType:'dust' } }} />);
  expect(screen.getByText('경보 전달 실패')).toBeInTheDocument();
  expect(screen.getByText(text, {exact:false})).toBeInTheDocument();
});

test('malformed delivery evidence preserves the call but cannot become playback success', () => {
  const call = CallSchema.parse({ id:'fixture', isAlert:true, alertDelivery:{ status:'completed' } });
  expect(call.id).toBe('fixture');
  render(<AlertDeliveryStatus call={call} />);
  expect(screen.getByText('경보 재생 확인 안 됨')).toBeInTheDocument();
});
