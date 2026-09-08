// DashboardApplication.tsx의 page==='console'(운영자 콘솔) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { HISTORY_PAGE_SIZE } from '../dashboardConstants';
import { RISK_CONFIG } from '../../constants/app';

export default function ConsolePage(props: any) {
  const {
    consoleHealth, consoleLoading, consoleCalls, fetchConsole, consoleHistory, consoleHistoryLoading,
    fetchConsoleHistory, consoleHistoryOrg, setConsoleHistoryOrg, orgs, consoleHistoryFrom,
    setConsoleHistoryFrom, consoleHistoryTo, setConsoleHistoryTo, consoleHistoryPage,
    setConsoleHistoryPage, orgSuspending, creditOrg, toggleOrgSuspend, consoleAuditLogs,
    consoleAuditLoading, fetchConsoleAuditLogs, consoleAuditActor, setConsoleAuditActor,
  } = props;

  return (
    <div className="fade-in">
      <section className="section" style={{marginBottom:20}}>
        <div className="section-title" style={{marginBottom:14}}>
          시스템 상태
          {consoleHealth && (
            <span style={{
              marginLeft:10, fontSize:13, fontWeight:600, padding:'2px 10px', borderRadius:12,
              background: consoleHealth.status==='ok' ? '#e6f4ea' : '#fce8e6',
              color: consoleHealth.status==='ok' ? '#1e8e3e' : '#c5221f',
            }}>{consoleHealth.status==='ok' ? '정상' : '이상 감지'}</span>
          )}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
          {(consoleHealth?.components || []).map((c) => (
            <div key={c.name} style={{
              border:'1px solid #dadce0', borderRadius:8, padding:'14px 16px',
              background:'#fff', display:'flex', flexDirection:'column', gap:6,
            }}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{
                  width:9, height:9, borderRadius:'50%', flexShrink:0,
                  background: c.ok ? '#1e8e3e' : '#d93025',
                }}/>
                <span style={{fontWeight:600, fontSize:15, color:'#202124'}}>{c.name}</span>
              </div>
              <div style={{fontSize:13, color: c.ok ? '#5f6368' : '#c5221f'}}>
                {c.ok ? `정상 응답 (${c.latencyMs}ms)` : (c.detail || '응답 없음')}
              </div>
            </div>
          ))}
          {!consoleHealth && !consoleLoading && (
            <div style={{color:'#5f6368', fontSize:14}}>데이터 없음</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="script-editor-header" style={{marginBottom:10}}>
          <div className="section-title" style={{marginBottom:0}}>
            지금 진행 중인 통화 ({consoleCalls.length}건, 기관 전체)
          </div>
          <button className={`btn-download ${consoleLoading?'btn-calling':''}`} onClick={()=>fetchConsole()} disabled={consoleLoading}>
            {consoleLoading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
        {consoleCalls.length === 0 ? (
          <div style={{color:'#5f6368', fontSize:14, padding:'20px 4px'}}>진행 중인 통화가 없습니다</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
              <thead>
                <tr style={{textAlign:'left', color:'#5f6368', borderBottom:'1px solid #dadce0'}}>
                  <th style={{padding:'8px 10px', fontWeight:500}}>어르신</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>기관</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>채널</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>상태</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>경과 시간</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>통화 ID</th>
                </tr>
              </thead>
              <tbody>
                {consoleCalls.map((c) => (
                  <tr key={c.callId} style={{borderBottom:'1px solid #f1f3f4'}}>
                    <td style={{padding:'10px'}}>{c.name || '(이름 없음)'}</td>
                    <td style={{padding:'10px', color:'#5f6368'}}>{c.orgId}</td>
                    <td style={{padding:'10px'}}>{c.channel === 'pstn' ? '070' : '앱'}</td>
                    <td style={{padding:'10px'}}>
                      <span style={{
                        fontSize:12, fontWeight:600, padding:'2px 8px', borderRadius:10,
                        background: c.status==='answered' ? '#e6f4ea' : '#fff8e1',
                        color: c.status==='answered' ? '#1e8e3e' : '#754d00',
                      }}>{c.status==='answered' ? '통화 중' : '발신 중'}</span>
                    </td>
                    <td style={{padding:'10px'}}>{c.elapsedSec}초</td>
                    <td style={{padding:'10px', fontFamily:'monospace', fontSize:12, color:'#5f6368'}}>{c.callId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section" style={{marginTop:20}}>
        <div className="script-editor-header" style={{marginBottom:10}}>
          <div className="section-title" style={{marginBottom:0}}>
            통화 이력 ({consoleHistory.length}건, 기관 전체)
          </div>
          <button className={`btn-download ${consoleHistoryLoading?'btn-calling':''}`} onClick={fetchConsoleHistory} disabled={consoleHistoryLoading}>
            {consoleHistoryLoading ? '조회 중...' : '조회'}
          </button>
        </div>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:14}}>
          <select className="form-input" style={{width:180, margin:0}} value={consoleHistoryOrg} onChange={e=>setConsoleHistoryOrg(e.target.value)}>
            <option value="">기관 전체</option>
            {orgs.map(o => <option key={o.orgId} value={o.orgId}>{o.name}</option>)}
          </select>
          <input type="date" className="form-input" style={{width:160, margin:0}} value={consoleHistoryFrom} onChange={e=>setConsoleHistoryFrom(e.target.value)} />
          <span style={{color:'#5f6368'}}>~</span>
          <input type="date" className="form-input" style={{width:160, margin:0}} value={consoleHistoryTo} onChange={e=>setConsoleHistoryTo(e.target.value)} />
          <span style={{fontSize:12, color:'#5f6368'}}>기본: 최근 30일 · 최근 200건</span>
        </div>
        {consoleHistory.length === 0 ? (
          <div style={{color:'#5f6368', fontSize:14, padding:'20px 4px'}}>
            {consoleHistoryLoading ? '불러오는 중...' : '조회된 통화 이력이 없습니다'}
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
              <thead>
                <tr style={{textAlign:'left', color:'#5f6368', borderBottom:'1px solid #dadce0'}}>
                  <th style={{padding:'8px 10px', fontWeight:500}}>어르신</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>전화번호</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>기관</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>채널</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>상태</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>시간</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>통화시간</th>
                </tr>
              </thead>
              <tbody>
                {consoleHistory.slice((consoleHistoryPage-1)*HISTORY_PAGE_SIZE, consoleHistoryPage*HISTORY_PAGE_SIZE).map((c) => {
                  const R = RISK_CONFIG[c.riskLevel] || {};
                  const org = orgs.find(o => o.orgId === c.orgId);
                  return (
                    <tr key={c.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{c.elderName || '(이름 없음)'}</td>
                      <td style={{padding:'10px', color:'#5f6368'}}>{c.phone}</td>
                      <td style={{padding:'10px', color:'#5f6368'}}>{org?.name || c.orgId || '-'}</td>
                      <td style={{padding:'10px'}}>{c.channel === 'pstn' ? '070' : '앱'}</td>
                      <td style={{padding:'10px'}}>
                        <span className={`result-pill ${c.riskLevel==='critical'?'pill-danger':c.riskLevel==='urgent'?'pill-warning':'pill-normal'}`}>{R.label || '정상'}</span>
                      </td>
                      <td style={{padding:'10px', color:'#5f6368'}}>{c.at ? new Date(c.at).toLocaleString('ko-KR') : (c.date || '-')}</td>
                      <td style={{padding:'10px'}}>{c.durationSec ? `${c.durationSec}초` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {consoleHistory.length > HISTORY_PAGE_SIZE && (() => {
          const totalPages = Math.ceil(consoleHistory.length / HISTORY_PAGE_SIZE);
          const start = (consoleHistoryPage-1)*HISTORY_PAGE_SIZE + 1;
          const end = Math.min(consoleHistoryPage*HISTORY_PAGE_SIZE, consoleHistory.length);
          return (
            <div style={{display:'flex', alignItems:'center', gap:10, marginTop:14, justifyContent:'flex-end'}}>
              <span style={{fontSize:13, color:'#5f6368'}}>{start}–{end} / 총 {consoleHistory.length}건</span>
              <button className="btn-download" disabled={consoleHistoryPage<=1} onClick={()=>setConsoleHistoryPage(p=>Math.max(1,p-1))}>이전</button>
              <span style={{fontSize:13, color:'#5f6368'}}>{consoleHistoryPage} / {totalPages}</span>
              <button className="btn-download" disabled={consoleHistoryPage>=totalPages} onClick={()=>setConsoleHistoryPage(p=>Math.min(totalPages,p+1))}>다음</button>
            </div>
          );
        })()}
      </section>

      {/* 2026-08-31: plan(trial/standard) 필드는 여전히 조회 전용 표시일 뿐(실제 결제
          연동 없음). 2026-08-31(포트원 결제 1단계) 추가: 크레딧 잔액 표시 + 콘솔 수동
          충전 — 실제 포트원 카드결제 연동 전까지 최소한의 접근 게이트(잔액 0이면
          하드블록, org.guard.ts)를 관리자가 수동으로 운영하기 위한 임시 조치. */}
      <section className="section" style={{marginTop:20}}>
        <div className="section-title" style={{marginBottom:10}}>
          요금제·기관 관리 ({orgs.length}개 기관)
          <span style={{marginLeft:10, fontSize:12, fontWeight:500, color:'#94a3b8'}}>요금제는 실제 결제(포트원) 연동 전 · 크레딧은 수동 충전(1단계)</span>
        </div>
        {orgs.length === 0 ? (
          <div style={{color:'#5f6368', fontSize:14, padding:'20px 4px'}}>기관 데이터가 없습니다</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
              <thead>
                <tr style={{textAlign:'left', color:'#5f6368', borderBottom:'1px solid #dadce0'}}>
                  <th style={{padding:'8px 10px', fontWeight:500}}>기관명</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>기관코드</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>요금제</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>크레딧 잔액</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>대상자</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>계정</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>상태</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => {
                  const suspended = o.suspended === true;
                  return (
                  <tr key={o.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                    <td style={{padding:'10px'}}>{o.name}</td>
                    <td style={{padding:'10px', fontFamily:'monospace', color:'#5f6368'}}>{o.code}</td>
                    <td style={{padding:'10px'}}>
                      <span style={{
                        fontSize:12, fontWeight:600, padding:'2px 10px', borderRadius:12,
                        background: o.plan==='standard' ? '#e6f4ea' : o.plan==='trial' ? '#fff8e1' : '#f1f3f4',
                        color: o.plan==='standard' ? '#1e8e3e' : o.plan==='trial' ? '#754d00' : '#5f6368',
                      }}>{o.plan==='standard'?'정식':o.plan==='trial'?'체험판':(o.plan||'미설정')}</span>
                    </td>
                    <td style={{padding:'10px'}}>
                      {o.creditBalance === null || o.creditBalance === undefined ? (
                        <span style={{color:'#94a3b8'}}>무제한(구기관)</span>
                      ) : (
                        <span style={{fontWeight:700, color: o.creditBalance <= 0 ? '#c5221f' : '#0f172a'}}>{Number(o.creditBalance).toLocaleString()}원</span>
                      )}
                    </td>
                    <td style={{padding:'10px'}}>{o.elderCount}명</td>
                    <td style={{padding:'10px'}}>{o.userCount}명</td>
                    <td style={{padding:'10px'}}>
                      <span style={{
                        fontSize:12, fontWeight:600, padding:'2px 10px', borderRadius:12,
                        background: suspended ? '#fce8e6' : '#e6f4ea',
                        color: suspended ? '#c5221f' : '#1e8e3e',
                      }}>{suspended ? '정지됨' : '정상'}</span>
                    </td>
                    <td style={{padding:'10px', display:'flex', gap:6}}>
                      <button
                        className="btn-secondary"
                        style={{fontSize:13, padding:'4px 10px', color:'#246BEB'}}
                        disabled={orgSuspending === o.orgId}
                        onClick={()=>creditOrg(o)}
                      >충전</button>
                      <button
                        className="btn-secondary"
                        style={{fontSize:13, padding:'4px 10px', color: suspended ? '#1e8e3e' : '#c5221f'}}
                        disabled={orgSuspending === o.orgId}
                        onClick={()=>toggleOrgSuspend(o, !suspended)}
                      >{orgSuspending === o.orgId ? '처리 중...' : (suspended ? '재개' : '정지')}</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section" style={{marginTop:20}}>
        <div className="script-editor-header" style={{marginBottom:10}}>
          <div className="section-title" style={{marginBottom:0}}>
            감사 로그 ({consoleAuditLogs.length}건)
          </div>
          <button className={`btn-download ${consoleAuditLoading?'btn-calling':''}`} onClick={fetchConsoleAuditLogs} disabled={consoleAuditLoading}>
            {consoleAuditLoading ? '조회 중...' : '조회'}
          </button>
        </div>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:14}}>
          <input className="form-input" style={{width:240, margin:0}} placeholder="관리자 이메일로 필터 (선택)" value={consoleAuditActor} onChange={e=>setConsoleAuditActor(e.target.value)} />
          <span style={{fontSize:12, color:'#5f6368'}}>기본: 최근 7일 · 최근 100건 — 누가 언제 콘솔에서 뭘 조회했는지</span>
        </div>
        {consoleAuditLogs.length === 0 ? (
          <div style={{color:'#5f6368', fontSize:14, padding:'20px 4px'}}>
            {consoleAuditLoading ? '불러오는 중...' : '조회된 감사 로그가 없습니다'}
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
              <thead>
                <tr style={{textAlign:'left', color:'#5f6368', borderBottom:'1px solid #dadce0'}}>
                  <th style={{padding:'8px 10px', fontWeight:500}}>시각</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>관리자</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>조회 항목</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>상세</th>
                </tr>
              </thead>
              <tbody>
                {consoleAuditLogs.map((l) => (
                  <tr key={l.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                    <td style={{padding:'10px', color:'#5f6368'}}>{l.at ? new Date(l.at).toLocaleString('ko-KR') : '-'}</td>
                    <td style={{padding:'10px'}}>{l.actorEmail || '-'}</td>
                    <td style={{padding:'10px', fontFamily:'monospace', fontSize:12}}>{l.action}</td>
                    <td style={{padding:'10px', color:'#5f6368', fontSize:12}}>{l.detail ? JSON.stringify(l.detail) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
