import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HealthSyntheticTestPanel from './HealthSyntheticTestPanel';

const response=(data:unknown,ok=true)=>Promise.resolve({ok,status:ok?200:400,json:async()=>data} as Response);
const mockFetch=jest.fn();
jest.mock('../../utils/api',()=>({SERVER_URL:'http://server.test',authFetch:(...args:unknown[])=>mockFetch(...args),errMsg:(data:any)=>data?.error?.message||'오류'}));

beforeEach(()=>mockFetch.mockReset());

it('관리자가 전화 없이 미리보기하고 실제 통화와 분리된 결과를 확인한다',async()=>{
  mockFetch
    .mockImplementationOnce(()=>response({items:[]}))
    .mockImplementationOnce(()=>response({runId:null,elderId:'01012345678',createdAt:'2026-10-01T08:00:00.000Z',expiresAt:'2026-10-02T08:00:00.000Z',observations:[{topic:'meal',value:'present',subject:'self',temporality:'current',evidenceLine:2,evidenceExcerpt:'밥을 못 먹었어요'}]}));
  render(<HealthSyntheticTestPanel elders={[{phone:'01012345678',name:'홍길동'}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'테스트 열기'}));
  await waitFor(()=>expect(mockFetch).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:'미리보기'}));
  expect(await screen.findByText('문제 확인')).toBeInTheDocument();
  const body=JSON.parse(mockFetch.mock.calls[1][1].body);
  expect(body).toMatchObject({elderId:'01012345678',save:false});
  expect(screen.getByText('밥을 못 먹었어요')).toBeInTheDocument();
});

it('저장된 테스트 결과를 실제 통계와 분리한다고 안내한다',async()=>{
  mockFetch.mockImplementationOnce(()=>response({items:[]}));
  render(<HealthSyntheticTestPanel elders={[{phone:'01012345678',name:'홍길동'}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'테스트 열기'}));
  expect(await screen.findByText(/실제 통화·과금·건강 통계에는 포함되지 않습니다/)).toBeInTheDocument();
});
