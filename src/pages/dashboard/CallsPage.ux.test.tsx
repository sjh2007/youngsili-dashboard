import { render, screen } from '@testing-library/react';
import CallsPage from './CallsPage';
import { CallSchema } from '../../schemas';

jest.mock('../../components/common', () => ({
  CallTranscript: () => null,
  GroupHeader: () => null,
}));
jest.mock('../../components/common/CallRecording', () => ({
  RecordingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RecordingConsent: () => null,
  CallRecording: () => null,
}));

const baseProps = {
  callsHistory: [{ id: 'call-1', phone: '01000000000', elderName: '테스트 어르신', date: '2026-10-02', riskLevel: 'normal' }],
  callsPhone: '', callsSearch: '', callsRiskMatch: () => true,
  nameByPhone: (_phone: string, name: string) => name,
  callsRange: 'month', setCallsRange: jest.fn(), callsFrom: '', setCallsFrom: jest.fn(),
  callsTo: '', setCallsTo: jest.fn(), fetchCalls: jest.fn(), callsLoading: false,
  callsError: '', callsAllOpen: false, setCallsAllOpen: jest.fn(), setCallsDayOv: jest.fn(),
  callsRisk: 'all', setCallsRisk: jest.fn(), elders: [], setCallsSearch: jest.fn(),
  setCallsPhone: jest.fn(), callsDayOv: {}, expandedCallDays: new Set<string>(),
  setExpandedCallDays: jest.fn(), formatDateHeader: (date: string) => date,
  kwFromTranscript: () => null, draftingCallId: '', openNoteForCall: jest.fn(),
};

test('검색 결과가 없으면 데이터 없음과 구분하여 안내한다', () => {
  render(<CallsPage {...baseProps} callsSearch="없는 이름" />);
  expect(screen.getByText(/조건에 맞는 통화 기록이 없습니다/)).toBeInTheDocument();
  expect(screen.queryByText('이 기간 통화 기록이 없습니다.')).not.toBeInTheDocument();
});

test('조회 실패 시 기존 목록을 유지하고 재시도를 제공한다', () => {
  render(<CallsPage {...baseProps} callsError="서버에 연결할 수 없습니다." />);
  expect(screen.getByRole('alert')).toHaveTextContent('통화 기록을 갱신하지 못했습니다.');
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
});

test('경보 실패의 기본 normal 값을 건강 정상으로 표시하지 않는다', () => {
  const call = {...baseProps.callsHistory[0], transcript:'', alertDelivery:{status:'failed',reason:'audio_generation_failed',includeCare:true,alertType:'cold'}};
  render(<CallsPage {...baseProps} callsHistory={[call]} callsDayOv={{'2026-10-02':true}} />);
  expect(screen.getByText('건강 상태 미확인')).toBeInTheDocument();
  expect(screen.getByText('경보 전달 실패')).toBeInTheDocument();
  // Filter button is the sole remaining normal label, not a call result badge.
  expect(screen.getAllByText('정상')).toHaveLength(1);
});

test.each([
  { status: 'completed', alertType: 'cold', includeCare: false, label: '경보 재생 완료' },
  { status: 'completed', alertType: 'cold', includeCare: true, label: '경보 재생 완료' },
  { status: 'completed', alertType: 'dust', includeCare: false, label: '경보 재생 완료' },
  { status: 'completed', alertType: 'dust', includeCare: true, label: '경보 재생 완료' },
  { status: 'failed', reason: 'interrupted', alertType: 'dust', includeCare: true, label: '경보 전달 실패' },
])('서버 응답 파싱 후 실제 통화 이력에 $alertType/$status/$includeCare 표시', ({ label, ...alertDelivery }) => {
  const call = CallSchema.parse({ ...baseProps.callsHistory[0], endedStatus: 'completed', alertDelivery });
  render(<CallsPage {...baseProps} callsHistory={[call]} callsDayOv={{ '2026-10-02': true }} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  if (alertDelivery.status === 'failed') {
    expect(screen.getByText('건강 상태 미확인')).toBeInTheDocument();
    expect(screen.getByText(/경보 재생 중 통화가 종료되거나 중단/)).toBeInTheDocument();
  }
});
