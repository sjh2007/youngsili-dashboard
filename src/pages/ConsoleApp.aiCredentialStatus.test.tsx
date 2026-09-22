import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { authFetch } from '../utils/api';

// jsdom does not implement matchMedia; ConsoleApp reads it when the module loads.
const originalMatchMedia = window.matchMedia;
window.matchMedia = jest.fn().mockReturnValue({ matches: false });
const ConsoleApp = require('./ConsoleApp').default;
afterAll(() => { window.matchMedia = originalMatchMedia; });

jest.mock('react-apexcharts', () => () => null);
jest.mock('../firebase', () => ({ auth: {}, authEnabled: true }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: Function) => {
    callback({ email: 'operator@fixture.invalid' });
    return () => {};
  },
  signOut: jest.fn(), signInWithEmailAndPassword: jest.fn(),
}));
jest.mock('../utils/api', () => ({
  authFetch: jest.fn(), SERVER_URL: 'https://api.fixture.invalid', errMsg: (_data: unknown, fallback: string) => fallback,
}));
// Unrelated system widgets have their own contracts; leave them unloaded in these tests.
jest.mock('../schemas', () => ({ ...jest.requireActual('../schemas'), parseOr: () => null }));
const fetchMock = authFetch as jest.Mock;
let role = 'superadmin';
let aiResponse: unknown;
const valid = {
  available: true, configured: true, keySuffix: '1234', fingerprint: '012345abcdef',
  model: 'models/gemini-3.1-flash-live-preview',
  lastLive: { state: 'credits_depleted', observedAt: '2026-09-22T00:00:00.000Z' },
};
beforeEach(() => {
  role = 'superadmin'; aiResponse = valid;
  fetchMock.mockReset().mockImplementation(async (url: string) => ({
    ok: true, status: 200,
    json: async () => url.endsWith('/me') ? { role }
      : url.endsWith('/console/ai-credential-status') ? aiResponse
      : url.endsWith('/console/health') ? { components: [] } : [],
  }));
});

it('shows masked identity and credit depletion to a superadmin', async () => {
  render(<ConsoleApp />);
  expect(await screen.findByText('선불 크레딧 소진')).toBeInTheDocument();
  expect(screen.getByText('••••1234 (지문 012345abcdef)')).toBeInTheDocument();
  expect(screen.getByText(/070 전화는 별도/)).toBeInTheDocument();
});

it('replaces the status with an explicit error when refresh returns malformed data', async () => {
  render(<ConsoleApp />);
  await screen.findByText('선불 크레딧 소진');
  aiResponse = null;
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(await screen.findByText('Google AI 상태 조회 실패')).toBeInTheDocument();
  expect(screen.queryByText('선불 크레딧 소진')).not.toBeInTheDocument();
  expect(screen.queryByText('상태를 조회하는 중입니다.')).not.toBeInTheDocument();
});

it('does not request or render the Google AI status for CS', async () => {
  role = 'cs';
  render(<ConsoleApp />);
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('/console/stats'))).toBe(true));
  expect(fetchMock.mock.calls.some(([url]) => url.includes('/console/ai-credential-status'))).toBe(false);
  expect(screen.queryByText('Google AI · 앱 전화')).not.toBeInTheDocument();
});
