import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authFetch } from '../utils/api';
window.matchMedia = jest.fn().mockReturnValue({matches:false});
const DashboardApplication = require('./DashboardApplication').default;
jest.mock('react-apexcharts', () => () => null);
jest.mock('../components/case-notes/CaseNoteExport', () => () => null);
jest.mock('../firebase', () => ({auth:{},authEnabled:true}));
jest.mock('firebase/auth', () => ({onAuthStateChanged: (_auth:unknown, callback:Function) => {
  callback({uid:'fixture-worker',email:'fixture@invalid.test',emailVerified:true}); return () => {};
},signOut:jest.fn(),sendEmailVerification:jest.fn()}));
jest.mock('../utils/api', () => ({authFetch:jest.fn(),SERVER_URL:'https://fixture.invalid',errMsg:()=> '저장 거절',isPayTestEnabled:()=>false}));
const fetchMock=authFetch as jest.Mock;
let role='admin'; let saveOk=true;
const saves=()=>fetchMock.mock.calls.filter(([url])=>url.endsWith('/elders/save'));
beforeEach(()=>{
  role='admin';saveOk=true;window.daum={Postcode:jest.fn().mockImplementation(({oncomplete})=>({open:()=>oncomplete({sido:'경상북도',sigungu:'포항시 북구',roadAddress:'경북 포항시 북구 가상주소'})}))} as any;localStorage.clear();window.location.hash='#elders';
  fetchMock.mockReset().mockImplementation(async(url:string)=>({ok:!url.endsWith('/elders/save')||saveOk,status:200,json:async()=>{
    if(url.endsWith('/me'))return{role,orgId:'fixture-org',orgName:'가상복지관',orgCode:'FIXTURE'};
    if(url.endsWith('/billing/balance'))return{creditBalance:0};
    if(url.endsWith('/elders/save'))return{success:saveOk};
    if(url.includes('/elders')||url.endsWith('/alerts')||url.includes('/caregivers')||url.includes('/admin/users')||url.endsWith('/notices/active'))return[];
    if(url.includes('/calls?'))return{calls:[]};
    return{};
  }}));
});
async function basic(useLookup=true){
  fireEvent.change(await screen.findByPlaceholderText('예: 김순자'),{target:{value:'가상어르신'}});
  fireEvent.change(screen.getByPlaceholderText('예: 78'),{target:{value:'76'}});
  fireEvent.change(screen.getByPlaceholderText('예: 010-1234-5678'),{target:{value:'010-0000-0000'}});
  if(useLookup) fireEvent.click(screen.getByRole('button',{name:'주소 검색'}));
  else fireEvent.change(screen.getByPlaceholderText('주소 검색을 눌러 선택'),{target:{value:'경북 포항시 남구 가상주소'}});
  fireEvent.change(screen.getByPlaceholderText('예: 고혈압, 당뇨'),{target:{value:'고혈압'}});
  fireEvent.change(screen.getByPlaceholderText('예: 혈압약'),{target:{value:'혈압약'}});
  fireEvent.click(screen.getByRole('button',{name:'다음 단계 →'}));
}
async function guardian(){
  fireEvent.change(await screen.findByPlaceholderText('예: 김민준'),{target:{value:'가상보호자'}});
  fireEvent.change(screen.getByPlaceholderText('예: 010-9876-5432'),{target:{value:'010-0000-0001'}});
  fireEvent.click(screen.getByRole('button',{name:'다음 단계 →'}));
}
it('blocks missing basic/guardian data before a save request',async()=>{
  render(<DashboardApplication/>);fireEvent.click((await screen.findAllByRole('button',{name:'신규 등록'}))[0]); await screen.findByPlaceholderText('예: 김순자');
  fireEvent.click(screen.getByRole('button',{name:'다음 단계 →'}));
  expect(screen.getByText('이름을 입력하세요')).toBeInTheDocument();
  expect(saves()).toHaveLength(0);
  await basic();fireEvent.click(screen.getByRole('button',{name:'다음 단계 →'}));
  expect(screen.getByText('보호자 연락처를 입력하세요')).toBeInTheDocument();expect(saves()).toHaveLength(0);
});
it.each(['admin','staff'])('%s registers with zero balance without calling or charging',async requestedRole=>{
  role=requestedRole;render(<DashboardApplication/>);fireEvent.click((await screen.findAllByRole('button',{name:'신규 등록'}))[0]);await basic();await guardian();
  fireEvent.click(screen.getByRole('button',{name:'등록 완료'}));
  expect(await screen.findByText('어르신 등록이 완료되었습니다!')).toBeInTheDocument();
  const payload=JSON.parse(saves()[0][1].body);
  expect(payload).toMatchObject({name:'가상어르신',age:76,disease:'고혈압',medicine:'혈압약',guardian:'가상보호자',region:'경북 포항시 북구'});
  expect(fetchMock.mock.calls.filter(([url])=>url.endsWith('/call/app')||url.includes('/payments'))).toHaveLength(0);
});
it('keeps input and does not show success on rejected registration',async()=>{
  saveOk=false;render(<DashboardApplication/>);fireEvent.click((await screen.findAllByRole('button',{name:'신규 등록'}))[0]);await basic();await guardian();
  fireEvent.click(screen.getByRole('button',{name:'등록 완료'}));
  await waitFor(()=>expect(saves()).toHaveLength(1));
  expect(await screen.findByText('저장 거절')).toBeInTheDocument();
  expect(screen.queryByText('어르신 등록이 완료되었습니다!')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'← 이전'}));
  expect(screen.getByDisplayValue('가상보호자')).toBeInTheDocument();
});


it('manual address edits invalidate the prior region and require lookup again',async()=>{
  render(<DashboardApplication/>);fireEvent.click((await screen.findAllByRole('button',{name:'신규 등록'}))[0]);
  await basic();fireEvent.click(screen.getByRole('button',{name:'← 이전'}));
  fireEvent.change(screen.getByPlaceholderText('주소 검색을 눌러 선택'),{target:{value:'경북 포항시 남구 가상주소'}});
  expect(screen.getByPlaceholderText('주소 검색 시 자동 입력')).toHaveValue('');
  fireEvent.click(screen.getByRole('button',{name:'다음 단계 →'}));
  expect(screen.getByText('주소 검색으로 주소와 관할 구역을 확인해 주세요')).toBeInTheDocument();
  expect(saves()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'주소 검색'}));
  expect(screen.getByPlaceholderText('주소 검색 시 자동 입력')).toHaveValue('경북 포항시 북구');
  fireEvent.click(screen.getByRole('button',{name:'다음 단계 →'}));
  expect(screen.getByPlaceholderText('예: 김민준')).toBeInTheDocument();
});
it('manual address without lookup cannot skip jurisdiction confirmation',async()=>{
  render(<DashboardApplication/>);fireEvent.click((await screen.findAllByRole('button',{name:'신규 등록'}))[0]);
  await basic(false);
  expect(screen.getByText('주소 검색으로 주소와 관할 구역을 확인해 주세요')).toBeInTheDocument();
  expect(saves()).toHaveLength(0);
});
