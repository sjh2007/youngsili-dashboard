import {useEffect,useRef,useState} from 'react';
import {HealthCaseNoteLinkSchema} from '../../schemas';
import {authFetch,SERVER_URL,errMsg} from '../../utils/api';

export default function HealthCaseNoteLink({caseId,revision,onChanged,onOpenNote}:{caseId:string;revision:number;onChanged:(revision:number)=>void;onOpenNote?:(note:{id:string})=>void}) {
  const [link,setLink]=useState<{noteId:string|null;revision:number}|null>(null);
  const [content,setContent]=useState('');
  const [action,setAction]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const sequence=useRef(0),locked=useRef(false);
  const pending=useRef<{fingerprint:string;requestId:string}|null>(null);
  const invalidate=()=>{++sequence.current;};
  const load=async()=>{
    const seq=++sequence.current;setBusy(true);setError('');
    try{
      const r=await authFetch(`${SERVER_URL}/health/insights/${encodeURIComponent(caseId)}/case-note`);
      const body:unknown=await r.json();
      if(!r.ok)throw new Error(errMsg(body,'연결된 일지를 불러오지 못했습니다.'));
      const parsed=HealthCaseNoteLinkSchema.safeParse(body);
      if(!parsed.success)throw new Error('일지 연결 응답을 확인하지 못했습니다.');
      if(seq!==sequence.current)return;
      setLink({noteId:parsed.data.noteId??null,revision:parsed.data.revision});onChanged(parsed.data.revision);
    }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'일지 조회 실패');}
    finally{if(seq===sequence.current)setBusy(false);}
  };
  useEffect(()=>{
    setLink(null);setContent('');setAction('');pending.current=null;locked.current=false;void load();
    return invalidate;
  },[caseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=async()=>{
    if(locked.current||busy||!link||link.noteId)return;
    if(!content.trim()){setError('실제로 확인한 상담·방문 내용을 입력해 주세요.');return;}
    locked.current=true;const seq=++sequence.current;setBusy(true);setError('');
    const payload={revision:Math.max(revision,link.revision),content:content.trim(),action:action.trim()};
    const fingerprint=JSON.stringify([caseId,payload]);
    if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,requestId:crypto.randomUUID()};
    try{
      const r=await authFetch(`${SERVER_URL}/health/insights/${encodeURIComponent(caseId)}/case-note`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:pending.current.requestId})});
      const body:unknown=await r.json();
      if(!r.ok)throw new Error(errMsg(body,'일지를 저장하지 못했습니다.'));
      const parsed=HealthCaseNoteLinkSchema.safeParse(body);
      if(!parsed.success||!parsed.data.noteId)throw new Error('저장된 일지를 확인하지 못했습니다. 상태를 다시 조회해 주세요.');
      if(seq!==sequence.current)return;
      pending.current=null;setLink({noteId:parsed.data.noteId??null,revision:parsed.data.revision});onChanged(parsed.data.revision);
    }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'일지 저장 실패');}
    finally{if(seq===sequence.current){locked.current=false;setBusy(false);}}
  };
  return <section aria-label="건강 확인 일지 연결" style={{marginTop:20,borderTop:'1px solid #e2e8f0',paddingTop:16}}>
    <h4>상담·방문 일지 연결</h4>
    <p className="health-scope-note">담당자가 실제 확인한 내용을 기록하세요. 일지 저장만으로 건강 확인 건이 조치 완료되지는 않습니다.</p>
    {error&&<p role="alert">{error}</p>}
    <button type="button" className="btn-secondary" disabled={busy} onClick={load}>일지 연결 상태 새로고침</button>
    {!link&&<p>{busy?'일지 연결 조회 중…':'일지 연결 상태를 확인해 주세요.'}</p>}
    {link?.noteId?<div><p role="status">저장된 일지가 연결되어 있습니다.</p><button type="button" className="btn-secondary" disabled={busy||!onOpenNote} onClick={()=>onOpenNote?.({id:link.noteId!})}>연결된 일지 열기</button><p className="health-scope-note">일지 화면에서 수정·다운로드·인쇄할 수 있습니다.</p></div>:link&&<div style={{display:'grid',gap:10,marginTop:12}}>
      <label>상담·방문 내용<textarea rows={4} maxLength={5000} value={content} disabled={busy} onChange={e=>setContent(e.target.value)} /></label>
      <label>조치 내용 (선택)<textarea rows={2} maxLength={2000} value={action} disabled={busy} onChange={e=>setAction(e.target.value)} /></label>
      <button type="button" className="btn-secondary" disabled={busy} onClick={save}>{busy?'저장 중…':'일지 저장·연결'}</button>
    </div>}
  </section>;
}
