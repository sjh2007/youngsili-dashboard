import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authFetch } from '../../utils/api';
import HealthInsightsPanel from './HealthInsightsPanel';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid', errMsg: (_d: unknown, fallback?: string) => fallback || '오류' }));
jest.mock('react-apexcharts', () => () => <div data-testid="health-chart" />);
const fetchMock = authFetch as jest.Mock;
const response = (data: unknown, status = 200) => ({ ok: status < 300, status, json: async () => data });

beforeEach(() => fetchMock.mockReset());
afterEach(() => jest.restoreAllMocks());

it('Firestore 문서 키인 전화번호로 목록과 그래프를 조회한다', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
    .mockResolvedValueOnce(response({ elderId: '01012345678', from: '2026-08-30', to: '2026-09-29', points: [] }));
  render(<HealthInsightsPanel elders={[{ id: 123, phone: '01012345678', name: '홍길동' }]} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls.map(([url]) => url).join('\n')).toContain('elderId=01012345678');
  expect(fetchMock.mock.calls.map(([url]) => url).join('\n')).not.toContain('elderId=123');
  expect(screen.getByRole('option', { name: '홍길동' })).toHaveValue('01012345678');
});

it('형식이 깨진 API 응답을 화면 데이터로 사용하지 않는다', async () => {
  const notify = jest.fn();
  fetchMock
    .mockResolvedValueOnce(response({ items: [{ caseId: 'case-without-required-fields' }], nextCursor: null }))
    .mockResolvedValueOnce(response({ elderId: '01012345678', from: '2026-08-30', to: '2026-09-29', points: [] }));
  render(<HealthInsightsPanel elders={[{ phone: '01012345678', name: '홍길동' }]} notify={notify} />);
  await waitFor(() => expect(notify).toHaveBeenCalledWith('건강 변화 API 응답 형식이 올바르지 않습니다'));
  expect(screen.queryByText('case-without-required-fields')).not.toBeInTheDocument();
});

it('확인 중인 카드에서 근거 보기를 누르면 통화 원문 근거를 펼친다', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [{
      caseId: 'case-1', elderId: '01012345678', topic: 'sleep', signal: 'new_statement', state: 'reviewing',
      latestObservedAt: '2026-09-29T07:06:24.672Z', evidenceCount: 1, revision: 2,
    }], nextCursor: null }))
    .mockResolvedValueOnce(response({ elderId: '01012345678', from: '2026-08-30', to: '2026-09-29', points: [] }))
    .mockResolvedValueOnce(response({
      caseId: 'case-1', elderId: '01012345678', topic: 'sleep', signal: 'new_statement', state: 'reviewing',
      latestObservedAt: '2026-09-29T07:06:24.672Z', evidenceCount: 1, revision: 2,
      evidence: [{ observedAt: '2026-09-29T07:06:24.672Z', excerpt: '잠을 못 잤어요', sourceId: 'source-1', line: 8 }],
      reviewNote: '', updatedAt: '2026-09-29T07:10:00.000Z',
    }));
  render(<HealthInsightsPanel elders={[{ phone: '01012345678', name: '홍길동' }]} />);
  const button=await screen.findByRole('button',{name:'근거 보기'});
  fireEvent.click(button);
  expect(await screen.findByText('“잠을 못 잤어요”')).toBeInTheDocument();
  expect(fetchMock.mock.calls[2][0]).toContain('/health/insights/case-1');
});

it('조치 완료 시 조치 내용을 필수로 저장하고 통화 기록 이동을 제공한다', async () => {
  const item={caseId:'case-2',elderId:'01012345678',topic:'discomfort',signal:'repeated_statement',state:'reviewing',latestObservedAt:'2026-09-29T07:06:24.672Z',evidenceCount:2,revision:2};
  const detail={...item,state:'resolved',revision:3,evidence:[],reviewNote:'보호자에게 연락함',updatedAt:'2026-09-29T08:00:00.000Z'};
  const openRecords=jest.fn();
  const promptMock=jest.spyOn(window,'prompt').mockImplementation(()=>'보호자에게 연락함');
  Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'}});
  fetchMock
    .mockResolvedValueOnce(response({items:[item],nextCursor:null}))
    .mockResolvedValueOnce(response({elderId:'01012345678',from:'2026-08-30',to:'2026-09-29',points:[]}))
    .mockResolvedValueOnce(response(detail))
    .mockResolvedValueOnce(response({items:[detail],nextCursor:null}))
    .mockResolvedValueOnce(response({elderId:'01012345678',from:'2026-08-30',to:'2026-09-29',points:[]}));
  render(<HealthInsightsPanel elders={[{phone:'01012345678',name:'홍길동'}]} onOpenCallRecords={openRecords}/>);
  fireEvent.click(await screen.findByRole('button',{name:'전체 통화 기록 보기'}));
  expect(openRecords).toHaveBeenCalledWith('01012345678');
  fireEvent.click(screen.getByRole('button',{name:'조치 완료'}));
  expect(promptMock).toHaveBeenCalled();
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(5));
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({state:'resolved',reviewNote:'보호자에게 연락함'});
});
