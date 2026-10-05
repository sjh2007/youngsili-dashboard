import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import HealthInsightsPanel from './HealthInsightsPanel';
import { authFetch } from '../../utils/api';

jest.mock('../../utils/api',()=>({authFetch:jest.fn(),SERVER_URL:'https://fixture.invalid',errMsg:()=> '조회 실패'}));
jest.mock('react-apexcharts',()=>()=> <div data-testid="chart"/>);
const mockedFetch=authFetch as jest.Mock;
const response=(data:unknown,status=200)=>({ok:status<300,status,json:async()=>data});
const elders=Array.from({length:300},(_,i)=>({phone:`elder-${i}`,name:`가상어르신${String(i+1).padStart(3,'0')}`}));
const makeItems=()=>elders.map((elder,i)=>({caseId:`case-${i}`,elderId:elder.phone,topic:i%2?'sleep':'meal',signal:'new_statement',state:i%3?'unreviewed':'reviewing',latestObservedAt:'2026-09-01T01:00:00Z',evidenceCount:1,revision:1}));
const emptyRanking={from:'2026-09-28',to:'2026-10-02',total:0,topics:{meal:0,sleep:0,activity:0,discomfort:0},people:[],points:[]};
afterEach(()=>{jest.restoreAllMocks();mockedFetch.mockReset()});

it('300명 전체 페이지를 누락 없이 조회하고 검색→근거→조치 완료를 연결한다',async()=>{
  let items=makeItems();
  const start=performance.now();
  const onCasesChange=jest.fn();
  jest.spyOn(window,'prompt').mockReturnValue('가상 검증: 연락 확인 완료');
  Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'}});
  mockedFetch.mockImplementation(async(url:string,init?:RequestInit)=>{
    const path=new URL(url);
    if(path.pathname.endsWith('/rankings'))return response(emptyRanking);
    if(path.pathname.endsWith('/review')){
      const id=path.pathname.split('/').at(-2);
      items=items.map(item=>item.caseId===id?{...item,state:'resolved',revision:2}:item);
      return response({...items.find(item=>item.caseId===id),evidence:[],reviewNote:'가상 검증: 연락 확인 완료',updatedAt:'2026-10-02T01:00:00Z',reviewedBy:'가상담당자'});
    }
    if(path.pathname.endsWith('/case-299'))return response({...items[299],evidence:[{observedAt:items[299].latestObservedAt,excerpt:'가상 근거: 잠을 자주 깼어요',sourceId:'fake-call',line:2}],reviewNote:'',updatedAt:null,reviewedBy:''});
    const offset=Number(path.searchParams.get('cursor')||0);
    return response({items:items.slice(offset,offset+100),nextCursor:offset+100<items.length?String(offset+100):null});
  });
  render(<HealthInsightsPanel elders={elders} onCasesChange={onCasesChange}/>);
  await waitFor(()=>expect(onCasesChange).toHaveBeenCalledWith(expect.any(Array),false));
  expect(onCasesChange.mock.calls[0][0]).toHaveLength(300);
  expect(new Set(onCasesChange.mock.calls[0][0].map(item=>item.caseId)).size).toBe(300);
  expect(screen.getAllByRole('article')).toHaveLength(20);
  const seen=new Set<string>();
  for(let index=0;index<15;index++){
    screen.getAllByRole('article').forEach(row=>seen.add(row.getAttribute('aria-label')||''));
    if(index<14)fireEvent.click(screen.getByRole('button',{name:'다음'}));
  }
  expect(seen.size).toBe(300);
  const loaded=performance.now();
  fireEvent.change(screen.getByLabelText('이름 검색'),{target:{value:'가상어르신300'}});
  const row=screen.getByRole('article',{name:'가상어르신300 수면 미확인'});
  fireEvent.click(within(row).getByRole('button',{name:'근거 보기'}));
  expect(await screen.findByText('“가상 근거: 잠을 자주 깼어요”')).toBeInTheDocument();
  const evidenceAt=performance.now();
  fireEvent.click(within(row).getByRole('button',{name:'조치 완료'}));
  await waitFor(()=>expect(onCasesChange).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('article',{name:'가상어르신300 수면 미확인'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'완료 이력 보기 (1)'}));
  expect(screen.getByText('가상 검증: 연락 확인 완료')).toBeInTheDocument();
  expect(items.filter(item=>item.state==='resolved')).toHaveLength(1);
  console.info(JSON.stringify({scenario:'300-person scripted workflow (not human usability timing)',loadedPeople:300,missing:0,loadAndVisit15PagesMs:Math.round(loaded-start),findAndEvidenceMs:Math.round(evidenceAt-loaded),completeMs:Math.round(performance.now()-evidenceAt)}));
});

