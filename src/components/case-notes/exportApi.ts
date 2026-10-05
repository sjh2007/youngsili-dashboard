import { z } from 'zod';
import { CaseNoteSchema, CaseNoteResultSchema } from '../../schemas';
import { authFetch, SERVER_URL, errMsg } from '../../utils/api';
import type { ExportLoader } from './exportData';

const versionSchema = z.object({version:z.string()});
const pageSchema = z.object({notes:z.array(CaseNoteSchema).max(100),nextCursor:z.string().nullable().optional(),hasMore:z.boolean(),scanned:z.number().optional(),version:z.string()});
async function read<T extends z.ZodType>(path:string,schema:T,signal:AbortSignal):Promise<z.infer<T>> {
  const response = await authFetch(`${SERVER_URL}/case-notes${path}`,{signal});
  const data = await response.json();
  if (!response.ok) throw new Error(errMsg(data,'일지를 불러오지 못했습니다. 다시 시도해 주세요.'));
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error('내보내기 응답 형식을 확인하지 못했습니다.');
  return parsed.data;
}
export const exportLoader: ExportLoader = {
  version: async (query,signal) => (await read(`/version?${new URLSearchParams(query)}`,versionSchema,signal)).version,
  page: (query,cursor,limit,signal) => read(`/page?${new URLSearchParams({...query,full:'true',limit:String(limit),...(cursor?{cursor}:{})})}`,pageSchema,signal),
  note: async (id,signal) => (await read(`/${encodeURIComponent(id)}`,CaseNoteResultSchema,signal)).note,
};
