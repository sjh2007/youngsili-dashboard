// DashboardApplication.tsx의 page==='dashboard'(대시보드 홈) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { Plus, ArrowRight, CheckCircle2, Users, AlertCircle, AlertTriangle, Phone, Activity, FileText, UserRound } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { normalizeRegion } from '../dashboardConstants';
import { STATUS_CONFIG } from '../../constants/app';

export default function DashboardHomePage(props: any) {
  const {
    me, openRegister, goPage, alertsData, alertIsReal, alertEnCode, alertKw, elders,
    getNoResponseDays, weatherData, alertsOpen, setAlertsOpen, openDetail, setCallModal, T,
    isDisability, setSortBy, noRespOpen, setNoRespOpen, danger, warning, normal, todoDone,
    setTodoDone, todayCalls, drillDispatch, dispatchTotal, answeredCount, missedCount, drillCalls,
    totalCalls, criticalCount, urgentCount, normalCount, safetyToday, calling, makeCall, alertCount,
    getSolitudeRisk, renderLastCall,
  } = props;

  return (
    <div className="fade-in dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <div className="dashboard-eyebrow">{me?.orgName || '영실이 돌봄센터'} · 오늘의 돌봄 현황</div>
          <h1>우선 확인이 필요한 어르신부터 살펴보세요</h1>
          <p>위험 알림과 미응답 현황을 확인하고 오늘의 안전확인 업무를 처리할 수 있습니다.</p>
        </div>
        <div className="dashboard-welcome-actions">
          <button className="btn-secondary" onClick={openRegister}><Plus size={18}/> 신규 등록</button>
          <button className="btn-primary" onClick={()=>goPage('schedule')}>전화 발신 시작 <ArrowRight size={18}/></button>
        </div>
      </section>
      {(() => {
        // 통화 중 위험 키워드 감지 — 어르신별·유형별 최신 1건으로 집계 ("오늘 N회"), 알림 피로 방지 (V2)
        // missed/help/safe 등 코드 알림은 문구 자체가 설명 → 따옴표 없이 (alertKw/alertEnCode)
        const kwAlerts = alertsData.filter(a => !a.read && (a.level === 'critical' || a.level === 'urgent') && alertIsReal(a));
        const byKey: Record<string, any> = {};  // alertsData는 최신순 → 키별 첫 항목이 최신
        kwAlerts.forEach(a => {
          const k = `${a.name}|${alertEnCode(a) || 'kw'}`;
          if (!byKey[k]) byKey[k] = { ...a, count: 0 };
          byKey[k].count++;
        });
        const alerts = Object.values(byKey).map(a => {
          const kw = alertKw(a);
          const code = alertEnCode(a);
          const el = elders.find(e => e.name === a.name);
          const msg = code ? `${kw} → ${code === 'missed' ? '안전확인 필요' : '즉시 확인'}` : `“${kw}” 위험 키워드 감지`;
          return { elder: el, name: a.name, level: a.level, msg, count: a.count, time: a.timestamp };
        });
        // 미응답: "오늘 새로 3일차 진입"만 개별 배너로 승격, 만성(4일 이상)은 요약 1줄 + 펼치기 (알림 피로 방지)
        const noResp = elders
          .map(e => ({ e, d: getNoResponseDays(e.lastCall, e.lastCallAt) }))
          .filter(x => x.d >= 3 && x.d < 99)
          .sort((a, b) => b.d - a.d);
        const noRespNew = noResp.filter(x => x.d === 3);
        const noRespChronic = noResp.filter(x => x.d > 3);
        const heatwaveElders = elders.filter(e => weatherData[normalizeRegion(e.region)]?.alert === 'heatwave');
        if (alerts.length === 0 && noResp.length === 0 && heatwaveElders.length === 0) return (
          <section className="dashboard-priority dashboard-priority-safe">
            <div className="dashboard-block-heading">
              <div><span className="dashboard-block-kicker">우선 대응</span><h2>현재 긴급하게 확인할 항목이 없습니다</h2></div>
              <CheckCircle2 size={24} color="#228738"/>
            </div>
            <p>새로운 위험 알림이나 장기 미응답이 발생하면 이 영역에 먼저 표시됩니다.</p>
          </section>
        );
        // P2-9: 배너 3건 초과 시 접기 — 위험(critical)은 항상 노출
        const ordered = [...alerts].sort((a, b) => (a.level==='critical'?0:1) - (b.level==='critical'?0:1));
        const kwRows = ordered.map((a, i) => (
              <div key={`kw${i}`} className={`alert-banner ${a.level==='critical'?'alert-banner-danger':'alert-banner-warning'}`} onClick={() => a.elder && openDetail(a.elder)}>
                <span className={`alert-banner-tag ${a.level==='critical'?'tag-danger':'tag-warning'}`}>{a.level==='critical'?'위험':'주의'}</span>
                <div className="alert-banner-body">
                  <span className="alert-banner-name">{a.elder ? `${a.elder.name}${a.elder.age?` (${a.elder.age}세)`:''}` : a.name}</span>
                  <span className="alert-banner-msg">{a.msg}</span>
                  {a.count > 1 && <span className="alert-banner-count">오늘 {a.count}회</span>}
                  {a.time && <span className="alert-banner-time">최근 {new Date(a.time).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>}
                </div>
                {a.elder && <button className="btn-primary btn-banner-call" onClick={e=>{e.stopPropagation();setCallModal(a.elder);}}>앱 전화</button>}
              </div>
        ));
        const newRows = noRespNew.map(({e, d}) => (
              <div key={`nr${e.id}`} className="alert-banner alert-banner-danger" onClick={() => openDetail(e)}>
                <span className="alert-banner-tag tag-danger">미응답</span>
                <div className="alert-banner-body">
                  <span className="alert-banner-name">{e.name}{e.age?` (${e.age}세)`:''}</span>
                  <span className="alert-banner-msg">{d}일째 미응답 · 오늘 확인 필요</span>
                </div>
                <button className="btn-primary btn-banner-call" onClick={ev=>{ev.stopPropagation();setCallModal(e);}}>앱 전화</button>
              </div>
        ));
        // 위험(빨강) 행은 항상 노출: critical 키워드 → 미응답 신규(위험) → 주의 순으로 배치
        const nCritical = ordered.filter(a => a.level === 'critical').length;
        const rows = [...kwRows.slice(0, nCritical), ...newRows, ...kwRows.slice(nCritical)];
        const limit = Math.max(3, nCritical + newRows.length);
        const visibleRows = alertsOpen ? rows : rows.slice(0, limit);
        const hiddenCnt = rows.length - visibleRows.length;
        return (
          <section className="dashboard-priority">
            <div className="dashboard-block-heading">
              <div><span className="dashboard-block-kicker">우선 대응</span><h2>지금 확인이 필요한 항목</h2></div>
              <span className="dashboard-priority-count">{rows.length + (noRespChronic.length > 0 ? 1 : 0) + (heatwaveElders.length > 0 ? 1 : 0)}건</span>
            </div>
            <div className="alert-stack">
            {visibleRows}
            {(hiddenCnt > 0 || (alertsOpen && rows.length > limit)) && (
              <button className="banner-btn banner-btn--ghost alert-more" onClick={()=>setAlertsOpen(v=>!v)}>
                {alertsOpen ? '접기 ▴' : `외 ${hiddenCnt}건 ▾`}
              </button>
            )}
            {noRespChronic.length > 0 && (
              <div className="alert-banner alert-banner-danger" style={{cursor:'default'}}>
                <span className="alert-banner-tag tag-danger">미응답</span>
                <div className="alert-banner-body">
                  <span className="alert-banner-name">미응답 {T.elder} {noRespChronic.length}명</span>
                  <span className="alert-banner-msg">최장 {noRespChronic[0].d}일째 무응답 · 즉시 확인 필요</span>
                </div>
                <button className="banner-btn banner-btn--danger" onClick={()=>{setSortBy('noResponse');goPage('elders');}}>{T.elder} 관리</button>
                <button className="banner-btn banner-btn--ghost" onClick={()=>setNoRespOpen(v=>!v)}>{noRespOpen?'접기 ▴':`펼치기 (${noRespChronic.length}) ▾`}</button>
              </div>
            )}
            {noRespOpen && noRespChronic.map(({e, d}) => (
              <div key={e.id} className="alert-banner alert-banner-danger alert-banner-sub" onClick={() => openDetail(e)}>
                <span className="alert-banner-tag tag-danger">{d}일째</span>
                <div className="alert-banner-body">
                  <span className="alert-banner-name">{e.name}{e.age?` (${e.age}세)`:''}</span>
                  <span className="alert-banner-msg">{d}일째 미응답 · 즉시 확인 필요</span>
                </div>
                <button className="btn-primary btn-banner-call" onClick={ev=>{ev.stopPropagation();setCallModal(e);}}>앱 전화</button>
              </div>
            ))}
            {heatwaveElders.length > 0 && (
              <div className="alert-banner alert-banner-warning">
                <span className="alert-banner-tag tag-warning">폭염</span>
                <div className="alert-banner-body">
                  <span className="alert-banner-msg">폭염경보 발효 · 영향 {T.elder} {heatwaveElders.length}명 안전 확인 필요</span>
                </div>
                {!isDisability && <button className="banner-btn banner-btn--warn" onClick={()=>goPage('data')}>대상 보기</button>}
              </div>
            )}
            </div>
          </section>
        );
      })()}

      <div className="stat-grid">
        {[
          {cls:'stat-total',   label:'총 담당 어르신', num:elders.length, Icon:Users,        ic:'#334155'},
          {cls:'stat-danger',  label:'위험 감지',     num:danger,        Icon:AlertCircle,  ic:'#DC2626'},
          {cls:'stat-warning', label:'주의 필요',     num:warning,       Icon:AlertTriangle,ic:'#F59E0B'},
          {cls:'stat-normal',  label:'정상',          num:normal,        Icon:CheckCircle2, ic:'#16A34A'},
        ].map(s=>(
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-top"><span className="stat-label">{s.label}</span><s.Icon size={20} strokeWidth={1.75} color={s.ic} aria-hidden="true"/></div>
            <div className="stat-num-row"><span className="stat-num">{s.num}</span><span className="stat-unit">명</span></div>
          </div>
        ))}
      </div>

      <div className="dashboard-flow">
        <div className="dash-col-left">
          {(() => {
            // "오늘 할 일" — 데이터에서 파생한 행동 체크리스트 (V2)
            const kwUnread = alertsData.filter(a=>!a.read&&(a.level==='critical'||a.level==='urgent')&&alertIsReal(a)).length;
            const noRespCnt = elders.filter(e=>{const d=getNoResponseDays(e.lastCall,e.lastCallAt);return d>=3&&d<99;}).length;
            const visitCnt = elders.filter(e=>e.visits>0).length;
            const heatCnt = elders.filter(e=>weatherData[normalizeRegion(e.region)]?.alert==='heatwave').length;
            const todos = [
              noRespCnt>0 && {key:'noresp', label:'미응답 어르신 확인', count:`${noRespCnt}명`, tone:'danger', go:'elders'},
              kwUnread>0  && {key:'kw',     label:'위험 키워드 알림 확인', count:`${kwUnread}건`, tone:'danger', go:'health'},
              visitCnt>0  && {key:'visit',  label:'방문 필요 어르신 확인', count:`${visitCnt}명`, tone:'warning', go:'elders'},
              heatCnt>0   && {key:'heat',   label:'폭염경보 안전 확인', count:`${heatCnt}명`, tone:'warning', go:'script'},
            ].filter(Boolean);
            const doneCnt = todos.filter(t=>todoDone[t.key]).length;
            return (
              <div className="section">
                <div className="todo-header"><div className="section-title" style={{marginBottom:0}}>오늘 할 일</div><span className="todo-progress">{doneCnt} / {todos.length} 완료</span></div>
                {todos.length===0 ? (
                  <div className="empty-state empty-state--sm">
                    <div className="empty-title">오늘 처리할 업무가 없습니다</div>
                    <div className="empty-desc">위험 키워드·미응답·건강 이상이 감지되면 이 자리에 자동으로 쌓입니다.</div>
                    <button className="btn-secondary" onClick={()=>goPage('schedule')}>전화 일정 관리</button>
                  </div>
                ) : todos.map(t=>(
                  <div key={t.key} className={`todo-item ${todoDone[t.key]?'todo-item-done':''}`}>
                    <button className={`todo-check ${todoDone[t.key]?'todo-check-on':''}`} onClick={()=>setTodoDone(prev=>({...prev,[t.key]:!prev[t.key]}))} aria-label="완료 체크">
                      {todoDone[t.key] && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                    </button>
                    <span className="todo-label" onClick={()=>goPage(t.go)}>{t.label}</span>
                    <span className={`todo-count ${t.tone==='danger'?'todo-count-danger':'todo-count-warning'}`}>{t.count}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="section">
            {(() => {
              // 오늘 통화 현황 — ①진행(헤드라인) ②연결 결과 ③통화 내용 위험 순.
              // 성격이 다른 두 분류를 한 줄에 섞어 각주로 설명하던 구조를 그룹으로 분리하고,
              // 0건 항목은 회색으로 눌러 '행동이 필요한 숫자'만 눈에 들어오게 한다.
              const active = elders.filter(e=>e.callActive);
              const calledSet = new Set(todayCalls.map(c=>String(c.phone||'').replace(/\D/g,'')));
              const done = active.filter(e=>calledSet.has(String(e.phone||'').replace(/\D/g,''))).length;
              const rate = active.length ? Math.round(done/active.length*100) : 0;
              // 0건은 눌러서(is-zero) '행동이 필요한 숫자'만 눈에 들어오게 한다.
              const stat = (num, label, tone, onClick, hint?) => (
                <button
                  key={label}
                  className={`callstat ${num>0 && tone ? 'tone-'+tone : ''} ${num===0 ? 'is-zero' : ''}`}
                  onClick={onClick}
                  title={hint}
                >
                  <span className="callstat-num">{num}</span>
                  <span className="callstat-label">{label}</span>
                </button>
              );
              return (
                <>
                  <div className="dash-section-header">
                    <div className="section-title">오늘 통화 현황</div>
                    <button className="btn-secondary btn-xs" onClick={()=>drillDispatch('all')}>발신 이력</button>
                  </div>

                  <div className="callprog">
                    <div className="callprog-head">
                      <span className="callprog-main">전화 예정 <b>{active.length}명</b> 중 <b>{done}명</b> 완료</span>
                      <span className="callprog-rate">{rate}%</span>
                    </div>
                    <div className="callrate-bar"><div className="callrate-fill" style={{width:`${rate}%`}}/></div>
                  </div>

                  <div className="callgroup">
                    <div className="callgroup-label">연결 결과 <span>오늘 발신 {dispatchTotal}건</span></div>
                    <div className="callgroup-items">
                      {stat(answeredCount, '받음', null, ()=>drillDispatch('received'), '받은 통화 보기')}
                      {stat(missedCount, missedCount>0 ? '부재중 · 재발신 필요' : '부재중', 'danger', ()=>drillDispatch('missed'), '부재중만 보기 → 재발신')}
                    </div>
                  </div>

                  <div className="callgroup">
                    <div className="callgroup-label">통화 내용 <span>받은 통화 {totalCalls}건 기준</span></div>
                    <div className="callgroup-items">
                      {stat(criticalCount, criticalCount>0 ? '긴급 · 즉시 확인' : '긴급', 'danger', ()=>drillCalls('critical'), '긴급 통화 보기')}
                      {stat(urgentCount, '주의', 'warning', ()=>drillCalls('urgent'), '주의 통화 보기')}
                      {stat(normalCount, '정상', null, ()=>drillCalls('normal'), '정상 통화 보기')}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {(() => {
            // ⚠️ 오늘 안전확인 미완료 보드 — 부재중(자동 재발신 소진)·발신실패로 끝나고 오늘 성공 통화가 없는 어르신
            // (안전확인의 핵심 = 응답 없는 어르신을 놓치지 않기 → 담당자 재발신/방문으로 폐루프)
            const { unchecked, undialed } = safetyToday();
            if (!unchecked.length && !undialed) return null;
            return (
              <div className="section" style={unchecked.length ? { borderLeft: '4px solid #dc2626' } : {}}>
                <div className="section-title">오늘 안전확인 미완료 {unchecked.length > 0 && <span style={{ color: '#dc2626' }}>{unchecked.length}명</span>}</div>
                {unchecked.length === 0 ? (
                  <div style={{ fontSize:16, color: '#16a34a', fontWeight: 600 }}>발신한 어르신은 모두 안전확인 완료됐습니다.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {unchecked.map(({ e, d }) => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: d.status === 'missed' ? '#fff7ed' : '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 90, fontWeight: 800 }}>{e.name}</div>
                        <div style={{ minWidth: 80, fontSize:16, color: '#64748b' }}>{e.region}</div>
                        <div style={{ flex: 1, fontSize:16, fontWeight: 700, color: d.status === 'missed' ? '#ea580c' : '#dc2626' }}>
                          {d.status === 'missed' ? `부재중 — 자동 재발신 ${d.retryCount || 0}회에도 무응답` : `발신 실패${d.reason ? ` (${d.reason})` : ''}`}
                        </div>
                        <div style={{ fontSize:15, color: '#94a3b8' }}>{d.sentAtIso ? new Date(d.sentAtIso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        <button className="btn-call" style={{ fontSize:15, padding: '5px 12px' }} disabled={calling === e.id} onClick={() => makeCall(e)}>{calling === e.id ? '발신 중…' : '재발신'}</button>
                      </div>
                    ))}
                    <div style={{ fontSize:15, color: '#dc2626', fontWeight: 600 }}>재발신에도 무응답이면 직접 전화 또는 방문 확인이 필요합니다.</div>
                  </div>
                )}
                {undialed > 0 && <div style={{ fontSize:15, color: '#94a3b8', marginTop: 8 }}>· 오늘 아직 발신하지 않은 어르신 {undialed}명 (전화 발신 관리에서 발신)</div>}
              </div>
            );
          })()}

          <div className="section">
            <div className="section-title">자주 찾는 업무</div>
            <div className="quick-actions">
              <button className="quick-btn quick-danger" onClick={()=>goPage('schedule')}><AlertCircle/><span>위험 어르신만 전화</span><span className="quick-count">{elders.filter(e=>e.status!=='normal').length}명</span></button>
              <button className="quick-btn quick-all" onClick={()=>goPage('schedule')}><Phone/><span>전체 일괄 앱 알림</span><span className="quick-count">{elders.filter(e=>e.callActive).length}명</span></button>
              <button className="quick-btn" onClick={()=>goPage('health')}><Activity/><span>건강 상태 확인</span>{alertCount > 0 && <span className="quick-count">{alertCount}건</span>}</button>
              <button className="quick-btn quick-report" onClick={()=>goPage('report')}><FileText/><span>오늘 리포트 출력</span></button>
              <button className="quick-btn quick-register" onClick={openRegister}><UserRound/><span>어르신 신규 등록</span></button>
            </div>
          </div>
        </div>

      </div>

      <div className="section">
        <div className="dash-section-header">
          <div className="section-title">전체 어르신 현황</div>
          <button className="btn-primary" onClick={openRegister}>+ 신규 등록</button>
        </div>
        <table className="table">
          <thead><tr><th>어르신</th><th>나이</th><th>지역</th><th>담당 복지사</th><th>마지막 통화</th><th>미응답</th><th>고독사위험</th><th>상태</th><th>즉시 전화</th></tr></thead>
          <tbody>
            {elders.length===0 && (
              <tr><td colSpan={9}>
                <div className="empty-state">
                  <div className="empty-title">아직 등록된 어르신이 없습니다</div>
                  <div className="empty-desc">어르신을 등록하면 통화 기록·건강 상태·위험 신호가 이 화면에 모입니다.<br/>여러 명은 CSV로 한 번에 등록할 수 있습니다.</div>
                  <div className="empty-actions">
                    <button className="btn-primary" onClick={openRegister}>첫 어르신 등록하기</button>
                    <button className="btn-secondary" onClick={()=>goPage('elders')}>CSV로 일괄 등록</button>
                  </div>
                </div>
              </td></tr>
            )}
            {[...elders].sort((a,b)=>{const order={danger:0,warning:1,normal:2};return order[a.status]-order[b.status];}).map(elder=>{
              const risk = getSolitudeRisk(elder);
              const days = getNoResponseDays(elder.lastCall, elder.lastCallAt);
              return (
                <tr key={elder.id} style={{cursor:'pointer'}} onClick={()=>openDetail(elder)}>
                  <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="table-avatar">{(elder.name||'?')[0]}</div><span style={{fontWeight:700}}>{elder.name}</span>{elder.keyword&&<span className="keyword-tag">"{elder.keyword}"</span>}</div></td>
                  <td>{elder.age?`${elder.age}세`:'—'}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{elder.region}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{renderLastCall(elder)}</td>
                  <td>{days===0?<span style={{color:'#22c55e',fontWeight:700,fontSize:15}}>정상</span>:<span style={{color:days>=3?'#ef4444':'#f59e0b',fontWeight:700,fontSize:15}}>{days>=99?'통화이력 없음':`${days}일`}</span>}</td>
                  <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                  <td><StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge></td>
                  <td onClick={e=>e.stopPropagation()}><button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'발신 중':'앱 전화'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
