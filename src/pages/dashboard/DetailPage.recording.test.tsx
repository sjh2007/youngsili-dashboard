import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DetailPage from './DetailPage';
import { authFetch } from '../../utils/api';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid' }));
const fetchMock = authFetch as jest.Mock;
const selected = { id: 'elder_fixture', name: '동명이인', phone: '010-0000-0000', status: 'normal' };
const calls = [
  { id: 'history_app', callId: 'dispatch_app', phone: '01000000000', elderName: '이전 이름', transcript: '앱 통화 내용' },
  { id: 'dispatch_pstn', channel: 'pstn', phone: '01000000000', elderName: selected.name, transcript: '일반전화 내용' },
  { id: 'other_person', phone: '01000000001', elderName: selected.name, transcript: '다른 어르신 통화' },
  { id: 'legacy', elderName: selected.name, transcript: '번호 없는 과거 텍스트' },
];
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const config = { enabled: true, retentionMonths: 12, canRead: true, canManage: true };

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith('/config')) return response(config);
    if (url.endsWith('/consent/status')) return response({ enabled: false, version: 'recording-v1', retentionMonths: 12 });
    if (url.includes('/audio?')) return { ok: true, blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }) };
    return response({ state: 'ready', channel: url.endsWith('dispatch_app') ? 'app' : 'pstn', durationSec: 20, formats: ['mp3', 'wav'], retentionMonths: 12 });
  });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:detail-recording');
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function view(elder = selected, history = calls) {
  return <DetailPage selected={elder} callsHistory={history} caseNotes={[]} cycleLabel={() => ''} />;
}

it('shows consent and separate recordings for this elder’s app and PSTN calls', async () => {
  const page = render(view());
  expect(await screen.findByRole('button', { name: '녹음 동의 확인' })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/consent/status'), expect.objectContaining({ body: JSON.stringify({ phone: '01000000000' }) }));
  expect(screen.queryByText('다른 어르신 통화')).not.toBeInTheDocument();
  expect(screen.getByText('번호 없는 과거 텍스트')).toBeInTheDocument();
  const checks = await screen.findAllByRole('button', { name: '녹음 확인' });
  expect(checks).toHaveLength(2);
  fireEvent.click(checks[0]);
  fireEvent.click(await screen.findByRole('button', { name: '다시 듣기' }));
  await waitFor(() => expect(screen.getByLabelText('통화 녹음 재생')).toHaveAttribute('src', 'blob:detail-recording'));
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/dispatch_app/audio?format=mp3&purpose=play'), expect.anything());
  fireEvent.click(checks[1]);
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'MP3 다운로드' })).toHaveLength(2));
  expect(screen.getAllByRole('button', { name: 'WAV 다운로드' })).toHaveLength(2);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/dispatch_pstn$/), expect.anything());
  const download = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(screen.getAllByRole('button', { name: 'WAV 다운로드' })[1]);
  await waitFor(() => expect(download).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/dispatch_pstn/audio?format=wav&purpose=download'), expect.anything());
  page.rerender(view({ ...selected, id: 'other', phone: '01000000001' }));
  await waitFor(() => expect(screen.queryByLabelText('통화 녹음 재생')).not.toBeInTheDocument());
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:detail-recording');
});

it('allows consent management before the first call and hides recording controls without access', async () => {
  const page = render(view(selected, []));
  await screen.findByRole('button', { name: '녹음 동의 확인' });
  expect(screen.getByText('통화 기록 없음')).toBeInTheDocument();
  page.unmount();
  fetchMock.mockResolvedValue(response({ ...config, canRead: false, canManage: false }));
  render(view());
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/config'), expect.anything()));
  expect(screen.queryByRole('button', { name: '녹음 확인' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '녹음 동의 확인' })).not.toBeInTheDocument();
});
