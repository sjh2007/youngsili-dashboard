export interface PrintableCaseNote {
  id: string;
  elderName?: string; elderPhone?: string; type?: string; category?: string;
  visitedAt?: string; source?: string; status?: string; authorEmail?: string;
  confirmedBy?: string; confirmedAt?: string; content?: string; action?: string;
  followUp?: { needed?: boolean; done?: boolean; dueDate?: string; note?: string };
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function noteDateKst(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const timeKst = (value?: string) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '기록 없음';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
};

/** Call synchronously from the click event, before awaiting a save request. */
export function reserveNotePrintWindow(): Window {
  const target = window.open('', '_blank');
  if (!target) throw new Error('인쇄 창이 차단되었습니다. 브라우저의 팝업을 허용한 후 다시 시도해 주세요.');
  target.opener = null;
  target.document.title = '일지 저장 확인 중';
  target.document.body.textContent = '일지 저장을 확인하고 있습니다. 저장 완료 후 인쇄 화면이 표시됩니다.';
  return target;
}

/** Only pass a persisted note returned by the server or loaded from the saved list. */
export function printSavedCaseNote(note: PrintableCaseNote, targetWindow?: Window): void {
  if (!note?.id) throw new Error('저장된 일지를 확인한 후 인쇄해 주세요.');
  const target = targetWindow || reserveNotePrintWindow();
  if (target.closed) throw new Error('인쇄 창이 닫혔습니다. 저장된 일지에서 다시 인쇄해 주세요.');
  const draft = note.source === 'auto-call' && note.status !== 'confirmed';
  const types = { visit: '가정방문', phone: '전화상담', office: '내소상담', guardian: '보호자상담', etc: '기타' };
  const categories = { health: '건강', safety: '안전', meal: '식사', emotional: '정서', welfare: '복지연계', etc: '기타' };
  const row = (label: string, value: unknown) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || '기록 없음')}</td></tr>`;
  const section = (label: string, value: unknown) => `<section><h2>${escapeHtml(label)}</h2><div class="content">${escapeHtml(value || '기록 없음')}</div></section>`;
  target.document.open();
  target.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>상담·방문 일지</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px/1.7 sans-serif;color:#0f172a;margin:24px auto;max-width:760px;padding:0 16px}h1{font-size:24px}h2{font-size:16px;margin-bottom:8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;overflow-wrap:anywhere}th{width:140px;background:#f4f6f8}section{margin-top:22px}.content{white-space:pre-wrap;overflow-wrap:anywhere}button{min-height:44px;padding:10px 18px;border:0;border-radius:8px;background:#246beb;color:white;font-weight:700;cursor:pointer}.toolbar{padding:14px;background:#eff6ff;margin-bottom:20px}.status{font-weight:700}.footer{margin-top:24px;font-size:12px;color:#475569;overflow-wrap:anywhere}@media print{body{margin:0;max-width:none;padding:0}.toolbar{display:none}h2{break-after:avoid}tr{break-inside:avoid}}
    </style></head><body><div class="toolbar"><button id="print-note" type="button">인쇄 / PDF 저장</button><p>인쇄 창의 대상에서 ‘PDF로 저장’을 선택할 수 있습니다. 파일 저장 여부는 브라우저에서 확인해 주세요.</p></div><h1>상담·방문 일지</h1><p class="status">${draft ? '자동기록 초안 · 담당자 확인 필요' : '확인 완료 일지'}</p><table>${row('어르신', note.elderName)}${row('상담 유형', types[note.type] || '기타')}${row('주제', categories[note.category] || note.category)}${row('상담 일시 (한국시간)', timeKst(note.visitedAt))}${row('작성 담당자', note.authorEmail)}${row('확인 담당자', draft ? '미확인' : note.confirmedBy || note.authorEmail)}${row('확인 시각 (한국시간)', draft ? '미확인' : timeKst(note.confirmedAt))}</table>${section('상담·방문 내용', note.content)}${section('조치 내용', note.action)}${section('후속 조치', note.followUp?.needed ? `${note.followUp.done ? '완료' : '진행 필요'}${note.followUp.dueDate ? ` · 예정일 ${note.followUp.dueDate}` : ''}${note.followUp.note ? `\n${note.followUp.note}` : ''}` : '없음')}<p class="footer">일지 ID: ${escapeHtml(note.id)}</p></body></html>`);
  target.document.close();
  target.document.getElementById('print-note')?.addEventListener('click', () => target.print());
}
