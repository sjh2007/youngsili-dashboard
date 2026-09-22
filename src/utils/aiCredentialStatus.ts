import { AiCredentialStatusSchema } from '../schemas';
import { authFetch, SERVER_URL } from './api';

export async function fetchAiCredentialStatus() {
  const unavailable = { available: false as const, error: 'Google AI 상태 조회 실패' };
  try {
    const response = await authFetch(`${SERVER_URL}/console/ai-credential-status`);
    if (!response.ok) return unavailable;
    // parseOr logs the original response on failure; this boundary must never log it.
    const parsed = AiCredentialStatusSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : unavailable;
  } catch {
    return unavailable;
  }
}
