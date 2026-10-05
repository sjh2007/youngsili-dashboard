import type { PrintableCaseNote } from '../../utils/caseNoteExport';

export const EXPORT_PART_ROWS = 5000;
export type ExportNote = PrintableCaseNote;
export interface ExportPage { notes: ExportNote[]; nextCursor?: string | null; hasMore: boolean; scanned?: number; version: string; }
export interface ExportLoader {
  version(query: Record<string, string>, signal: AbortSignal): Promise<string>;
  page(query: Record<string, string>, cursor: string | undefined, limit: number, signal: AbortSignal): Promise<ExportPage>;
  note(id: string, signal: AbortSignal): Promise<ExportNote>;
}
export const changedMessage = '내보내기 중 일지가 변경되었습니다. 창을 닫고 처음부터 다시 시작해 주세요. 이미 받은 파일은 함께 사용하지 마세요.';
export function exportRows(notes: ExportNote[]): string[][] {
  const types = {visit:'가정방문',phone:'전화상담',office:'내소상담',guardian:'보호자상담',etc:'기타'};
  const cats = {safety:'안전',health:'건강',meal:'식사',emotional:'정서',welfare:'생활지원',etc:'기타'};
  return [['일시','어르신','유형','분류','내용','조치사항','후속필요','후속기한','작성자','상태'], ...notes.map(n => [
    n.visitedAt ? new Date(n.visitedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '', n.elderName || '',
    types[n.type] || n.type || '', cats[n.category] || n.category || '', n.content || '', n.action || '',
    n.followUp?.needed ? 'O' : '', n.followUp?.dueDate || '', (n.authorEmail || '').split('@')[0],
    n.source === 'auto-call' && n.status !== 'confirmed' ? '자동기록(확인 필요)' : '확인 완료',
  ].map(String))];
}
const check = (signal: AbortSignal) => { if (signal.aborted) throw new DOMException('취소됨', 'AbortError'); };
export async function collectExportPart(loader: ExportLoader, query: Record<string,string>, version: string,
  startCursor: string | undefined, signal: AbortSignal, progress: (rows:number, scanned:number)=>void,
  selectedIds?: string[]): Promise<{notes: ExportNote[]; nextCursor?: string; hasMore: boolean}> {
  const notes: ExportNote[] = []; let cursor = startCursor; let more = false; let scanned = 0;
  const seen = new Set<string>();
  const accept = (note: ExportNote) => {
    if (seen.has(note.id)) throw new Error('중복 일지 응답을 확인했습니다. 처음부터 다시 조회해 주세요.');
    seen.add(note.id); notes.push(note);
  };
  if (selectedIds) {
    if (selectedIds.length > 100) throw new Error('한 번에 선택할 수 있는 일지는 100건입니다.');
    for (const id of Array.from(new Set(selectedIds))) {
      check(signal); const n = await loader.note(id,signal); check(signal);
      if (n.id !== id) throw new Error('일지 번호가 일치하지 않습니다.');
      if (query.includeDrafts === 'true' || !(n.source === 'auto-call' && n.status !== 'confirmed')) accept(n);
      progress(notes.length,++scanned);
    }
  } else {
    do {
      check(signal);
      const limit = Math.min(100,EXPORT_PART_ROWS-notes.length);
      const page = await loader.page(query,cursor,limit,signal); check(signal);
      if (page.version !== version) throw new Error(changedMessage);
      if (page.notes.length > limit) throw new Error('서버 응답이 파일 최대 건수를 초과했습니다.');
      page.notes.forEach(accept); scanned += page.scanned || page.notes.length;
      more = page.hasMore;
      if (more && (!page.nextCursor || page.nextCursor === cursor)) throw new Error('다음 조회 위치를 확인하지 못했습니다.');
      cursor = page.nextCursor || undefined; progress(notes.length,scanned);
      await new Promise(resolve => setTimeout(resolve,0));
    } while (more && notes.length < EXPORT_PART_ROWS);
  }
  check(signal);
  if (await loader.version(query,signal) !== version) throw new Error(changedMessage);
  check(signal); return {notes,nextCursor:cursor,hasMore:more};
}
