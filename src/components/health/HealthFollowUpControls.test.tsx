import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import HealthFollowUpControls from './HealthFollowUpControls';
import {authFetch} from '../../utils/api';
jest.mock('../../utils/api',()=>({authFetch:jest.fn(),SERVER_URL:'https://fixture.invalid',errMsg:()=> '저장 실패'}));
const mock=authFetch as jest.Mock;
const response=(data:unknown,ok=true)=>({ok,json:async()=>data});
const candidate={revision:2,followUp:null,candidateQuestion:'최근에는 잠을 편하게 주무셨나요?',approvalAvailable:true,approvalBlockedReason:null};
it('shows expired delivery reservation separately from approval and never claims playback',async()=>{
  mock.mockResolvedValue(response({revision:4,followUp:{status:'approved',deliveryState:'expired',askedAt:null,expiresAt:'2099-01-01T00:00:00Z'},approvalAvailable:false}));
  render(<HealthFollowUpControls canManage caseId="case1"/>);
  expect(await screen.findByRole('status')).toHaveTextContent('질문 전달 확인 기한이 지났습니다');
  expect(screen.getByText('질문 전달: 기록 없음 · 답변 수신: 기록 없음')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'승인 취소'})).toBeEnabled();
});
beforeEach(()=>{mock.mockReset();Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:jest.fn().mockReturnValueOnce('00000000-0000-4000-8000-000000000001').mockReturnValue('00000000-0000-4000-8000-000000000002')}})});
it('approval is explicit with deadline and never claims a question was delivered',async()=>{
  mock.mockResolvedValueOnce(response(candidate)).mockResolvedValueOnce(response({revision:3,followUp:{status:'approved',question:'최근에는 잠을 편하게 주무셨나요?',expiresAt:'2026-10-10T14:59:59Z'}}));
  render(<HealthFollowUpControls canManage caseId="case1"/>);
  expect(await screen.findByText('승인할 질문: 최근에는 잠을 편하게 주무셨나요?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'후속 확인 승인'}));
  await screen.findByText('담당자 승인됨');
  const body=JSON.parse(mock.mock.calls[1][1].body);
  expect(body).toMatchObject({action:'approve',revision:2,requestId:expect.any(String),expiresAt:expect.any(String)});
  expect(screen.getByText('질문 전달: 기록 없음 · 답변 수신: 기록 없음')).toBeInTheDocument();
});

it('blocks approval when the server reports invalid evidence',async()=>{
  mock.mockResolvedValue(response({...candidate,approvalAvailable:false,approvalBlockedReason:'원본 근거를 확인할 수 없습니다.'}));
  render(<HealthFollowUpControls canManage caseId="case1"/>);
  expect(await screen.findByText('원본 근거를 확인할 수 없습니다.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'후속 확인 승인'})).toBeDisabled();
});

it('does not let a late response from the previous case overwrite the next case',async()=>{
  let finish:(v:unknown)=>void=()=>{};
  mock.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce(response({...candidate,candidateQuestion:'오늘 식사는 편하게 하셨나요?'}));
  const view=render(<HealthFollowUpControls canManage caseId="case1"/>);
  view.rerender(<HealthFollowUpControls canManage caseId="case2"/>);
  await screen.findByText('승인할 질문: 오늘 식사는 편하게 하셨나요?');
  await act(async()=>finish(response(candidate)));
  expect(screen.queryByText('승인할 질문: 최근에는 잠을 편하게 주무셨나요?')).toBeNull();
});

it('reuses the request ID after an ambiguous save failure',async()=>{
  mock.mockResolvedValueOnce(response(candidate)).mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce(response({revision:3,followUp:{status:'approved'}}));
  render(<HealthFollowUpControls canManage caseId="case1"/>);
  fireEvent.click(await screen.findByRole('button',{name:'후속 확인 승인'}));
  await screen.findByText(/connection lost/);
  fireEvent.click(screen.getByRole('button',{name:'후속 확인 승인'}));
  await screen.findByText('담당자 승인됨');
  expect(JSON.parse(mock.mock.calls[1][1].body).requestId).toBe(JSON.parse(mock.mock.calls[2][1].body).requestId);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});

it('expired questions cannot be marked refused or resolved without a new approval',async()=>{
  mock.mockResolvedValue(response({...candidate,followUp:{status:'expired',expiresAt:'2020-01-01T00:00:00Z'}}));
  render(<HealthFollowUpControls canManage caseId="case1"/>);
  await screen.findByText('기한 만료');
  expect(screen.getByRole('button',{name:'후속 확인 거절'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'후속 확인 종료'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'후속 확인 승인'})).toBeEnabled();
});

it('read-only workers can inspect status but cannot submit approval',async()=>{
  mock.mockResolvedValue(response(candidate));
  render(<HealthFollowUpControls caseId="case1"/>);
  await screen.findByText('후속 질문 승인·변경은 담당자 권한이 필요합니다.');
  expect(screen.queryByRole('button',{name:'후속 확인 승인'})).toBeNull();
  expect(mock).toHaveBeenCalledTimes(1);
});
it('requires reason and preserves entered reason after failed refusal',async()=>{
  mock.mockResolvedValueOnce(response({revision:2,followUp:{status:'approved'}})).mockResolvedValueOnce(response({},false));
  render(<HealthFollowUpControls canManage caseId="case1"/>);
  fireEvent.click(await screen.findByRole('button',{name:'후속 확인 거절'}));
  expect(screen.getByRole('alert')).toHaveTextContent('처리 이유');
  expect(mock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('후속 처리 이유'),{target:{value:'본인 거절'}});
  fireEvent.click(screen.getByRole('button',{name:'후속 확인 거절'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('저장 실패'));
  expect(screen.getByLabelText('후속 처리 이유')).toHaveValue('본인 거절');
});
