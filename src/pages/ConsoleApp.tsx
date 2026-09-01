// AI영실이 운영 콘솔 — 기관 대시보드와 완전히 분리된 별도 빌드 타겟(superadmin 전용).
// 같은 레포·같은 authFetch/SERVER_URL/Firebase 로그인을 재사용하되, 진입점만 다르다
// (src/index.tsx가 REACT_APP_TARGET=console일 때 App 대신 이 컴포넌트를 렌더).
// 권한 판정은 별도 API 없이 GET /console/health 호출 결과(403이면 비superadmin)로 대신한다.
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  Activity, BarChart3, Phone, CreditCard, Receipt, RotateCcw, Building2,
  Users as UsersIcon, HeartHandshake, Megaphone, FileClock, FlaskConical, LogOut, UserCog,
} from 'lucide-react';
import { auth, authEnabled } from '../firebase';
import { SERVER_URL, authFetch, errMsg } from '../utils/api';
// App.css는 src/index.tsx에서 정적으로 이미 import됨(동적 import로 인한 FOUC 방지 목적) —
// 이 콘솔은 별도 빌드 타겟(build-console)이라, 아래 <GcpStyle>은 App.css를 건드리지 않고
// 이 페이지 안에서만 스코프된 스타일을 얹는다(기관 대시보드 쪽엔 영향 없음).

const NAVY = '#1a73e8', BLUE = '#1a73e8';

/** 역할 계층별 배지 색 — 권한 수준이 한눈에 구분되도록(worker < staff < admin < superadmin) */
const ROLE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  worker:     { bg: '#f1f3f4', fg: '#5f6368', label: 'worker' },
  staff:      { bg: '#e8f0fe', fg: '#1a73e8', label: 'staff' },
  admin:      { bg: '#f3e8fd', fg: '#9334e6', label: 'admin' },
  superadmin: { bg: '#fce8e6', fg: '#c5221f', label: 'superadmin' },
  cs:         { bg: '#e6f4ea', fg: '#188038', label: 'CS 담당자' },
};
function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.worker;
  return <span className="gcp-chip" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

/** 구글 클라우드 콘솔 참조 — 이 페이지(build-console)에서만 적용되는 스코프 스타일.
 * App.css(기관 대시보드와 공유)는 건드리지 않고, .gcp-console 아래에서만 이긴다. */
function GcpStyle() {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap" />
      <style>{`
        .gcp-console, .gcp-console input, .gcp-console select, .gcp-console button, .gcp-console textarea {
          font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .gcp-console { background: #f8f9fa; color: #202124; }
        .gcp-console .section {
          background: #fff;
          border: 1px solid #dadce0;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15);
          padding: 20px 24px;
        }
        .gcp-console .section-title { color: #202124; font-size: 15px; font-weight: 500; }
        .gcp-console .btn-primary {
          background: #1a73e8; color: #fff; border: 1px solid #1a73e8; border-radius: 4px;
          font-weight: 500; font-size: 13.5px; padding: 8px 20px; letter-spacing: .01em;
        }
        .gcp-console .btn-primary:hover { background: #1765cc; border-color: #1765cc; }
        .gcp-console .btn-primary:disabled { background: #f1f3f4; border-color: #f1f3f4; color: #9aa0a6; }
        .gcp-console .btn-secondary, .gcp-console .btn-download {
          background: #fff; color: #1a73e8; border: 1px solid #dadce0; border-radius: 4px;
          font-weight: 500; font-size: 13px; padding: 7px 16px;
        }
        .gcp-console .btn-secondary:hover, .gcp-console .btn-download:hover { background: #e8f0fe; border-color: #d2e3fc; }
        .gcp-console .form-input {
          border: 1px solid #dadce0; border-radius: 4px; color: #202124; font-size: 14px;
        }
        .gcp-console .form-input:focus { border-color: #1a73e8; outline: none; box-shadow: 0 0 0 1px #1a73e8; }
        .gcp-console table thead tr { color: #5f6368; font-weight: 500; border-bottom: 1px solid #dadce0 !important; }
        .gcp-console table tbody tr { border-bottom: 1px solid #f1f3f4 !important; }
        .gcp-console table tbody tr:hover { background: #f8f9fa; }
        .gcp-console .gcp-chip {
          display: inline-block; font-size: 11.5px; font-weight: 500; padding: 2px 10px;
          border-radius: 999px; letter-spacing: .01em;
        }
        .gcp-console .gcp-sidebar { background: #fff; border-right: 1px solid #dadce0; }
        .gcp-console .gcp-nav-item {
          display: flex; align-items: center; gap: 14px; padding: 9px 16px 9px 20px;
          margin: 1px 8px 1px 0; border-radius: 0 20px 20px 0; cursor: pointer; border: none;
          background: transparent; color: #3c4043; font-size: 13.5px; font-weight: 500;
          width: calc(100% - 8px); text-align: left;
        }
        .gcp-console .gcp-nav-item:hover { background: #f1f3f4; }
        .gcp-console .gcp-nav-item.is-active { background: #e8f0fe; color: #1a73e8; }
        .gcp-console .gcp-nav-item.is-active svg { color: #1a73e8; }
        .gcp-console .gcp-topbar { background: #fff; border-bottom: 1px solid #dadce0; }
        .gcp-console .toast-viewport .toast { font-family: 'Roboto', sans-serif; }
      `}</style>
    </>
  );
}

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
    <div className="gcp-console" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f9fa',padding:24}}>
      <GcpStyle />
      <div style={{background:'#fff',borderRadius:8,border:'1px solid #dadce0',boxShadow:'0 1px 2px 0 rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)',padding:'40px 40px 32px',width:400,maxWidth:'100%'}}>
        <div style={{textAlign:'center',marginBottom:26}}>
          <div style={{width:44,height:44,borderRadius:11,background:'#1a73e8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,margin:'0 auto 14px'}}>영</div>
          <div style={{fontSize:20,fontWeight:500,color:'#202124'}}>AI영실이 운영 콘솔</div>
          <div style={{fontSize:13,color:'#5f6368',marginTop:6}}>총괄 관리자 전용 — 일반 기관 계정은 접근할 수 없습니다</div>
        </div>
        <div style={{fontSize:12.5,fontWeight:500,color:'#5f6368',margin:'14px 0 6px'}}>이메일</div>
        <input className="form-input" style={{width:'100%',height:44,padding:'0 14px',boxSizing:'border-box',fontSize:14.5,margin:0}}
          type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" />
        <div style={{fontSize:12.5,fontWeight:500,color:'#5f6368',margin:'16px 0 6px'}}>비밀번호</div>
        <input className="form-input" style={{width:'100%',height:44,padding:'0 14px',boxSizing:'border-box',fontSize:14.5,margin:0}}
          type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter' && doLogin()} autoComplete="current-password" />
        {err && <div style={{color:'#c5221f',fontSize:13,marginTop:12,background:'#fce8e6',padding:'10px 12px',borderRadius:4}}>{err}</div>}
        <button className="btn-primary" style={{width:'100%',height:44,fontSize:14.5,cursor:'pointer',marginTop:22}}
          disabled={busy} onClick={doLogin}>{busy ? '로그인 중...' : '로그인'}</button>
      </div>
    </div>
  );
}