it('빠른 기간 전환에서 최신 날짜 요청만 반영하고 모든 통계 요청에 동일 기간을 전달한다',async()=>{
  mockedFetch.mockImplementation(async(url:string)=>response(url.includes('/rankings')?emptyRanking:{items:[],nextCursor:null}));
  render(<HealthInsightsPanel elders={elders}/>);
  await screen.findByText('현재 확인할 변화가 없습니다.');
  fireEvent.click(screen.getByRole('button',{name:'최근 3개월'}));
  await screen.findByText('현재 확인할 변화가 없습니다.');
  const url=new URL(mockedFetch.mock.calls.filter(([url])=>url.includes('/rankings')).at(-1)[0]);
  expect(screen.getByRole('button',{name:/최근 3개월/})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByText(`조회 기간 ${url.searchParams.get('from')!.replace(/-/g,'.')} ~ ${url.searchParams.get('to')!.replace(/-/g,'.')}`)).toBeInTheDocument();
  expect(url.searchParams.get('from')).toMatch(/-01$/);
});

it('날짜별 대상 필터는 이미 처리된 사람도 상세 대상에서 유지하고 미처리 목록만 좁힌다',async()=>{
  const people=elders.slice(0,2);
  const item=makeItems()[0];
  const ranking={...emptyRanking,total:2,coverage:{detectionEvents:2,detectedPeople:2,analyzedPeople:2,analyzedCalls:2,detectionRate:1,unreviewedCases:0,openCases:1,unconnectedPeople:null,unconnectedReason:'unavailable'},points:[{date:'2026-10-02',total:2,detectedPeople:2,analyzedPeople:2,detectionRate:1,detectedElderIds:people.map(person=>person.phone),analyzedElderIds:people.map(person=>person.phone)}]};
  mockedFetch.mockImplementation(async(url:string)=>response(url.includes('/rankings')?ranking:{items:[item],nextCursor:null}));
  render(<HealthInsightsPanel elders={people}/>);
  fireEvent.click(await screen.findByText('날짜별 수치와 대상 보기'));
  fireEvent.click(screen.getByRole('button',{name:'이 날짜 대상 보기'}));
  expect(screen.getByRole('button',{name:'가상어르신002 · 개인 이력'})).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText(/해당 날짜 통화만 표시하는 목록이 아닙니다/)).toBeInTheDocument();
});

it('기간을 바꾼 뒤 늦게 완료된 이전 기간 응답을 무시한다',async()=>{
  let resolveOld:(value:unknown)=>void=()=>{};
  mockedFetch.mockReturnValueOnce(new Promise(resolve=>{resolveOld=resolve})).mockResolvedValueOnce(response({...emptyRanking,total:999}));
  render(<HealthInsightsPanel elders={elders}/>);
  mockedFetch.mockResolvedValueOnce(response({items:[],nextCursor:null})).mockResolvedValueOnce(response(emptyRanking));
  fireEvent.click(screen.getByRole('button',{name:'이번 달'}));
  expect(await screen.findByText('현재 확인할 변화가 없습니다.')).toBeInTheDocument();
  resolveOld(response({items:makeItems(),nextCursor:null}));
  await waitFor(()=>expect(screen.queryByRole('article')).not.toBeInTheDocument());
  expect(screen.getByRole('button',{name:/이번 달/})).toHaveAttribute('aria-pressed','true');
  expect(screen.queryByText('999건')).not.toBeInTheDocument();
});

it('직접 날짜는 조회 버튼으로만 적용하고 잘못된 날짜와 취소는 기존 조회를 유지한다',async()=>{
  mockedFetch.mockImplementation(async(url:string)=>response(url.includes('/rankings')?emptyRanking:{items:[],nextCursor:null}));
  render(<HealthInsightsPanel elders={[]}/>);
  await screen.findByText('현재 확인할 변화가 없습니다.');
  const initialCalls=mockedFetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'직접 선택'}));
  fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-08-01'}});
  fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-08-31'}});
  expect(mockedFetch).toHaveBeenCalledTimes(initialCalls);
  fireEvent.click(screen.getByRole('button',{name:'선택 기간 조회'}));
  await screen.findByText('현재 확인할 변화가 없습니다.');
  expect(screen.getByText('조회 기간 2026.08.01 ~ 2026.08.31')).toBeInTheDocument();
  expect(mockedFetch.mock.calls.at(-1)[0]).toContain('from=2026-08-01&to=2026-08-31');
  fireEvent.click(screen.getByRole('button',{name:/직접 선택/}));
  fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-07-01'}});
  const appliedCalls=mockedFetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'선택 기간 조회'}));
  expect(screen.getByRole('alert')).toHaveTextContent('종료일은 시작일보다');
  expect(mockedFetch).toHaveBeenCalledTimes(appliedCalls);
  fireEvent.click(screen.getByRole('button',{name:'취소'}));
  expect(screen.getByText('조회 기간 2026.08.01 ~ 2026.08.31')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'이번 주'}));
  await screen.findByText('현재 확인할 변화가 없습니다.');
  expect(screen.queryByText('조회 기간 2026.08.01 ~ 2026.08.31')).not.toBeInTheDocument();
});
