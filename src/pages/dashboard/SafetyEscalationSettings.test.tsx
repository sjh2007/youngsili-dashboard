import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SafetyEscalationSettings from './SafetyEscalationSettings';
import { authFetch } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  SERVER_URL: 'https://api.example.test',
  authFetch: jest.fn(),
}));

const mockedAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

test('저장 요청에서 조회 전용 메타데이터를 제외한다', async () => {
  const safetyEscalation = {
    primary: { name: '신주환', phone: '01032597777' },
    secondary: { name: '김주환', phone: '01067797200' },
    afterHours: { name: '박주환', phone: '01067797200' },
    afterHoursInstructions: '18시 이후 당직자에게 전달',
    acknowledgeWithinMinutes: 30,
    completeWithinMinutes: 60,
    updatedAt: '2026-09-26T00:00:00.000Z',
    updatedBy: 'manager@example.test',
  };
  mockedAuthFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, safetyEscalation }),
  } as Response);

  render(<SafetyEscalationSettings me={{ safetyEscalation }} notify={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '연락망 저장' }));

  await waitFor(() => expect(mockedAuthFetch).toHaveBeenCalledTimes(1));
  const options = mockedAuthFetch.mock.calls[0][1] as RequestInit;
  const body = JSON.parse(String(options.body));
  expect(body).toEqual({
    primary: safetyEscalation.primary,
    secondary: safetyEscalation.secondary,
    afterHours: safetyEscalation.afterHours,
    afterHoursInstructions: safetyEscalation.afterHoursInstructions,
    acknowledgeWithinMinutes: 30,
    completeWithinMinutes: 60,
  });
  expect(body).not.toHaveProperty('updatedAt');
  expect(body).not.toHaveProperty('updatedBy');
});
