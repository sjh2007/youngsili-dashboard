// DashboardApplication.tsx의 page==='detail'(어르신 상세 정보) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { CallTranscript } from '../../components/common';
import { StatusBadge } from '../../components/ui';
import { STATUS_CONFIG, RISK_CONFIG } from '../../constants/app';
import { CARE_GROUPS } from '../dashboardConstants';

export default function DetailPage(props: any) {
  const {
    selected, setPage, setSelected, openEdit, deleteElder, callResult, calling, setCallModal,
    makeCall, toggleCallActive, cycleLabel, callsHistory, draftingCallId, openNoteForCall,
    caseNotes, CASE_TYPE_META, CASE_CAT_META, isAutoDraft, AutoDraftBadge, copyNote, copiedNoteId,
    openEditNote, deleteNote, openNewNote,
  } = props;

  return (
    <div className="fade-in detail-page">
      <div className="detail-topbar">
        <button className="back-btn" onClick={()=>{setPage('elders');setSelected(null);}}>← 목록으로</button>
        <div className="detail-actions"><button className="btn-secondary" onClick={()=>openEdit(selected)}>정보 수정</button><button className="btn-danger-outline" onClick={()=>deleteElder(selected.id)}>삭제</button></div>
      </div>
      {callResult&&callResult.elderId===selected.id&&<div className={`call-result-banner ${callResult.status}`}>{callResult.message}</div>}
      <div className="detail-grid">
        <div className="detail-card">
          <div className="detail-profile-summary">
            <div className="detail-profile-copy">
              <div className="detail-name">{selected.name}</div>
              <div className="detail-sub">{selected.age}세 · {selected.region}</div>
              <StatusBadge tone={selected.status || 'normal'}>{(STATUS_CONFIG[selected.status]||STATUS_CONFIG.normal).label}</StatusBadge>
            </div>
          </div>
          <div className="call-action-box">
            <button className={`btn-call-lg ${calling===selected.id?'btn-calling':''} ${!selected.callActive?'btn-disabled':''}`} onClick={()=>selected.callActive&&setCallModal(selected)} disabled={calling===selected.id||!selected.callActive}>{calling===selected.id?'발신 중...':'앱 전화 걸기'}</button>
            {/* 앱 미설치 어르신용 — 앱 푸시를 건너뛰고 070 번호로 바로 전화 */}
            <button
              className={`btn-call-lg ${calling===selected.id?'btn-calling':''} ${!selected.callActive?'btn-disabled':''}`}
              style={{marginTop:8,background:'#e8f3ff',color:'#1b64da'}}
              onClick={()=>selected.callActive&&makeCall(selected,'pstn')}
              disabled={calling===selected.id||!selected.callActive}
              title="어르신 앱이 없어도 일반 전화로 걸립니다"
            >{calling===selected.id?'발신 중...':'일반 전화 걸기'}</button>
            <div className="detail-call-status">
              <div><span className="detail-call-status-label">자동 발신</span><span style={{fontSize:15,fontWeight:700,padding:'4px 10px',borderRadius:6,...(selected.callActive?{background:'#dcfce7',color:'#15803d'}:{background:'#fee2e2',color:'#dc2626'})}}>{selected.callActive?'사용 중':'사용 안 함'}</span></div>
              <button onClick={()=>toggleCallActive(selected.id)} style={{fontSize:15,fontWeight:700,padding:'7px 12px',borderRadius:7,cursor:'pointer',...(selected.callActive?{background:'#fff',color:'#475467',border:'1px solid #cdd3da'}:{background:'#246BEB',color:'#fff',border:'none'})}}>{selected.callActive?'자동 발신 끄기':'자동 발신 켜기'}</button>
            </div>
          </div>
          <div className="detail-info-grid">
            {[['성별',selected.gender==='female'?'여성':'남성'],['호칭',selected.title||'어르신'],['돌봄군',(CARE_GROUPS[selected.careGroup]||{}).label||'미지정'],['전화번호',selected.phone],['담당 복지사',selected.caregiver||'미배정'],['주소',`${selected.address||''} ${selected.addressDetail||''}`.trim()],['보호자',selected.guardian],['보호자 연락처',selected.guardianPhone],['지병',selected.disease||'없음'],['복용약',selected.medicine||'없음'],['거동상태',selected.mobility],['전화 주기',cycleLabel(selected.callCycle, selected.callDays)],['전화 시간',selected.callTime],['마지막 통화',selected.lastCall],['방문 필요',selected.visits>0?`${selected.visits}회 권고`:'불필요']].map(([label,value],i)=>(<div key={i} className="detail-info-row"><span className="detail-label">{label}</span><span style={{color:label==='방문 필요'&&selected.visits>0?'#ef4444':'inherit',fontWeight:label==='방문 필요'?700:400}}>{value}</span></div>))}
          </div>
        </div>
        <div className="detail-right">
          {selected.keyword&&<div className="alert-box"><div className="alert-box-title">감지된 위험 키워드</div><div className="alert-box-keyword">"{selected.keyword}"</div><div className="alert-box-desc">즉시 방문 또는 가족 연락이 필요합니다.</div></div>}
          <div className="section">
            <div className="script-editor-header" style={{marginBottom:12}}>
              <div className="section-title" style={{marginBottom:0}}>통화 기록</div>
            </div>
            {(()=>{
              // 통화기록 메뉴와 동일한 서버 데이터(callsHistory)에서 이 어르신만 필터 (이름 또는 전화번호 매칭)
              const mine = callsHistory.filter(c=>c.elderName===selected.name||(c.phone&&selected.phone&&String(c.phone).replace(/\D/g,'')===String(selected.phone).replace(/\D/g,'')));
              if(mine.length===0) return <div style={{color:'#9ca3af',fontSize:17,padding:'16px 0'}}>통화 기록 없음</div>;
              return mine.map(c=>{
                const R=RISK_CONFIG[c.riskLevel]||{};
                const hm=c.at?new Date(c.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                const dur=c.durationSec||0;
                return (
                  <div key={c.id} className={`call-row ${c.riskLevel==='critical'?'call-row-danger':c.riskLevel==='urgent'?'call-row-warning':''}`}>
                    <div style={{minWidth:96,color:'#64748b',fontSize:16}}>{c.date} {hm}</div>
                    <div style={{minWidth:64,color:'#64748b',fontSize:16}}>{Math.floor(dur/60)}분 {dur%60}초</div>
                    <div style={{minWidth:44,fontWeight:700,fontSize:16,color:R.color||'#16a34a'}}>{R.label||'정상'}</div>
                    <button className="btn-small" disabled={!!draftingCallId||!c.transcript}
                      title={c.transcript?'이 통화 내용을 일지 작성 창에 채워서 엽니다':'통화 내용이 없어 초안을 만들 수 없습니다'}
                      onClick={()=>openNoteForCall(c)}
                      style={{marginLeft:'auto',fontSize:15,fontWeight:700}}>
                      {draftingCallId===c.id?'초안 생성 중…':'일지 작성'}
                    </button>
                    <div style={{flexBasis:'100%'}}><CallTranscript text={c.transcript} /></div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="section">
            <div className="script-editor-header" style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div className="section-title" style={{marginBottom:0}}>상담·방문 일지</div>
              <button className="btn-primary" style={{fontSize:16,padding:'6px 12px'}} onClick={()=>openNewNote({elderPhone:selected.phone,elderName:selected.name})}>＋ 일지 작성</button>
            </div>
            {(()=>{
              const mineNotes=caseNotes.filter(n=>String(n.elderPhone||'').replace(/\D/g,'')===String(selected.phone||'').replace(/\D/g,''));
              if(mineNotes.length===0) return <div style={{color:'#9ca3af',fontSize:17,padding:'8px 0'}}>상담·방문 일지 없음</div>;
              return mineNotes.map(n=>{
                const tmeta=CASE_TYPE_META[n.type]||CASE_TYPE_META.etc;
                const d=n.visitedAt?new Date(n.visitedAt):null;
                const when=d?`${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}`:'';
                return (
                  <div key={n.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',marginBottom:8,background:'#fff'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{color:'#64748b',fontSize:15,fontWeight:600}}>{when}</span>
                      <span style={{fontSize:14,fontWeight:700,color:tmeta.color,background:tmeta.bg,padding:'2px 8px',borderRadius:20}}>{tmeta.label}</span>
                      <span style={{fontSize:15,color:'#64748b'}}>{CASE_CAT_META[n.category]||'기타'}</span>
                      {n.linkedAlertId&&<span style={{fontSize:14,color:'#dc2626',fontWeight:700}}>알림 대응</span>}
                      {isAutoDraft(n)&&<AutoDraftBadge/>}
                      <span style={{flex:1}}/>
                      <button onClick={()=>copyNote(n, n.id)} style={{background:'none',border:'none',color:'#16a34a',fontSize:15,fontWeight:700,cursor:'pointer'}} title="붙여넣기용 텍스트 복사">{copiedNoteId===n.id?'복사됨':'복사'}</button>
                      <button onClick={()=>openEditNote(n)} style={{background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer'}}>수정</button>
                      <button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:15,fontWeight:700,cursor:'pointer'}}>삭제</button>
                    </div>
                    {n.content&&<div style={{fontSize:16,color:'#1f2937',marginTop:5,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.content}</div>}
                    {n.action&&<div style={{fontSize:15,color:'#475569',marginTop:4}}><b style={{color:'#0f766e'}}>조치</b> {n.action}</div>}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
