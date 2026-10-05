import { z } from 'zod';
import { CaseNoteResultSchema, CaseNoteWriteSchema, CaseNotePageSchema, CaseNoteVersionSchema, parseOr } from '../schemas';
import { authFetch, errMsg, SERVER_URL } from './api';

async function checked<T extends z.ZodType>(path: string, schema: T, options?: RequestInit): Promise<z.infer<T>> {
  const response = await authFetch(`${SERVER_URL}/case-notes${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errMsg(data, `일지 요청에 실패했습니다 (${response.status}). 입력 내용은 유지됩니다.`));
  // Global parseOr has an observation-only mode; saves must fail closed.
  if (!schema.safeParse(data).success) throw new Error('일지 저장·조회 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
  const parsed = parseOr(schema, data, null);
  if (!parsed) throw new Error('일지 저장·조회 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
  return parsed;
}
const json = (method: string, body: unknown): RequestInit => ({method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
export type CaseNotesQuery = Record<string, string>;
export async function fetchCaseNotesPage(query: CaseNotesQuery, signal?: AbortSignal) {
  return checked(`/page?${new URLSearchParams(query).toString()}`, CaseNotePageSchema, {signal});
}
export async function fetchCaseNotesVersion(signal?: AbortSignal) {
  return checked('/version', CaseNoteVersionSchema, {signal});
}
export async function fetchCaseNote(id: string) {
  return (await checked(`/${encodeURIComponent(id)}`, CaseNoteResultSchema)).note;
}
export async function ensureCallNote(callId: string) {
  return (await checked('/from-call', CaseNoteWriteSchema, json('POST', {callId}))).note;
}
export async function persistCaseNote(id: string | null, body: Record<string, unknown>) {
  const result = await checked(id ? `/${encodeURIComponent(id)}` : '', CaseNoteWriteSchema, json(id ? 'PATCH' : 'POST', body));
  if (result.id !== result.note.id || (id && result.id !== id)) throw new Error('저장된 일지 번호가 일치하지 않습니다. 다시 조회해 주세요.');
  return result.note;
}
