// DashboardApplication.tsx의 page==='health'(건강 상태) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { CheckCircle2, AlertTriangle, AlertCircle, Users } from 'lucide-react';
import { Button, PageIntro, StatusBadge } from '../../components/ui';
import { SERVER_URL, authFetch } from '../../utils/api';
import { STATUS_CONFIG } from '../../constants/app';

export default function HealthPage(props: any) {
  const {
    healthLoading, fetchHealth, healthData, elders, alertsData, alertIsReal, nameByPhone, alertEnCode,
    alertKw, draftingAlertId, openNoteFromAlert, healthFilter, setHealthFilter, healthAllOpen,
    setHealthAllOpen, setHealthRowOv, setHealthNormalShown, healthRowOv, getNoResponseDays,
    callsHistory, kwFromTranscript, healthHistory, setCallModal, openDetail, healthRange,
    setHealthRange, healthHistFrom, setHealthHistFrom, healthHistTo, setHealthHistTo,
    formatDateHeader, healthNormalShown,
  } = props;

  return (
    <div className="fade-in health-page">
      <PageIntro title="어르신 건강 상태 현황" description="영실이 앱에서 어르신이 직접 체크한 건강 상태 · 15초마다 자동 갱신됩니다" actions={<Button className={healthLoading?'btn-calling':''} onClick={()=>fetchHealth()} disabled={healthLoading}>{healthLoading ? '불러오는 중...' : '갱신'}</Button>} />
      <div className="stat-grid" style={{marginBottom:20}}>
        {[
          {label:'좋아요',   num:healthData.filter(h=>h.status==='good').length, Icon:CheckCircle2,  ic:'#16A34A', color:'#16a34a'},
          {label:'그럭저럭', num:healthData.filter(h=>h.status==='okay').length, Icon:AlertTriangle, ic:'#F59E0B', color:'#d97706'},
          {label:'안 좋아요', num:healthData.filter(h=>h.status==='bad').length,  Icon:AlertCircle,   ic:'#DC2626', color:'#dc2626'},
          {label:'미체크',   num:elders.length - healthData.length,               Icon:Users,         ic:'#94a3b8', color:'#64748b'},
        ].map(s=>(
          <div key={s.label} className="stat-card">
            <div className="stat-top"><span className="stat-label">{s.label}</span><s.Icon size={20} strokeWidth={1.75} color={s.ic} aria-hidden="true"/></div>
            <div className="stat-num-row"><span className="stat-num" style={{color:s.color}}>{s.num}</span><span className="stat-unit">명</span></div>
          </div>
        ))}
      </div>
      {(()=>{
        const un = alertsData.filter(a=>(a.status ? a.status !== 'done' : !a.read) && alertIsReal(a));   // 폐루프: 완료(done) 전까지 표시
        if (un.length === 0) return null;
        const CAT = {
          health:  { label:'건강', icon:'❤️', c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
          fall:    { label:'낙상', icon:'🦴', c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
          emotion: { label:'정서', icon:'💙', c:'#246BEB', bg:'#eff6ff', bd:'#bfdbfe' },
          living:  { label:'생활', icon:'🧺', c:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
          meal:    { label:'식사', icon:'🍚', c:'#ea580c', bg:'#fff7ed', bd:'#fed7aa' },
          missed:  { label:'부재중', icon:'📵', c:'#b45309', bg:'#fffbeb', bd:'#fde68a' },
          help:    { label:'구조요청', icon:'🆘', c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
          safe:    { label:'안전확인', icon:'✅', c:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
        };
        const cnt = c => un.filter(a=>(a.category||'health')===c).length;
        return (
        <div className="section" style={{marginBottom:20}}>
          <div className="section-title">미처리 알림 ({un.length}건) <span style={{fontSize:15,fontWeight:600,color:'#94a3b8'}}>— 조치 시작 → 조치 완료(또는 일지 작성)로 마감하세요</span></div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            {['health','fall','emotion','living','meal','missed','help','safe'].map(c=> cnt(c)>0 && (
              <span key={c} style={{fontSize:15,fontWeight:700,color:CAT[c].c,background:CAT[c].bg,border:'1px solid '+CAT[c].bd,padding:'3px 10px',borderRadius:20}}>{CAT[c].label} {cnt(c)}건</span>
            ))}
          </div>
          {un.map((alert,i) => {
            const m = CAT[alert.category] || CAT.health;
            return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:14,background:m.bg,borderLeft:'4px solid '+m.c,border:'1px solid '+m.bd,borderRadius:10,padding:'12px 16px',marginBottom:8,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:180}}><div style={{fontSize:17,fontWeight:700,color:m.c,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontSize:14,fontWeight:800,background:m.c,color:'#fff',padding:'2px 8px',borderRadius:20}}>{m.label}</span>{nameByPhone(alert.phone, alert.name)} · {alertEnCode(alert) ? alertKw(alert) : `"${alertKw(alert)}"`}</div><div style={{fontSize:15,color:m.c,marginTop:2,opacity:0.85}}>{new Date(alert.timestamp).toLocaleString('ko-KR')}</div></div>
              {alert.status === 'ack' && <span style={{fontSize:15,fontWeight:800,color:'#b45309',background:'#fef3c7',padding:'3px 10px',borderRadius:20}}>조치중{alert.actionBy?` · ${alert.actionBy.split('@')[0]}`:''}</span>}
              <button className="btn-small" style={{background:'#1e3a6e',color:'#fff',borderColor:'#1e3a6e'}} disabled={!!draftingAlertId} title="통화 내용을 찾아 초안까지 채워서 엽니다" onClick={()=>openNoteFromAlert(alert)}>{draftingAlertId===alert.id?'초안 생성 중…':'일지 작성'}</button>
              {(!alert.status || alert.status === 'new') && (
                <button className="banner-btn" style={{border:'1.5px solid '+m.c,color:m.c}} onClick={async()=>{await authFetch(`${SERVER_URL}/alerts/${alert.id}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'ack'})}).catch(()=>{});fetchHealth();}}>조치 시작</button>
              )}
              {alert.status === 'ack' && (
                <button className="btn-small" style={{background:'#16a34a',color:'#fff',borderColor:'#16a34a'}} onClick={async()=>{
                  const note = window.prompt('조치 내용을 입력하세요 (예: 유선 확인 — 이상 없음, 보호자 연락, 방문 예정)');
                  if (note === null) return;
                  await authFetch(`${SERVER_URL}/alerts/${alert.id}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done',note})}).catch(()=>{});
                  fetchHealth();
                }}>조치 완료</button>
              )}
            </div>
            );
          })}
        </div>
        );
      })()}
      {/* P2-9: 어르신별 행 확장 아코디언 — 기본 접힘, 위험만 자동 펼침. 인라인 상세는 펼칠 때만 계산(지연 로드) */}
      <div className="section health-list-section">
        <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <span style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span>어르신별 건강 상태</span>
            {[['all','전체'],['danger','위험'],['warning','주의'],['normal','정상']].map(([k,l])=>{
              const n = k==='all' ? elders.filter(e=>e.approved!==false).length : elders.filter(e=>e.approved!==false&&e.status===k).length;
              return <button key={k} onClick={()=>setHealthFilter(k)} className={`smart-btn ${healthFilter===k?'smart-active':''}`} style={{fontSize:15,padding:'4px 12px'}}>{l} {n}</button>;
            })}
          </span>
          <button onClick={()=>{const open=!healthAllOpen; setHealthAllOpen(open); setHealthRowOv(()=>{const o={}; elders.forEach(e=>{o[e.id]=open;}); return o;}); if(open) setHealthNormalShown(9999);}} className="btn-secondary" style={{fontSize:15,padding:'4px 10px',fontWeight:700}}>{healthAllOpen?'전체 접기 ▴':'전체 펼치기 ▾'}</button>
        </div>
        {(()=>{
          const list = elders.filter(e=>e.approved!==false);
          if (list.length===0) return <div style={{textAlign:'center',padding:40,color:'#9ca3af'}}>등록된 어르신이 없습니다.</div>;
          const order={danger:0,warning:1,normal:2};
          const HLABEL={good:'좋아요',okay:'그럭저럭',bad:'안 좋아요'};
          const hCheckOf = (e)=>{ const p=String(e.phone||'').replace(/\D/g,''); return (p&&healthData.find(h=>String(h.phone||'').replace(/\D/g,'')===p))||healthData.find(h=>h.name===e.name); };
          // 정렬: 위험 → 주의 → 정상(최근 통화순)
          const sorted = list.slice().sort((a,b)=> ((order[a.status]??2)-(order[b.status]??2)) || String(b.lastCallAt||'').localeCompare(String(a.lastCallAt||'')));
          const visible = sorted.filter(e=>healthFilter==='all'||e.status===healthFilter);
          if (visible.length===0) return <div style={{textAlign:'center',padding:30,color:'#9ca3af'}}>해당 상태의 어르신이 없습니다.</div>;
          const riskRows = visible.filter(e=>e.status!=='normal');
          const normalRows = visible.filter(e=>e.status==='normal');
          const shownRows = [...riskRows, ...normalRows.slice(0,healthNormalShown)];
          const hiddenNormal = Math.max(0, normalRows.length-healthNormalShown);
          return (<>
            {shownRows.map(elder=>{
              const stc = STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal;
              const open = healthRowOv[elder.id] !== undefined ? healthRowOv[elder.id] : elder.status==='danger';
              const hc = hCheckOf(elder);
              const nrd = getNoResponseDays(elder.lastCall, elder.lastCallAt);
              const isRisk = elder.status!=='normal';
              const summary = isRisk
                ? ([elder.keyword&&`"${elder.keyword}" 감지`, nrd>=1&&(nrd>=99?'통화 이력 없음':`${nrd}일째 미응답`), hc&&`앱 체크: ${HLABEL[hc.status]||'-'}`].filter(Boolean).join(' · ') || '위험 신호 확인 필요')
                : [nrd===0?'오늘 통화 완료':(nrd==null||nrd>=99)?'통화 이력 없음':`마지막 통화 ${nrd}일 전`, hc?`앱 체크: ${HLABEL[hc.status]||'-'}`:'오늘 앱 미체크'].join(' · ');
              return (
                <div key={elder.id} style={{marginBottom:8}}>
                  <div className="health-person-row" onClick={()=>setHealthRowOv(p=>({...p,[elder.id]:!open}))} role="button" tabIndex={0} aria-expanded={open}
                    onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setHealthRowOv(p=>({...p,[elder.id]:!open})); } }}
                    style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',cursor:'pointer',userSelect:'none',padding:'11px 14px',
                      borderRadius:open?'10px 10px 0 0':'10px',
                      border:'1px solid '+(elder.status==='danger'?'#fecaca':open?'#bfdbfe':'#e2e8f0'),
                      background:elder.status==='danger'?'#fef2f2':open?'#f0f5ff':'#fff'}}>
                    <span aria-hidden="true" style={{fontSize:14,color:'#94a3b8',width:12,textAlign:'center'}}>{open?'▼':'▶'}</span>
                    <span style={{fontWeight:800,fontSize:17,minWidth:100}}>{elder.name}{elder.age?` (${elder.age}세)`:''}</span>
                    <StatusBadge tone={elder.status || 'normal'}>{stc.label}</StatusBadge>
                    <span style={{flex:1,minWidth:160,fontSize:16,fontWeight:isRisk?700:500,color:elder.status==='danger'?'#dc2626':elder.status==='warning'?'#b45309':'#64748b'}}>{summary}</span>
                    {elder.status==='danger' ? (
                      <span style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                        <button className="btn-call-sm" onClick={()=>setCallModal(elder)}>앱 전화</button>
                        <button className="btn-secondary" style={{fontSize:15,padding:'4px 10px'}} onClick={()=>openDetail(elder)}>상세</button>
                      </span>
                    ) : (
                      <button onClick={e=>{e.stopPropagation();openDetail(elder);}} style={{background:'none',border:'none',color:'#94a3b8',fontSize:15,fontWeight:700,cursor:'pointer'}}>상세 ›</button>
                    )}
                  </div>
                  {open && (()=>{
                    const p = String(elder.phone||'').replace(/\D/g,'');
                    const wk = Date.now()-7*86400000;
                    const fmtMD = iso => { const d=new Date(iso); return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; };
                    const evts = [
                      ...callsHistory.filter(c=>String(c.phone||'').replace(/\D/g,'')===p && c.at && (new Date(c.at) as any)>=wk).map(c=>{
                        const risky=c.riskLevel==='critical'||c.riskLevel==='urgent';
                        const kw=risky?kwFromTranscript(c.transcript):null;
                        return { at:c.at, danger:risky, tx:`받음 ${c.durationSec||0}초${kw?` · "${kw}" 감지`:''}` };
                      }),
                      ...healthHistory.filter(h=>{const hp=String(h.phone||'').replace(/\D/g,''); return (hp?hp===p:h.name===elder.name) && h.at && (new Date(h.at) as any)>=wk;}).map(h=>(
                        { at:h.at, danger:h.status==='bad', tx:`앱 건강 체크: ${HLABEL[h.status]||h.status||'-'}` }
                      )),
                    ].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,8);
                    const judge = isRisk ? [
                      elder.keyword&&`"${elder.keyword}" 키워드 감지`,
                      nrd>=2&&nrd<99&&`${nrd}일 연속 미응답`,
                      hc&&hc.status==='bad'&&`앱 건강 체크 '안 좋아요'`,
                    ].filter(Boolean).join(' + ') : '';
                    return (
                      <div className="health-expanded" style={{border:'1px solid '+(elder.status==='danger'?'#fecaca':'#bfdbfe')}}>
                        <div style={{fontWeight:800,fontSize:16,color:'#334155',marginBottom:6}}>최근 7일 이력</div>
                        <div className="health-history-list">
                        {evts.length===0 ? <div style={{fontSize:16,color:'#94a3b8'}}>최근 7일 내 통화·건강 체크 기록이 없습니다.</div>
                          : evts.map((v,i)=>(
                            <div key={i} style={{display:'flex',gap:10,fontSize:16,marginBottom:3}}>
                              <span style={{color:'#94a3b8',minWidth:40}}>{fmtMD(v.at)}</span>
                              <span style={{fontWeight:v.danger?800:500,color:v.danger?'#dc2626':'#334155'}}>{v.tx}</span>
                            </div>
                          ))}
                        </div>
                        {judge && <div style={{fontSize:16,fontWeight:800,color:'#dc2626',marginTop:8}}>판단 근거: {judge}</div>}
                        <div className="health-expanded-actions">
                          <button className="btn-call-sm" onClick={()=>setCallModal(elder)}>앱 전화</button>
                          <button className="btn-secondary" style={{fontSize:15}} onClick={()=>openDetail(elder)}>상세 정보</button>
                          {elder.guardianPhone && <a href={`tel:${elder.guardianPhone}`} className="btn-secondary" style={{fontSize:15,textDecoration:'none'}}>보호자 연락 ({elder.guardian||'보호자'} {elder.guardianPhone})</a>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            {hiddenNormal>0 && (
              <button onClick={()=>setHealthNormalShown(n=>n+10)} style={{background:'none',border:'none',color:'#246BEB',fontSize:16,fontWeight:700,cursor:'pointer',padding:'6px 2px'}}>
                + 나머지 정상 {hiddenNormal}명 보기 ▾ <span style={{color:'#94a3b8',fontWeight:600}}>(10명 단위 지연 로드)</span>
              </button>
            )}
          </>);
        })()}
      </div>
      {/* 건강 체크 이력 (일/월별) — healthEvents 컬렉션 */}
      <div className="section">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:14}}>
          <div className="section-title" style={{marginBottom:0}}>건강 체크 이력 (일/월별)</div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {[['week','최근 7일'],['month','최근 30일'],['custom','직접 선택']].map(([k,label])=>(
              <button key={k} onClick={()=>setHealthRange(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(healthRange===k?'#246BEB':'#e2e8f0'),background:healthRange===k?'#eff6ff':'#fff',color:healthRange===k?'#246BEB':'#64748b',fontWeight:700,fontSize:16,cursor:'pointer'}}>{label}</button>
            ))}
            {healthRange==='custom' && (<>
              <input type="date" value={healthHistFrom} onChange={e=>setHealthHistFrom(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:16}}/>
              <span style={{color:'#94a3b8'}}>~</span>
              <input type="date" value={healthHistTo} onChange={e=>setHealthHistTo(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:16}}/>
            </>)}
          </div>
        </div>
        {(()=>{
          const histReal = healthHistory.filter(alertIsReal);
          if (histReal.length===0) return <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>이 기간 건강 체크 이력이 없습니다.</div>;
          const grouped: Record<string, any[]>={};
          histReal.forEach(h=>{const dk=h.date||(h.at?h.at.slice(0,10):'미상');(grouped[dk]=grouped[dk]||[]).push(h);});
          return Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,evs])=>(
            <div key={date} style={{marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:17,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:16}}>· {evs.length}건</span></div>
              {evs.map((h,i)=>{
                const sc={good:'#16a34a',okay:'#f59e0b',bad:'#ef4444'}[h.status]||'#64748b';
                const sl={good:'좋아요',okay:'그럭저럭',bad:'안 좋아요'}[h.status]||h.status||'-';
                const hm=h.at?new Date(h.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                return (<div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 14px',borderRadius:10,background:h.status==='bad'?'#fef2f2':'#f8fafc',marginBottom:6}}>
                  <div style={{minWidth:80,fontWeight:700,fontSize:17}}>{h.name||h.phone||'미상'}</div>
                  <div style={{minWidth:46,color:'#64748b',fontSize:16}}>{hm}</div>
                  <div style={{fontWeight:700,fontSize:17,color:sc}}>{sl}</div>
                </div>);
              })}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
