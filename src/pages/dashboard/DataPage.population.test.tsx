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
  expect(screen.getByText('읍면동별 독거노인 현황')).toBeInTheDocument();
  expect(screen.getByText('죽도동')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '포항시' })).toBeInTheDocument();
});
