// AI영실이 운영 콘솔 — 기관 대시보드와 완전히 분리된 별도 빌드 타겟(superadmin 전용).
// 같은 레포·같은 authFetch/SERVER_URL/Firebase 로그인을 재사용하되, 진입점만 다르다
// (src/index.tsx가 REACT_APP_TARGET=console일 때 App 대신 이 컴포넌트를 렌더).
// 권한 판정은 별도 API 없이 GET /console/health 호출 결과(403이면 비superadmin)로 대신한다.
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, authEnabled } from '../firebase';
import { SERVER_URL, authFetch, errMsg } from '../utils/api';
// App.css는 src/index.tsx에서 정적으로 이미 import됨(동적 import로 인한 FOUC 방지 목적)

const NAVY = '#003675', BLUE = '#246beb';

function LoginScreen({ onLoggedIn }: { onLoggedIn?: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const doLogin = async () => {
    setErr(''); setBusy(true);
    try {
      await signInWithEmailAndPassword(auth as any, email.trim(), pw);
      onLoggedIn && onLoggedIn();
    } catch (e: any) {
      setErr(/wrong-password|user-not-found|invalid-credential/.test(e.code || '') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : '로그인 실패. 잠시 후 다시 시도해 주세요.');
    }
    setBusy(false);
  };
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',padding:24}}>
      <div style={{background:'#fff',borderRadius:16,padding:40,width:400,maxWidth:'100%',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
        <div style={{textAlign:'center',marginBottom:22}}>
          <div style={{fontSize:22,fontWeight:900,color:NAVY}}>AI영실이 운영 콘솔</div>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>총괄 관리자 전용 — 일반 기관 계정은 접근할 수 없습니다</div>
        </div>
        <div style={{fontSize:14,fontWeight:700,margin:'14px 0 6px'}}>이메일</div>
        <input style={{width:'100%',height:48,padding:'0 14px',borderRadius:8,border:'1px solid #cbd5e1',boxSizing:'border-box',fontSize:15}}
          type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" />
        <div style={{fontSize:14,fontWeight:700,margin:'14px 0 6px'}}>비밀번호</div>
        <input style={{width:'100%',height:48,padding:'0 14px',borderRadius:8,border:'1px solid #cbd5e1',boxSizing:'border-box',fontSize:15}}
          type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter' && doLogin()} autoComplete="current-password" />
        {err && <div style={{color:'#b42318',fontSize:13,marginTop:10,background:'#fff3f2',padding:'10px 12px',borderRadius:4,borderLeft:'3px solid #d92d20'}}>{err}</div>}
        <button style={{width:'100%',height:48,borderRadius:8,border:'none',background:BLUE,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',marginTop:20}}
          disabled={busy} onClick={doLogin}>{busy ? '로그인 중...' : '로그인'}</button>
      </div>
    </div>
  );
}

function AccessDenied({ email, onLogout }: { email?: string; onLogout: () => void }) {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',padding:24}}>
      <div style={{background:'#fff',borderRadius:16,padding:40,width:420,maxWidth:'100%',textAlign:'center'}}>
        <div style={{fontSize:40}}>🔒</div>
        <div style={{fontSize:18,fontWeight:800,color:'#0f172a',marginTop:12}}>운영 콘솔 접근 권한이 없습니다</div>
        <div style={{fontSize:14,color:'#64748b',marginTop:8}}>{email ? `${email} 계정은 ` : ''}총괄 관리자 전용 콘솔입니다.</div>
        <button className="btn-secondary" style={{marginTop:20}} onClick={onLogout}>다른 계정으로 로그인</button>
      </div>
    </div>
  );
}

const NAV = [
  { id: 'health', label: '시스템 모니터링' },
  { id: 'calls', label: '통화 이력' },
  { id: 'subscriptions', label: '정기결제 현황' },
  { id: 'orgs', label: '기관 관리' },
  { id: 'audit', label: '감사 로그' },
] as const;
type PageId = typeof NAV[number]['id'];

export default function ConsoleApp() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null); // null=확인 중, true/false=결과
  const [page, setPage] = useState<PageId>('health');
  const [toast, setToast] = useState<{message:string; tone:'info'|'success'|'error'}|null>(null);
  const notify = (message: unknown, tone: 'info'|'success'|'error' = 'error') => {
    setToast({ message: String(message), tone });
    setTimeout(() => setToast(null), 3200);
  };

  const [health, setHealth] = useState<any>(null);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOrg, setHistoryOrg] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [subs, setSubs] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgBusy, setOrgBusy] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [authCheckError, setAuthCheckError] = useState('');   // 네트워크/CORS 등 판정 자체가 실패한 경우 — "권한 없음"과 구분해야 함
  const [authCheckRetry, setAuthCheckRetry] = useState(0);

  useEffect(() => {
    if (!authEnabled) { setAuthChecked(true); return; }
    const unsub = onAuthStateChanged(auth as any, u => { setAuthUser(u); setAuthChecked(true); setAuthorized(null); });
    return unsub;
  }, []);

  // 로그인 성공 후 superadmin 여부 확인 — 별도 API 없이 /console/health 403 여부로 판정.
  // 주의: fetch 자체가 실패(CORS·네트워크 오류 등)한 경우를 403(진짜 권한 없음)과 반드시
  // 구분해야 한다 — 둘 다 "권한 없음"으로 뭉개면 실제로는 superadmin인 계정도 인프라
  // 문제(CORS_ORIGINS 미등록 등) 때문에 "권한 없음" 오진을 받는다(2026-08-31 실사용 발견).
  useEffect(() => {
    if (!authUser) { setAuthorized(null); setAuthCheckError(''); return; }
    let cancelled = false;
    (async () => {
      setAuthCheckError('');
      try {
        const r = await authFetch(`${SERVER_URL}/console/health`);
        if (cancelled) return;
        if (r.status === 403) { setAuthorized(false); return; }
        if (!r.ok) { setAuthCheckError(`서버 오류(${r.status}) — 권한 판정 실패`); return; }
        const d = await r.json().catch(() => null);
        setAuthorized(true);
        if (d && Array.isArray(d.components)) setHealth(d);
      } catch (e: any) {
        if (!cancelled) setAuthCheckError(`네트워크 오류로 권한을 확인하지 못했습니다: ${e?.message || e}`);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, authCheckRetry]);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const [hRes, cRes] = await Promise.all([
        authFetch(`${SERVER_URL}/console/health`),
        authFetch(`${SERVER_URL}/console/calls/active`),
      ]);
      const hData = await hRes.json();
      const cData = await cRes.json();
      if (hData && Array.isArray(hData.components)) setHealth(hData);
      if (Array.isArray(cData)) setActiveCalls(cData);
    } catch { notify('시스템 상태 조회 실패'); }
    finally { setLoadingHealth(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyOrg) params.set('org', historyOrg);
      const r = await authFetch(`${SERVER_URL}/console/calls/history?${params.toString()}`);
      const d = await r.json();
      setHistory(Array.isArray(d?.calls) ? d.calls : []);
    } catch { notify('통화 이력 조회 실패'); }
    finally { setHistoryLoading(false); }
  };

  const fetchSubs = async () => {
    setSubsLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/subscriptions`);
      const d = await r.json();
      setSubs(Array.isArray(d?.orgs) ? d.orgs : []);
    } catch { notify('정기결제 현황 조회 실패'); }
    finally { setSubsLoading(false); }
  };

  const fetchOrgs = async () => {
    try { const r = await authFetch(`${SERVER_URL}/admin/orgs`); const d = await r.json(); setOrgs(Array.isArray(d) ? d : []); } catch { setOrgs([]); }
  };
  const toggleOrgSuspend = async (org: any, nextSuspended: boolean) => {
    const verb = nextSuspended ? '정지' : '재개';
    if (!window.confirm(`"${org.name}" 기관을 ${verb}하시겠습니까?${nextSuspended ? ' 정지하면 소속 직원 전원이 즉시 로그인/이용이 막힙니다.' : ''}`)) return;
    setOrgBusy(org.orgId);
    try {
      const r = await authFetch(`${SERVER_URL}/console/orgs/${org.orgId}/suspend`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ suspended: nextSuspended }) });
      if (r.ok) { notify(`"${org.name}" 기관을 ${verb}했습니다.`, 'success'); fetchOrgs(); }
      else { const d = await r.json().catch(()=>({})); notify(errMsg(d, `${verb} 실패`)); }
    } catch { notify('네트워크 오류 — 기관 상태 변경 실패'); }
    finally { setOrgBusy(''); }
  };
  const creditOrg = async (org: any) => {
    const input = window.prompt(`"${org.name}" 기관에 충전할 금액(원)을 입력하세요.`, '1000');
    if (input === null) return;
    const amount = parseInt(input, 10);
    if (!Number.isInteger(amount) || amount <= 0) { notify('1원 이상의 정수를 입력해 주세요'); return; }
    setOrgBusy(org.orgId);
    try {
      const r = await authFetch(`${SERVER_URL}/console/orgs/${org.orgId}/credit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount }) });
      const d = await r.json().catch(()=>({}));
      if (r.ok) { notify(`"${org.name}"에 ${amount.toLocaleString()}원 충전했습니다 (잔액 ${Number(d.creditBalance).toLocaleString()}원).`, 'success'); fetchOrgs(); }
      else notify(errMsg(d, '충전 실패'));
    } catch { notify('네트워크 오류 — 충전 실패'); }
    finally { setOrgBusy(''); }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/audit-logs`);
      const d = await r.json();
      setAuditLogs(Array.isArray(d?.logs) ? d.logs : []);
    } catch { notify('감사 로그 조회 실패'); }
    finally { setAuditLoading(false); }
  };

  useEffect(() => {
    if (authorized !== true) return;
    if (page === 'health') fetchHealth();
    if (page === 'calls') fetchHistory();
    if (page === 'subscriptions') fetchSubs();
    if (page === 'orgs') fetchOrgs();
    if (page === 'audit') fetchAuditLogs();
  }, [page, authorized]); // eslint-disable-line

  if (!authChecked) return null;
  if (!authUser) return <LoginScreen />;
  if (authCheckError) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',padding:24}}>
        <div style={{background:'#fff',borderRadius:16,padding:40,width:420,maxWidth:'100%',textAlign:'center'}}>
          <div style={{fontSize:40}}>⚠️</div>
          <div style={{fontSize:18,fontWeight:800,color:'#0f172a',marginTop:12}}>권한 확인 실패</div>
          <div style={{fontSize:14,color:'#64748b',marginTop:8}}>{authCheckError}</div>
          <button className="btn-primary" style={{marginTop:20,marginRight:8}} onClick={()=>setAuthCheckRetry(n=>n+1)}>다시 시도</button>
          <button className="btn-secondary" style={{marginTop:20}} onClick={()=>signOut(auth as any)}>로그아웃</button>
        </div>
      </div>
    );
  }
  if (authorized === null) return null; // 권한 확인 중 — 깜빡임 방지로 빈 화면
  if (authorized === false) return <AccessDenied email={authUser.email} onLogout={() => signOut(auth as any)} />;

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f5f7fa'}}>
      {toast && (
        <div className="toast-viewport">
          <div className={`toast toast--${toast.tone}`}>{toast.message}</div>
        </div>
      )}
      <div style={{width:220,background:'#0f172a',color:'#fff',padding:'20px 12px',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{fontSize:16,fontWeight:900,padding:'0 10px 20px'}}>AI영실이 <span style={{fontSize:11,fontWeight:700,color:'#94a3b8',border:'1px solid #334155',borderRadius:4,padding:'1px 5px',marginLeft:4}}>OPS</span></div>
        {NAV.map(item => (
          <button key={item.id} onClick={()=>setPage(item.id)}
            style={{textAlign:'left',padding:'10px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,marginBottom:2,
              background: page===item.id ? '#1e293b' : 'transparent', color: page===item.id ? '#fff' : '#94a3b8'}}>
            {item.label}
          </button>
        ))}
        <div style={{marginTop:'auto',paddingTop:16,borderTop:'1px solid #1e293b'}}>
          <div style={{fontSize:12,color:'#64748b',padding:'0 10px 8px'}}>{authUser.email}</div>
          <button className="btn-secondary" style={{width:'100%'}} onClick={()=>signOut(auth as any)}>로그아웃</button>
        </div>
      </div>
      <div style={{flex:1,padding:'28px 32px',overflowY:'auto'}}>
        <div style={{fontSize:20,fontWeight:900,color:'#0f172a',marginBottom:20}}>{NAV.find(n=>n.id===page)?.label}</div>

        {page === 'health' && (
          <div className="fade-in">
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:10}}>
                <div className="section-title" style={{marginBottom:0}}>시스템 상태</div>
                <button className={`btn-download ${loadingHealth?'btn-calling':''}`} onClick={fetchHealth} disabled={loadingHealth}>{loadingHealth?'조회 중...':'새로고침'}</button>
              </div>
              {!health ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>데이터 없음</div> : (
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {health.components?.map((c: any) => (
                    <div key={c.name} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',minWidth:160}}>
                      <div style={{fontSize:13,color:'#64748b'}}>{c.name}</div>
                      <div style={{fontSize:16,fontWeight:800,color: c.ok?'#1e8e3e':'#c5221f',marginTop:4}}>{c.ok?'정상':'오류'}</div>
                      {c.latencyMs != null && <div style={{fontSize:12,color:'#94a3b8'}}>{c.latencyMs}ms</div>}
                      {c.detail && <div style={{fontSize:12,color:'#c5221f'}}>{c.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="section" style={{marginTop:20}}>
              <div className="section-title" style={{marginBottom:10}}>지금 진행 중인 통화 ({activeCalls.length}건)</div>
              {activeCalls.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>진행 중인 통화가 없습니다</div> : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                    <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                      <th style={{padding:'8px 10px'}}>이름</th><th style={{padding:'8px 10px'}}>전화번호</th><th style={{padding:'8px 10px'}}>기관</th>
                      <th style={{padding:'8px 10px'}}>상태</th><th style={{padding:'8px 10px'}}>경과</th>
                    </tr></thead>
                    <tbody>{activeCalls.map((c:any) => (
                      <tr key={c.callId} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px'}}>{c.name}</td><td style={{padding:'10px'}}>{c.phone}</td><td style={{padding:'10px'}}>{c.orgId}</td>
                        <td style={{padding:'10px'}}>{c.status}</td><td style={{padding:'10px'}}>{c.elapsedSec}초</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {page === 'calls' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>통화 이력 ({history.length}건)</div>
              <button className={`btn-download ${historyLoading?'btn-calling':''}`} onClick={fetchHistory} disabled={historyLoading}>{historyLoading?'조회 중...':'조회'}</button>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <input className="form-input" style={{width:200,margin:0}} placeholder="기관코드 필터(선택)" value={historyOrg} onChange={e=>setHistoryOrg(e.target.value)} />
            </div>
            {history.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{historyLoading?'불러오는 중...':'조회된 통화 이력이 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>시각</th><th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>어르신</th>
                    <th style={{padding:'8px 10px'}}>위험도</th><th style={{padding:'8px 10px'}}>통화시간</th>
                  </tr></thead>
                  <tbody>{history.map((c:any) => (
                    <tr key={c.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{c.at ? new Date(c.at).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{c.orgId}</td><td style={{padding:'10px'}}>{c.elderName}</td>
                      <td style={{padding:'10px'}}>{c.riskLevel}</td><td style={{padding:'10px'}}>{c.durationSec}초</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {page === 'subscriptions' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>정기결제 현황 ({subs.length}개 기관)</div>
              <button className={`btn-download ${subsLoading?'btn-calling':''}`} onClick={fetchSubs} disabled={subsLoading}>{subsLoading?'조회 중...':'새로고침'}</button>
            </div>
            {subs.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{subsLoading?'불러오는 중...':'기관 데이터가 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>기관명</th><th style={{padding:'8px 10px'}}>요금제</th><th style={{padding:'8px 10px'}}>대상자</th>
                    <th style={{padding:'8px 10px'}}>월 청구액</th><th style={{padding:'8px 10px'}}>자동결제</th><th style={{padding:'8px 10px'}}>다음 청구일</th><th style={{padding:'8px 10px'}}>최근 오류</th>
                  </tr></thead>
                  <tbody>{subs.map((s:any) => (
                    <tr key={s.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{s.orgName || s.orgId}</td><td style={{padding:'10px'}}>{s.plan || '미설정'}</td><td style={{padding:'10px'}}>{s.elderCount}명</td>
                      <td style={{padding:'10px'}}>{s.monthlyAmount != null ? `${s.monthlyAmount.toLocaleString()}원` : '-'}</td>
                      <td style={{padding:'10px'}}><span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:s.autoRenew?'#e6f4ea':'#f1f3f4',color:s.autoRenew?'#1e8e3e':'#5f6368'}}>{s.autoRenew?'등록됨':'미등록'}</span></td>
                      <td style={{padding:'10px',color:'#5f6368'}}>{s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleDateString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px',color:s.lastChargeError?'#c5221f':'#5f6368',fontSize:12}}>{s.lastChargeError || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {page === 'orgs' && (
          <section className="section fade-in">
            <div className="section-title" style={{marginBottom:10}}>기관 관리 ({orgs.length}개 기관)</div>
            {orgs.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>기관 데이터가 없습니다</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>기관명</th><th style={{padding:'8px 10px'}}>기관코드</th><th style={{padding:'8px 10px'}}>요금제</th>
                    <th style={{padding:'8px 10px'}}>크레딧 잔액</th><th style={{padding:'8px 10px'}}>대상자</th><th style={{padding:'8px 10px'}}>상태</th><th style={{padding:'8px 10px'}}></th>
                  </tr></thead>
                  <tbody>{orgs.map((o:any) => {
                    const suspended = o.suspended === true;
                    return (
                    <tr key={o.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{o.name}</td><td style={{padding:'10px',fontFamily:'monospace',color:'#5f6368'}}>{o.code}</td><td style={{padding:'10px'}}>{o.plan || '미설정'}</td>
                      <td style={{padding:'10px'}}>{o.creditBalance == null ? <span style={{color:'#94a3b8'}}>무제한(구기관)</span> : <span style={{fontWeight:700,color:o.creditBalance<=0?'#c5221f':'#0f172a'}}>{Number(o.creditBalance).toLocaleString()}원</span>}</td>
                      <td style={{padding:'10px'}}>{o.elderCount}명</td>
                      <td style={{padding:'10px'}}><span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:suspended?'#fce8e6':'#e6f4ea',color:suspended?'#c5221f':'#1e8e3e'}}>{suspended?'정지됨':'정상'}</span></td>
                      <td style={{padding:'10px',display:'flex',gap:6}}>
                        <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',color:'#246BEB'}} disabled={orgBusy===o.orgId} onClick={()=>creditOrg(o)}>충전</button>
                        <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',color:suspended?'#1e8e3e':'#c5221f'}} disabled={orgBusy===o.orgId} onClick={()=>toggleOrgSuspend(o,!suspended)}>{orgBusy===o.orgId?'처리 중...':(suspended?'재개':'정지')}</button>
                      </td>
                    </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {page === 'audit' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>감사 로그 ({auditLogs.length}건)</div>
              <button className={`btn-download ${auditLoading?'btn-calling':''}`} onClick={fetchAuditLogs} disabled={auditLoading}>{auditLoading?'조회 중...':'조회'}</button>
            </div>
            {auditLogs.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{auditLoading?'불러오는 중...':'조회된 감사 로그가 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>시각</th><th style={{padding:'8px 10px'}}>관리자</th><th style={{padding:'8px 10px'}}>조회 항목</th><th style={{padding:'8px 10px'}}>상세</th>
                  </tr></thead>
                  <tbody>{auditLogs.map((l:any) => (
                    <tr key={l.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{l.at ? new Date(l.at).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{l.actorEmail || '-'}</td>
                      <td style={{padding:'10px',fontFamily:'monospace',fontSize:12}}>{l.action}</td>
                      <td style={{padding:'10px',color:'#5f6368',fontSize:12}}>{l.detail ? JSON.stringify(l.detail) : ''}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
