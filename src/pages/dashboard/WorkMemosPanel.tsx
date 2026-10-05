import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { WorkMemoListSchema, WorkMemoSchema, type WorkMemo } from '../../schemas';
import { authFetch, errMsg, SERVER_URL } from '../../utils/api';

export default function WorkMemosPanel() {
  const [items,setItems]=useState<WorkMemo[]>([]);
  const [text,setText]=useState('');
  const [cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const locked=useRef(false);
  const version=useRef(0);
  const load=async(more=false)=>{
    const request=++version.current;
    setLoading(true);setError('');
    try {
      const response=await authFetch(`${SERVER_URL}/work-memos${more&&cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);
      const data:unknown=await response.json();
      if(!response.ok)throw new Error(errMsg(data,'업무 메모를 불러오지 못했습니다'));
      const parsed=WorkMemoListSchema.safeParse(data);
      if(!parsed.success)throw new Error('업무 메모 응답 형식을 확인할 수 없습니다');
      if(request===version.current){setItems(previous=>more?Array.from(new Map([...previous,...parsed.data.items].map(item=>[item.id,item])).values()):parsed.data.items);setCursor(parsed.data.nextCursor)}
    }catch(e){if(request===version.current)setError(e instanceof Error?e.message:'업무 메모 조회 실패')}
    finally{if(request===version.current)setLoading(false)}
  };
  // Load once per mounted institution view; version rejects responses after unmount.
  useEffect(()=>{load();return()=>{version.current++}},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const save=async(item?:WorkMemo,remove=false)=>{
    if(locked.current)return;
    const value=text.trim();
    if(!item&&(!value||value.length>1000)){setError('메모는 1~1,000자로 입력해 주세요');return}
    locked.current=true;setBusy(true);setError('');
    try{
      const response=await authFetch(`${SERVER_URL}/work-memos${item?`/${encodeURIComponent(item.id)}`:''}`,{
        method:remove?'DELETE':item?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        ...(!remove?{body:JSON.stringify(item?{done:!item.done}:{text:value})}:{}),
      });
      const data:unknown=await response.json();
      if(!response.ok)throw new Error(errMsg(data,'업무 메모를 저장하지 못했습니다'));
      if(remove){setItems(previous=>previous.filter(memo=>memo.id!==item.id))}
      else{
        const parsed=WorkMemoSchema.safeParse(data);
        if(!parsed.success)throw new Error('업무 메모 저장 응답 형식을 확인할 수 없습니다');
        setItems(previous=>item?previous.map(memo=>memo.id===item.id?parsed.data:memo):[parsed.data,...previous]);
        if(!item)setText('');
      }
    }catch(e){setError(e instanceof Error?e.message:'업무 메모 저장 실패')}
    finally{locked.current=false;setBusy(false)}
  };
  return <section className="section casenotes-memo">
    <div className="casenotes-memo-heading"><div><div className="section-title">업무 메모</div><p>기관 구성원과 공유됩니다. 어르신 개인정보는 상담·방문 일지에 기록해 주세요.</p></div></div>
    <form className="memo-input-wrap" onSubmit={event=>{event.preventDefault();save()}}>
      <input className="memo-input" aria-label="새 업무 메모" placeholder="새 메모를 입력하세요" value={text} maxLength={1000} disabled={busy||loading} onChange={event=>setText(event.target.value)}/>
      <button className="btn-primary" type="submit" disabled={busy||loading||!text.trim()}>{busy?'저장 중…':'메모 추가'}</button>
    </form>
    {error&&<div role="alert" className="error-msg">{error}<button className="btn-secondary" disabled={busy||loading} onClick={()=>load()}>다시 조회</button></div>}
    {loading?<p role="status">업무 메모를 불러오는 중입니다…</p>:items.length?<div className="memo-list">{items.map(item=><div key={item.id} className={`memo-item ${item.done?'memo-done':''}`}>
      <button className={`todo-check ${item.done?'todo-check-on':''}`} disabled={busy} onClick={()=>save(item)} aria-label={item.done?'메모 완료 취소':'메모 완료'} aria-pressed={item.done}>{item.done&&<CheckCircle2 size={13} color="#fff" strokeWidth={3}/>}</button>
      <div className="memo-text">{item.text}</div><time className="memo-time" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ko-KR')}</time>
      <button className="memo-del" disabled={busy} aria-label="메모 삭제" onClick={()=>save(item,true)}><X size={15}/></button>
    </div>)}</div>:!error&&<p className="health-empty">등록된 업무 메모가 없습니다.</p>}
    {cursor&&<button className="btn-secondary" disabled={loading||busy} onClick={()=>load(true)}>이전 메모 더 보기</button>}
  </section>;
}
