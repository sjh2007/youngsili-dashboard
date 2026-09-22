import { fetchAiCredentialStatus } from './aiCredentialStatus';
import { authFetch } from './api';

jest.mock('./api', () => ({ authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid' }));
const fetchMock = authFetch as jest.Mock;
const valid = {
  available: true, configured: true, keySuffix: '1234', fingerprint: '012345abcdef',
  model: 'models/gemini-3.1-flash-live-preview',
  lastLive: { state: 'credits_depleted', observedAt: '2026-09-22T00:00:00.000Z' },
};
const failed = { available: false, error: 'Google AI 상태 조회 실패' };
afterEach(() => jest.restoreAllMocks());

it('shows the observed credit depletion status', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => valid });
  expect(await fetchAiCredentialStatus()).toEqual(valid);
});

it('replaces a previous successful result when a refresh cannot reach the API', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => valid });
  expect(await fetchAiCredentialStatus()).toEqual(valid);
  fetchMock.mockRejectedValueOnce(new Error('network failure'));
  expect(await fetchAiCredentialStatus()).toEqual(failed);
});

it.each([null, { available: true }, { ...valid, lastLive: { state: 'unexpected-sensitive-text' } }])(
  'reports invalid data as unavailable without logging the response', async data => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    expect(await fetchAiCredentialStatus()).toEqual(failed);
    expect(warn).not.toHaveBeenCalled();
  },
);

it('handles HTTP and JSON failures without exposing their content', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'fixture-secret' }) });
  expect(await fetchAiCredentialStatus()).toEqual(failed);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('fixture-secret'); } });
  expect(await fetchAiCredentialStatus()).toEqual(failed);
});
