import { useEffect, useRef, useState } from 'react';
import { HealthFollowUpSchema } from '../../schemas';
import { SERVER_URL, authFetch, errMsg } from '../../utils/api';
import { koreanDate } from '../../utils/healthPeriod';
import type { z } from 'zod';

const dateAfter = (days:number) => koreanDate(new Date(Date.now()+days*86400000));
const statusLabel:Record<string,string> = {approved:'담당자 승인됨',asked:'질문 전달 기록 있음',answered:'답변 수신 · 담당자 확인 필요',refused:'후속 확인 거절',resolved:'후속 확인 종료',cancelled:'승인 취소',canceled:'승인 취소',expired:'기한 만료',pending:'담당자 승인 대기'};
export default function HealthFollowUpControls({caseId,onChanged,canManage=false}:{caseId:string;onChanged?:(revision:number)=>void;canManage?:boolean}) {
  const [data,setData]=useState<z.infer<typeof HealthFollowUpSchema>|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [dueDate,setDueDate]=useState(()=>dateAfter(7));
  const [reason,setReason]=useState('');
  const requestRef=useRef(0);
  const savingRef=useRef(false);
  const pendingRef=useRef<{fingerprint:string;requestId:string}|null>(null);
  const invalidate=()=>{++requestRef.current;savingRef.current=false;pendingRef.current=null;};
  const load=async()=>{
    const request=++requestRef.current;
    setBusy(true);setError('');
    try {
      const r=await authFetch(`${SERVER_URL}/health/insights/${encodeURIComponent(caseId)}/follow-up`),body:unknown=await r.json();
      if(!r.ok)throw new Error(errMsg(body,'후속 확인 상태를 불러오지 못했습니다'));
      const parsed=HealthFollowUpSchema.safeParse(body);
      if(!parsed.success)throw new Error('후속 확인 응답 형식을 확인하지 못했습니다');
      if(request!==requestRef.current)return;
      setData(parsed.data);
      onChanged?.(parsed.data.revision);
    }catch(e){if(request===requestRef.current)setError(e instanceof Error?e.message:'후속 확인 상태를 불러오지 못했습니다')}
    finally{if(request===requestRef.current)setBusy(false)}
  };
  useEffect(()=>{invalidate();setData(null);setReason('');setDueDate(dateAfter(7));void load();return invalidate},[caseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=async(action:'approve'|'refuse'|'resolve'|'cancel')=>{
    if(!data||savingRef.current||busy||!canManage)return;
    if(action==='approve'&&(data.approvalAvailable!==true||!data.candidateQuestion)){setError(data.approvalBlockedReason||'승인 가능한 질문과 근거를 다시 확인해 주세요.');return}
    if(action==='approve'&&(!dueDate||dueDate<koreanDate()||dueDate>dateAfter(29))){setError('오늘을 포함한 30일 이내의 후속 확인 기한을 선택해 주세요.');return}
    if(action!=='approve'&&!reason.trim()){setError('처리 이유를 입력해 주세요.');return}
    savingRef.current=true;const request=++requestRef.current;
    const payload={action,revision:data.revision,...(action==='approve'?{expiresAt:new Date(`${dueDate}T23:59:59+09:00`).toISOString()}:{reason:reason.trim()})};
    const fingerprint=JSON.stringify([caseId,payload]);
    if(pendingRef.current?.fingerprint!==fingerprint)pendingRef.current={fingerprint,requestId:crypto.randomUUID()};
    setBusy(true);setError('');
    try {
      const r=await authFetch(`${SERVER_URL}/health/insights/${encodeURIComponent(caseId)}/follow-up`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:pendingRef.current.requestId})});
      const body:unknown=await r.json();
      if(!r.ok)throw new Error(errMsg(body,'후속 확인 설정을 저장하지 못했습니다'));
      const parsed=HealthFollowUpSchema.safeParse(body);
      if(!parsed.success)throw new Error('후속 확인 저장 응답 형식을 확인하지 못했습니다');
      if(request!==requestRef.current)return;
      pendingRef.current=null;
      setData(parsed.data);setReason('');onChanged?.(parsed.data.revision);
    }catch(e){if(request===requestRef.current)setError(e instanceof Error?e.message:'후속 확인 설정을 저장하지 못했습니다')}
    finally{if(request===requestRef.current){savingRef.current=false;setBusy(false)}}
  };
  const fu=data?.followUp;
  const canApprove=data?.approvalAvailable===true&&!!data.candidateQuestion;
  const expired=!!fu?.expiresAt&&Date.parse(fu.expiresAt)<=Date.now();
  const canFinish=!!fu&&!expired&&!['refused','resolved','cancelled','canceled','expired'].includes(fu.status);
  return <section aria-label="건강 후속 확인 설정" style={{marginTop:20,borderTop:'1px solid #e2e8f0',paddingTop:16}}>
    <h4>건강 후속 확인</h4>
    <p>{fu?(statusLabel[fu.status]||fu.status):data?'등록된 후속 확인 없음':'후속 확인 상태 조회 중…'}</p>
    <p className="health-scope-note">담당자가 다음 확인 질문과 기한을 승인합니다. 승인만으로 새 전화를 걸지는 않습니다. 실제 질문 전달·답변 수신은 아래 기록으로 확인하며, 담당자 조치 완료와 별도로 관리합니다.</p>
    {fu?.question&&<p>확인 질문: {fu.question}</p>}
    {canApprove&&<p><strong>승인할 질문: {data.candidateQuestion}</strong></p>}
    {data?.approvalBlockedReason&&<p className="health-scope-note">{data.approvalBlockedReason}</p>}
    {fu?.expiresAt&&<p>기한: {new Date(fu.expiresAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}
    {fu&&<p>질문 전달: {fu.askedAt?'기록 있음':'기록 없음'} · 답변 수신: {fu.answeredAt?'기록 있음':'기록 없음'}</p>}
    {fu?.deliveryState==='claimed'&&<p className="health-scope-note">통화에서 후속 질문을 예약했습니다. 아직 전달 완료 기록은 없습니다.</p>}
    {fu?.deliveryState==='prepared'&&<p className="health-scope-note">질문 전달을 준비했습니다. 재생 완료 확인 전에는 전달된 것으로 처리하지 않습니다.</p>}
    {fu?.deliveryState==='expired'&&!fu.askedAt&&<p role="status">질문 전달 확인 기한이 지났습니다. 자동으로 다시 질문하지 않습니다. 통화 기록을 확인한 뒤 필요하면 승인 취소 후 다시 승인해 주세요.</p>}
    {error&&<p role="alert">{error} <button type="button" className="btn-secondary" disabled={busy} onClick={load}>상태 다시 조회</button></p>}
    {data&&!canManage&&<p className="health-scope-note">후속 질문 승인·변경은 담당자 권한이 필요합니다.</p>}
    {data&&canManage&&<div style={{display:'grid',gap:10}}>
      <label>후속 확인 기한 (한국시간)<input type="date" value={dueDate} min={koreanDate()} max={dateAfter(29)} disabled={busy||!canApprove} onChange={e=>setDueDate(e.target.value)}/></label>
      <button type="button" className="btn-secondary" disabled={busy||!canApprove} onClick={()=>save('approve')}>후속 확인 승인</button>
      <label>후속 처리 이유<textarea rows={2} value={reason} maxLength={500} disabled={busy} onChange={e=>setReason(e.target.value)} placeholder="거절·종료·승인 취소 시 필수"/></label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{([['refuse','후속 확인 거절'],['resolve','후속 확인 종료'],['cancel','승인 취소']] as const).map(([action,label])=><button key={action} type="button" className="btn-secondary" style={{minHeight:44}} disabled={busy||!canFinish} onClick={()=>save(action)}>{label}</button>)}</div>
    </div>}
  </section>;
}
