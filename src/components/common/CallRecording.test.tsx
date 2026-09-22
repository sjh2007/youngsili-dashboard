import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authFetch } from '../../utils/api';
import { CallRecording, RecordingConsent, RecordingProvider } from './CallRecording';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid' }));
const fetchMock = authFetch as jest.Mock;
const config = { enabled: true, retentionMonths: 12, canRead: true, canManage: true };
const metadata = { state: 'ready', channel: 'app', durationSec: 20, formats: ['mp3', 'wav'], retentionMonths: 12 };
const response = (data: unknown, status = 200) => ({ ok: status < 300, status, json: async () => data });

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (url: string) => response(url.endsWith('/config') ? config : metadata));
  URL.createObjectURL = jest.fn().mockReturnValue('blob:recording-fixture');
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
function view() { return render(<RecordingProvider><CallRecording callId="call_fixture" /></RecordingProvider>); }

it('only reads metadata on demand and fetches playback with authenticated requests', async () => {
  const page = view();
  const check = await screen.findByRole('button', { name: '녹음 확인' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(check);
  const play = await screen.findByRole('button', { name: '다시 듣기' });
  fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }) });
  fireEvent.click(play);
  await waitFor(() => expect(screen.getByLabelText('통화 녹음 재생')).toHaveAttribute('src', 'blob:recording-fixture'));
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('format=mp3&purpose=play'), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  page.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording-fixture');
});
it('shows separate MP3 and WAV downloads and labels failures', async () => {
  view(); fireEvent.click(await screen.findByRole('button', { name: '녹음 확인' }));
  const mp3 = await screen.findByRole('button', { name: 'MP3 다운로드' });
  expect(screen.getByRole('button', { name: 'WAV 다운로드' })).toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(response({}, 403)); fireEvent.click(mp3);
  expect(await screen.findByText(/녹음 조회·다운로드에 실패/)).toBeInTheDocument();
});
it('distinguishes missing, failed and still processing recordings', async () => {
  view(); const button = await screen.findByRole('button', { name: '녹음 확인' });
  fetchMock.mockResolvedValueOnce(response({}, 404)); fireEvent.click(button);
  expect(await screen.findByText(/저장된 녹음을 찾을 수 없습니다/)).toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(response({ ...metadata, state: 'failed', formats: [] })); fireEvent.click(button);
  expect(await screen.findByText(/녹음 저장 실패/)).toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(response({ ...metadata, state: 'processing', formats: [] })); fireEvent.click(button);
  expect(await screen.findByText(/녹음 수집·처리 중/)).toBeInTheDocument();
});
it('hides controls from roles without recording access and makes no request for CS console', async () => {
  fetchMock.mockResolvedValueOnce(response({ ...config, canRead: false, canManage: false }));
  const page = view(); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: '녹음 확인' })).not.toBeInTheDocument(); page.unmount();
  fetchMock.mockClear();
  render(<RecordingProvider enabled={false}><CallRecording callId="fixture" /></RecordingProvider>);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('requires a consent attestation and sends the selected elder in the body', async () => {
  fetchMock.mockImplementation(async url => response(url.endsWith('/config') ? config : { enabled: false, version: 'recording-v1', retentionMonths: 12 }));
  render(<RecordingProvider><RecordingConsent phone="01000000000" /></RecordingProvider>);
  const save = await screen.findByRole('button', { name: '녹음 동의 확인' });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); expect(save).toBeEnabled();
  fetchMock.mockResolvedValueOnce(response({ enabled: true, version: 'recording-v1', retentionMonths: 12 }));
  fireEvent.click(save);
  await screen.findByRole('button', { name: '동의 철회 및 녹음 삭제' });
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/call-recordings/consent'), expect.objectContaining({
    method: 'POST', body: JSON.stringify({ phone: '01000000000', enabled: true, confirmed: true }),
  }));
});
it('rejects malformed server metadata without displaying the response', async () => {
  view(); const check = await screen.findByRole('button', { name: '녹음 확인' });
  fetchMock.mockResolvedValueOnce(response({ secret: 'sensitive-response' })); fireEvent.click(check);
  await screen.findByText(/녹음 조회·다운로드에 실패/);
  expect(screen.queryByText('sensitive-response')).not.toBeInTheDocument();
});
it('removes previous playback controls after a recording becomes unavailable', async () => {
  view(); const check = await screen.findByRole('button', { name: '녹음 확인' });
  fireEvent.click(check); await screen.findByRole('button', { name: '다시 듣기' });
  fetchMock.mockResolvedValueOnce(response({}, 404)); fireEvent.click(check);
  await screen.findByText(/저장된 녹음을 찾을 수 없습니다/);
  expect(screen.queryByRole('button', { name: '다시 듣기' })).not.toBeInTheDocument();
});
