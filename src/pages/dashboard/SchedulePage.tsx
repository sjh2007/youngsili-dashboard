// DashboardApplication.tsx의 page==='schedule'(전화 발신 관리) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { GroupHeader } from '../../components/common';
import { StatusBadge } from '../../components/ui';
import { SERVER_URL, authFetch } from '../../utils/api';
import { localDayKey } from '../../utils/date';
import { STATUS_CONFIG } from '../../constants/app';

export default function SchedulePage(props: any) {
  const {
    alertResponses, loadAlertResponses, openNewNote, elders, smartFilter, applySmartFilter,
    checked, checkAll, uncheckAll, batchSize, setBatchSize, batchIntervalSec, setBatchIntervalSec,
    bulkRunning, setBulkConfirm, stopBulkCall, bulkDone, bulkQueue, bulkChannel, batchWait,
    bulkCurrent, setBulkDone, setBulkQueue, setChecked, resendMissed, histStatus, setHistStatus,
    histDays, setHistDays, loadDispatchHistory, histAllOpen, setHistAllOpen, setHistDayOv,
    dispatchHist, histLoading, histDayOv, expandedHistDays, setExpandedHistDays, formatDateHeader,
    nameByPhone, smartElders, toggleCheck, openEdit, cycleLabel, renderLastCall, toggleCallActive,
  } = props;

  return (
    <div className="fade-in schedule-page">
      {(() => {
        // 어르신별 최신 응답만(safe/help/missed) → help·missed를 상단으로(우선대응)
        const latest: Record<string, any> = {};
        for (const r of alertResponses) { const k = r.phone || r.elderName; if (!latest[k]) latest[k] = r; }
        const checkedCnt = Object.values(latest).filter(r => r.checked).length;
        const list = Object.values(latest).filter(r => !r.checked);   // 확인 처리된 건 숨김(기록은 보존 → 월간 실적 집계)
        if (list.length === 0 && checkedCnt === 0) return null;
        const rank = { help: 0, missed: 1, safe: 2 };
        list.sort((a, b) => (rank[a.response] ?? 3) - (rank[b.response] ?? 3) || (b.at || '').localeCompare(a.at || ''));
        const cfg = {
          help:   { icon: '🚨', label: '도움 요청', color: '#dc2626', bg: '#fef2f2', desc: '즉시 복지사·보호자 대응 필요' },
          missed: { icon: '⚠️', label: '미응답',   color: '#ea580c', bg: '#fff7ed', desc: '자동 재발신 후에도 무응답 — 직접 확인 필요' },
          safe:   { icon: '✅', label: '안전 확인', color: '#16a34a', bg: '#f0fdf4', desc: '' },
        };
        const stageLabel = { prepare: '발생 초기', evacuate: '긴급 대피', safety: '안전 확인' };
        const nHelp = list.filter(r => r.response === 'help').length;
        const nMissed = list.filter(r => r.response === 'missed').length;
        const nSafe = list.filter(r => r.response === 'safe').length;
        const fmtTime = (iso) => {
          // 날짜 없이 시각만 표시하면 어제 기록이 '미래 시각'처럼 보임 → 오늘 아니면 날짜 병기
          try {
            const d = new Date(iso);
            const t = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            const ds = d.toLocaleDateString('sv-SE');
            const today = new Date().toLocaleDateString('sv-SE');
            if (ds === today) return `오늘 ${t}`;
            const yest = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');
            if (ds === yest) return `어제 ${t}`;
            return `${d.getMonth() + 1}/${d.getDate()} ${t}`;
          } catch { return ''; }
        };
        return (
          <div className="section" style={{borderLeft:'4px solid #ea580c'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div className="section-title" style={{margin:0}}>경보 응답 현황 <span style={{fontSize:15,fontWeight:600,color:'#94a3b8'}}>(최근 24시간분 표시 · 15초 자동 갱신{checkedCnt>0?` · 확인됨 ${checkedCnt}건 숨김`:''})</span></div>
              <div style={{display:'flex',gap:10,fontSize:16,fontWeight:700}}>
                <span style={{color:'#dc2626'}}>도움 요청 {nHelp}</span>
                <span style={{color:'#ea580c'}}>미응답 {nMissed}</span>
                <span style={{color:'#16a34a'}}>안전 {nSafe}</span>
                <button className="btn-secondary" style={{fontSize:15,padding:'2px 8px'}} onClick={()=>loadAlertResponses()}>갱신</button>
              </div>
            </div>
            {list.length === 0 && <div style={{marginTop:10,fontSize:16,color:'#16a34a',fontWeight:600}}>모든 응답이 확인 처리됐습니다. (확인됨 {checkedCnt}건 · 24시간 경과 시 자동으로 사라집니다)</div>}
            <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
              {list.map((r, i) => {
                const c = cfg[r.response] || cfg.safe;
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,background:c.bg,border:`1px solid ${c.color}30`,borderRadius:10,padding:'10px 14px',flexWrap:'wrap'}}>
                    <span style={{fontSize:20}}>{c.icon}</span>
                    <div style={{minWidth:90}}>
                      <div style={{fontWeight:800,color:'#1f2937'}}>{r.elderName || '어르신'}</div>
                      <div style={{fontSize:15,color:'#94a3b8'}}>{r.phone}</div>
                    </div>
                    <span style={{fontWeight:800,color:c.color,fontSize:17,minWidth:74}}>{c.label}</span>
                    <span style={{fontSize:15,color:'#64748b',flex:1}}>{c.desc}{r.response==='missed'&&r.retryCount?` (재발신 ${r.retryCount}회)`:''}</span>
                    <span style={{fontSize:15,color:'#94a3b8'}}>{stageLabel[r.alertStage]||''} · {fmtTime(r.at)}</span>
                    {(r.response==='help'||r.response==='missed') && (
                      <button className="btn-secondary" style={{fontSize:15,padding:'4px 10px'}}
                        onClick={()=>openNewNote({ elderPhone:r.phone, elderName:r.elderName, type:'phone', category:'safety',
                          content:`[산불 경보 ${stageLabel[r.alertStage]||''}] ${r.response==='help'?'어르신이 "도와줘" — 도움 요청':`미응답(자동 재발신 ${r.retryCount||0}회 후)`}. 조치 확인 필요.`,
                          linkedAlertId:`alertresp_${r.id}` })}>일지</button>
                    )}
                    <button className="btn-secondary" style={{fontSize:15,padding:'4px 10px'}}
                      title="확인 처리 — 목록에서 숨겨집니다(기록은 월간 실적에 보존)"
                      onClick={async()=>{await authFetch(`${SERVER_URL}/alert/responses/${r.id}/check`,{method:'POST'}).catch(()=>{});loadAlertResponses(true);}}>확인</button>
                  </div>
                );
              })}
            </div>
            {(nHelp>0||nMissed>0) && <div style={{marginTop:10,fontSize:15,color:'#ea580c',fontWeight:600}}>도움 요청·미응답 어르신을 먼저 확인하세요. 목록 상단에 자동 정렬됩니다.</div>}
          </div>
        );
      })()}
      <div className="bulk-toolbar">
        <div className="bulk-left">
          <div className="bulk-title">스마트 선택</div>
          <div className="smart-filters">
            {[{id:'all',label:'전체',count:elders.length},{id:'danger',label:'위험/주의만',count:elders.filter(e=>e.status!=='normal').length},{id:'noCall',label:'발신 대상',count:elders.filter(e=>e.lastCall==='아직 없음'||(e.lastCall||'').includes('어제')).length},{id:'active',label:'활성만',count:elders.filter(e=>e.callActive).length}].map(f=>(
              <button key={f.id} className={`smart-btn ${smartFilter===f.id?'smart-active':''}`} onClick={()=>applySmartFilter(f.id)}>{f.label} <span className="filter-count">{f.count}</span></button>
            ))}
          </div>
        </div>
        <div className="bulk-right">
          <span className="check-count">{checked.length}명 선택됨</span>
          <button className="btn-secondary" onClick={checkAll}>전체선택</button>
          <button className="btn-secondary" onClick={uncheckAll}>선택해제</button>
          {!bulkRunning && checked.length > batchSize && (
            <span style={{fontSize:15,color:'#64748b',display:'flex',alignItems:'center',gap:4}} title="AI서버 동시통화 부하를 줄이려 나눠서 발신합니다">
              배치 <input type="number" min="1" max="50" value={batchSize} onChange={e=>setBatchSize(Math.max(1,Number(e.target.value)||1))} style={{width:42,padding:'3px 4px',border:'1px solid #cbd5e1',borderRadius:6,textAlign:'center'}}/>명/
              <input type="number" min="0" max="600" value={batchIntervalSec} onChange={e=>setBatchIntervalSec(Math.max(0,Number(e.target.value)||0))} style={{width:48,padding:'3px 4px',border:'1px solid #cbd5e1',borderRadius:6,textAlign:'center'}}/>초
            </span>
          )}
          {!bulkRunning
            ? <>
                <button className={`btn-bulk-call ${checked.length===0?'btn-disabled':''}`} disabled={checked.length===0}
                  onClick={()=>setBulkConfirm({ count: checked.length, queue: null, channel: 'app', isAlert: false, alertLabel: null })}>
                  앱 알림 발신 ({checked.length}명)
                </button>
                <button className={`btn-bulk-call ${checked.length===0?'btn-disabled':''}`} disabled={checked.length===0}
                  onClick={()=>setBulkConfirm({ count: checked.length, queue: null, channel: 'pstn', isAlert: false, alertLabel: null })}>
                  일반전화 동시발신 ({checked.length}명)
                </button>
              </>
            : <button className="btn-bulk-stop" onClick={stopBulkCall}>발신 중단</button>
          }
        </div>
      </div>

      {(bulkRunning || bulkDone.length > 0) && (
        <div className="bulk-progress-box">
          <div className="bulk-progress-header">
            <span className="bulk-progress-title">{bulkRunning?(bulkChannel==='pstn'?'일반전화 발신 중...':'앱 알림 발신 중...'):'발신 완료'}</span>
            <span className="bulk-progress-count">{bulkDone.length} / {bulkQueue.length}</span>
          </div>
          <div className="bulk-bar-wrap"><div className="bulk-bar" style={{width:`${bulkQueue.length?bulkDone.length/bulkQueue.length*100:0}%`}}/></div>
          {batchWait > 0 && <div style={{fontSize:16,color:'#f59e0b',fontWeight:700,margin:'8px 0'}}>AI서버 부하 분산 — 다음 {batchSize}명 발신까지 {batchWait}초 대기…</div>}
          <div className="bulk-result-list">
            {bulkQueue.map(elder=>{
              const done = bulkDone.find(d=>d.id===elder.id);
              const isCurrent = bulkCurrent===elder.id;
              return (
                <div key={elder.id} className={`bulk-result-item ${isCurrent?'bulk-current':done?done.success?'bulk-success':'bulk-fail':''}`}>
                  <div className="table-avatar">{(elder.name||'?')[0]}</div>
                  <span className="bulk-name">{elder.name}</span>
                  <span className="bulk-phone">{elder.phone}</span>
                  <span className="bulk-status-icon">{
                    isCurrent ? '발신 중'
                    : !done ? '대기'
                    : done.status==='ringing' ? '수신대기'
                    : done.status==='answered' ? '통화중'
                    : done.status==='completed' ? `받음 (${done.durationSec||0}초)`
                    : done.status==='missed' ? '부재중'
                    : (done.status==='failed'||done.success===false) ? '발신실패'
                    : '전송됨'
                  }</span>
                </div>
              );
            })}
          </div>
          {!bulkRunning && bulkDone.length>0 && (
            <div className="bulk-summary">
              <span className="bulk-success-count">받음 {bulkDone.filter(d=>d.status==='completed'||d.status==='answered').length}</span>
              <span style={{color:'#f59e0b',fontWeight:700}}>수신대기 {bulkDone.filter(d=>d.status==='ringing').length}</span>
              <span className="bulk-fail-count">부재중 {bulkDone.filter(d=>d.status==='missed').length} · 실패 {bulkDone.filter(d=>d.status==='failed').length}</span>
              {bulkDone.filter(d=>d.status==='missed').length>0 && <button className="btn-bulk-call" onClick={resendMissed}>부재중 {bulkDone.filter(d=>d.status==='missed').length}명 다시 발신</button>}
              <button className="btn-secondary" onClick={()=>{setBulkDone([]);setBulkQueue([]);setChecked([]);}}>닫기</button>
            </div>
          )}
        </div>
      )}

      {/* 발신 이력(날짜별 아코디언) — P2-8: 기본 오늘만 펼침, 과거는 요약 헤더만 */}
      <div className="section schedule-history-section">
        <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <span style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span>발신 이력</span>
            {[['all','전체'],['received','받음'],['missed','부재중']].map(([k,l])=>(
              <button key={k} onClick={()=>setHistStatus(k)} className={`smart-btn ${histStatus===k?'smart-active':''}`} style={{fontSize:15,padding:'4px 12px'}}>{l}</button>
            ))}
            {histStatus==='missed' && <span style={{fontSize:15,color:'#b45309',fontWeight:700}}>부재중 행만 표시 · 전체 자동 펼침</span>}
          </span>
          <span style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {[7,30].map(d=>(
              <button key={d} onClick={()=>setHistDays(d)} className={`smart-btn ${histDays===d?'smart-active':''}`} style={{fontSize:15,padding:'4px 10px'}}>최근 {d}일</button>
            ))}
            <button onClick={()=>loadDispatchHistory(histDays)} className="btn-secondary" style={{fontSize:15,padding:'4px 10px'}}>새로고침</button>
            <button onClick={()=>{const open=!histAllOpen; setHistAllOpen(open); setHistDayOv(()=>{const o={}; dispatchHist.forEach(x=>{o[(x.sentAtIso||'').slice(0,10)||'미상']=open;}); return o;});}} className="btn-secondary" style={{fontSize:15,padding:'4px 10px',fontWeight:700}}>{histAllOpen?'전체 접기 ▴':'전체 펼치기 ▾'}</button>
            <span style={{fontSize:14,color:'#94a3b8',alignSelf:'center'}}>15초마다 자동 갱신</span>
          </span>
        </div>
        {histLoading ? (
          <div style={{padding:24,textAlign:'center',color:'#94a3b8'}}>불러오는 중...</div>
        ) : dispatchHist.length===0 ? (
          <div style={{padding:24,textAlign:'center',color:'#94a3b8'}}>최근 {histDays}일 발신 이력이 없습니다.</div>
        ) : (()=>{
          const statusMatch = (x) => histStatus==='all' ? true : histStatus==='received' ? (x.status==='completed'||x.status==='answered') : x.status==='missed';
          const filtered = dispatchHist.filter(statusMatch);
          if (filtered.length===0) return <div style={{padding:24,textAlign:'center',color:'#94a3b8'}}>{histStatus==='missed'?'부재중':'받은'} 발신이 없습니다.</div>;
          const groups: Record<string, any[]>={};
          filtered.forEach(x=>{ const dk=(x.sentAtIso||'').slice(0,10)||'미상'; (groups[dk]=groups[dk]||[]).push(x); });
          return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>{
            const recv=rows.filter(r=>r.status==='completed'||r.status==='answered').length;
            const miss=rows.filter(r=>r.status==='missed').length;
            const sorted=rows.slice().sort((a,b)=>String(b.sentAtIso).localeCompare(String(a.sentAtIso)));
            // '부재중' 필터 선택 시 전체 자동 펼침(해당 행만 이미 필터됨), 그 외엔 오늘만 기본 펼침
            const open = histStatus==='missed' ? true : (histDayOv[date] !== undefined ? histDayOv[date] : date===localDayKey());
            const rowsOpen=expandedHistDays.has(date);
            const shown=rowsOpen?sorted:sorted.slice(0,3);
            const hiddenBad=sorted.slice(3).filter(r=>r.status==='missed'||r.status==='failed').length;
            return (
            <div key={date} style={{marginBottom:10}}>
              <GroupHeader label={formatDateHeader(date)} count={rows.length}
                chips={[{label:'받음',value:recv,color:'#16a34a'},{label:'부재중',value:miss,color:'#f59e0b'}]}
                flag={recv===0&&miss>0?'이날 전원 부재중':null}
                open={open} onToggle={()=>setHistDayOv(p=>({...p,[date]:!open}))}/>
              {open && shown.map((x,i)=>{
                const t=x.sentAtIso?new Date(x.sentAtIso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                const st=x.status;
                const info=(st==='completed'||st==='answered')?{ic:'',tx:`받음${x.durationSec?` (${x.durationSec}초)`:''}`,c:'#16a34a'}
                  :st==='ringing'?{ic:'',tx:'수신대기',c:'#f59e0b'}
                  :st==='missed'?{ic:'',tx:'부재중',c:'#f59e0b'}
                  :st==='failed'?{ic:'',tx:`실패${x.reason?` · ${x.reason}`:''}`,c:'#ef4444'}
                  :{ic:'',tx:'전송됨',c:'#64748b'};
                return (
                  <div key={x.callId||i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderRadius:10,background:st==='failed'?'#fef2f2':st==='missed'?'#fff7ed':'#f8fafc',marginBottom:6,flexWrap:'wrap'}}>
                    <div style={{minWidth:46,color:'#64748b',fontSize:16,fontWeight:600}}>{t}</div>
                    <div style={{minWidth:90,fontWeight:700,fontSize:17}}>{nameByPhone(x.phone,x.name)}</div>
                    <div style={{minWidth:110,color:'#64748b',fontSize:16}}>{x.phone}</div>
                    <div style={{flex:1,minWidth:120,fontWeight:700,fontSize:16,color:info.c}}>{info.tx}</div>
                  </div>
                );
              })}
              {open && sorted.length>3 && (
                <button onClick={()=>setExpandedHistDays(prev=>{const n=new Set(prev); n.has(date)?n.delete(date):n.add(date); return n;})} style={{marginTop:2,marginLeft:2,background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer',padding:'2px 0'}}>
                  {rowsOpen?'접기 ▴':`+ ${sorted.length-3}건 더 보기${hiddenBad>0?` (부재중·실패 ${hiddenBad}건 포함)`:''} ▾`}
                </button>
              )}
            </div>
          );});
        })()}
      </div>

      <table className="table">
        <thead><tr><th style={{width:40}}><input type="checkbox" checked={checked.length===smartElders.length&&smartElders.length>0} onChange={e=>e.target.checked?checkAll():uncheckAll()} className="cb"/></th><th>어르신</th><th>전화번호</th><th>담당 복지사</th><th>전화 주기</th><th>전화 시간</th><th>마지막 통화</th><th>상태</th><th>발신 상태</th></tr></thead>
        <tbody>
          {smartElders.map(elder=>{
            const done = bulkDone.find(d=>d.id===elder.id);
            return (
              <tr key={elder.id} className={`${checked.includes(elder.id)?'row-checked':''} ${done?done.success?'row-success':'row-fail':''}`}>
                <td><input type="checkbox" checked={checked.includes(elder.id)} onChange={()=>toggleCheck(elder.id)} className="cb"/></td>
                <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="table-avatar">{(elder.name||'?')[0]}</div><div onClick={()=>openEdit(elder)} style={{cursor:'pointer'}} title="클릭 → 어르신 정보 수정"><div style={{fontWeight:700,color:'#246BEB'}}>{elder.name}</div><div style={{fontSize:15,color:'#94a3b8'}}>{elder.age?`${elder.age}세`:'—'}</div></div>{done&&<span className={`inline-result ${done.success?'success':'error'}`}>{done.success?'성공':'실패'}</span>}</div></td>
                <td style={{fontSize:16}}>{elder.phone}</td>
                <td style={{fontSize:16,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                <td><span className="cycle-badge">{cycleLabel(elder.callCycle, elder.callDays)}</span></td>
                <td><span className="time-badge">{elder.callTime}</span></td>
                <td style={{fontSize:16,color:'#64748b'}}>{renderLastCall(elder)}</td>
                <td><StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge></td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:15,fontWeight:700,padding:'3px 10px',borderRadius:20,whiteSpace:'nowrap',...(elder.callActive?{background:'#dcfce7',color:'#15803d'}:{background:'#fee2e2',color:'#dc2626'})}}>{elder.callActive?'발신 중':'발신 중단'}</span>
                    <button onClick={()=>toggleCallActive(elder.id)} style={{fontSize:15,fontWeight:700,padding:'5px 11px',borderRadius:8,cursor:'pointer',whiteSpace:'nowrap',...(elder.callActive?{background:'#fff',color:'#64748b',border:'1px solid #d1d5db'}:{background:'#16a34a',color:'#fff',border:'none'})}}>{elder.callActive?'중단하기':'발신 켜기'}</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
