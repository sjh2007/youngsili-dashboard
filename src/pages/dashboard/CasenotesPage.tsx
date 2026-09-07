// DashboardApplication.tsx의 page==='casenotes'(상담·방문 일지) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-07).
import { Search, X, CheckCircle2, PencilLine } from 'lucide-react';

export default function CasenotesPage(props: any) {
  const {
    T, caseSearch, setCaseSearch, openSchedule, openWeeklyReport, exportNotesXlsx, caseNotes,
    openNewNote, caseType, setCaseType, caseFollowUpOnly, setCaseFollowUpOnly, memoText, setMemoText,
    memos, setMemos, isAutoDraft, caseLoading, nameByPhone, CASE_TYPE_META, selectedNotes,
    setSelectedNotes, deleteSelectedNotes, expandedNoteDays, setExpandedNoteDays, formatDateHeader,
    toggleNoteSel, copyNote, copiedNoteId, openEditNote, deleteNote, CASE_CAT_META, CASE_TOPIC_META,
    AutoDraftBadge,
  } = props;

  return (
    <div className="fade-in casenotes-page">
      <div className="casenotes-toolbar">
        <div className="casenotes-toolbar-main">
          <div className="search-box casenotes-search"><Search size={19} aria-hidden="true"/><input className="search-input" placeholder={`${T.elder} 이름으로 검색`} value={caseSearch} onChange={e=>setCaseSearch(e.target.value)}/>{caseSearch&&<button className="search-clear" onClick={()=>setCaseSearch('')} aria-label="검색어 지우기"><X size={16}/></button>}</div>
          <div className="casenotes-actions">
            <button className="btn-secondary" onClick={openSchedule} title="이용자별 월 급여제공 일정표 — 날짜별 제공시간 입력·저장 후 공식 달력 양식으로 인쇄(PDF)">급여제공 일정표</button>
            <button className="btn-secondary" onClick={openWeeklyReport} title="공식 양식(1~5주차·사회/신체/가사/기타)에 이번 달 일지를 자동으로 채워 인쇄(PDF)합니다">주간업무 보고서</button>
            <button className="btn-secondary" onClick={()=>exportNotesXlsx(caseNotes)} title="일지 전체(최근 90일)를 엑셀로 다운로드 — 기관 보관·결재용">엑셀</button>
            <button className="btn-primary" onClick={()=>openNewNote()}><PencilLine size={17}/> 새 일지</button>
          </div>
        </div>
        <div className="casenotes-filter-row">
          <span className="casenotes-filter-label">상담 유형</span>
          {[['all','전체'],['visit','방문'],['phone','전화'],['office','내소'],['guardian','보호자'],['etc','기타']].map(([v,l])=>(
            <button key={v} className={`smart-btn ${caseType===v?'smart-active':''}`} onClick={()=>setCaseType(v)}>{l}</button>
          ))}
          <span className="casenotes-filter-divider"/>
          <button className={`smart-btn casenotes-followup ${caseFollowUpOnly?'is-active':''}`} onClick={()=>setCaseFollowUpOnly(v=>!v)}>후속 필요{caseFollowUpOnly?' · 해제':''}</button>
          <span className="casenotes-sync">15초마다 자동 갱신</span>
        </div>
      </div>

      <section className="section casenotes-memo">
        <div className="casenotes-memo-heading"><div><div className="section-title">업무 메모</div><p>상담이나 방문 전에 확인할 내용을 간단히 기록하세요.</p></div></div>
        <div className="memo-input-wrap">
          <input className="memo-input" placeholder="새 메모를 입력하세요" value={memoText} onChange={e=>setMemoText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&memoText.trim()){const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});setMemos(prev=>[{id:Date.now(),text:memoText.trim(),time:now,done:false},...prev]);setMemoText('');}}}/>
          <button className="btn-primary" onClick={()=>{if(!memoText.trim())return;const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});setMemos(prev=>[{id:Date.now(),text:memoText.trim(),time:now,done:false},...prev]);setMemoText('');}}>메모 추가</button>
        </div>
        {memos.length>0 && <div className="memo-list">
          {memos.map(memo=><div key={memo.id} className={`memo-item ${memo.done?'memo-done':''}`}>
            <button className={`todo-check ${memo.done?'todo-check-on':''}`} onClick={()=>setMemos(prev=>prev.map(m=>m.id===memo.id?{...m,done:!m.done}:m))} aria-label="메모 완료">{memo.done&&<CheckCircle2 size={13} color="#fff" strokeWidth={3}/>}</button>
            <div className="memo-text">{memo.text}</div><div className="memo-time">{memo.time}</div>
            <button className="memo-del" aria-label="메모 삭제" onClick={()=>setMemos(prev=>prev.filter(m=>m.id!==memo.id))}><X size={15}/></button>
          </div>)}
        </div>}
      </section>
      {(()=>{
        const ym=new Date().toISOString().slice(0,7);
        const tm=caseNotes.filter(n=>(n.visitedAt||'').slice(0,7)===ym);
        // 실적 집계는 담당자가 확인한 일지만 센다 — 자동기록 초안이 방문·상담 실적으로 잡히면 안 된다
        const done=tm.filter(n=>!isAutoDraft(n));
        const stat=[
          {label:'이번달 가정방문',value:done.filter(n=>n.type==='visit').length,color:'#246BEB'},
          {label:'이번달 전화상담',value:done.filter(n=>n.type==='phone').length,color:'#16a34a'},
          {label:'이번달 전체 상담',value:done.length,color:'#7c3aed'},
          {label:'미처리 후속',value:caseNotes.filter(n=>n.followUp&&n.followUp.needed&&!n.followUp.done).length,color:'#f59e0b'},
          {label:'확인 필요(자동기록)',value:caseNotes.filter(isAutoDraft).length,color:'#b45309'},
        ];
        return (
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
            {stat.map((s,i)=>(
              <div key={i} style={{flex:'1 1 140px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px'}}>
                <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
                <div style={{fontSize:16,color:'#64748b',marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>
        );
      })()}
      {caseLoading ? (
        <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>불러오는 중...</div>
      ) : (()=>{
        const filtered=caseNotes.filter(n=>
          (caseType==='all'||n.type===caseType) &&
          (!caseSearch||(nameByPhone(n.elderPhone,n.elderName)||'').includes(caseSearch)) &&
          (!caseFollowUpOnly||(n.followUp&&n.followUp.needed&&!n.followUp.done))
        );
        if(filtered.length===0) {
          if(caseNotes.length===0) return <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>아직 작성된 상담·방문 일지가 없습니다. ＋ 새 일지로 첫 기록을 남겨보세요.</div>;
          const active=[caseFollowUpOnly&&'후속 필요', caseType!=='all'&&`유형: ${(CASE_TYPE_META[caseType]||{}).label||caseType}`, caseSearch&&`검색: "${caseSearch}"`].filter(Boolean);
          return (
            <div style={{padding:'30px',textAlign:'center',color:'#64748b'}}>
              <div style={{fontSize:17,fontWeight:600}}>선택한 필터에 맞는 일지가 없습니다.</div>
              {active.length>0 && <div style={{fontSize:16,color:'#94a3b8',marginTop:6}}>적용 중인 필터 — {active.join(' · ')}</div>}
              <div style={{fontSize:16,color:'#94a3b8',marginTop:2}}>전체 {caseNotes.length}건이 있어요. 필터를 끄면 모두 표시됩니다.</div>
              <button onClick={()=>{setCaseType('all');setCaseSearch('');setCaseFollowUpOnly(false);}} style={{marginTop:14,background:'#246BEB',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:17,fontWeight:700,cursor:'pointer'}}>↺ 필터 초기화</button>
            </div>
          );
        }
        const groups: Record<string, any[]>={};
        filtered.forEach(n=>{ const dk=(n.visitedAt||'').slice(0,10)||'미상'; (groups[dk]=groups[dk]||[]).push(n); });
        const allSel=filtered.every(n=>selectedNotes.has(n.id));
        const selectAll=()=>setSelectedNotes(prev=>{const s=new Set(prev); if(allSel) filtered.forEach(n=>s.delete(n.id)); else filtered.forEach(n=>s.add(n.id)); return s;});
        return (<>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:16,fontWeight:600,color:'#334155',cursor:'pointer'}}>
              <input type="checkbox" checked={allSel} onChange={selectAll}/> 전체 선택
            </label>
            {selectedNotes.size>0 && (<>
              <span style={{fontSize:16,color:'#246BEB',fontWeight:700}}>{selectedNotes.size}건 선택됨</span>
              <button onClick={deleteSelectedNotes} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:16,fontWeight:700,cursor:'pointer'}}>선택 삭제</button>
              <button onClick={()=>setSelectedNotes(new Set())} style={{background:'#fff',color:'#64748b',border:'1px solid #d1d5db',borderRadius:8,padding:'6px 12px',fontSize:16,fontWeight:600,cursor:'pointer'}}>선택 해제</button>
            </>)}
          </div>
          {Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>{
          const open=expandedNoteDays.has(date);
          const shown=open?rows:rows.slice(0,3);
          return (
            <div key={date} style={{marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:17,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:16}}>· {rows.length}건</span></div>
              {shown.map(n=>{
                const tmeta=CASE_TYPE_META[n.type]||CASE_TYPE_META.etc;
                const time=n.visitedAt?new Date(n.visitedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                const fu=n.followUp&&n.followUp.needed&&!n.followUp.done;
                const sel=selectedNotes.has(n.id);
                return (
                  <div key={n.id} style={{border:'1px solid '+(sel?'#93c5fd':'#e2e8f0'),borderRadius:10,padding:'12px 14px',marginBottom:8,background:sel?'#eff6ff':'#fff'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                      <input type="checkbox" checked={sel} onChange={()=>toggleNoteSel(n.id)} style={{width:16,height:16,cursor:'pointer',flexShrink:0}}/>
                      <span style={{minWidth:44,color:'#64748b',fontSize:16,fontWeight:600}}>{time}</span>
                      <span style={{fontSize:15,fontWeight:700,color:tmeta.color,background:tmeta.bg,padding:'2px 8px',borderRadius:20}}>{tmeta.label}</span>
                      <span style={{fontWeight:700,fontSize:17}}>{nameByPhone(n.elderPhone,n.elderName)}</span>
                      <span style={{fontSize:15,color:'#64748b'}}>· {CASE_CAT_META[n.category]||'기타'}</span>
                      {(n.topics||[]).length>0 && <span style={{fontSize:15,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:12,padding:'2px 8px'}}>{(n.topics||[]).map(t=>CASE_TOPIC_META[t]).filter(Boolean).join('·')}</span>}
                      {n.linkedAlertId&&<span style={{fontSize:14,color:'#dc2626',fontWeight:700}}>알림 대응</span>}
                      {isAutoDraft(n)&&<AutoDraftBadge/>}
                      {fu&&<span style={{fontSize:14,color:'#f59e0b',fontWeight:700}}>후속{n.followUp.dueDate?` ~${n.followUp.dueDate}`:''}</span>}
                      <span style={{flex:1}}/>
                      <button onClick={()=>copyNote(n, n.id)} style={{background:'none',border:'none',color:'#16a34a',fontSize:15,fontWeight:700,cursor:'pointer'}} title="붙여넣기용 텍스트 복사">{copiedNoteId===n.id?'복사됨':'복사'}</button>
                      <button onClick={()=>openEditNote(n)} style={{background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer'}}>수정</button>
                      <button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:15,fontWeight:700,cursor:'pointer'}}>삭제</button>
                    </div>
                    {n.content&&<div style={{fontSize:16,color:'#1f2937',marginTop:6,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.content}</div>}
                    {n.action&&<div style={{fontSize:16,color:'#475569',marginTop:5,lineHeight:1.5}}><b style={{color:'#0f766e'}}>조치</b> {n.action}</div>}
                    {n.authorEmail&&<div style={{fontSize:14,color:'#94a3b8',marginTop:6}}>작성: {n.authorEmail}</div>}
                  </div>
                );
              })}
              {rows.length>3 && (
                <button onClick={()=>setExpandedNoteDays(prev=>{const s=new Set(prev); s.has(date)?s.delete(date):s.add(date); return s;})} style={{background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer',padding:'2px 0'}}>
                  {open?'접기 ▴':`${rows.length-3}건 더 보기 ▾`}
                </button>
              )}
            </div>
          );
        })}
        </>);
      })()}
    </div>
  );
}
