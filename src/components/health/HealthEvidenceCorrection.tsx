import { useState } from 'react';
import type { HealthInsightDetail } from '../../schemas';

export default function HealthEvidenceCorrection({ detail, busy, onSave }: {
  detail: HealthInsightDetail; busy: boolean;
  onSave: (state: 'corrected'|'dismissed', observationIds: string[], reason: string) => Promise<boolean>;
}) {
  const [open,setOpen] = useState(false);
  const [selected,setSelected] = useState<string[]>([]);
  const [reason,setReason] = useState('');
  const [state,setState] = useState<'corrected'|'dismissed'>('corrected');
  const [error,setError] = useState('');
  const evidence = Array.from(new Map(detail.evidence.filter(e => e.observationId && !['invalid','excluded'].includes(e.validationStatus)).map(e => [e.observationId,e])).values());
  if (!evidence.length) return null;
  const submit = async(event: React.FormEvent) => {
    event.preventDefault();
    if (!selected.length) { setError('정정하거나 제외할 근거를 선택해 주세요.'); return; }
    if (!reason.trim()) { setError('근거를 정정·제외하는 이유를 입력해 주세요.'); return; }
    setError('');
    if (await onSave(state,selected,reason.trim())) { setOpen(false);setSelected([]);setReason(''); }
  };
  return <section style={{marginTop:16}} aria-label="관찰 근거 정정·제외">
    <button type="button" className="btn-secondary" disabled={busy} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>근거 정정·제외</button>
    {open&&<form onSubmit={submit} style={{display:'grid',gap:12,marginTop:12}}>
      <p>잘못 해석한 관찰 근거만 선택해 분석 집계에서 제외합니다. 통화 원문은 보존되며, 남은 유효 근거가 있으면 담당자 확인 건은 유지됩니다. 건강 회복이나 조치 완료를 뜻하지 않습니다.</p>
      <fieldset disabled={busy}><legend>정정·제외할 원문 근거 선택 (필수)</legend>{evidence.map(e=><label key={e.observationId} style={{display:'flex',gap:8,alignItems:'start',minHeight:44,padding:'8px 0'}}><input type="checkbox" checked={selected.includes(e.observationId)} onChange={event=>setSelected(ids=>event.target.checked?[...ids,e.observationId]:ids.filter(id=>id!==e.observationId))}/><span>{e.excerpt}<small style={{display:'block'}}>원문 {e.line}번째 줄 · {new Date(e.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</small></span></label>)}</fieldset>
      <label>처리 구분<select disabled={busy} value={state} onChange={event=>setState(event.target.value as 'corrected'|'dismissed')}><option value="corrected">오류 해석 정정 — 선택 근거 제외</option><option value="dismissed">검토 대상에서 제외 — 선택 근거 제외</option></select></label>
      <label>정정·제외 이유 (필수)<textarea disabled={busy} value={reason} maxLength={500} rows={3} onChange={event=>setReason(event.target.value)} placeholder="예: 타인의 과거 이야기가 본인의 현재 불편으로 해석됨"/></label>
      {error&&<p role="alert">{error}</p>}
      <div><button type="submit" className="btn-primary" disabled={busy} style={{minHeight:44}}>선택 근거 정정·제외 저장</button> <button type="button" className="btn-secondary" disabled={busy} onClick={()=>setOpen(false)}>취소</button></div>
    </form>}
  </section>;
}
