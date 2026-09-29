import { render, screen, waitFor } from '@testing-library/react';
import { authFetch } from '../../utils/api';
import HealthInsightsPanel from './HealthInsightsPanel';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid', errMsg: (_d: unknown, fallback?: string) => fallback || '오류' }));
jest.mock('react-apexcharts', () => () => <div data-testid="health-chart" />);
const fetchMock = authFetch as jest.Mock;
const response = (data: unknown, status = 200) => ({ ok: status < 300, status, json: async () => data });

beforeEach(() => fetchMock.mockReset());

it('Firestore 문서 키인 전화번호로 목록과 그래프를 조회한다', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
    .mockResolvedValueOnce(response({ elderId: '01012345678', from: '2026-08-30', to: '2026-09-29', points: [] }));
  render(<HealthInsightsPanel elders={[{ id: 123, phone: '01012345678', name: '홍길동' }]} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls.map(([url]) => url).join('\n')).toContain('elderId=01012345678');
  expect(fetchMock.mock.calls.map(([url]) => url).join('\n')).not.toContain('elderId=123');
  expect(screen.getByRole('option', { name: '홍길동' })).toHaveValue('01012345678');
});

it('형식이 깨진 API 응답을 화면 데이터로 사용하지 않는다', async () => {
  const notify = jest.fn();
  fetchMock
    .mockResolvedValueOnce(response({ items: [{ caseId: 'case-without-required-fields' }], nextCursor: null }))
    .mockResolvedValueOnce(response({ elderId: '01012345678', from: '2026-08-30', to: '2026-09-29', points: [] }));
  render(<HealthInsightsPanel elders={[{ phone: '01012345678', name: '홍길동' }]} notify={notify} />);
  await waitFor(() => expect(notify).toHaveBeenCalledWith('건강 변화 API 응답 형식이 올바르지 않습니다'));
  expect(screen.queryByText('case-without-required-fields')).not.toBeInTheDocument();
});
