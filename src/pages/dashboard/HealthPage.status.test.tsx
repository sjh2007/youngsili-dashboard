import { act, render, screen, within } from '@testing-library/react';
import HealthPage from './HealthPage';

let reportCases: ((cases: unknown[],hasMore:boolean)=>void)|undefined;
jest.mock('../../components/health/HealthInsightsPanel', () => (props: {onCasesChange:(cases:unknown[],hasMore:boolean)=>void}) => { reportCases=props.onCasesChange; return null; });

test('a default normal elder with only an old check is not presented as healthy today', () => {
  render(<HealthPage
    healthLoading={false} healthError="" fetchHealth={jest.fn()}
    healthData={[{name:'테스트 어르신', phone:'01000000000', status:'good', timestamp:'2025-01-01T00:00:00Z'}]}
    elders={[{ id: 'elder-1', name: '테스트 어르신', phone: '01000000000', status: 'normal', approved: true, lastCall: '아직 없음' }]}
    alertsData={[]} alertIsReal={() => true} healthFilter="all" setHealthFilter={jest.fn()}
    healthAllOpen={false} setHealthAllOpen={jest.fn()} setHealthRowOv={jest.fn()}
    setHealthNormalShown={jest.fn()} healthRowOv={{}} healthNormalShown={10}
    getNoResponseDays={() => 99} callsHistory={[]} healthHistory={[]}
    healthRange="week" setHealthRange={jest.fn()} formatDateHeader={jest.fn()}
    me={{role:'worker'}}
  />);

  const row = screen.getByRole('button', { name: /테스트 어르신.*기본 분류/ });
  expect(within(row).getByText('기본 분류')).toBeInTheDocument();
  expect(within(row).getByText(/통화 이력 없음 · 오늘 앱 미체크/)).toBeInTheDocument();
  expect(screen.getByText(/건강 이상이 없다는 판정이 아닙니다/)).toBeInTheDocument();
  expect(screen.getByText('미체크').closest('.stat-card')).toHaveTextContent('1명');
  expect(screen.getByText('좋아요').closest('.stat-card')).toHaveTextContent('0명');
});

test('an unfinished health card remains visible beside the independent base classification', () => {
  render(<HealthPage
    healthLoading={false} healthError="" fetchHealth={jest.fn()} healthData={[]}
    elders={[{id:'elder-1',name:'테스트 어르신',phone:'01000000000',status:'normal',approved:true,lastCall:'아직 없음'}]}
    alertsData={[]} alertIsReal={() => true} healthFilter="all" setHealthFilter={jest.fn()}
    healthAllOpen={false} setHealthAllOpen={jest.fn()} setHealthRowOv={jest.fn()}
    setHealthNormalShown={jest.fn()} healthRowOv={{}} healthNormalShown={0}
    getNoResponseDays={() => 99} callsHistory={[]} healthHistory={[]}
    healthRange="week" setHealthRange={jest.fn()} formatDateHeader={jest.fn()} me={{role:'worker'}}
  />);
  act(()=>reportCases?.([{caseId:'case-1',elderId:'01000000000',state:'reviewing'}],false));
  const row=screen.getByRole('button',{name:/테스트 어르신.*기본 분류.*확인할 건강 변화 1건/});
  expect(within(row).getByText('기본 분류')).toBeInTheDocument();
  expect(within(row).getByText('확인할 건강 변화 1건')).toBeInTheDocument();
  act(()=>reportCases?.([{caseId:'case-1',elderId:'01000000000',state:'resolved'}],false));
  expect(screen.queryByText('확인할 건강 변화 1건')).not.toBeInTheDocument();
});
