import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authFetch } from '../../utils/api';
import HealthInsightsPanel from './HealthInsightsPanel';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid', errMsg: (_d: unknown, fallback?: string) => fallback || '오류' }));
jest.mock('react-apexcharts', () => () => <div data-testid="health-chart" />);
const fetchMock = authFetch as jest.Mock;
const response = (data: unknown, status = 200) => ({ ok: status < 300, status, json: async () => data });
const rankings = { from:'2026-08-30',to:'2026-09-29',total:1,topics:{meal:1,sleep:0,activity:0,discomfort:0},people:[{elderId:'01012345678',total:1,previousTotal:0,delta:1,latestObservedAt:'2026-09-29T07:06:24.672Z',topics:{meal:1,sleep:0,activity:0,discomfort:0}}],points:[{date:'2026-09-29',total:1}] };

beforeEach(() => fetchMock.mockReset());
afterEach(() => jest.restoreAllMocks());

it('처음에는 전체를 표시하고 선택하면 Firestore 전화번호 키로 필터링한다', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
    .mockResolvedValueOnce(response(rankings))
    .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
    .mockResolvedValueOnce(response({ elderId: '01012345678', from: '2026-08-30', to: '2026-09-29', points: [] }))
    .mockResolvedValueOnce(response(rankings));
  render(<HealthInsightsPanel elders={[{ id: 123, phone: '01012345678', name: '홍길동' }]} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[0][0]).not.toContain('elderId=');
  expect(screen.getByRole('option', { name: '전체 어르신' })).toHaveValue('__all__');
  fireEvent.change(screen.getByLabelText('어르신 필터'), { target: { value: '01012345678' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
  expect(fetchMock.mock.calls.map(([url]) => url).join('\n')).toContain('elderId=01012345678');
  expect(fetchMock.mock.calls.map(([url]) => url).join('\n')).not.toContain('elderId=123');
  expect(screen.getByRole('option', { name: '홍길동' })).toHaveValue('01012345678');
});

it('형식이 깨진 API 응답을 화면 데이터로 사용하지 않는다', async () => {
  const notify = jest.fn();
  fetchMock
    .mockResolvedValueOnce(response({ items: [{ caseId: 'case-without-required-fields' }], nextCursor: null }))
    .mockResolvedValueOnce(response(rankings));
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
    .mockResolvedValueOnce(response(rankings))
    .mockResolvedValueOnce(response({
      caseId: 'case-1', elderId: '01012345678', topic: 'sleep', signal: 'new_statement', state: 'reviewing',
      latestObservedAt: '2026-09-29T07:06:24.672Z', evidenceCount: 1, revision: 2,
      evidence: [{ observedAt: '2026-09-29T07:06:24.672Z', excerpt: '잠을 못 잤어요', sourceId: 'source-1', line: 8 }],
      reviewNote: '', updatedAt: '2026-09-29T07:10:00.000Z', reviewedBy: '담당자',
    }));
  render(<HealthInsightsPanel elders={[{ phone: '01012345678', name: '홍길동' }]} />);
  const button=await screen.findByRole('button',{name:'근거 보기'});
  fireEvent.click(button);
  expect(await screen.findByText('“잠을 못 잤어요”')).toBeInTheDocument();
  expect(fetchMock.mock.calls[2][0]).toContain('/health/insights/case-1');
});

it('조치 완료 시 조치 내용을 필수로 저장하고 통화 기록 이동을 제공한다', async () => {
  const item={caseId:'case-2',elderId:'01012345678',topic:'discomfort',signal:'repeated_statement',state:'reviewing',latestObservedAt:'2026-09-29T07:06:24.672Z',evidenceCount:2,revision:2};
  const detail={...item,state:'resolved',revision:3,evidence:[],reviewNote:'보호자에게 연락함',updatedAt:'2026-09-29T08:00:00.000Z',reviewedBy:'staff@example.com'};
  const openRecords=jest.fn();
  const promptMock=jest.spyOn(window,'prompt').mockImplementation(()=>'보호자에게 연락함');
  Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'}});
  fetchMock
    .mockResolvedValueOnce(response({items:[item],nextCursor:null}))
    .mockResolvedValueOnce(response(rankings))
    .mockResolvedValueOnce(response(detail))
    .mockResolvedValueOnce(response({items:[detail],nextCursor:null}))
    .mockResolvedValueOnce(response(rankings));
  render(<HealthInsightsPanel elders={[{phone:'01012345678',name:'홍길동'}]} onOpenCallRecords={openRecords}/>);
  fireEvent.click(await screen.findByRole('button',{name:'전체 통화 기록 보기'}));
  expect(openRecords).toHaveBeenCalledWith('01012345678');
  fireEvent.click(screen.getByRole('button',{name:'조치 완료'}));
  expect(promptMock).toHaveBeenCalled();
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(5));
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({state:'resolved',reviewNote:'보호자에게 연락함'});
  expect(await screen.findByText('현재 확인할 변화가 없습니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'완료 이력 보기 (1)'}));
  expect(await screen.findByText('보호자에게 연락함')).toBeInTheDocument();
  expect(screen.getByText('staff@example.com')).toBeInTheDocument();
});

it('조회 실패를 정상 0건으로 표시하지 않고 재시도를 제공한다', async () => {
  fetchMock.mockResolvedValueOnce(response({},500)).mockResolvedValueOnce(response(rankings));
  render(<HealthInsightsPanel elders={[]}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('오류');
  expect(screen.queryByText('현재 확인할 변화가 없습니다.')).not.toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(response({items:[],nextCursor:null})).mockResolvedValueOnce(response(rankings));
  fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
  expect(await screen.findByText('현재 확인할 변화가 없습니다.')).toBeInTheDocument();
});

it('이전 기록 커서를 이어 조회하고 기존 카드를 중복 없이 유지한다', async () => {
  const item={caseId:'case-a',elderId:'01012345678',topic:'activity',signal:'new_statement',state:'reviewing',latestObservedAt:'2026-09-29T07:06:24.672Z',evidenceCount:1,revision:1};
  fetchMock.mockResolvedValueOnce(response({items:[item],nextCursor:'cursor/+='})).mockResolvedValueOnce(response(rankings));
  fetchMock.mockResolvedValueOnce(response({items:[item,{...item,caseId:'case-b',topic:'sleep'}],nextCursor:null}));
  render(<HealthInsightsPanel elders={[{phone:'01012345678',name:'홍길동'}]}/>);
  await waitFor(()=>expect(screen.getAllByRole('button',{name:'근거 보기'})).toHaveLength(2));
  expect(fetchMock.mock.calls[2][0]).toContain('cursor=cursor%2F%2B%3D');
  expect(screen.queryByRole('button',{name:'이전 기록 더 보기'})).not.toBeInTheDocument();
});

it('어르신을 바꾼 후 늦게 도착한 이전 응답으로 화면을 덮어쓰지 않는다', async () => {
  let resolveOld:(value:unknown)=>void=()=>{};
  fetchMock.mockReturnValueOnce(new Promise(resolve=>{resolveOld=resolve})).mockResolvedValueOnce(response(rankings));
  render(<HealthInsightsPanel elders={[{phone:'01012345678',name:'홍길동'}]}/>);
  fetchMock.mockResolvedValueOnce(response({items:[],nextCursor:null})).mockResolvedValueOnce(response({elderId:'01012345678',from:'2026-09-01',to:'2026-09-29',points:[]})).mockResolvedValueOnce(response(rankings));
  fireEvent.change(screen.getByLabelText('어르신 필터'),{target:{value:'01012345678'}});
  expect(await screen.findByText('현재 확인할 변화가 없습니다.')).toBeInTheDocument();
  resolveOld(response({},500));
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('같은 revision으로 새 근거가 도착해도 새로고침 후에는 이전 원문을 재사용하지 않는다',async()=>{
  const item={caseId:'case-fresh',elderId:'01012345678',topic:'sleep',signal:'new_statement',state:'reviewing',latestObservedAt:'2026-09-29T07:06:24.672Z',evidenceCount:1,revision:2};
  const detail=(excerpt:string)=>({...item,evidence:[{observedAt:item.latestObservedAt,excerpt,sourceId:'source',line:2}],reviewNote:'',updatedAt:null,reviewedBy:''});
  fetchMock.mockResolvedValueOnce(response({items:[item],nextCursor:null})).mockResolvedValueOnce(response(rankings)).mockResolvedValueOnce(response(detail('이전 근거')));
  render(<HealthInsightsPanel elders={[{phone:'01012345678',name:'홍길동'}]}/>);
  fireEvent.click(await screen.findByRole('button',{name:'근거 보기'}));
  expect(await screen.findByText('“이전 근거”')).toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(response({items:[{...item,evidenceCount:2}],nextCursor:null})).mockResolvedValueOnce(response(rankings)).mockResolvedValueOnce(response(detail('갱신된 근거')));
  fireEvent.click(screen.getByRole('button',{name:'목록 새로고침'}));
  fireEvent.click(await screen.findByRole('button',{name:'근거 보기'}));
  expect(await screen.findByText('“갱신된 근거”')).toBeInTheDocument();
  expect(screen.queryByText('“이전 근거”')).not.toBeInTheDocument();
});
