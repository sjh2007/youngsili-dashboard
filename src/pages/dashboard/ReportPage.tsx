// DashboardApplication.tsx의 page==='report'(리포트/통계) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { Phone, AlertCircle, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react';

export default function ReportPage(props: any) {
  const {
    exportStatsCSV, me, reportMonth, setReportMonth, monthlyBusy, downloadMonthlyReport, reportCalls,
    elders, statsRange, setStatsRange, statsFrom, setStatsFrom, statsTo, setStatsTo, fetchStats,
    statsLoading, statsData, priorityScore, statsPrev, LV_COLOR, kwLevel, danger, warning,
    reportDispatches,
  } = props;

  return (
    <div className="fade-in report-page">
      <div className="report-banner"><div><div className="report-banner-title">{new Date().getFullYear()}년 {new Date().getMonth()+1}월 월간 리포트</div><div className="report-banner-sub">{me?.orgName ? `${me.orgName} · ` : ''}AI 영실이 복지 서비스</div></div><div className="report-banner-actions"><button className="btn-download" onClick={exportStatsCSV}>엑셀 다운로드</button><button className="btn-download" onClick={()=>window.print()}>PDF 다운로드</button></div></div>
      <div className="section report-export-panel">
        <div className="section-title">월간 실적 보고서 (지자체 보고용 엑셀)</div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <input type="month" className="form-input" style={{width:170,marginBottom:0}} value={reportMonth} onChange={e=>setReportMonth(e.target.value)}/>
          <button className="btn-primary" disabled={monthlyBusy} onClick={downloadMonthlyReport}>{monthlyBusy?'생성 중…':'엑셀 다운로드'}</button>
          <span style={{fontSize:15,color:'#94a3b8'}}>시트 4개 — 요약(안전확인 성공률·위험감지·일지) · 어르신별 실적 · 일별 현황 · 위험 감지 상세</span>
        </div>
      </div>
      <div className="report-stat-grid">
        {[{label:'총 통화',value:`${reportCalls.length}건`,Icon:Phone},{label:'긴급 감지',value:`${reportCalls.filter(c=>c.riskLevel==='critical').length}건`,Icon:AlertCircle,tone:'danger'},{label:'주의 감지',value:`${reportCalls.filter(c=>c.riskLevel==='urgent').length}건`,Icon:AlertTriangle,tone:'warning'},{label:'정상 통화',value:`${reportCalls.filter(c=>!c.riskLevel||c.riskLevel==='normal').length}건`,Icon:CheckCircle2},{label:'총 통화 시간',value:`${Math.round(reportCalls.reduce((s,c)=>s+(c.durationSec||0),0)/60)}분`,Icon:Clock},{label:'관리 어르신',value:`${elders.length}명`,Icon:Users}].map((s,i)=>(
          <div key={i} className={`report-stat-card ${s.tone?`is-${s.tone}`:''}`}>
            <s.Icon className="report-stat-icon" size={24}/>
            <div className="report-stat-content">
              <div className="report-stat-value">{s.value}</div>
              <div className="report-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="section">
        <div className="section-title">주간 통화 현황 (최근 7일)</div>
        <div className="chart-wrap">
          {(()=>{const last7=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=d.toISOString().slice(0,10);const dn=['일','월','화','수','목','금','토'][d.getDay()];const dc=reportCalls.filter(c=>(c.date||(c.at?c.at.slice(0,10):''))===ds);return{day:dn,calls:dc.length,danger:dc.filter(c=>c.riskLevel==='critical').length,warning:dc.filter(c=>c.riskLevel==='urgent').length};});const maxCalls=Math.max(1,...last7.map(x=>x.calls));return last7.map((d,i)=>(<div key={i} className="chart-col"><div className="chart-bar-wrap"><div className="chart-bar-total" style={{height:`${d.calls/maxCalls*100}%`}}><div className="chart-bar-danger" style={{height:`${d.calls?d.danger/d.calls*100:0}%`}}/><div className="chart-bar-warning" style={{height:`${d.calls?d.warning/d.calls*100:0}%`}}/></div></div><div className="chart-val">{d.calls}</div><div className="chart-day">{d.day}</div></div>));})()}
        </div>
        <div className="chart-legend"><span className="legend-item"><span className="legend-dot" style={{background:'#ef4444'}}/>긴급</span><span className="legend-item"><span className="legend-dot" style={{background:'#f59e0b'}}/>주의</span><span className="legend-item"><span className="legend-dot" style={{background:'#3b82f6'}}/>정상</span></div>
      </div>
      {/* ── 위험 키워드 통계 (실데이터 /stats, 기간선택·빈도·우선순위·추이) ── */}
      <div className="section">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:14}}>
          <div className="section-title" style={{marginBottom:0}}>위험 키워드 통계</div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {[['week','이번 주'],['month','이번 달'],['3month','최근 3개월'],['custom','직접 선택']].map(([k,label])=>(
              <button key={k} onClick={()=>setStatsRange(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(statsRange===k?'#246BEB':'#e2e8f0'),background:statsRange===k?'#eff6ff':'#fff',color:statsRange===k?'#246BEB':'#64748b',fontWeight:700,fontSize:16,cursor:'pointer'}}>{label}</button>
            ))}
            {statsRange==='custom' && (<>
              <input type="date" value={statsFrom} onChange={e=>setStatsFrom(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:16}}/>
              <span style={{color:'#94a3b8'}}>~</span>
              <input type="date" value={statsTo} onChange={e=>setStatsTo(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:16}}/>
            </>)}
            <button onClick={fetchStats} className="btn-download" style={{padding:'6px 12px'}}>{statsLoading?'불러오는 중':'새로고침'}</button>
          </div>
        </div>

        {(!statsData || statsData.available !== true) ? (
          // available!==true: 실패 응답({error:'인증 필요'} 등)이 '0건'으로 그럴듯하게 표시되지 않게
          <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>{statsLoading?'불러오는 중...':(statsData&&statsData.error?'통계를 불러오지 못했습니다. 새로고침 버튼으로 다시 시도해 주세요.':'아직 통계 데이터가 없습니다. 통화 중 위험 키워드가 감지되면 자동으로 쌓입니다.')}</div>
        ) : (()=>{
          const elderEntries = Object.entries((statsData.elders||{}) as Record<string, any>)
            .filter(([name])=>elders.some(e=>e.name===name))  // 등록된 어르신만 (옛 이름·더미 제외)
            .map(([name,es])=>({ name, es, score: priorityScore(es), prevTotal: (statsPrev&&statsPrev.elders&&statsPrev.elders[name]&&statsPrev.elders[name].total)||0 }))
            .sort((a,b)=>b.score-a.score);
          const topKw = (statsData.topKeywords||[])[0];
          const surge = elderEntries.filter(e=>e.es.total>e.prevTotal).sort((a,b)=>(b.es.total-b.prevTotal)-(a.es.total-a.prevTotal))[0];
          return (<>
            <div className="report-keyword-summary">
              <div style={{background:'#f8fafc',borderRadius:12,padding:16}}><div style={{fontSize:16,color:'#64748b'}}>총 위험 감지</div><div style={{fontSize:26,fontWeight:900,color:'#0f172a'}}>{statsData.totalEvents||0}건</div></div>
              <div style={{background:'#fff7ed',borderRadius:12,padding:16}}><div style={{fontSize:16,color:'#9a3412'}}>최다 키워드</div><div style={{fontSize:20,fontWeight:900,color:'#c2410c'}}>{topKw?`"${topKw.keyword}" ${topKw.count}건`:'-'}</div></div>
              <div style={{background:'#fef2f2',borderRadius:12,padding:16}}><div style={{fontSize:16,color:'#991b1b'}}>위험 급증 어르신</div><div style={{fontSize:20,fontWeight:900,color:'#dc2626'}}>{surge?`${surge.name} (+${surge.es.total-surge.prevTotal})`:'없음'}</div></div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {elderEntries.length===0 && <div style={{color:'#94a3b8',padding:20,textAlign:'center'}}>이 기간엔 위험 감지가 없습니다.</div>}
              {elderEntries.map((e,idx)=>{
                const trendDiff = e.es.total - e.prevTotal;
                return (
                  <div key={e.name} className="report-keyword-row">
                    <div style={{display:'flex',alignItems:'center',gap:10,minWidth:160}}>
                      <div style={{width:30,height:30,borderRadius:15,background:idx===0?'#dc2626':idx===1?'#f59e0b':'#94a3b8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16}}>{idx+1}</div>
                      <div><div style={{fontWeight:800,fontSize:17}}>{e.name}</div><div style={{fontSize:15,color:'#94a3b8'}}>우선순위 {e.score}점 · 총 {e.es.total}건</div></div>
                    </div>
                    <div style={{flex:1,display:'flex',flexWrap:'wrap',gap:6,minWidth:160}}>
                      {Object.entries((e.es.keywords||{}) as Record<string, any>).sort((a,b)=>b[1]-a[1]).map(([kw,cnt])=>{const L=LV_COLOR[kwLevel(kw)];return(<span key={kw} style={{background:L.bg,color:L.c,borderRadius:4,padding:'3px 10px',fontSize:16,fontWeight:700}}>{kw} ×{cnt}</span>);})}
                    </div>
                    <div style={{textAlign:'right',minWidth:90}}>
                      <div style={{fontSize:18,fontWeight:900,color:trendDiff>0?'#dc2626':trendDiff<0?'#16a34a':'#94a3b8'}}>{trendDiff>0?`↑ +${trendDiff}`:trendDiff<0?`↓ ${trendDiff}`:'→ 0'}</div>
                      <div style={{fontSize:14,color:'#94a3b8'}}>지난 기간 {e.prevTotal}건</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>);
        })()}
      </div>
      <div className="section">
        <div className="section-title">위험도 분포 <span style={{fontSize:15,fontWeight:600,color:'#94a3b8'}}>— 위 키워드 통계와 같은 기간 기준 (긴급 감지=위험, 그 외 감지=주의)</span></div>
        {(()=>{
          // 위 '위험 키워드 통계'와 같은 데이터(선택 기간 statsData)로 분류 — 실시간 알림 상태(status)와
          // 소스가 달라 "목록엔 주의 감지가 있는데 그래프는 0명"으로 어긋나던 문제 수정.
          const st = (statsData && statsData.elders) || null;
          const lvlOf = (name) => {
            if (!st) return null;
            const es = st[name];
            if (!es || !es.total) return 'normal';
            return ((es.byLevel || {}).critical || 0) > 0 ? 'danger' : 'warning';
          };
          // statsData 없으면(로딩·서버 장애) 기존 실시간 상태 기준 폴백
          const rDanger  = st ? elders.filter(e => lvlOf(e.name) === 'danger').length  : danger;
          const rWarning = st ? elders.filter(e => lvlOf(e.name) === 'warning').length : warning;
          const rNormal  = Math.max(0, elders.length - rDanger - rWarning);
          return (
        <div className="donut-wrap">
          <div className="donut-chart">
            <svg viewBox="0 0 120 120" width="160" height="160">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#fef2f2" strokeWidth="18"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#ef4444" strokeWidth="18" strokeDasharray={`${rDanger/elders.length*283} 283`} strokeDashoffset="0" transform="rotate(-90 60 60)"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#f59e0b" strokeWidth="18" strokeDasharray={`${rWarning/elders.length*283} 283`} strokeDashoffset={`-${rDanger/elders.length*283}`} transform="rotate(-90 60 60)"/>
              <circle cx="60" cy="60" r="45" fill="none" stroke="#22c55e" strokeWidth="18" strokeDasharray={`${rNormal/elders.length*283} 283`} strokeDashoffset={`-${(rDanger+rWarning)/elders.length*283}`} transform="rotate(-90 60 60)"/>
              <text x="60" y="55" textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{elders.length}</text>
              <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#94a3b8">전체</text>
            </svg>
          </div>
          <div className="donut-legend">
            {[{label:'위험',count:rDanger,color:'#ef4444'},{label:'주의',count:rWarning,color:'#f59e0b'},{label:'정상',count:rNormal,color:'#22c55e'}].map(item=>(<div key={item.label} className="donut-legend-item"><div className="donut-dot" style={{background:item.color}}/><div><div className="donut-label">{item.label}</div><div className="donut-count" style={{color:item.color}}>{item.count}명 ({Math.round(item.count/elders.length*100)}%)</div></div></div>))}
          </div>
        </div>
          );
        })()}
      </div>
      <div className="section">
        <div className="section-title">통화 종료 사유 <span style={{fontSize:15,fontWeight:600,color:'#94a3b8'}}>— 위 위험 키워드 통계와 같은 기간 기준</span></div>
        {(()=>{
          // dispatches는 발신 시도 단위 기록(진행 중 상태 ringing/answered/needs_confirm 포함) —
          // 도넛은 "끝난" 통화만 집계해야 하므로 종결 상태(completed/missed/failed)만 사용.
          const terminal = reportDispatches.filter(d => ['completed','missed','failed'].includes(d.status));
          const nDone = terminal.filter(d => d.status === 'completed').length;
          const nMissed = terminal.filter(d => d.status === 'missed').length;
          const nFailed = terminal.filter(d => d.status === 'failed').length;
          const total = terminal.length;
          if (total === 0) return <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>{statsLoading?'불러오는 중...':'이 기간엔 종료된 통화 발신 이력이 없습니다.'}</div>;
          const pct = (n) => n / total * 283;
          return (
            <div className="donut-wrap">
              <div className="donut-chart">
                <svg viewBox="0 0 120 120" width="160" height="160">
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#f0fdf4" strokeWidth="18"/>
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#22c55e" strokeWidth="18" strokeDasharray={`${pct(nDone)} 283`} strokeDashoffset="0" transform="rotate(-90 60 60)"/>
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#f59e0b" strokeWidth="18" strokeDasharray={`${pct(nMissed)} 283`} strokeDashoffset={`-${pct(nDone)}`} transform="rotate(-90 60 60)"/>
                  <circle cx="60" cy="60" r="45" fill="none" stroke="#ef4444" strokeWidth="18" strokeDasharray={`${pct(nFailed)} 283`} strokeDashoffset={`-${pct(nDone)+pct(nMissed)}`} transform="rotate(-90 60 60)"/>
                  <text x="60" y="55" textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{total}</text>
                  <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#94a3b8">종료 통화</text>
                </svg>
              </div>
              <div className="donut-legend">
                {[{label:'정상 종료',count:nDone,color:'#22c55e'},{label:'부재중(무응답)',count:nMissed,color:'#f59e0b'},{label:'발신 실패(시스템 오류)',count:nFailed,color:'#ef4444'}].map(item=>(<div key={item.label} className="donut-legend-item"><div className="donut-dot" style={{background:item.color}}/><div><div className="donut-label">{item.label}</div><div className="donut-count" style={{color:item.color}}>{item.count}건 ({Math.round(item.count/total*100)}%)</div></div></div>))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
