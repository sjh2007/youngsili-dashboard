import { render, screen, within } from '@testing-library/react';
import EldersPage from './EldersPage';

test('the default elder classification is neutral and does not claim a healthy result', () => {
  const elder = {id:'elder-1',name:'테스트 어르신',phone:'01000000000',status:'normal',approved:true,age:78,region:'서울',callActive:true};
  render(<EldersPage
    me={{}} T={{elder:'어르신'}} searchName="" setSearchName={jest.fn()}
    REGIONS={['전체','서울']} regionFilter="전체" setRegionFilter={jest.fn()}
    filter="all" setFilter={jest.fn()} elders={[elder]} sortBy="status" setSortBy={jest.fn()}
    viewMode="table" setViewMode={jest.fn()} downloadCsvTemplate={jest.fn()}
    csvInputRef={{current:null}} handleCsvFile={jest.fn()} openRegister={jest.fn()}
    filteredElders={[elder]} pendingElders={[]} selectedElders={new Set()}
    toggleAllElders={jest.fn()} bulkRunning={false} bulkChannel="pstn"
    deleteSelectedElders={jest.fn()} EldersEmpty={()=><div>비어 있음</div>}
    getSolitudeRisk={()=>({label:'확인 필요',bg:'#fff',color:'#000'})}
    getNoResponseDays={()=>99} openDetail={jest.fn()} toggleElderSel={jest.fn()}
    renderLastCall={()=> '기록 없음'} calling={null} setCallModal={jest.fn()}
  />);
  const row = screen.getByRole('row', {name:/테스트 어르신/});
  expect(within(row).getByText('기본 분류')).toBeInTheDocument();
  expect(within(row).queryByText('정상')).not.toBeInTheDocument();
  expect(screen.getByText(/건강 변화 카드와 미처리 알림은/)).toBeInTheDocument();
});
