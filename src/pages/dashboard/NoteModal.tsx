// DashboardApplication.tsx의 noteModal(상담·방문 일지 작성/수정) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { type CSSProperties } from 'react';

export default function NoteModal(props: any) {
  const {
    noteModal, noteForm, setNoteModal, setNoteForm, elders, CASE_TYPE_META, CASE_CAT_META,
    CASE_TOPIC_META, TIME_OPTS, fmtTimeK, copyNote, copiedNoteId, saveNote, noteSaving,
  } = props;

  const L: CSSProperties={display:'block',fontSize:16,fontWeight:700,color:'#334155',marginBottom:5,textAlign:'left'};
  const I: CSSProperties={width:'100%',display:'block',boxSizing:'border-box',margin:0};
  const close=()=>{setNoteModal(null);setNoteForm(null);};

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600,width:'94%',textAlign:'left'}}>
        <div className="modal-title" style={{textAlign:'left',marginBottom:noteForm.autoDraft?10:18}}>{noteForm.id?'상담·방문 일지 수정':'새 상담·방문 일지'}</div>
        {noteForm.autoDraft && (
          <div style={{fontSize:16,color:'#b45309',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:10,padding:'10px 12px',marginBottom:16,lineHeight:1.5}}>
            통화 내용으로 <b>자동 작성된 초안</b>입니다. 내용을 확인·수정한 뒤 저장하면 <b>내 이름으로 확정</b>됩니다.
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:15,maxHeight:'66vh',overflowY:'auto',paddingRight:4}}>
          <div>
            <label style={L}>어르신</label>
            <select className="form-input" style={I} value={noteForm.elderPhone} onChange={e=>{const el=elders.find(x=>String(x.phone)===e.target.value); setNoteForm(f=>({...f,elderPhone:e.target.value,elderName:el?el.name:''}));}}>
              <option value="">— 어르신 선택 —</option>
              {elders.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(e=>(<option key={e.id||e.phone} value={e.phone}>{e.name} ({e.phone})</option>))}
            </select>
          </div>
          <div>
            <label style={L}>상담 유형</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {Object.entries(CASE_TYPE_META).map(([k,m]: [string, any])=>(
                <button key={k} type="button" onClick={()=>setNoteForm(f=>({...f,type:k}))} style={{fontSize:16,padding:'7px 13px',borderRadius:20,cursor:'pointer',fontWeight:600,border:'1px solid '+(noteForm.type===k?m.color:'#d1d5db'),background:noteForm.type===k?m.bg:'#fff',color:noteForm.type===k?m.color:'#374151'}}>{m.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={L}>주제</label>
            <select className="form-input" style={I} value={noteForm.category} onChange={e=>setNoteForm(f=>({...f,category:e.target.value}))}>
              {Object.entries(CASE_CAT_META).map(([k,l]: [string, any])=>(<option key={k} value={k}>{l}</option>))}
            </select>
          </div>
          <div>
            <label style={L}>업무 구분 <span style={{fontWeight:500,color:'#94a3b8'}}>(주간업무 보고서 체크란 — 복수 선택)</span></label>
            <div style={{display:'flex',gap:14,flexWrap:'wrap',padding:'6px 2px'}}>
              {Object.entries(CASE_TOPIC_META).map(([k,l]: [string, any])=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:17,fontWeight:600,color:'#374151',cursor:'pointer'}}>
                  <input type="checkbox" checked={(noteForm.topics||[]).includes(k)}
                    onChange={e=>setNoteForm(f=>({...f,topics:e.target.checked?[...(f.topics||[]),k]:(f.topics||[]).filter(t=>t!==k)}))}/>
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={L}>상담 일시</label>
            <div style={{display:'flex',gap:8}}>
              <input type="date" className="form-input" style={{...I,flex:'3 1 0'}} value={noteForm.visitedDate} onChange={e=>setNoteForm(f=>({...f,visitedDate:e.target.value}))}/>
              <select className="form-input" style={{...I,flex:'2 1 0'}} value={noteForm.visitedTime} onChange={e=>setNoteForm(f=>({...f,visitedTime:e.target.value}))}>
                {(TIME_OPTS.includes(noteForm.visitedTime)?TIME_OPTS:[...TIME_OPTS,noteForm.visitedTime].sort()).map(t=>(<option key={t} value={t}>{fmtTimeK(t)}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label style={L}>상담·방문 내용</label>
            <textarea className="form-input" style={{...I,resize:'vertical'}} rows={4} placeholder="예: 가정방문. 혈압약 잘 복용 중. 무릎 통증 호소하여..." value={noteForm.content} onChange={e=>setNoteForm(f=>({...f,content:e.target.value}))}/>
          </div>
          <div>
            <label style={L}>조치사항 <span style={{color:'#94a3b8',fontWeight:400}}>(선택)</span></label>
            <textarea className="form-input" style={{...I,resize:'vertical'}} rows={2} placeholder="예: 보건소 방문 안내, 밑반찬 지원 연계" value={noteForm.action} onChange={e=>setNoteForm(f=>({...f,action:e.target.value}))}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',paddingTop:2}}>
            <label style={{fontSize:16,fontWeight:700,color:'#334155',display:'flex',alignItems:'center',gap:7,cursor:'pointer',margin:0}}>
              <input type="checkbox" checked={noteForm.followUpNeeded} onChange={e=>setNoteForm(f=>({...f,followUpNeeded:e.target.checked}))} style={{width:16,height:16}}/> 후속조치 필요
            </label>
            {noteForm.followUpNeeded && <input type="date" className="form-input" style={{width:180,margin:0}} value={noteForm.followUpDue} onChange={e=>setNoteForm(f=>({...f,followUpDue:e.target.value}))}/>}
          </div>
        </div>
        <div className="modal-btns" style={{marginTop:20,justifyContent:'flex-end'}}>
          <button className="btn-secondary" onClick={close}>취소</button>
          <button className="btn-secondary" onClick={()=>copyNote({elderName:noteForm.elderName,type:noteForm.type,category:noteForm.category,content:noteForm.content,action:noteForm.action,visitedAt:(noteForm.visitedDate&&noteForm.visitedTime)?`${noteForm.visitedDate}T${noteForm.visitedTime}`:new Date().toISOString(),followUp:{needed:noteForm.followUpNeeded,dueDate:noteForm.followUpDue}},'modal')} title="정부 노인맞춤돌봄시스템 등에 붙여넣기용 텍스트 복사">{copiedNoteId==='modal'?'복사됨':'복사'}</button>
          <button className="btn-primary" onClick={saveNote} disabled={noteSaving}>{noteSaving?'저장 중...':(noteForm.id?'수정 저장':'일지 저장')}</button>
        </div>
      </div>
    </div>
  );
}
