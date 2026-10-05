import { fireEvent, render, screen } from '@testing-library/react';
import DataPage from './DataPage';

const baseProps = {
  weatherData: {},
  disasterMsgConfigured: false,
  disasterMsgs: [],
  popError: null,
  popLoading: false,
  elders: [],
  alertSeverity: () => 'warning',
  calling: null,
  setCallModal: jest.fn(),
  popDoneOpen: {},
  setPopDoneOpen: jest.fn(),
  fetchWeather: jest.fn(),
  getNoResponseDays: () => 1,
  weatherStale: false,
  weatherTime: '',
  T: { elder: '어르신' },
};

it.each([{}, {'대구 중구':{noData:true,temp:null,alert:'none',unavailableReason:'key_expired'}}])('missing or expired weather never claims all elders are safe',weatherData=>{
  render(<DataPage {...baseProps} fetchPopulation={jest.fn()} popData={{total:{population:1,elderly:1,elderlyRatio:100,solitary:1},regions:[]}} weatherData={weatherData} elders={[{id:'e1',name:'가상',region:'대구 중구'}]}/>);
  expect(screen.getByText('일부 지역의 날씨 정보를 확인할 수 없습니다. 기상 상황을 별도로 확인해 주세요.')).toBeInTheDocument();
  expect(screen.queryByText(/모든 어르신이 안전한 날씨/)).toBeNull();
});

it('포항시 제목과 일반구를 표시하고 북구 선택 시 하위 지역을 요청한다', () => {
  const fetchPopulation = jest.fn();
  render(<DataPage {...baseProps} fetchPopulation={fetchPopulation} popData={{
    sido: '경북', sidoName: '경상북도', areaName: '포항시', areaPath: '포항시', areaLevel: 'city',
    source: '테스트', year: 2026, month: 8, breadcrumbs: [{ label: '경상북도' }, { label: '포항시', region: '포항시' }],
    total: { population: 600, elderly: 136, elderlyRatio: 22.7, solitary: 40 },
    regions: [{ region: '북구', regionPath: '포항시 북구', hasChildren: true, total: 300, elderly: 68, elderlyRatio: 22.7, solitary: 20 }],
  }} />);

  expect(screen.getByText('포항시 고령 1인 세대 현황')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '북구 하위 지역 보기' }));
  expect(fetchPopulation).toHaveBeenCalledWith('포항시 북구');
});

it('북구 화면에서는 읍면동과 지역 경로를 표시한다', () => {
  render(<DataPage {...baseProps} fetchPopulation={jest.fn()} popData={{
    sido: '경북', sidoName: '경상북도', areaName: '포항시 북구', areaPath: '포항시 북구', areaLevel: 'district',
    source: '테스트', year: 2026, month: 8,
    breadcrumbs: [{ label: '경상북도' }, { label: '포항시', region: '포항시' }, { label: '북구', region: '포항시 북구' }],
    total: { population: 300, elderly: 68, elderlyRatio: 22.7, solitary: 20 },
    regions: [{ region: '죽도동', regionPath: '포항시 북구', hasChildren: false, total: 100, elderly: 23, elderlyRatio: 23, solitary: 7 }],
  }} />);

  expect(screen.getByText('포항시 북구 고령 1인 세대 현황')).toBeInTheDocument();
  expect(screen.getByText('읍면동별 고령 1인 세대 현황')).toBeInTheDocument();
  expect(screen.getByText('죽도동')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '포항시' })).toBeInTheDocument();
});

it('세대 단위·기준일·수집시각·출처와 결측 안내를 구분한다', () => {
  render(<DataPage {...baseProps} fetchPopulation={jest.fn()} popData={{
    sido:'경남',sidoName:'경상남도',areaPath:'사천시',areaName:'사천시',asOf:'2026-09-30',fetchedAt:'2026-10-03T06:00:00Z',
    source:'행정안전부',sourceUrl:'https://jumin.mois.go.kr/ageStatMonth.do',householdSourceUrl:'https://jumin.mois.go.kr/sexdAge1Hshd.do',stale:true,incomplete:true,
    total:{population:1000,elderly:100,elderlyRatio:10,solitary:40},
    regions:[{region:'신수출장소',regionPath:'사천시 신수출장소',total:10,elderly:5,elderlyRatio:50,solitary:null}],
  }}/>);
  expect(screen.getByText('40세대')).toBeInTheDocument();
  expect(screen.getByText(/2026년 09월 30일/)).toBeInTheDocument();
  expect(screen.getByText(/자료 수집 시각:/)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'행정안전부 인구 원자료'})).toBeInTheDocument();
  expect(screen.getByText(/최신 자료 확인 중/)).toBeInTheDocument();
  expect(screen.getAllByText('자료 없음')).toHaveLength(2);
});

it('같은 구 이름이 있어도 다른 시의 등록 인원을 합치지 않는다',()=>{
  render(<DataPage {...baseProps} fetchPopulation={jest.fn()} elders={[{region:'경북 포항시 북구'},{region:'대구 북구'}]} popData={{
    sido:'경북',sidoName:'경상북도',areaPath:'포항시 북구',areaName:'포항시 북구',total:{population:500,elderly:100,elderlyRatio:20,solitary:10},regions:[],
  }}/>);
  expect(screen.getByText('1명')).toBeInTheDocument();
  expect(screen.queryByText('2명')).toBeNull();
});
