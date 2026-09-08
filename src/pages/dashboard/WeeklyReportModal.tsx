// DashboardApplication.tsx의 weeklyModal(주간업무 보고서) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
export default function WeeklyReportModal(props: any) {
  const {
    setWeeklyModal, setWeeklyDoc, weeklyModal, elders, loadWeekly, weeklyDoc, winWide, isStaffUp,
    accounts, weeklyAll, printWeeklyBatch, printWeeklyReport, saveWeekly, CASE_TOPIC_META,
  } = props;

  return (
    <div className="modal-overlay" onClick={()=>{setWeeklyModal(null);setWeeklyDoc(null);}}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:winWide?1020:640,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
        <h3 style={{margin:'0 0 6px'}}>주간업무 보고서 — 확인·수정·출력</h3>
        <div style={{fontSize:16,color:'#64748b',marginBottom:12}}>지원사가 앱에서 주차별로 작성(음성→텍스트)한 내용입니다. 오타를 고치고 지시사항을 적은 뒤 저장·출력하세요.</div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <select className="form-input" style={{flex:1,margin:0}} value={weeklyModal.phone} onChange={e=>{const p=e.target.value;setWeeklyModal(f=>({...f,phone:p}));loadWeekly(p,weeklyModal.ym);}}>
            {elders.map(e=>(<option key={e.id} value={String(e.phone||'').replace(/\D/g,'')}>{e.name} ({e.phone})</option>))}
          </select>
          <input type="month" className="form-input" style={{width:150,margin:0}} value={weeklyModal.ym} onChange={e=>{const ym=e.target.value;setWeeklyModal(f=>({...f,ym}));loadWeekly(weeklyModal.phone,ym);}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          <input className="form-input" style={{margin:0}} placeholder="급여종류" value={weeklyModal.benefit} onChange={e=>setWeeklyModal(f=>({...f,benefit:e.target.value}))}/>
          <input className="form-input" style={{margin:0}} placeholder="이용자 생년월일" value={(weeklyDoc&&weeklyDoc.birth)||''} onChange={e=>setWeeklyDoc(f=>({...f,birth:e.target.value}))}/>
          <input className="form-input" style={{margin:0}} placeholder="지원사 성명" value={(weeklyDoc&&weeklyDoc.workerName)||''} onChange={e=>setWeeklyDoc(f=>({...f,workerName:e.target.value}))}/>
        </div>
        {(!weeklyDoc || !weeklyDoc.loaded) ? (
          <div style={{textAlign:'center',color:'#94a3b8',padding:24}}>불러오는 중…</div>
        ) : (
          <>
            {/* PC(와이드): 주차 2열 그리드로 모니터 폭 활용 (5주차는 전체 폭), 모바일: 세로 1열 */}
            <div style={{display:'grid',gridTemplateColumns:winWide?'1fr 1fr':'1fr',gap:10,marginBottom:10}}>
            {[1,2,3,4,5].map(i=>{
              const w = weeklyDoc.weeks[i] || { content:'', topics:[] };
              const setW = (patch)=>setWeeklyDoc(f=>({...f,weeks:{...f.weeks,[i]:{...(f.weeks[i]||{content:'',topics:[]}),...patch, _fromNotes:false}}}));
              return (
              <div key={i} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',background:w._fromNotes?'#fffbeb':'#fff',...(winWide&&i===5?{gridColumn:'1 / -1'}:{})}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
                  <span style={{fontWeight:900,color:'#1e3a6e'}}>{i}주차</span>
                  {w._fromNotes && <span style={{fontSize:15,fontWeight:700,color:'#b45309',background:'#fef3c7',padding:'2px 8px',borderRadius:12}}>상담일지에서 자동 채움 — 저장 시 확정</span>}
                  <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
                    {Object.entries(CASE_TOPIC_META).map(([k,l]: [string, any])=>(
                      <label key={k} style={{display:'flex',alignItems:'center',gap:4,fontSize:16,fontWeight:600,cursor:'pointer'}}>
                        <input type="checkbox" checked={(w.topics||[]).includes(k)}
                          onChange={e=>setW({topics:e.target.checked?[...(w.topics||[]),k]:(w.topics||[]).filter(t=>t!==k)})}/>
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
                <textarea className="form-input" style={{width:'100%',minHeight:winWide?96:64,margin:0,fontSize:16,lineHeight:1.5}} value={w.content}
                  placeholder="이 주차 업무내용·특이사항 (지원사 앱에서 녹음하면 자동으로 채워집니다)"
                  onChange={e=>setW({content:e.target.value})}/>
              </div>
              );
            })}
            </div>
            <div style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',marginBottom:12}}>
              <div style={{fontWeight:900,color:'#1e3a6e',marginBottom:6}}>전담인력 지시사항</div>
              <textarea className="form-input" style={{width:'100%',minHeight:48,margin:0,fontSize:16}} value={weeklyDoc.note}
                placeholder="검토 후 지원사에게 전달할 지시사항" onChange={e=>setWeeklyDoc(f=>({...f,note:e.target.value}))}/>
            </div>
          </>
        )}
        {isStaffUp && (()=>{
          const authorName = (em)=>{ const a=accounts.find(u=>u.email===em); return (a&&a.name)?`${a.name} (${em.split('@')[0]})`:em; };
          const authors = [...new Set(weeklyAll.map(w=>w.authorEmail).filter(Boolean))];
          return (
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'8px 10px'}}>
            <select className="form-input" style={{flex:1,margin:0}} value={weeklyModal.author} onChange={e=>setWeeklyModal(f=>({...f,author:e.target.value}))}>
              <option value="">전체 작성자</option>
              {authors.map((em: any)=>(<option key={em} value={em}>{authorName(em)}</option>))}
            </select>
            <button className="btn-secondary" style={{whiteSpace:'nowrap'}} onClick={printWeeklyBatch} title="그 달에 저장된 보고서 전체를 한 번에 — PDF 한 파일">일괄 출력</button>
          </div>
          );
        })()}
        <div className="modal-btns" style={{justifyContent:'flex-end',gap:8}}>
          <button className="btn-secondary" onClick={()=>{setWeeklyModal(null);setWeeklyDoc(null);}}>닫기</button>
          <button className="btn-secondary" onClick={printWeeklyReport}>양식 출력</button>
          <button className="btn-primary" onClick={saveWeekly} disabled={!!(weeklyDoc&&weeklyDoc.saving)}>{weeklyDoc&&weeklyDoc.saving?'저장 중…':'파일로 저장'}</button>
        </div>
      </div>
    </div>
  );
}
