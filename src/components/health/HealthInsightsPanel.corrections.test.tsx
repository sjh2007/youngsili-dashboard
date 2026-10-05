import {fireEvent,render,screen} from '@testing-library/react';
import HealthInsightsPanel from './HealthInsightsPanel';
import {authFetch} from '../../utils/api';
jest.mock('../../utils/api',()=>({authFetch:jest.fn(),SERVER_URL:'https://fixture.invalid',errMsg:()=> '조회 실패'}));
jest.mock('react-apexcharts',()=>()=> <div/>);
const mock=authFetch as jest.Mock;
const response=(data:unknown)=>({ok:true,status:200,json:async()=>data});
const item={caseId:'case1',elderId:'elder1',topic:'sleep',signal:'new_statement',state:'unreviewed',latestObservedAt:'2026-10-01T01:00:00Z',revision:1,evidenceCount:2,recoveryStatus:'reported',recoveryReportedAt:'2026-10-02T01:00:00Z'};
const ranking={from:'2026-09-28',to:'2026-10-03',total:1,topics:{meal:0,sleep:1,activity:0,discomfort:0},people:[],points:[]};
beforeEach(()=>{mock.mockReset();Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'}})});
it('recovery remains in active work and partial correction uses selected ID without marking staff complete',async()=>{
  let current={...item};
  const detail=()=>({...current,evidence:[{observationId:'o1',validationStatus:'valid',observedAt:item.latestObservedAt,sourceId:'call1',line:1,excerpt:'잠을 못 잤어요'}],reviewNote:'',updatedAt:null,reviewedBy:''});
  mock.mockImplementation(async(url:string,init?:RequestInit)=>{
    if(url.includes('/rankings'))return response(ranking);
    if(url.includes('/follow-up'))return response({revision:current.revision,followUp:null});
    if(url.endsWith('/review')){current={...current,state:'reviewing',revision:2};return response({...detail(),correctionRecorded:1})}
    if(url.endsWith('/case1'))return response(detail());
    return response({items:[current],nextCursor:null});
  });
  render(<HealthInsightsPanel elders={[{phone:'elder1',name:'가상어르신'}]}/>);
  expect(await screen.findByText(/통화에서 회복 보고/)).toBeInTheDocument();
  expect(screen.getByRole('article',{name:'가상어르신 수면 미확인'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'근거 보기'}));
  fireEvent.click(await screen.findByRole('button',{name:'근거 정정·제외'}));
  expect(screen.getByText(/2건 중 1건을 표시/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/잠을 못 잤어요/));
  fireEvent.change(screen.getByLabelText('정정·제외 이유 (필수)'),{target:{value:'타인의 이야기'}});
  fireEvent.click(screen.getByRole('button',{name:'선택 근거 정정·제외 저장'}));
  expect(await screen.findByRole('article',{name:'가상어르신 수면 확인 중'})).toBeInTheDocument();
  const request=mock.mock.calls.find(([url])=>url.endsWith('/review'));
  expect(JSON.parse(request[1].body)).toMatchObject({state:'corrected',observationIds:['o1'],reviewNote:'타인의 이야기',revision:1});
});