function AccessDenied({ email, onLogout }: { email?: string; onLogout: () => void }) {
  return (
    <div className="gcp-console" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f9fa',padding:24}}>
      <GcpStyle />
      <div style={{background:'#fff',borderRadius:8,border:'1px solid #dadce0',boxShadow:'0 1px 2px 0 rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)',padding:40,width:420,maxWidth:'100%',textAlign:'center'}}>
        <div style={{width:48,height:48,borderRadius:'50%',background:'#fce8e6',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto',fontSize:22}}>🔒</div>
        <div style={{fontSize:17,fontWeight:500,color:'#202124',marginTop:16}}>운영 콘솔 접근 권한이 없습니다</div>
        <div style={{fontSize:13.5,color:'#5f6368',marginTop:8}}>{email ? `${email} 계정은 ` : ''}총괄 관리자 전용 콘솔입니다.</div>
        <button className="btn-secondary" style={{marginTop:22}} onClick={onLogout}>다른 계정으로 로그인</button>
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

type MonthlyRow = { month: string; total: number; completed: number; missed: number; failed: number; riskCritical: number; riskUrgent: number; riskWarning: number };

/** 월별 통화 스택바(연결/미연결/실패) + 위험알림 추이 라인 — SVG로 직접 그린 경량 차트 */
function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  if (!data.length) return null;
  const W = 720, H = 200, padL = 34, padB = 24, padT = 10, padR = 10;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(38, slot * 0.55);
  const maxTotal = Math.max(1, ...data.map(d => d.total));
  const maxRisk = Math.max(1, ...data.map(d => d.riskCritical + d.riskUrgent + d.riskWarning));
  const yFor = (v: number) => padT + plotH - (v / maxTotal) * plotH;
  const riskYFor = (v: number) => padT + plotH - (v / maxRisk) * plotH * 0.85; // 살짝 여유(라인이 막대 위에 안 붙게)

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const riskPoints = data.map((d, i) => {
    const x = padL + slot * i + slot / 2;
    const y = riskYFor(d.riskCritical + d.riskUrgent + d.riskWarning);
    return { x, y };
  });
  const linePath = riskPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
      {/* 옅은 그리드 */}
      {gridLines.map((g,i) => {
        const y = padT + plotH * (1-g);
        return <line key={i} x1={padL} x2={W-padR} y1={y} y2={y} stroke="#e8eaed" strokeWidth={1} />;
      })}
      {/* Y축 라벨(전체 발신 기준) */}
      {gridLines.map((g,i) => (
        <text key={i} x={padL-6} y={padT + plotH*(1-g)+4} fontSize={9.5} fill="#9aa0a6" textAnchor="end" fontFamily="Roboto Mono, monospace">
          {Math.round(maxTotal*g)}
        </text>
      ))}
      {/* 스택 바: 연결(초록) / 미연결(호박) / 실패(빨강) */}
      {data.map((d, i) => {
        const x = padL + slot*i + (slot-barW)/2;
        const yCompleted = yFor(d.completed);
        const yMissedTop = yFor(d.completed + d.missed);
        const yFailedTop = yFor(d.completed + d.missed + d.failed);
        const base = padT + plotH;
        return (
          <g key={d.month}>
            <rect x={x} y={yCompleted} width={barW} height={Math.max(0, base-yCompleted)} fill="#34a853" rx={2} />
            <rect x={x} y={yMissedTop} width={barW} height={Math.max(0, yCompleted-yMissedTop)} fill="#f9ab00" />
            <rect x={x} y={yFailedTop} width={barW} height={Math.max(0, yMissedTop-yFailedTop)} fill="#d93025" rx={0} />
            <text x={x+barW/2} y={H-6} fontSize={10.5} fill="#5f6368" textAnchor="middle">{d.month.slice(2).replace('-', '.')}</text>
          </g>
        );
      })}
      {/* 위험알림 추이 라인 */}
      <path d={linePath} fill="none" stroke="#7b1fa2" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {riskPoints.map((p,i) => {
        const isLast = i === riskPoints.length-1;
        return <circle key={i} cx={p.x} cy={p.y} r={isLast?4:2.5} fill="#7b1fa2" stroke="#fff" strokeWidth={isLast?1.5:0} />;
      })}
    </svg>
  );
}

const NAV = [
  { id: 'health', label: '시스템 모니터링', icon: Activity },
  { id: 'stats', label: '통계', icon: BarChart3 },
  { id: 'calls', label: '통화 이력', icon: Phone },
  { id: 'subscriptions', label: '정기결제 현황', icon: CreditCard },
  { id: 'payments', label: '결제 내역', icon: Receipt },
  { id: 'refunds', label: '환불', icon: RotateCcw },
  { id: 'orgs', label: '기관 관리', icon: Building2 },
  { id: 'users', label: '사용자', icon: UsersIcon },
  { id: 'elders', label: '어르신', icon: HeartHandshake },
  { id: 'notices', label: '공지', icon: Megaphone },
  { id: 'audit', label: '감사 로그', icon: FileClock },
  { id: 'test', label: '기능 테스트', icon: FlaskConical },
  { id: 'staff', label: '콘솔 계정', icon: UserCog },
] as const;
type PageId = typeof NAV[number]['id'];

/** CS 담당자(role:'cs')에게 보이는 사이드바 범위 — 백엔드 @AllowCs() 라우트와 1:1로 맞춘다 */
const CS_ALLOWED_PAGES: PageId[] = ['stats', 'calls', 'payments', 'refunds', 'users', 'elders', 'notices'];

export default function ConsoleApp() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null); // null=확인 중, true/false=결과
  const [consoleRole, setConsoleRole] = useState<string | null>(null); // 'superadmin' | 'cs' — 사이드바 범위 결정용
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
  const [testCallTargetInput, setTestCallTargetInput] = useState('');
  const [testPublicData, setTestPublicData] = useState<any[]>([]); // ComponentHealth[]
  const [auditLoading, setAuditLoading] = useState(false);
  const [authCheckError, setAuthCheckError] = useState('');   // 네트워크/CORS 등 판정 자체가 실패한 경우 — "권한 없음"과 구분해야 함
  const [authCheckRetry, setAuthCheckRetry] = useState(0);

  // ── 통계 ──
  const [statsData, setStatsData] = useState<any>(null); // { monthly, byOrg }
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsMonths, setStatsMonths] = useState(6);
  const [statsOrg, setStatsOrg] = useState('');

  // ── 사용자(기관 소속 계정) 관리 ──
  const [users, setUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersOrgFilter, setUsersOrgFilter] = useState('');
  const [userBusy, setUserBusy] = useState('');

  // ── 어르신 마스터 데이터 ──
  const [elders, setElders] = useState<any[]>([]);
  const [eldersPage, setEldersPage] = useState(1);
  const [eldersLoading, setEldersLoading] = useState(false);
  const [eldersOrgFilter, setEldersOrgFilter] = useState('');
  const [eldersSearch, setEldersSearch] = useState('');
  const [elderBusy, setElderBusy] = useState('');

  // ── 공지 ──
  const [notices, setNotices] = useState<any[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeTargetOrgs, setNoticeTargetOrgs] = useState(''); // 콤마 구분 orgId, 빈 값=전체
  const [noticeBusy, setNoticeBusy] = useState(false);

  // ── 콘솔 CS 계정 관리(superadmin 전용) ──
  const [csAccounts, setCsAccounts] = useState<any[]>([]);
  const [csAccountsLoading, setCsAccountsLoading] = useState(false);
  const [csEmail, setCsEmail] = useState('');
  const [csPassword, setCsPassword] = useState('');
  const [csName, setCsName] = useState('');
  const [csBusy, setCsBusy] = useState(false);

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
    if (!authUser) { setAuthorized(null); setAuthCheckError(''); setConsoleRole(null); return; }
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
        // /console/health는 superadmin·cs 둘 다 통과하므로, 사이드바를 실제 역할에 맞게
        // 좁히려면 /me로 정확한 role을 한 번 더 확인해야 한다.
        try {
          const meRes = await authFetch(`${SERVER_URL}/me`);
          const me = await meRes.json().catch(() => null);
          if (!cancelled && me?.role) setConsoleRole(me.role);
        } catch { /* 역할 확인 실패해도 기본(제한된) 화면으로 동작 — 아래 NAV 필터가 안전 쪽으로 처리 */ }
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
  const saveTestCallTarget = async () => {
    if (!testCallTargetInput.trim()) { notify('전화번호를 입력하세요'); return; }
    setTestBusy('call-target-save');
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/call-target`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: testCallTargetInput.trim() }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { notify(errMsg(d, '등록 실패')); return; }
      notify('테스트 대상 번호가 등록됐습니다', 'success');
      setTestCallTargetInput('');
      fetchTestCallTarget();
    } catch { notify('네트워크 오류 — 등록 실패'); }
    finally { setTestBusy(''); }
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

  // ── 통계 ──
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({ months: String(statsMonths) });
      if (statsOrg) params.set('org', statsOrg);
      const r = await authFetch(`${SERVER_URL}/console/stats?${params.toString()}`);
      setStatsData(await r.json().catch(() => null));
    } catch { notify('통계 조회 실패'); }
    finally { setStatsLoading(false); }
  };
  const orgName = (orgId: string) => orgs.find((o: any) => o.orgId === orgId)?.name || orgId;

  // ── 사용자(기관 소속 계정) 관리 ──
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (usersOrgFilter) params.set('org', usersOrgFilter);
      const r = await authFetch(`${SERVER_URL}/admin/users?${params.toString()}`);
      const d = await r.json().catch(() => []);
      setUsers(Array.isArray(d) ? d : []);
      setUsersPage(1);
    } catch { notify('사용자 목록 조회 실패'); }
    finally { setUsersLoading(false); }
  };
  const changeUserRole = async (u: any) => {
    const next = window.prompt(`"${u.email}" 계정의 새 역할을 입력하세요 (worker / staff / admin)`, u.role);
    if (next === null) return;
    if (!['worker', 'staff', 'admin'].includes(next)) { notify('worker / staff / admin 중 하나여야 합니다'); return; }
    setUserBusy(u.uid);
    try {
      const r = await authFetch(`${SERVER_URL}/admin/users/${u.uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { notify('역할을 변경했습니다.', 'success'); fetchUsers(); }
      else notify(errMsg(d, '역할 변경 실패'));
    } catch { notify('네트워크 오류 — 역할 변경 실패'); }
    finally { setUserBusy(''); }
  };
  const toggleUserLock = async (u: any, disabled: boolean) => {
    const verb = disabled ? '잠그' : '잠금 해제하';
    if (!window.confirm(`"${u.email}" 계정을 ${verb}시겠습니까?`)) return;
    setUserBusy(u.uid);
    try {
      const r = await authFetch(`${SERVER_URL}/admin/users/${u.uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disabled }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { notify(`계정을 ${disabled ? '잠갔습니다' : '잠금 해제했습니다'}.`, 'success'); fetchUsers(); }
      else notify(errMsg(d, '처리 실패'));
    } catch { notify('네트워크 오류 — 처리 실패'); }
    finally { setUserBusy(''); }
  };
  const resetUserPasswordAction = async (u: any) => {
    if (!window.confirm(`"${u.email}" 계정의 비밀번호 재설정 링크를 발급할까요? (메일은 자동 발송되지 않습니다 — 직접 전달해야 합니다)`)) return;
    setUserBusy(u.uid);
    try {
      const r = await authFetch(`${SERVER_URL}/admin/users/${u.uid}/reset-password`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.resetLink) {
        try { await navigator.clipboard.writeText(d.resetLink); notify('재설정 링크를 클립보드에 복사했습니다. 담당자에게 전달해 주세요.', 'success'); }
        catch { window.prompt('아래 링크를 복사해 담당자에게 전달하세요:', d.resetLink); }
      } else notify(errMsg(d, '링크 발급 실패'));
    } catch { notify('네트워크 오류 — 링크 발급 실패'); }
    finally { setUserBusy(''); }
  };

  // ── 어르신 마스터 데이터 ──
  const fetchElders = async () => {
    setEldersLoading(true);
    try {
      const params = new URLSearchParams();
      if (eldersOrgFilter) params.set('org', eldersOrgFilter);
      const r = await authFetch(`${SERVER_URL}/elders?${params.toString()}`);
      const d = await r.json().catch(() => []);
      setElders(Array.isArray(d) ? d : []);
      setEldersPage(1);
    } catch { notify('어르신 목록 조회 실패'); }
    finally { setEldersLoading(false); }
  };
  const transferElder = async (elder: any) => {
    const targetOrgId = window.prompt(
      `"${elder.name || elder.phone}" 어르신을 이관할 기관의 orgId를 입력하세요.\n(현재: ${elder.orgId})\n\n선택 가능: ${orgs.map((o: any) => `${o.orgId}(${o.name})`).join(', ')}`,
      '',
    );
    if (targetOrgId === null || !targetOrgId.trim()) return;
    if (!orgs.some((o: any) => o.orgId === targetOrgId.trim())) { notify('존재하지 않는 orgId입니다'); return; }
    if (!window.confirm(`"${elder.name || elder.phone}" 어르신을 "${targetOrgId.trim()}"로 이관합니다. 계속할까요?`)) return;
    setElderBusy(elder.phone);
    try {
      const r = await authFetch(`${SERVER_URL}/elders/save?org=${encodeURIComponent(targetOrgId.trim())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: elder.phone, force: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { notify('기관을 이관했습니다.', 'success'); fetchElders(); }
      else notify(errMsg(d, '이관 실패'));
    } catch { notify('네트워크 오류 — 이관 실패'); }
    finally { setElderBusy(''); }
  };

  // ── 공지(총괄 관리자 → 기관) ──
  const fetchNotices = async () => {
    setNoticesLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/notices`);
      const d = await r.json().catch(() => []);
      setNotices(Array.isArray(d) ? d : []);
    } catch { notify('공지 목록 조회 실패'); }
    finally { setNoticesLoading(false); }
  };
  const createNoticeAction = async () => {
    if (!noticeTitle.trim() || !noticeBody.trim()) { notify('제목과 내용을 입력하세요'); return; }
    const targetOrgs = noticeTargetOrgs.split(',').map(s => s.trim()).filter(Boolean);
    setNoticeBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/notices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noticeTitle.trim(), body: noticeBody.trim(), ...(targetOrgs.length ? { targetOrgs } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { notify('공지를 게시했습니다.', 'success'); setNoticeTitle(''); setNoticeBody(''); setNoticeTargetOrgs(''); fetchNotices(); }
      else notify(errMsg(d, '공지 생성 실패'));
    } catch { notify('네트워크 오류 — 공지 생성 실패'); }
    finally { setNoticeBusy(false); }
  };
  const toggleNoticeActive = async (n: any) => {
    const nextActive = !n.active;
    try {
      const r = await authFetch(`${SERVER_URL}/console/notices/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: nextActive }) });
      if (r.ok) { notify(nextActive ? '공지를 다시 게시했습니다.' : '공지를 내렸습니다.', 'success'); fetchNotices(); }
      else notify('상태 변경 실패');
    } catch { notify('네트워크 오류 — 상태 변경 실패'); }
  };
  const deleteNoticeAction = async (n: any) => {
    if (!window.confirm(`"${n.title}" 공지를 완전히 삭제할까요?`)) return;
    try {
      const r = await authFetch(`${SERVER_URL}/console/notices/${n.id}`, { method: 'DELETE' });
      if (r.ok) { notify('공지를 삭제했습니다.', 'success'); fetchNotices(); }
      else notify('삭제 실패');
    } catch { notify('네트워크 오류 — 삭제 실패'); }
  };

  // ── 콘솔 CS 계정 관리(superadmin 전용) ──
  const fetchCsAccounts = async () => {
    setCsAccountsLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/staff`);
      const d = await r.json().catch(() => []);
      setCsAccounts(Array.isArray(d) ? d : []);
    } catch { notify('CS 계정 목록 조회 실패'); }
    finally { setCsAccountsLoading(false); }
  };
  const createCsAccountAction = async () => {
    if (!csEmail.trim() || csPassword.length < 6) { notify('이메일과 6자 이상 비밀번호를 입력하세요'); return; }
    setCsBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/staff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: csEmail.trim(), password: csPassword, name: csName.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { notify('CS 계정을 생성했습니다.', 'success'); setCsEmail(''); setCsPassword(''); setCsName(''); fetchCsAccounts(); }
      else notify(errMsg(d, '생성 실패'));
    } catch { notify('네트워크 오류 — 생성 실패'); }
    finally { setCsBusy(false); }
  };
  const deleteCsAccountAction = async (u: any) => {
    if (!window.confirm(`"${u.email}" CS 계정을 삭제할까요?`)) return;
    try {
      const r = await authFetch(`${SERVER_URL}/console/staff/${u.uid}`, { method: 'DELETE' });
      if (r.ok) { notify('CS 계정을 삭제했습니다.', 'success'); fetchCsAccounts(); }
      else notify('삭제 실패');
    } catch { notify('네트워크 오류 — 삭제 실패'); }
  };

  useEffect(() => {
    if (authorized !== true) return;
    // consoleRole이 아직 안 정해졌으면(=/me 응답 전) 기다린다 — 안 그러면 기본 진입 화면인
    // '시스템 모니터링'용 fetchHealth()가 role 확정·리다이렉트보다 먼저 한 번 실행돼 CS
    // 계정에서 GET /console/calls/active(비허용 라우트) 403이 콘솔에 찍힌다(2026-09-01 발견).
    if (consoleRole === null) return;
    if (page === 'test') fetchTestCallTarget();
    if (page === 'health') fetchHealth();
    if (page === 'calls') fetchHistory();
    if (page === 'subscriptions') fetchSubs();
    if (page === 'orgs') fetchOrgs();
    if (page === 'test' && orgs.length === 0) fetchOrgs();
    if (page === 'audit') fetchAuditLogs();
    if (page === 'payments') fetchPayments();
    if (page === 'refunds') fetchRefundable();
    if (page === 'stats') { fetchStats(); if (orgs.length === 0) fetchOrgs(); }
    if (page === 'users') { fetchUsers(); if (orgs.length === 0) fetchOrgs(); }
    if (page === 'elders') { fetchElders(); if (orgs.length === 0) fetchOrgs(); }
    if (page === 'notices') fetchNotices();
    if (page === 'staff') fetchCsAccounts();
  }, [page, authorized, consoleRole]); // eslint-disable-line

  // CS 담당자는 기본 진입 화면(시스템 모니터링)을 못 보므로, 역할 확인이 끝나면 허용된
  // 화면으로 옮겨준다(그 전까지 짧게 시스템 모니터링이 보이는 건 렌더링뿐 — 실제 데이터 접근은
  // 백엔드가 막는다).
  useEffect(() => {
    if (consoleRole === 'cs' && !CS_ALLOWED_PAGES.includes(page)) setPage('stats');
  }, [consoleRole]); // eslint-disable-line

  if (!authChecked) return null;
  if (!authUser) return <LoginScreen />;
  if (authCheckError) {
    return (
      <div className="gcp-console" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f9fa',padding:24}}>
        <GcpStyle />
        <div style={{background:'#fff',borderRadius:8,border:'1px solid #dadce0',boxShadow:'0 1px 2px 0 rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)',padding:40,width:420,maxWidth:'100%',textAlign:'center'}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:'#fef7e0',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto',fontSize:22}}>⚠️</div>
          <div style={{fontSize:17,fontWeight:500,color:'#202124',marginTop:16}}>권한 확인 실패</div>
          <div style={{fontSize:13.5,color:'#5f6368',marginTop:8}}>{authCheckError}</div>
          <div style={{marginTop:20,display:'flex',gap:8,justifyContent:'center'}}>
            <button className="btn-primary" onClick={()=>setAuthCheckRetry(n=>n+1)}>다시 시도</button>
            <button className="btn-secondary" onClick={()=>signOut(auth as any)}>로그아웃</button>
          </div>
        </div>
      </div>
    );
  }
  if (authorized === null) return null; // 권한 확인 중 — 깜빡임 방지로 빈 화면
  if (authorized === false) return <AccessDenied email={authUser.email} onLogout={() => signOut(auth as any)} />;

  return (
    <div className="gcp-console" style={{display:'flex',minHeight:'100vh'}}>
      <GcpStyle />
      {toast && (
        <div className="toast-viewport">
          <div className={`toast toast--${toast.tone}`}>{toast.message}</div>
        </div>
      )}
      <div className="gcp-sidebar" style={{width:232,padding:'16px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'6px 20px 18px'}}>
          <div style={{width:28,height:28,borderRadius:7,background:'#1a73e8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>영</div>
          <div>
            <div style={{fontSize:14.5,fontWeight:500,color:'#202124',lineHeight:1.2}}>AI영실이</div>
            <div style={{fontSize:11,color:'#5f6368',lineHeight:1.2}}>운영 콘솔</div>
          </div>
        </div>
        {(consoleRole==='cs' ? NAV.filter(n=>CS_ALLOWED_PAGES.includes(n.id)) : NAV).map(item => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button key={item.id} onClick={()=>setPage(item.id)} className={`gcp-nav-item ${active?'is-active':''}`}>
              <Icon size={18} strokeWidth={active?2.25:1.75} style={{flexShrink:0,color: active?'#1a73e8':'#5f6368'}} />
              {item.label}
            </button>
          );
        })}
        <div style={{marginTop:'auto',paddingTop:14,borderTop:'1px solid #dadce0',margin:'14px 16px 0'}}>
          <div style={{fontSize:12,color:'#5f6368',padding:'0 4px 10px',wordBreak:'break-all'}}>{authUser.email}</div>
          <button className="btn-secondary" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:7}} onClick={()=>signOut(auth as any)}><LogOut size={14}/> 로그아웃</button>
        </div>
      </div>
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        <div className="gcp-topbar" style={{padding:'18px 32px',flexShrink:0}}>
          <div style={{fontSize:11.5,color:'#5f6368',fontWeight:500,letterSpacing:'.02em',marginBottom:2}}>AI영실이 운영 콘솔</div>
          <div style={{fontSize:21,fontWeight:500,color:'#202124'}}>{NAV.find(n=>n.id===page)?.label}</div>
        </div>
        <div style={{flex:1,padding:'24px 32px',overflowY:'auto'}}>

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

        {page === 'stats' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:16}}>
              <div className="script-editor-header" style={{marginBottom:10}}>
                <div className="section-title" style={{marginBottom:0}}>월별 이용 통계</div>
                <button className={`btn-download ${statsLoading?'btn-calling':''}`} onClick={fetchStats} disabled={statsLoading}>{statsLoading?'조회 중...':'조회'}</button>
              </div>
              <div style={{display:'flex',gap:10,marginBottom:14,alignItems:'center'}}>
                <select className="form-input" style={{width:140,margin:0}} value={statsMonths} onChange={e=>setStatsMonths(Number(e.target.value))}>
                  <option value={3}>최근 3개월</option>
                  <option value={6}>최근 6개월</option>
                  <option value={12}>최근 12개월</option>
                </select>
                <select className="form-input" style={{width:220,margin:0}} value={statsOrg} onChange={e=>setStatsOrg(e.target.value)}>
                  <option value="">전체 기관</option>
                  {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
                </select>
              </div>
              {!statsData ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{statsLoading?'불러오는 중...':'데이터 없음 — 조회 버튼을 눌러주세요'}</div> : (
                <>
                  <div style={{display:'flex',gap:18,flexWrap:'wrap',alignItems:'center',fontSize:12,color:'#5f6368',marginBottom:4}}>
                    <span><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#34a853',marginRight:5}}/>연결</span>
                    <span><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#f9ab00',marginRight:5}}/>미연결</span>
                    <span><span style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#d93025',marginRight:5}}/>실패</span>
                    <span><span style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:'#7b1fa2',marginRight:5}}/>위험알림 추이(우측 축)</span>
                  </div>
                  <MonthlyChart data={statsData.monthly || []} />
                  <div style={{overflowX:'auto',marginTop:18}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                      <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                        <th style={{padding:'8px 10px'}}>월</th><th style={{padding:'8px 10px'}}>전체 발신</th><th style={{padding:'8px 10px'}}>연결</th>
                        <th style={{padding:'8px 10px'}}>미연결</th><th style={{padding:'8px 10px'}}>실패</th><th style={{padding:'8px 10px'}}>연결률</th>
                        <th style={{padding:'8px 10px'}}>위험알림(긴급/주의)</th>
                      </tr></thead>
                      <tbody>{(statsData.monthly || []).map((m:any) => (
                        <tr key={m.month} style={{borderBottom:'1px solid #f1f3f4'}}>
                          <td style={{padding:'10px',fontWeight:700}}>{m.month}</td>
                          <td style={{padding:'10px'}}>{m.total}건</td>
                          <td style={{padding:'10px',color:'#1e8e3e'}}>{m.completed}건</td>
                          <td style={{padding:'10px',color:'#754d00'}}>{m.missed}건</td>
                          <td style={{padding:'10px',color:'#c5221f'}}>{m.failed}건</td>
                          <td style={{padding:'10px'}}>{m.connectRate != null ? `${Math.round(m.connectRate*100)}%` : '-'}</td>
                          <td style={{padding:'10px'}}>{m.riskCritical+m.riskUrgent > 0 ? <span style={{color:'#c5221f',fontWeight:700}}>{m.riskCritical+m.riskUrgent}건</span> : '-'}{m.riskWarning>0 && <span style={{color:'#754d00'}}> / 주의 {m.riskWarning}건</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
            {statsData && statsData.byOrg?.length > 0 && (
              <section className="section">
                <div className="section-title" style={{marginBottom:10}}>기관별 이용 순위 (선택 기간 합계)</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                    <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                      <th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>전체 발신</th><th style={{padding:'8px 10px'}}>연결</th><th style={{padding:'8px 10px'}}>연결률</th>
                    </tr></thead>
                    <tbody>{(() => {
                      const maxOrgTotal = Math.max(1, ...statsData.byOrg.map((o:any)=>o.total));
                      return statsData.byOrg.map((o:any) => (
                      <tr key={o.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px',minWidth:220}}>
                          <div style={{marginBottom:4}}>{orgName(o.orgId)}</div>
                          <div style={{background:'#f1f3f4',borderRadius:3,height:6,width:'100%',overflow:'hidden'}}>
                            <div style={{background:'#1a73e8',height:'100%',width:`${(o.total/maxOrgTotal)*100}%`}} />
                          </div>
                        </td>
                        <td style={{padding:'10px',fontVariantNumeric:'tabular-nums'}}>{o.total}건</td>
                        <td style={{padding:'10px',color:'#1e8e3e',fontVariantNumeric:'tabular-nums'}}>{o.completed}건</td>
                        <td style={{padding:'10px',fontVariantNumeric:'tabular-nums'}}>{o.connectRate != null ? `${Math.round(o.connectRate*100)}%` : '-'}</td>
                      </tr>
                      ));
                    })()}</tbody>
                  </table>
                </div>
              </section>
            )}
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
                      <td style={{padding:'10px',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',color:'#c5221f'}} disabled={refundBusy===p.id} onClick={()=>doRefund(p)}>
                            {refundBusy===p.id ? '처리 중...' : '환불'}
                          </button>
                          {p.refundRequestStatus==='pending' && (
                            <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px'}} disabled={refundBusy===p.id} onClick={()=>doRejectRefund(p)}>거절</button>
                          )}
                        </div>
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
                      <td style={{padding:'10px',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',color:'#1a73e8'}} disabled={orgBusy===o.orgId} onClick={()=>creditOrg(o)}>충전</button>
                          <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',color:suspended?'#1e8e3e':'#c5221f'}} disabled={orgBusy===o.orgId} onClick={()=>toggleOrgSuspend(o,!suspended)}>{orgBusy===o.orgId?'처리 중...':(suspended?'재개':'정지')}</button>
                        </div>
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

        {page === 'users' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>기관 소속 사용자 ({users.length}명)</div>
              <button className={`btn-download ${usersLoading?'btn-calling':''}`} onClick={fetchUsers} disabled={usersLoading}>{usersLoading?'조회 중...':'조회'}</button>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <select className="form-input" style={{width:220,margin:0}} value={usersOrgFilter} onChange={e=>setUsersOrgFilter(e.target.value)}>
                <option value="">전체 기관</option>
                {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
              </select>
            </div>
            {users.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{usersLoading?'불러오는 중...':'조회된 사용자가 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>이메일</th><th style={{padding:'8px 10px'}}>이름</th><th style={{padding:'8px 10px'}}>기관</th>
                    <th style={{padding:'8px 10px'}}>역할</th><th style={{padding:'8px 10px'}}></th>
                  </tr></thead>
                  <tbody>{users.slice((usersPage-1)*PAGE_SIZE, usersPage*PAGE_SIZE).map((u:any) => (
                    <tr key={u.uid} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{u.email}</td>
                      <td style={{padding:'10px'}}>{u.name || '-'}</td>
                      <td style={{padding:'10px'}}>{u.role==='cs' ? <span style={{color:'#94a3b8'}}>—(콘솔 전용)</span> : orgName(u.orgId)}</td>
                      <td style={{padding:'10px'}}><RoleBadge role={u.role} /></td>
                      <td style={{padding:'10px'}}>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',minWidth:280}}>
                          {consoleRole!=='cs' && (
                            <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px'}} disabled={userBusy===u.uid || u.role==='superadmin'} onClick={()=>changeUserRole(u)}>역할변경</button>
                          )}
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px'}} disabled={userBusy===u.uid || u.role==='superadmin' || u.role==='cs'} onClick={()=>toggleUserLock(u,true)}>잠금</button>
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px'}} disabled={userBusy===u.uid || u.role==='superadmin' || u.role==='cs'} onClick={()=>toggleUserLock(u,false)}>잠금해제</button>
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px',color:'#1a73e8'}} disabled={userBusy===u.uid || u.role==='superadmin' || u.role==='cs'} onClick={()=>resetUserPasswordAction(u)}>비번재설정</button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={usersPage} setPage={setUsersPage} total={users.length} />
              </div>
            )}
          </section>
        )}

        {page === 'elders' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>어르신 마스터 데이터 ({elders.length}명)</div>
              <button className={`btn-download ${eldersLoading?'btn-calling':''}`} onClick={fetchElders} disabled={eldersLoading}>{eldersLoading?'조회 중...':'조회'}</button>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
              <select className="form-input" style={{width:220,margin:0}} value={eldersOrgFilter} onChange={e=>setEldersOrgFilter(e.target.value)}>
                <option value="">전체 기관</option>
                {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
              </select>
              <input className="form-input" style={{width:220,margin:0}} placeholder="이름·전화번호 검색" value={eldersSearch} onChange={e=>setEldersSearch(e.target.value)} />
            </div>
            {(() => {
              const filtered = elders.filter((e:any) => !eldersSearch.trim() || String(e.name||'').includes(eldersSearch.trim()) || String(e.phone||'').includes(eldersSearch.trim()));
              return filtered.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{eldersLoading?'불러오는 중...':'조회된 어르신이 없습니다'}</div> : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                    <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                      <th style={{padding:'8px 10px'}}>이름</th><th style={{padding:'8px 10px'}}>전화번호</th><th style={{padding:'8px 10px'}}>기관</th>
                      <th style={{padding:'8px 10px'}}>승인상태</th><th style={{padding:'8px 10px'}}>통화활성</th><th style={{padding:'8px 10px'}}></th>
                    </tr></thead>
                    <tbody>{filtered.slice((eldersPage-1)*PAGE_SIZE, eldersPage*PAGE_SIZE).map((e:any) => (
                      <tr key={e.phone} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px'}}>{e.name || '-'}</td>
                        <td style={{padding:'10px'}}>{e.phone}</td>
                        <td style={{padding:'10px'}}>{orgName(e.orgId)}</td>
                        <td style={{padding:'10px'}}>
                          <span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:e.approved===false?'#fff8e1':'#e6f4ea',color:e.approved===false?'#754d00':'#1e8e3e'}}>{e.approved===false?'승인대기':'승인됨'}</span>
                        </td>
                        <td style={{padding:'10px'}}>{e.callActive===false ? <span style={{color:'#94a3b8'}}>꺼짐</span> : <span style={{color:'#1e8e3e'}}>켜짐</span>}</td>
                        <td style={{padding:'10px'}}>
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px'}} disabled={elderBusy===e.phone} onClick={()=>transferElder(e)}>{elderBusy===e.phone?'처리 중...':'기관 이관'}</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <Pager page={eldersPage} setPage={setEldersPage} total={filtered.length} />
                </div>
              );
            })()}
          </section>
        )}

        {page === 'notices' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>새 공지 게시</div>
              <input className="form-input" placeholder="제목" value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} style={{marginBottom:8}} />
              <textarea className="form-input" placeholder="내용" value={noticeBody} onChange={e=>setNoticeBody(e.target.value)} rows={4} style={{marginBottom:8,width:'100%',boxSizing:'border-box',resize:'vertical'}} />
              <input className="form-input" placeholder="대상 기관 orgId(콤마 구분, 비우면 전체 기관)" value={noticeTargetOrgs} onChange={e=>setNoticeTargetOrgs(e.target.value)} style={{marginBottom:8}} />
              <div style={{fontSize:12,color:'#94a3b8',marginBottom:10}}>기관코드: {orgs.map((o:any)=>`${o.orgId}(${o.name})`).join(', ') || '기관 목록 로딩 전'}</div>
              <button className="btn-primary" disabled={noticeBusy} onClick={createNoticeAction}>{noticeBusy?'게시 중...':'게시'}</button>
            </section>
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:10}}>
                <div className="section-title" style={{marginBottom:0}}>게시된 공지 ({notices.length}건)</div>
                <button className={`btn-download ${noticesLoading?'btn-calling':''}`} onClick={fetchNotices} disabled={noticesLoading}>{noticesLoading?'조회 중...':'새로고침'}</button>
              </div>
              {notices.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{noticesLoading?'불러오는 중...':'게시된 공지가 없습니다'}</div> : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {notices.map((n:any) => (
                    <div key={n.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',opacity:n.active?1:0.55}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:15}}>{n.title} {!n.active && <span style={{fontSize:11,fontWeight:600,color:'#5f6368',marginLeft:6}}>(내려짐)</span>}</div>
                          <div style={{fontSize:13,color:'#5f6368',marginTop:4,whiteSpace:'pre-wrap'}}>{n.body}</div>
                          <div style={{fontSize:12,color:'#94a3b8',marginTop:6}}>
                            대상: {n.targetOrgs?.length ? n.targetOrgs.map((o:string)=>orgName(o)).join(', ') : '전체 기관'} · {n.createdBy} · {n.createdAt ? new Date(n.createdAt).toLocaleString('ko-KR') : '-'}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px'}} onClick={()=>toggleNoticeActive(n)}>{n.active?'내리기':'재게시'}</button>
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px',color:'#c5221f'}} onClick={()=>deleteNoticeAction(n)}>삭제</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {page === 'staff' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>CS 계정 생성</div>
              <div style={{fontSize:12.5,color:'#5f6368',marginBottom:14}}>CS 담당자는 특정 기관에 속하지 않고, 콘솔의 통계·통화이력·결제내역·환불·사용자(비번재설정/잠금)·어르신·공지 화면만 사용할 수 있습니다.</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                <div>
                  <div style={{fontSize:12,color:'#5f6368',marginBottom:4}}>이메일</div>
                  <input className="form-input" style={{width:220,margin:0}} type="email" value={csEmail} onChange={e=>setCsEmail(e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:12,color:'#5f6368',marginBottom:4}}>비밀번호(6자 이상)</div>
                  <input className="form-input" style={{width:180,margin:0}} type="password" value={csPassword} onChange={e=>setCsPassword(e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:12,color:'#5f6368',marginBottom:4}}>이름(선택)</div>
                  <input className="form-input" style={{width:140,margin:0}} value={csName} onChange={e=>setCsName(e.target.value)} />
                </div>
                <button className="btn-primary" disabled={csBusy} onClick={createCsAccountAction}>{csBusy?'생성 중...':'생성'}</button>
              </div>
            </section>
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:10}}>
                <div className="section-title" style={{marginBottom:0}}>CS 계정 목록 ({csAccounts.length}명)</div>
                <button className={`btn-download ${csAccountsLoading?'btn-calling':''}`} onClick={fetchCsAccounts} disabled={csAccountsLoading}>{csAccountsLoading?'조회 중...':'새로고침'}</button>
              </div>
              {csAccounts.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{csAccountsLoading?'불러오는 중...':'생성된 CS 계정이 없습니다'}</div> : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                    <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                      <th style={{padding:'8px 10px'}}>이메일</th><th style={{padding:'8px 10px'}}>이름</th><th style={{padding:'8px 10px'}}></th>
                    </tr></thead>
                    <tbody>{csAccounts.map((u:any) => (
                      <tr key={u.uid} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px'}}>{u.email}</td>
                        <td style={{padding:'10px'}}>{u.name || '-'}</td>
                        <td style={{padding:'10px'}}><button className="btn-secondary" style={{fontSize:12,padding:'4px 8px',color:'#c5221f'}} onClick={()=>deleteCsAccountAction(u)}>삭제</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
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
                <div style={{color:'#c5221f',fontSize:13,marginBottom:12}}>테스트 대상 번호가 등록돼 있지 않습니다 — 아래에 테스트 전용 어르신 번호를 등록해야 이 기능을 쓸 수 있습니다(실제 어르신에게 오발신되지 않도록 이 번호로만 하드 제한됩니다).</div>
              ) : (
                <div style={{fontSize:13,color:'#5f6368',marginBottom:12}}>
                  테스트 대상: <b style={{color:'#0f172a'}}>{testCallTarget.name || '(이름 없음)'}</b> ({testCallTarget.phone}) · {testCallTarget.orgId || '소속 기관 확인 불가'}
                </div>
              )}
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:testCallTarget?.configured ? 14 : 0}}>
                <input className="form-input" style={{width:220,margin:0}} value={testCallTargetInput} onChange={e=>setTestCallTargetInput(e.target.value)} placeholder="테스트 어르신 번호(숫자만)" />
                <button className="btn-secondary" disabled={testBusy==='call-target-save'} onClick={saveTestCallTarget}>{testBusy==='call-target-save'?'등록 중...':(testCallTarget?.configured?'대상 변경':'대상 등록')}</button>
              </div>
              {testCallTarget?.configured && (
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  <button className="btn-primary" disabled={!!testBusy} onClick={()=>testCallFlow('checkin')}>{testBusy==='call-checkin'?'발신 중...':'안부확인 테스트 발신'}</button>
                  <button className="btn-secondary" disabled={!!testBusy} onClick={()=>testCallFlow('alert')}>{testBusy==='call-alert'?'발신 중...':'경보 테스트 발신'}</button>
                </div>
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
    </div>
  );
}
