import { act, fireEvent, render, screen } from '@testing-library/react';
import { authFetch } from '../../utils/api';
import DemoCallsPanel from './DemoCallsPanel';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid' }));
const fetchMock = authFetch as jest.Mock;
const session = { callId: 'demo_fixture', name: '체험자', phone: '010-****-1234', scenario: 'weather',
  status: 'completed', createdAt: '2026-09-28T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
  transcript: '영실이: 폭염을 가정한 체험입니다.', durationSec: 45, recordingConsent: false };
const response = (data: unknown, status = 200) => ({ ok: status < 300, status, json: async () => data });
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-28T12:00:00Z'));
  fetchMock.mockReset().mockResolvedValue(response({ items: [session], limit: 100 }));
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('shows masked demo data and text without a recording request when consent is absent', async () => {
  render(<DemoCallsPanel />);
  expect(await screen.findByText(session.phone)).toBeInTheDocument();
  expect(screen.getByText('날씨 안전')).toBeInTheDocument();
  fireEvent.click(screen.getByText('대화 텍스트 보기'));
  expect(screen.getByText(session.transcript)).toBeInTheDocument();
  expect(screen.getByText('녹음 미동의 · 텍스트만 저장')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('https://api.fixture.invalid/demo/sessions', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
it('removes expired transcripts and the recording player at the retention deadline', async () => {
  const expiresAt = new Date(Date.now() + 1000).toISOString();
  fetchMock.mockImplementation(async (url: string) => response(url.endsWith('/config')
    ? { enabled: true, retentionDays: 30, canRead: true, canManage: false }
    : { items: [{ ...session, recordingConsent: true, expiresAt }], limit: 100 }));
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  render(<DemoCallsPanel />);
  await screen.findByRole('button', { name: '녹음 확인' });
  act(() => { jest.advanceTimersByTime(1001); });
  expect(screen.queryByText(session.transcript)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '녹음 확인' })).not.toBeInTheDocument();
  expect(screen.getByText(/만료된 체험 1건/)).toBeInTheDocument();
});
it('reports denied access and retries without retaining previous personal data', async () => {
  render(<DemoCallsPanel />); await screen.findByText(session.phone);
  fetchMock.mockResolvedValueOnce(response({}, 403));
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('운영관리자만');
  expect(screen.queryByText(session.phone)).not.toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(response({ items: [], limit: 100 }));
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(await screen.findByText('현재 열람 가능한 체험 통화가 없습니다.')).toBeInTheDocument();
});
it('rejects malformed metadata without exposing or logging the private payload', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  fetchMock.mockResolvedValue(response({ items: [{ ...session, expiresAt: 'invalid', transcript: 'private-payload' }], limit: 100 }));
  render(<DemoCallsPanel />);
  expect(await screen.findByRole('alert')).toHaveTextContent('응답을 확인할 수 없습니다');
  expect(screen.queryByText('private-payload')).not.toBeInTheDocument();
  expect(warn).not.toHaveBeenCalled();
});
