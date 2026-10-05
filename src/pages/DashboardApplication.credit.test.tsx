import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authFetch } from '../utils/api';
window.matchMedia = jest.fn().mockReturnValue({matches:false});
const DashboardApplication = require('./DashboardApplication').default;
jest.mock('react-apexcharts', () => () => null);
jest.mock('../components/case-notes/CaseNoteExport', () => () => null);
jest.mock('../firebase', () => ({auth:{},authEnabled:true}));
jest.mock('firebase/auth', () => ({onAuthStateChanged: (_auth:unknown, callback:Function) => {
  callback({email:'fixture@invalid.test',emailVerified:true}); return () => {};
},signOut:jest.fn(),sendEmailVerification:jest.fn()}));
jest.mock('../utils/api', () => ({authFetch:jest.fn(),SERVER_URL:'https://fixture.invalid',errMsg:()=> '발신 거절',isPayTestEnabled:()=>false}));
jest.mock('./dashboard/DashboardHomePage', () => (props:any) => <button onClick={()=>props.makeCall({id:'a',phone:'01000000001',name:'가상어르신'},'pstn',true)}>단건 시험</button>);
jest.mock('./dashboard/SchedulePage', () => (props:any) => <button onClick={()=>props.setBulkConfirm({count:3,channel:'pstn',isAlert:true,queue:[1,2,3].map(id=>({id,name:'가상',phone:`0100000000${id}`}))})}>일괄 시험</button>);
jest.mock('./dashboard/UpgradeModal', () => (props:any) => <div data-testid="topup">충전 탭: {props.upgradeTab}<button onClick={()=>props.setShowUpgradeModal(false)}>충전창 닫기</button></div>);
const fetchMock = authFetch as jest.Mock;
let balance:number|null;
let rejectCall:boolean;
const requests = () => fetchMock.mock.calls.filter(([url])=>url.endsWith('/call/app'));
beforeEach(()=>{
  balance=-184; rejectCall=true; window.location.hash='#dashboard';
  fetchMock.mockReset().mockImplementation(async (url:string)=>({ok:!url.endsWith('/call/app')||!rejectCall,status:200,json:async()=> {
    if(url.endsWith('/me')) return {role:'admin',orgId:'fixture',orgName:'가상기관',orgCode:'FIXTURE'};
    if(url.endsWith('/billing/balance')) return {creditBalance:balance};
    if(url.endsWith('/call/app')) return rejectCall?{error:{code:'FORBIDDEN',details:{reason:'no_credit',creditBalance:balance}}}:{success:true,callId:'fixture-call'};
    if(url.includes('/elders')||url.endsWith('/alerts')||url.includes('/caregivers')||url.endsWith('/notices/active')) return [];
    if(url.includes('/calls?')) return {calls:[]};
    return {};
  }}));
});
it.each([0,-184,null])('allows dashboard at balance %s',async value=>{
  balance=value; render(<DashboardApplication/>);
  expect(await screen.findByRole('button',{name:'단건 시험'})).toBeInTheDocument();
  await waitFor(()=>expect(fetchMock.mock.calls.some(([url])=>url.endsWith('/billing/balance'))).toBe(true));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
it('shows credit rejection only on dispatch, opens metered recharge without retry',async()=>{
  render(<DashboardApplication/>);
  fireEvent.click(await screen.findByRole('button',{name:'단건 시험'}));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('-184원');
  fireEvent.click(screen.getByRole('button',{name:'잔액 새로고침'}));
  fireEvent.click(screen.getByRole('button',{name:'충전하기'}));
  expect(await screen.findByTestId('topup')).toHaveTextContent('metered');
  fireEvent.click(screen.getByRole('button',{name:'충전창 닫기'}));
  expect(requests()).toHaveLength(1);
});
it('does not block server-authorized included calls at zero balance',async()=>{
  balance=0;rejectCall=false;render(<DashboardApplication/>);
  fireEvent.click(await screen.findByRole('button',{name:'단건 시험'}));
  await waitFor(()=>expect(requests()).toHaveLength(1));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
it('stops remaining bulk dispatches on first credit rejection',async()=>{
  window.location.hash='#schedule';render(<DashboardApplication/>);
  fireEvent.click(await screen.findByRole('button',{name:'일괄 시험'}));
  fireEvent.click(screen.getByRole('button',{name:'발신 시작'}));
  await screen.findByRole('alertdialog',{name:'전화 발신을 위한 충전 잔액이 없습니다'});
  expect(requests()).toHaveLength(1);
});
