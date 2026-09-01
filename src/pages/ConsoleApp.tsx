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

const PAGE_SIZE = 25; // 대시보드 콘솔 통화 이력과 동일한 페이지당 건수

function Pager({ page, setPage, total }: { page: number; setPage: (fn: (p: number) => number) => void; total: number }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,marginTop:14,justifyContent:'flex-end'}}>
      <span style={{fontSize:13,color:'#5f6368'}}>{start}–{end} / 총 {total}건</span>
      <button className="btn-download" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>이전</button>
      <span style={{fontSize:13,color:'#5f6368'}}>{page} / {totalPages}</span>
      <button className="btn-download" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>다음</button>
    </div>
  );
}

const NAV = [
  { id: 'health', label: '시스템 모니터링' },
  { id: 'calls', label: '통화 이력' },
  { id: 'subscriptions', label: '정기결제 현황' },
  { id: 'payments', label: '결제 내역' },
  { id: 'refunds', label: '환불' },
  { id: 'orgs', label: '기관 관리' },
  { id: 'audit', label: '감사 로그' },
  { id: 'test', label: '기능 테스트' },
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
  const [historyPage, setHistoryPage] = useState(1);
  const [historyOrg, setHistoryOrg] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [subs, setSubs] = useState<any[]>([]);
  const [subsPage, setSubsPage] = useState(1);
  const [subsLoading, setSubsLoading] = useState(false);
  const [orgsPage, setOrgsPage] = useState(1);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgBusy, setOrgBusy] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsOrg, setPaymentsOrg] = useState('');
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [refundable, setRefundable] = useState<any[]>([]);
  const [refundPage, setRefundPage] = useState(1);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundBusy, setRefundBusy] = useState('');
  const [testOrgId, setTestOrgId] = useState('');
  const [testLog, setTestLog] = useState<string[]>([]);
  const [testAmount, setTestAmount] = useState('300000');
  const [testPayMethod, setTestPayMethod] = useState('CARD');
  const [testPlanKey, setTestPlanKey] = useState('basic');
  const [testRefundPaymentId, setTestRefundPaymentId] = useState('');
  const [testRefundReason, setTestRefundReason] = useState('테스트 환불 요청');
  const [testBusy, setTestBusy] = useState('');
  const [testCallTarget, setTestCallTarget] = useState<any>(null); // {configured, phone, name, orgId}
  const [testPublicData, setTestPublicData] = useState<any[]>([]); // ComponentHealth[]
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
      setHistoryPage(1);
    } catch { notify('통화 이력 조회 실패'); }
    finally { setHistoryLoading(false); }
  };

  const fetchSubs = async () => {
    setSubsLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/subscriptions`);
      const d = await r.json();
      setSubs(Array.isArray(d?.orgs) ? d.orgs : []);
      setSubsPage(1);
    } catch { notify('정기결제 현황 조회 실패'); }
    finally { setSubsLoading(false); }
  };

  const fetchOrgs = async () => {
    try { const r = await authFetch(`${SERVER_URL}/admin/orgs`); const d = await r.json(); setOrgs(Array.isArray(d) ? d : []); setOrgsPage(1); } catch { setOrgs([]); }
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
      setAuditPage(1);
    } catch { notify('감사 로그 조회 실패'); }
    finally { setAuditLoading(false); }
  };

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (paymentsOrg) params.set('org', paymentsOrg);
      const r = await authFetch(`${SERVER_URL}/console/payments?${params.toString()}`);
      const d = await r.json();
      setPayments(Array.isArray(d?.payments) ? d.payments : []);
      setPaymentsPage(1);
    } catch { notify('결제 내역 조회 실패'); }
    finally { setPaymentsLoading(false); }
  };

  const fetchRefundable = async () => {
    setRefundLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/payments?status=paid`);
      const d = await r.json();
      setRefundable(Array.isArray(d?.payments) ? d.payments.filter((p:any)=>p.type !== 'subscription') : []);
      setRefundPage(1);
    } catch { notify('환불 대상 조회 실패'); }
    finally { setRefundLoading(false); }
  };
  const doRefund = async (payment: any) => {
    const reason = window.prompt(`"${payment.orgId}" 기관의 ${payment.amount.toLocaleString()}원 결제를 환불합니다.\n환불 사유를 입력하세요.`, '');
    if (reason === null) return;
    if (!reason.trim()) { notify('환불 사유를 입력해야 합니다'); return; }
    if (!window.confirm(`${payment.amount.toLocaleString()}원을 환불하고 해당 기관의 크레딧을 회수합니다. 계속할까요?`)) return;
    setRefundBusy(payment.id);
    try {
      const r = await authFetch(`${SERVER_URL}/console/payments/${payment.id}/refund`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason: reason.trim() }) });
      const d = await r.json().catch(()=>({}));
      if (r.ok) { notify(`환불 완료: ${payment.amount.toLocaleString()}원`, 'success'); fetchRefundable(); }
      else notify(errMsg(d, '환불 실패'));
    } catch { notify('네트워크 오류 — 환불 실패'); }
    finally { setRefundBusy(''); }
  };
  const doRejectRefund = async (payment: any) => {
    if (!window.confirm(`"${payment.orgId}" 기관의 환불 요청을 거절할까요? (실제 환불은 일어나지 않습니다)`)) return;
    setRefundBusy(payment.id);
    try {
      const r = await authFetch(`${SERVER_URL}/console/payments/${payment.id}/refund-request/reject`, { method:'POST' });
      if (r.ok) { notify('환불 요청을 거절했습니다.', 'success'); fetchRefundable(); }
      else notify('거절 처리 실패');
    } catch { notify('네트워크 오류 — 거절 처리 실패'); }
    finally { setRefundBusy(''); }
  };

  // ── 기능 테스트(총괄 관리자 전용) — orgId를 직접 지정해 실제 결제 플로우를 눌러본다 ──
  const logTest = (line: string) => setTestLog(prev => [...prev.slice(-30), `${new Date().toLocaleTimeString()} ${line}`]);

  const testTopupFlow = async () => {
    if (!testOrgId) { notify('먼저 대상 기관을 선택하세요'); return; }
    const amount = Number(testAmount);
    if (!Number.isInteger(amount) || amount < 10000) { notify('10,000원 이상의 정수를 입력하세요'); return; }
    setTestBusy('topup');
    logTest(`충전 테스트 시작 — ${testOrgId}, ${amount.toLocaleString()}원, ${testPayMethod}`);
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/topup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId: testOrgId, amount, payMethod: testPayMethod }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { logTest(`❌ 요청 생성 실패: ${errMsg(d,'실패')}`); return; }
      logTest(`✅ 결제 요청 생성됨(paymentId=${d.paymentId}) — PortOne 결제창 호출...`);

      const { requestPayment } = await import('@portone/browser-sdk/v2');
      const response = await requestPayment({
        storeId: d.storeId, channelKey: d.channelKey, paymentId: d.paymentId, orderName: d.orderName,
        totalAmount: d.amount, currency: 'KRW', payMethod: testPayMethod as any,
        customer: { email: authUser.email, fullName: '테스트' },
        ...(testPayMethod === 'VIRTUAL_ACCOUNT' ? { virtualAccount: { accountExpiry: { validHours: 24 } } } : {}),
      });
      if (response?.code !== undefined) { logTest(`❌ 결제 실패: ${response.message || response.code}`); return; }
      logTest(`✅ 결제창 완료(paymentId=${d.paymentId}) — 웹훅으로 크레딧 반영은 잠시 후 확인해 주세요`);
      notify('충전 테스트 완료', 'success');
    } catch (e:any) { logTest(`❌ 오류: ${e?.message || e}`); }
    finally { setTestBusy(''); }
  };

  const testSubscribeFlow = async () => {
    if (!testOrgId) { notify('먼저 대상 기관을 선택하세요'); return; }
    setTestBusy('subscribe');
    logTest(`정액제 테스트 시작 — ${testOrgId}, ${testPlanKey}`);
    try {
      const regRes = await authFetch(`${SERVER_URL}/console/test/subscribe/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId: testOrgId, planKey: testPlanKey }) });
      const reg = await regRes.json().catch(()=>({}));
      if (!regRes.ok) { logTest(`❌ 빌링키 발급 요청 실패: ${errMsg(reg,'실패')}`); return; }
      logTest(`✅ 빌링키 발급 요청 생성됨(issueId=${reg.issueId}, ${reg.amount.toLocaleString()}원) — 카드 등록창 호출...`);

      const { requestIssueBillingKey } = await import('@portone/browser-sdk/v2');
      const response = await requestIssueBillingKey({
        storeId: reg.storeId, channelKey: reg.channelKey, billingKeyMethod: 'CARD',
        issueId: reg.issueId, issueName: reg.issueName,
        customer: { email: authUser.email, fullName: '테스트', phoneNumber: '01000000000' },
      });
      if (response?.code !== undefined) { logTest(`❌ 카드 등록 실패: ${response.message || response.code}`); return; }
      logTest(`✅ 카드 등록 완료(billingKey=${response.billingKey.slice(0,12)}...) — 첫 결제 승인 요청...`);

      const confirmRes = await authFetch(`${SERVER_URL}/console/test/subscribe/confirm`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId: testOrgId, issueId: reg.issueId, billingKey: response.billingKey }) });
      const confirm = await confirmRes.json().catch(()=>({}));
      if (!confirmRes.ok) { logTest(`❌ 첫 결제 승인 실패: ${errMsg(confirm,'실패')}`); return; }
      logTest(`✅ 첫 결제 승인 완료(${confirm.amount?.toLocaleString()}원) — 자동결제 등록됨`);
      notify('정액제 테스트 완료', 'success');
    } catch (e:any) { logTest(`❌ 오류: ${e?.message || e}`); }
    finally { setTestBusy(''); }
  };

  const testRefundRequestFlow = async () => {
    if (!testOrgId) { notify('먼저 대상 기관을 선택하세요'); return; }
    if (!testRefundPaymentId.trim()) { notify('테스트할 paymentId를 입력하세요'); return; }
    setTestBusy('refund');
    logTest(`환불 요청 테스트 — ${testOrgId}, paymentId=${testRefundPaymentId}`);
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/refund-request`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId: testOrgId, paymentId: testRefundPaymentId.trim(), reason: testRefundReason }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { logTest(`❌ 환불 요청 실패: ${errMsg(d,'실패')}`); return; }
      logTest(`✅ 환불 요청 접수됨(status=${d.status}) — "환불" 메뉴에서 확인 가능`);
      notify('환불 요청 테스트 완료', 'success');
    } catch (e:any) { logTest(`❌ 오류: ${e?.message || e}`); }
    finally { setTestBusy(''); }
  };

  const fetchTestCallTarget = async () => {
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/call-target`);
      setTestCallTarget(await r.json().catch(()=>null));
    } catch { setTestCallTarget(null); }
  };
  const testCallFlow = async (kind: 'checkin' | 'alert') => {
    if (!testCallTarget?.configured) { notify('TEST_ELDER_PHONE이 설정돼 있지 않습니다(서버 .env)'); return; }
    if (!window.confirm(`${testCallTarget.name || '테스트 어르신'}(${testCallTarget.phone})에게 ${kind==='alert'?'경보':'안부확인'} 테스트 전화를 겁니다. 계속할까요?`)) return;
    setTestBusy(`call-${kind}`);
    logTest(`통화 발신 테스트 — ${kind==='alert'?'경보':'안부확인'} (${testCallTarget.phone})`);
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/call`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { logTest(`❌ 발신 요청 실패: ${errMsg(d,'실패')}`); return; }
      logTest(`✅ 발신 결과: ${JSON.stringify(d)}`);
      notify('통화 발신 테스트 요청 완료', 'success');
    } catch (e:any) { logTest(`❌ 오류: ${e?.message || e}`); }
    finally { setTestBusy(''); }
  };

  const testPublicDataFlow = async () => {
    if (!testOrgId) { notify('먼저 대상 기관을 선택하세요'); return; }
    setTestBusy('public-data');
    logTest(`공공데이터 연동 상태 조회 — ${testOrgId}`);
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/public-data?orgId=${encodeURIComponent(testOrgId)}`);
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { logTest(`❌ 조회 실패: ${errMsg(d,'실패')}`); return; }
      setTestPublicData(Array.isArray(d.components) ? d.components : []);
      logTest(`✅ 조회 완료 — ${d.components?.length ?? 0}개 항목`);
    } catch (e:any) { logTest(`❌ 오류: ${e?.message || e}`); }
    finally { setTestBusy(''); }
  };

  useEffect(() => {
    if (authorized !== true) return;
    if (page === 'test') fetchTestCallTarget();
    if (page === 'health') fetchHealth();
    if (page === 'calls') fetchHistory();
    if (page === 'subscriptions') fetchSubs();
    if (page === 'orgs') fetchOrgs();
    if (page === 'test' && orgs.length === 0) fetchOrgs();
    if (page === 'audit') fetchAuditLogs();
    if (page === 'payments') fetchPayments();
    if (page === 'refunds') fetchRefundable();
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
                  <tbody>{history.slice((historyPage-1)*PAGE_SIZE, historyPage*PAGE_SIZE).map((c:any) => (
                    <tr key={c.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{c.at ? new Date(c.at).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{c.orgId}</td><td style={{padding:'10px'}}>{c.elderName}</td>
                      <td style={{padding:'10px'}}>{c.riskLevel}</td><td style={{padding:'10px'}}>{c.durationSec}초</td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={historyPage} setPage={setHistoryPage} total={history.length} />
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
                  <tbody>{subs.slice((subsPage-1)*PAGE_SIZE, subsPage*PAGE_SIZE).map((s:any) => (
                    <tr key={s.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{s.orgName || s.orgId}</td><td style={{padding:'10px'}}>{s.plan || '미설정'}</td><td style={{padding:'10px'}}>{s.elderCount}명</td>
                      <td style={{padding:'10px'}}>{s.monthlyAmount != null ? `${s.monthlyAmount.toLocaleString()}원` : '-'}</td>
                      <td style={{padding:'10px'}}><span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:s.autoRenew?'#e6f4ea':'#f1f3f4',color:s.autoRenew?'#1e8e3e':'#5f6368'}}>{s.autoRenew?'등록됨':'미등록'}</span></td>
                      <td style={{padding:'10px',color:'#5f6368'}}>{s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleDateString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px',color:s.lastChargeError?'#c5221f':'#5f6368',fontSize:12}}>{s.lastChargeError || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={subsPage} setPage={setSubsPage} total={subs.length} />
              </div>
            )}
          </section>
        )}

        {page === 'payments' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>결제 내역 ({payments.length}건)</div>
              <button className={`btn-download ${paymentsLoading?'btn-calling':''}`} onClick={fetchPayments} disabled={paymentsLoading}>{paymentsLoading?'조회 중...':'조회'}</button>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <input className="form-input" style={{width:200,margin:0}} placeholder="기관코드 필터(선택)" value={paymentsOrg} onChange={e=>setPaymentsOrg(e.target.value)} />
            </div>
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:10}}>포트원 결제·정액제 청구 기록(조회 전용) — 취소/환불은 아래 "환불" 메뉴 참고</div>
            {payments.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{paymentsLoading?'불러오는 중...':'조회된 결제 내역이 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>시각</th><th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>종류</th>
                    <th style={{padding:'8px 10px'}}>금액</th><th style={{padding:'8px 10px'}}>상태</th><th style={{padding:'8px 10px'}}>요청자</th>
                  </tr></thead>
                  <tbody>{payments.slice((paymentsPage-1)*PAGE_SIZE, paymentsPage*PAGE_SIZE).map((p:any) => (
                    <tr key={p.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{p.orgId}</td>
                      <td style={{padding:'10px'}}>{p.type==='subscription' ? `정액제${p.planKey?`(${p.planKey})`:''}${p.renewal?' · 자동갱신':''}` : '크레딧 충전'}</td>
                      <td style={{padding:'10px',fontWeight:700}}>{p.amount.toLocaleString()}원</td>
                      <td style={{padding:'10px'}}>
                        <span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,
                          background: p.status==='paid'?'#e6f4ea':p.status==='failed'?'#fce8e6':p.status==='cancelled'?'#f1f3f4':'#fff8e1',
                          color: p.status==='paid'?'#1e8e3e':p.status==='failed'?'#c5221f':p.status==='cancelled'?'#5f6368':'#754d00'}}>
                          {p.status==='paid'?'완료':p.status==='failed'?'실패':p.status==='cancelled'?'취소됨':'대기'}
                        </span>
                      </td>
                      <td style={{padding:'10px',color:'#5f6368',fontSize:12}}>{p.requestedBy}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={paymentsPage} setPage={setPaymentsPage} total={payments.length} />
              </div>
            )}
          </section>
        )}

        {page === 'refunds' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>환불 ({refundable.length}건)</div>
              <button className={`btn-download ${refundLoading?'btn-calling':''}`} onClick={fetchRefundable} disabled={refundLoading}>{refundLoading?'조회 중...':'새로고침'}</button>
            </div>
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:14}}>완료(paid)된 크레딧 충전 건만 대상 — 정액제 결제는 플랜 상태가 얽혀 있어 여기서 환불할 수 없습니다. 환불하면 포트원 결제취소 + 해당 기관 크레딧 회수가 함께 일어납니다(되돌릴 수 없음). 기관이 직접 요청한 건은 "환불 요청됨"으로 표시됩니다(요청 없이도 직접 환불 가능).</div>
            {refundable.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{refundLoading?'불러오는 중...':'환불 가능한 결제가 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>시각</th><th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>금액</th>
                    <th style={{padding:'8px 10px'}}>요청 상태</th><th style={{padding:'8px 10px'}}>사유</th><th style={{padding:'8px 10px'}}></th>
                  </tr></thead>
                  <tbody>{[...refundable].sort((a:any,b:any)=>(b.refundRequestStatus==='pending'?1:0)-(a.refundRequestStatus==='pending'?1:0))
                    .slice((refundPage-1)*PAGE_SIZE, refundPage*PAGE_SIZE).map((p:any) => (
                    <tr key={p.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{p.orgId}</td>
                      <td style={{padding:'10px',fontWeight:700}}>{p.amount.toLocaleString()}원</td>
                      <td style={{padding:'10px'}}>
                        {p.refundRequestStatus==='pending' ? <span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:'#fff8e1',color:'#754d00'}}>환불 요청됨</span>
                          : p.refundRequestStatus==='rejected' ? <span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:'#f1f3f4',color:'#5f6368'}}>요청 거절됨</span>
                          : <span style={{color:'#94a3b8',fontSize:12}}>-</span>}
                      </td>
                      <td style={{padding:'10px',color:'#5f6368',fontSize:12}}>{p.refundRequestReason || '-'}</td>
                      <td style={{padding:'10px',display:'flex',gap:6}}>
                        <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',color:'#c5221f'}} disabled={refundBusy===p.id} onClick={()=>doRefund(p)}>
                          {refundBusy===p.id ? '처리 중...' : '환불'}
                        </button>
                        {p.refundRequestStatus==='pending' && (
                          <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px'}} disabled={refundBusy===p.id} onClick={()=>doRejectRefund(p)}>거절</button>
                        )}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={refundPage} setPage={setRefundPage} total={refundable.length} />
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
                  <tbody>{orgs.slice((orgsPage-1)*PAGE_SIZE, orgsPage*PAGE_SIZE).map((o:any) => {
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
                <Pager page={orgsPage} setPage={setOrgsPage} total={orgs.length} />
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
                  <tbody>{auditLogs.slice((auditPage-1)*PAGE_SIZE, auditPage*PAGE_SIZE).map((l:any) => (
                    <tr key={l.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{l.at ? new Date(l.at).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{l.actorEmail || '-'}</td>
                      <td style={{padding:'10px',fontFamily:'monospace',fontSize:12}}>{l.action}</td>
                      <td style={{padding:'10px',color:'#5f6368',fontSize:12}}>{l.detail ? JSON.stringify(l.detail) : ''}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={auditPage} setPage={setAuditPage} total={auditLogs.length} />
              </div>
            )}
          </section>
        )}

        {page === 'test' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>대상 기관</div>
              <select className="form-input" style={{maxWidth:360}} value={testOrgId} onChange={e=>setTestOrgId(e.target.value)}>
                <option value="">기관을 선택하세요</option>
                {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
              </select>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:8}}>총괄 관리자 계정 자체는 소속 기관이 없어서(orgId='*'), 아래 테스트는 여기서 고른 기관을 대상으로 실행됩니다 — 실제 결제(카드/계좌이체 등)가 나갑니다, 테스트 채널인지 확인 후 진행하세요.</div>
            </section>

            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>크레딧 충전 테스트</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                <input className="form-input" style={{width:160,margin:0}} type="number" min={10000} step={1000} value={testAmount} onChange={e=>setTestAmount(e.target.value)} placeholder="금액" />
                <select className="form-input" style={{width:200,margin:0}} value={testPayMethod} onChange={e=>setTestPayMethod(e.target.value)}>
                  <option value="CARD">카드</option>
                  <option value="TRANSFER">실시간 계좌이체</option>
                  <option value="VIRTUAL_ACCOUNT">무통장입금</option>
                  <option value="EASY_PAY">카카오페이</option>
                </select>
                <button className="btn-primary" disabled={testBusy==='topup'} onClick={testTopupFlow}>{testBusy==='topup'?'진행 중...':'테스트 결제'}</button>
              </div>
            </section>

            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>정액제 신청 테스트</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                <select className="form-input" style={{width:200,margin:0}} value={testPlanKey} onChange={e=>setTestPlanKey(e.target.value)}>
                  <option value="basic">베이직</option>
                  <option value="standard">스탠다드</option>
                  <option value="premium">프리미엄</option>
                </select>
                <button className="btn-primary" disabled={testBusy==='subscribe'} onClick={testSubscribeFlow}>{testBusy==='subscribe'?'진행 중...':'테스트 등록'}</button>
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:8}}>선택한 기관에 등록된 어르신 수가 있어야 금액 계산이 됩니다.</div>
            </section>

            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>환불 요청 테스트</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                <input className="form-input" style={{width:260,margin:0}} value={testRefundPaymentId} onChange={e=>setTestRefundPaymentId(e.target.value)} placeholder="paymentId (결제 내역 메뉴에서 확인)" />
                <input className="form-input" style={{width:220,margin:0}} value={testRefundReason} onChange={e=>setTestRefundReason(e.target.value)} placeholder="환불 사유" />
                <button className="btn-primary" disabled={testBusy==='refund'} onClick={testRefundRequestFlow}>{testBusy==='refund'?'진행 중...':'요청 테스트'}</button>
              </div>
            </section>

            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>통화 발신 테스트</div>
              {testCallTarget === null ? (
                <div style={{color:'#94a3b8',fontSize:14}}>불러오는 중...</div>
              ) : !testCallTarget.configured ? (
                <div style={{color:'#c5221f',fontSize:13}}>TEST_ELDER_PHONE이 서버에 설정돼 있지 않습니다 — .env에 테스트 전용 어르신 번호를 등록해야 이 기능을 쓸 수 있습니다(실제 어르신에게 오발신되지 않도록 서버가 이 번호로만 하드 제한합니다).</div>
              ) : (
                <>
                  <div style={{fontSize:13,color:'#5f6368',marginBottom:10}}>
                    테스트 대상: <b style={{color:'#0f172a'}}>{testCallTarget.name || '(이름 없음)'}</b> ({testCallTarget.phone}) · {testCallTarget.orgId || '소속 기관 확인 불가'}
                  </div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    <button className="btn-primary" disabled={!!testBusy} onClick={()=>testCallFlow('checkin')}>{testBusy==='call-checkin'?'발신 중...':'안부확인 테스트 발신'}</button>
                    <button className="btn-secondary" disabled={!!testBusy} onClick={()=>testCallFlow('alert')}>{testBusy==='call-alert'?'발신 중...':'경보 테스트 발신'}</button>
                  </div>
                </>
              )}
            </section>

            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>공공데이터 연동 상태</div>
              <div style={{display:'flex',gap:10,marginBottom:14}}>
                <button className="btn-primary" disabled={testBusy==='public-data'} onClick={testPublicDataFlow}>{testBusy==='public-data'?'조회 중...':'선택한 기관 기준으로 조회'}</button>
              </div>
              {testPublicData.length > 0 && (
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {testPublicData.map((c:any) => (
                    <div key={c.name} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',minWidth:160}}>
                      <div style={{fontSize:13,color:'#64748b'}}>{c.name}</div>
                      <div style={{fontSize:16,fontWeight:800,color:c.ok?'#1e8e3e':'#c5221f',marginTop:4}}>{c.ok?'정상':'오류'}</div>
                      {c.latencyMs != null && <div style={{fontSize:12,color:'#94a3b8'}}>{c.latencyMs}ms</div>}
                      {c.detail && <div style={{fontSize:12,color:c.ok?'#5f6368':'#c5221f',marginTop:2}}>{c.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-title" style={{marginBottom:10}}>실행 로그</div>
              <div style={{background:'#0f172a',color:'#e2e8f0',borderRadius:10,padding:14,minHeight:120,maxHeight:300,overflowY:'auto',fontFamily:'monospace',fontSize:12}}>
                {testLog.length === 0 ? <span style={{color:'#64748b'}}>아직 실행한 테스트가 없습니다</span> : testLog.map((l,i)=>(<div key={i}>{l}</div>))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
