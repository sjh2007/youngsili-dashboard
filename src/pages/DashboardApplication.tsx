import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { auth, authEnabled } from '../firebase';
import { onAuthStateChanged, signOut, sendEmailVerification } from 'firebase/auth';
import HelpGuide, { LATEST_NOTICE } from '../components/help/HelpGuide';
import ScriptPage from './dashboard/ScriptPage';
import DataPage from './dashboard/DataPage';
import SafetyPage from './dashboard/SafetyPage';
import CasenotesPage from './dashboard/CasenotesPage';
import SchedulePage from './dashboard/SchedulePage';
import EldersPage from './dashboard/EldersPage';
import HealthPage from './dashboard/HealthPage';
import ConsolePage from './dashboard/ConsolePage';
import DashboardHomePage from './dashboard/DashboardHomePage';
import CallsPage from './dashboard/CallsPage';
import ReportPage from './dashboard/ReportPage';
import DetailPage from './dashboard/DetailPage';
import AdminPage from './dashboard/AdminPage';
import RegisterPage from './dashboard/RegisterPage';
import ConsoleSubscriptionsPage from './dashboard/ConsoleSubscriptionsPage';
import FormsPage from './dashboard/FormsPage';
import AuthScreen from '../components/auth/AuthScreen';
import { ElderListSchema, MeSchema, BillingBalanceSchema, TopupResponseSchema, PaymentStatusSchema, SubscribeRegisterResponseSchema, SubscriptionStatusSchema, AlertListSchema, CallListSchema, ForestFireMapSchema, SpecialWarningMapSchema, DisasterMsgResponseSchema, parseOr } from '../schemas';
import { CallTranscript, GroupHeader, PageErrorBoundary } from '../components/common';
import { Button, Dialog, EmptyState, PageIntro, StatusBadge, Toolbar } from '../components/ui';
import { SERVER_URL, authFetch, errMsg } from '../utils/api';
import { localDayKey } from '../utils/date';
import { CAREGIVERS, STATUS_CONFIG, RISK_CONFIG } from '../constants/app';
import { useCountdown } from '../hooks/useCountdown';
import { AlertCircle, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, Plus,
         UserRound, UserRoundCheck, X, Search, Copy, LogOut, ChevronDown, List, Clock,
         LayoutGrid, Activity, Users, ShieldCheck, Phone, FileText, PencilLine,
         Database, Building2, Wallet, CreditCard, Crown } from 'lucide-react';
import {
  EMPTY_FORM, normalizeRegion, HISTORY_PAGE_SIZE, REFUND_REASON_PRESETS, PAY_METHOD_OPTIONS,
  BANK_LABELS, UPGRADE_PLANS, CHARGE_TIERS, juminToBirth, CARE_GROUPS, TITLE_OPTIONS,
  DEFAULT_SCRIPT, ALERT_TEMPLATES, WILDFIRE_STAGES, DEFAULT_QUESTIONS, fillAlertVars,
  NavIcon, RefreshIcon, RESTORABLE_PAGES, loadXLSX, whileVisible,
} from './dashboardConstants';

export default function App() {
  const [page, setPage]         = useState(() => { try { const h = (window.location.hash || '').replace('#','').split('/')[0]; const saved = localStorage.getItem('youngsili_current_page') || ''; return RESTORABLE_PAGES.includes(h) ? h : RESTORABLE_PAGES.includes(saved) ? saved : 'dashboard'; } catch { return 'dashboard'; } });
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => { if (!authEnabled) { setAuthChecked(true); return; } const unsub = onAuthStateChanged(auth, u => { setAuthUser(u); setAuthChecked(true); }); return unsub; }, []); // eslint-disable-line
  // 랜딩(로그인/가입)에서 ?login 으로 오면 남아있는 다른 계정 세션을 로그아웃 → 신규 계정으로 새로 로그인하게
  useEffect(() => {
    if (authEnabled && new URLSearchParams(window.location.search).has('login')) {
      signOut(auth).catch(() => {});
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []); // eslint-disable-line
  // 이메일 인증 완료 후 사용자 새로고침 → 인증상태 반영
  const reloadUser = async () => { try { await auth.currentUser?.reload(); } catch {} window.location.reload(); };
  const doLogout = () => signOut(auth);
  // 이메일 인증 리마인더(비차단): 재발송 + 쿨다운(한도 초과 방지)
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyCooldown, setVerifyCooldown] = useCountdown();
  const resendVerify = async () => {
    if (verifyCooldown > 0 || !auth.currentUser) return;
    setVerifyNote('');
    try { await sendEmailVerification(auth.currentUser); setVerifyNote('인증 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.'); setVerifyCooldown(60); }
    catch (e) { setVerifyNote(e.code === 'auth/too-many-requests' ? '⏳ 잠시 후 다시 시도해 주세요 (발송 한도).' : '발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'); setVerifyCooldown(30); }
  };
  // 일괄 발신 확인 — 되돌릴 수 없는 행위(실제 전화 발신) 직전 의도 재확인
  const [bulkConfirm, setBulkConfirm] = useState<any>(null);
  // 경보 통화에서 안부 질문까지 이어갈지 — 발신 확인 창에서 고른다. 기본은 경보만.
  const [alertIncludeCare, setAlertIncludeCare] = useState(false);
  // 사이드바: 메뉴 검색 + 그룹 접기(접힘 상태는 브라우저에 기억)
  const [navQuery, setNavQuery] = useState('');
  // 알림: 화면을 가리는 중앙 Dialog 대신 하단 토스트(자동 소멸)로 표시
  const [toast, setToast] = useState<{ message: string; tone: 'info'|'success'|'error'; hiding?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const toastHideTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const dismissToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
    setToast(t => t ? { ...t, hiding: true } : null);
    toastHideTimer.current = setTimeout(() => setToast(null), 200);
  };
  const notify = (message: unknown, tone: 'info'|'success'|'error' = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
    setToast({ message: String(message), tone });
    toastTimer.current = setTimeout(dismissToast, 3200);
  };
  const [navFold, setNavFold] = useState<any>(() => { try { return JSON.parse(localStorage.getItem('navFold') || '{}'); } catch { return {}; } });
  const toggleNavGroup = (label: string) => setNavFold(prev => {
    const next = { ...prev, [label]: !prev[label] };
    try { localStorage.setItem('navFold', JSON.stringify(next)); } catch {}
    return next;
  });
  // 기관코드 복사 (어르신 앱 등록 시 사용)
  const [orgCopied, setOrgCopied] = useState(false);
  const copyOrgCode = () => { if (!me?.orgCode) return; try { navigator.clipboard.writeText(me.orgCode); setOrgCopied(true); setTimeout(() => setOrgCopied(false), 1500); } catch {} };
  const [elders, setElders] = useState([]);  // 서버(Firestore) /elders에서 로드 (localStorage 더미 폐지)
  const [selected, setSelected] = useState(null);
  const eldersRequestRef = useRef<AbortController | null>(null);
  const callsRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    eldersRequestRef.current?.abort();
    callsRequestRef.current?.abort();
  }, []);
  useEffect(() => {
    if (page !== 'detail' || selected || elders.length === 0) return;
    try {
      const savedId = localStorage.getItem('youngsili_selected_elder_id');
      const elder = elders.find(e => String(e.id) === savedId);
      if (elder) setSelected(elder);
      else setPage('elders');
    } catch { setPage('elders'); }
  }, [page, selected, elders]);
  const [filter, setFilter]     = useState('all');
  const [form, setForm]         = useState<any>(EMPTY_FORM);
  const [formStep, setFormStep] = useState(1);
  const [searchName, setSearchName]   = useState('');
  const [regionFilter, setRegionFilter] = useState('전체');
  const [sortBy, setSortBy]           = useState('status');
  const [viewMode, setViewMode]       = useState('card');
  const [memoText, setMemoText]       = useState('');
  const [memos, setMemos]             = useState(() => { try { return JSON.parse(localStorage.getItem('youngsili_memos')) || []; } catch { return []; } });
  const [lastSync, setLastSync]       = useState(null);   // 마지막 데이터 갱신 시각 (헤더 표시)
  const [todoDone, setTodoDone]       = useState({});     // 대시보드 "오늘 할 일" 체크 상태
  const [noRespOpen, setNoRespOpen]   = useState(false);  // 대시보드 만성 미응답 요약 펼침 상태
  const [alertsOpen, setAlertsOpen]   = useState(false);  // 대시보드 알림 배너 3건 초과분 펼침 (위험은 항상 노출)
  const [healthData, setHealthData]     = useState([]);
  const [caregivers, setCaregivers]     = useState(CAREGIVERS);
  const [alertsData, setAlertsData]     = useState([]);
  const [alertCount, setAlertCount]     = useState(0);
  const [healthLoading, setHealthLoading] = useState(false);
  // 영실이 콘솔(총괄 관리자 전용) — 3개 서버 헬스체크 + 전체 기관 진행 중인 통화
  const [consoleHealth, setConsoleHealth] = useState(null);   // {status, components:[{name,ok,latencyMs,detail}]}
  const [consoleCalls, setConsoleCalls]   = useState([]);
  const [consoleLoading, setConsoleLoading] = useState(false);
  // 통화 이력(기관 무관, 최근 200건) — 별도 로딩/필터 상태(진행 중인 통화 폴링과 분리)
  const [consoleHistory, setConsoleHistory] = useState([]);
  const [consoleHistoryLoading, setConsoleHistoryLoading] = useState(false);
  const [consoleHistoryOrg, setConsoleHistoryOrg]   = useState('');
  const [consoleHistoryFrom, setConsoleHistoryFrom] = useState('');
  const [consoleHistoryTo, setConsoleHistoryTo]     = useState('');
  const [consoleHistoryPage, setConsoleHistoryPage] = useState(1);   // 통화 이력 최대 500건이라 테이블 페이지네이션 필요
  // 감사 로그 — 누가 언제 콘솔에서 뭘 조회했는지(2026-08-31). 통화 이력과 마찬가지로 수동 조회.
  const [consoleAuditLogs, setConsoleAuditLogs]       = useState([]);
  const [consoleAuditLoading, setConsoleAuditLoading] = useState(false);
  const [consoleAuditActor, setConsoleAuditActor]     = useState('');
  const [orgSuspending, setOrgSuspending] = useState('');   // 정지/재개 처리 중인 orgId(버튼 중복 클릭 방지)
  // 정기결제 현황(전체 기관, 총괄 관리자 전용) — 정액제 자동결제(빌링키) 등록 여부·다음 청구일·최근 오류
  const [consoleSubs, setConsoleSubs] = useState([]);
  const [consoleSubsLoading, setConsoleSubsLoading] = useState(false);
  // ── 멀티테넌트: 본인 정보 + 운영자 기관·계정 관리 ──
  const [me, setMe]               = useState(null);   // {role, orgId, orgName, orgCode, email}
  const [orgNotices, setOrgNotices] = useState([]);    // 총괄 관리자 콘솔이 보낸 공지(GET /notices/active)
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState([]); // 닫기는 이 세션 동안만(서버에 안 남김)
  const [billing, setBilling]     = useState(null);   // {creditBalance: number|null} — null(미조회) 이면 차단 화면 안 띄움
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); // 요금제 정책 v1.0(2026-08-28) §5 기준 정액제 안내
  const [upgradeTab, setUpgradeTab] = useState('metered'); // 'metered'(정량제, 주력) | 'flat'(정액제, 보조)
  const [topupBusy, setTopupBusy] = useState(false); // 포트원 결제 요청 처리 중(버튼 중복 클릭 방지)
  const [paymentSuccess, setPaymentSuccess] = useState(null); // 결제 접수 완료 모달 {amount, desc}(null이면 모달 숨김)
  const [subscribeBusy, setSubscribeBusy] = useState(null); // 결제 요청 처리 중인 planKey(중복 클릭 방지)
  const [subStatus, setSubStatus] = useState(null); // GET /billing/subscription — {plan, autoRenew, nextChargeAt, lastChargeError, elderCount, monthlyAmount}
  const [subCancelBusy, setSubCancelBusy] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [topupPayMethod, setTopupPayMethod] = useState('CARD'); // 'CARD'(이니시스) | 'TRANSFER'(계좌이체) | 'VIRTUAL_ACCOUNT'(무통장입금) — 카카오페이는 제외(2026-09-01)
  const [pendingTopup, setPendingTopup] = useState(null); // {amount} — "신청" 클릭 시 결제수단 선택 모달을 띄우기 위한 대기 상태
  const [showPlanModal, setShowPlanModal] = useState(false); // 사이드바 크레딧 잔액 클릭 → 현재 플랜·잔액·결제수단 요약 모달
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null); // {id, amount} — 환불 요청 사유 선택 모달
  const [refundReasonPreset, setRefundReasonPreset] = useState(REFUND_REASON_PRESETS[0]);
  const [refundReasonCustom, setRefundReasonCustom] = useState('');
  const [refundRequestBusy, setRefundRequestBusy] = useState(false);
  const [virtualAccountInfo, setVirtualAccountInfo] = useState(null); // {amount, bank, accountNumber, remitteeName, expiredAt} — 계좌 발급 완료 안내 모달
  const [orgs, setOrgs]           = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [newOrgType, setNewOrgType] = useState('senior');   // 기관 유형 (화면 분기 기준)
  const [newOrgName, setNewOrgName] = useState('');
  const [newAcct, setNewAcct]     = useState({ email:'', password:'', name:'', phone:'', orgId:'', role:'worker' });
  const [adminMsg, setAdminMsg]   = useState('');
  const isSuper = me?.role === 'superadmin';
  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';   // 기관 관리자(자기 기관 계정 관리 가능)
  // 역할 계층: superadmin(운영자) > admin(센터장) > staff(전담직원) > worker(지원사)
  const isStaffUp = isAdmin || me?.role === 'staff';                   // 전담직원 이상 — 구성원 초대·이용자 배정
  const ROLE_KO = { superadmin: '운영자', admin: '센터장(관리자)', staff: '전담직원', worker: '지원사' };
  // 내가 초대·생성으로 부여할 수 있는 역할 (서버 GRANTABLE과 일치)
  const grantableRoles = isSuper ? ['admin','staff','worker'] : isAdmin ? ['admin','staff','worker'] : ['worker'];
  // ── 기관 유형별 화면 분기 (orgType): senior=노인맞춤돌봄(기본) / disability=장애인활동지원 ──
  // 용어·메뉴·서식 기본값이 기관 유형을 따라감. 데이터 구조는 동일(하나의 플랫폼).
  const isDisability = me?.orgType === 'disability';
  const T = isDisability
    ? { elder: '이용자', worker: '활동지원사', benefit: '활동지원서비스' }
    : { elder: '어르신', worker: '생활지원사', benefit: '노인맞춤돌봄서비스' };
  const ORG_TYPE_KO = { senior: '노인맞춤돌봄', disability: '장애인활동지원' };
  // 도움말 '업데이트 소식' 읽음 추적 → 새 소식 있으면 메뉴에 🔴
  const [helpSeen, setHelpSeen] = useState(() => { try { return Number(localStorage.getItem('youngsili_help_seen') || 0); } catch { return 0; } });
  const hasNewNotice = LATEST_NOTICE > helpSeen;

  // ── 통계(리포트) 상태 ──
  const [statsRange, setStatsRange]       = useState('month'); // week | month | 3month | custom
  const [statsFrom, setStatsFrom]         = useState('');
  const [statsTo, setStatsTo]             = useState('');
  const [statsData, setStatsData]         = useState(null);    // 현재 기간 /stats
  const [statsPrev, setStatsPrev]         = useState(null);    // 직전 기간(추이 비교용)
  const [statsLoading, setStatsLoading]   = useState(false);
  const [callsHistory, setCallsHistory]   = useState([]);     // 서버 /calls (통화별 1건)
  const [callsLoading, setCallsLoading]   = useState(false);
  const [callsRange, setCallsRange]       = useState('month'); // week | month | custom
  const [callsFrom, setCallsFrom]         = useState('');
  const [callsTo, setCallsTo]             = useState('');
  const [callsPhone, setCallsPhone]       = useState('');     // 어르신 필터 ('' = 전체)
  const [callsSearch, setCallsSearch]     = useState('');     // 이름 검색
  const [callsRisk, setCallsRisk]         = useState('all');  // 위험도 필터 all|critical|urgent|normal (KPI 드릴다운)
  const [healthHistory, setHealthHistory] = useState([]);     // 건강 이력 (healthEvents)
  const [healthRange, setHealthRange]     = useState('month');
  const [healthHistFrom, setHealthHistFrom] = useState('');
  const [healthHistTo, setHealthHistTo]   = useState('');
  const [reportCalls, setReportCalls]     = useState([]);     // 리포트용 통화 실데이터 (calls)
  const [reportDispatches, setReportDispatches] = useState([]); // 리포트용 발신 이력(종료 사유 도넛용)

  // 위험 키워드 → 위험도 (키워드 칩 색상용; 서버 KEYWORDS와 동기화)
  const KW_LEVEL = {
    critical: ['살려','쓰러','숨이 막','숨을 못','의식','가슴이 아파','가슴 아파','죽','119','구급차','피가 나','피나','못 일어'],
    urgent:   ['어지러','넘어졌','넘어져','토','열이 나','열나','다쳤','숨이 차','답답','배가 아파','머리가 아파','많이 아파','힘이 없','기운이 없','무서','혼자'],
  };
  const kwLevel = (kw) => {
    const t = kw || '';
    if (KW_LEVEL.critical.some(s => t.includes(s))) return 'critical';
    if (KW_LEVEL.urgent.some(s => t.includes(s))) return 'urgent';
    return 'warning';
  };
  const LV_COLOR = { critical: { c:'#dc2626', bg:'#fef2f2' }, urgent: { c:'#d97706', bg:'#fffbeb' }, warning: { c:'#ca8a04', bg:'#fefce8' } };
  // 통화 기록 목록용 — 대화 전문에서 감지 키워드만 추출해 강조 (V2: 목록은 스캔용)
  const kwFromTranscript = (t) => {
    const s = t || '';
    const hit = KW_LEVEL.critical.find(k => s.includes(k)) || KW_LEVEL.urgent.find(k => s.includes(k));
    if (!hit) return null;
    const idx = s.indexOf(hit);
    const from = Math.max(0, s.lastIndexOf(' ', idx) + 1);
    let to = s.indexOf(' ', idx + hit.length); if (to < 0) to = Math.min(s.length, idx + hit.length + 4);
    return s.slice(from, to).replace(/[.,~!?]+$/, '');
  };

  const rangeToDates = (range) => {
    const to = new Date();
    const day = 86400000;
    if (range === 'custom' && statsFrom && statsTo) return { from: new Date(statsFrom + 'T00:00:00'), to: new Date(statsTo + 'T23:59:59') };
    if (range === 'week')   return { from: new Date(to.getTime() - 7 * day),  to };
    if (range === '3month') return { from: new Date(to.getTime() - 90 * day), to };
    return { from: new Date(to.getTime() - 30 * day), to }; // month
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { from, to } = rangeToDates(statsRange);
      const span = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - span);
      const [cur, prev, callsRes, dispRes] = await Promise.all([
        authFetch(`${SERVER_URL}/stats?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/stats?from=${prevFrom.toISOString()}&to=${prevTo.toISOString()}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/calls?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/call/dispatches?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
      ]);
      setStatsData(cur); setStatsPrev(prev); setReportCalls(callsRes.calls || []);
      setReportDispatches(Array.isArray(dispRes.dispatches) ? dispRes.dispatches : []);
    } catch { setStatsData({ available: false }); setStatsPrev(null); }
    finally { setStatsLoading(false); }
  };

  const priorityScore = (es) => {
    if (!es) return 0;
    const w = { critical: 3, urgent: 1.5, warning: 1 };
    let s = 0;
    Object.entries((es.byLevel || {}) as Record<string, any>).forEach(([lvl, c]) => { s += c * (w[lvl] || 1); });
    if (es.lastAt) { const d = (Date.now() - new Date(es.lastAt).getTime()) / 86400000; if (d < 1) s *= 1.5; else if (d < 3) s *= 1.2; }
    return Math.round(s * 10) / 10;
  };

  // 위험 키워드 통계 → 엑셀(UTF-8 CSV, BOM 포함 → Excel 한글 정상)
  const exportStatsCSV = () => {
    if (!statsData || !statsData.elders || Object.keys(statsData.elders).length === 0) { notify('내보낼 통계 데이터가 없습니다.'); return; }
    const { from, to } = rangeToDates(statsRange);
    const fmt = (d) => new Date(d).toLocaleDateString('ko-KR');
    const entries = Object.entries(statsData.elders as Record<string, any>)
      .map(([name, es]) => ({ name, es, score: priorityScore(es), prevTotal: (statsPrev && statsPrev.elders && statsPrev.elders[name] && statsPrev.elders[name].total) || 0 }))
      .sort((a, b) => b.score - a.score);
    const rows = [];
    rows.push(['위험 키워드 통계 리포트']);
    rows.push(['기간', `${fmt(from)} ~ ${fmt(to)}`]);
    rows.push(['총 위험 감지', `${statsData.totalEvents || 0}건`]);
    rows.push([]);
    rows.push(['순위', '어르신', '우선순위 점수', '총 감지', '주요 키워드(빈도)', '긴급', '주의', '마지막 감지', '지난기간', '증감']);
    entries.forEach((e, i) => {
      const kwStr = Object.entries((e.es.keywords || {}) as Record<string, any>).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}(${c})`).join(' ');
      const diff = e.es.total - e.prevTotal;
      rows.push([i + 1, e.name, e.score, e.es.total, kwStr, (e.es.byLevel || {}).critical || 0, (e.es.byLevel || {}).urgent || 0, e.es.lastAt ? new Date(e.es.lastAt).toLocaleString('ko-KR') : '', e.prevTotal, diff > 0 ? `+${diff}` : `${diff}`]);
    });
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `위험키워드통계_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── 월간 실적 보고서(엑셀 4시트: 요약/어르신별/일별/위험감지) — 지자체 안전확인 실적 보고용 ──
  const downloadMonthlyReport = async (monthArg) => {
    const targetMonth = (typeof monthArg === 'string' && /^\d{4}-\d{2}$/.test(monthArg)) ? monthArg : reportMonth;
    if (monthlyBusy) return;
    setMonthlyBusy(true);
    try {
      const XLSX = await loadXLSX();
      const [y, m] = targetMonth.split('-').map(Number);
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59);
      const fi = from.toISOString(), ti = to.toISOString();
      const [callsR, dispR, notesR, arR] = await Promise.all([
        authFetch(`${SERVER_URL}/calls?from=${fi}&to=${ti}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/call/dispatches?from=${fi}&to=${ti}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/case-notes?from=${fi}&to=${ti}`).then(r => r.json()).catch(() => ({ notes: [] })),
        authFetch(`${SERVER_URL}/alert/responses?from=${fi}`).then(r => r.json()).catch(() => ({ responses: [] })),
      ]);
      const calls = callsR.calls || [];
      const disps = dispR.dispatches || [];
      const notes = notesR.notes || [];
      const ar = (arR.responses || []).filter(x => (x.at || '') >= fi && (x.at || '') <= ti);
      const norm = (ph) => String(ph || '').replace(/\D/g, '');
      const st = (v) => disps.filter(d => d.status === v).length;
      const received = st('completed') + st('answered');
      const totalDisp = disps.length;
      const durMin = Math.round(calls.reduce((sum, c) => sum + (c.durationSec || 0), 0) / 60);
      const nCrit = calls.filter(c => c.riskLevel === 'critical').length;
      const nUrg = calls.filter(c => c.riskLevel === 'urgent' || c.riskLevel === 'warning').length;
      const monthLabel = `${y}년 ${m}월`;

      // 시트1: 요약
      const aoaS = [
        [`AI 영실이 월간 실적 보고서 — ${monthLabel}`], [],
        ['구분', '값'],
        ['대상 어르신(등록)', `${elders.length}명`],
        ['· 일반돌봄군', `${elders.filter(e => e.careGroup === 'general').length}명`],
        ['· 중점돌봄군', `${elders.filter(e => e.careGroup === 'intensive').length}명`],
        ['· 미지정', `${elders.filter(e => !CARE_GROUPS[e.careGroup]).length}명`], [],
        ['AI 전화 안전확인 발신', `${totalDisp}건`],
        ['· 안전확인 완료(받음)', `${received}건`],
        ['· 부재중', `${st('missed')}건`],
        ['· 발신 실패', `${st('failed')}건`],
        ['· 안전확인 성공률', totalDisp ? `${Math.round(received / totalDisp * 100)}%` : '-'], [],
        ['통화(안부대화) 건수', `${calls.length}건`],
        ['총 통화 시간', `${durMin}분`],
        ['위험 감지 — 긴급', `${nCrit}건`],
        ['위험 감지 — 주의', `${nUrg}건`], [],
        ['재난 경보 응답 — 안전확인', `${ar.filter(x => x.response === 'safe').length}건`],
        ['재난 경보 응답 — 도움요청', `${ar.filter(x => x.response === 'help').length}건`],
        ['재난 경보 응답 — 미응답', `${ar.filter(x => x.response === 'missed').length}건`], [],
        ['상담·방문 일지 작성', `${notes.length}건`],
        ['· 방문', `${notes.filter(n => n.type === 'visit').length}건`],
        ['· 전화', `${notes.filter(n => n.type === 'phone').length}건`],
      ];

      // 시트2: 어르신별 실적
      const aoaE = [['이름', '돌봄군', '지역', '통화 성공(건)', '통화한 날(일)', '부재중(건)', '총 통화(분)', '긴급', '주의', '마지막 통화일']];
      elders.forEach(e => {
        const ph = norm(e.phone);
        const my = calls.filter(c => norm(c.phone) === ph);
        const days = new Set(my.map(c => c.date)).size;
        const myDisp = disps.filter(d => norm(d.phone) === ph);
        const last = my.map(c => c.date).sort().pop() || '-';
        aoaE.push([
          e.name, (CARE_GROUPS[e.careGroup] || {}).label || '미지정', e.region || '',
          my.length, days, myDisp.filter(d => d.status === 'missed').length,
          Math.round(my.reduce((sum, c) => sum + (c.durationSec || 0), 0) / 60),
          my.filter(c => c.riskLevel === 'critical').length,
          my.filter(c => c.riskLevel === 'urgent' || c.riskLevel === 'warning').length,
          last,
        ]);
      });

      // 시트3: 일별 현황
      const aoaD = [['날짜', '발신', '받음', '부재중', '통화 성공', '긴급 감지']];
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dd = disps.filter(x => (x.sentAtIso || '').slice(0, 10) === ds);
        if (!dd.length && !calls.some(c => c.date === ds)) continue;
        aoaD.push([ds, dd.length, dd.filter(x => x.status === 'completed' || x.status === 'answered').length,
          dd.filter(x => x.status === 'missed').length, calls.filter(c => c.date === ds).length,
          calls.filter(c => c.date === ds && c.riskLevel === 'critical').length]);
      }

      // 시트4: 위험 감지 상세
      const aoaR = [['날짜', '어르신', '위험도', '통화(초)']];
      calls.filter(c => c.riskLevel && c.riskLevel !== 'normal')
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .forEach(c => aoaR.push([c.date, nameByPhone(c.phone, c.elderName), (RISK_CONFIG[c.riskLevel] || {}).label || c.riskLevel, c.durationSec || 0]));

      const wb = XLSX.utils.book_new();
      const add = (aoa, name, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols; XLSX.utils.book_append_sheet(wb, ws, name); };
      add(aoaS, '요약', [{ wch: 30 }, { wch: 16 }]);
      add(aoaE, '어르신별 실적', [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 7 }, { wch: 7 }, { wch: 13 }]);
      add(aoaD, '일별 현황', [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }]);
      add(aoaR, '위험 감지', [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]);
      XLSX.writeFile(wb, `영실이_월간실적_${targetMonth}.xlsx`);
    } catch (e) { notify('보고서 생성에 실패했습니다: ' + e.message); }
    setMonthlyBusy(false);
  };

  const fetchElders = async () => {
    eldersRequestRef.current?.abort();
    const controller = new AbortController();
    eldersRequestRef.current = controller;
    try {
      const res = await authFetch(`${SERVER_URL}/elders`, { signal: controller.signal });
      const data = parseOr(ElderListSchema, await res.json(), null);
      if (!controller.signal.aborted && Array.isArray(data)) setElders(data.filter(e => e && e.phone));  // 번호 없는 잘못된 문서 제외
    } catch (err) { if (!controller.signal.aborted) console.error('어르신 목록 오류:', err); }
    finally { if (eldersRequestRef.current === controller) eldersRequestRef.current = null; }
  };

  const fetchCaregivers = async () => {
    try {
      const res = await authFetch(`${SERVER_URL}/settings/caregivers`);
      const d = await res.json();
      if (Array.isArray(d.list) && d.list.length) setCaregivers(d.list);
    } catch { /* 서버 미응답 시 기본 목록 유지 */ }
  };
  const addCaregiver = () => {
    const name = (window.prompt('새 담당 복지사 이름을 입력하세요') || '').trim();
    if (!name) return;
    const isNew = !caregivers.includes(name);
    const next = isNew ? [...caregivers, name] : caregivers;
    setCaregivers(next);
    setForm(f => ({ ...f, caregiver: name }));
    if (isNew) authFetch(`${SERVER_URL}/settings/caregivers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ list: next }) }).catch(()=>{});
  };

  // ── 멀티테넌트: 본인 정보 + 운영자 기관·계정 관리 ──
  const fetchMe = async () => {
    try { const r = await authFetch(`${SERVER_URL}/me`); if (r.ok) { const m = parseOr(MeSchema, await r.json(), null); if (m) setMe(m); } } catch {}
  };
  // 총괄 관리자 콘솔이 보낸 공지("점검 예정" 등) — 닫기는 이 세션 동안만 유지(서버에 안 남김)
  const fetchOrgNotices = async () => {
    try { const r = await authFetch(`${SERVER_URL}/notices/active`); if (r.ok) setOrgNotices(await r.json().catch(()=>[])); } catch {}
  };
  // 선불 충전식 크레딧 잔액(1단계) — superadmin은 소속 기관이 없어(orgId='*') 조회 대상이 아니다.
  // /billing/balance는 @BillingExempt라 잔액 0이어도 조회는 항상 성공한다(막힌 이유를 보여줘야 하므로).
  const fetchBillingBalance = async () => {
    try {
      const r = await authFetch(`${SERVER_URL}/billing/balance`);
      if (r.ok) setBilling(parseOr(BillingBalanceSchema, await r.json(), null));
    } catch {}
  };
  // 30일 무료체험 시작 — 요금제 업그레이드 모달의 "시범사업" 카드. 기관당 1회만 가능(서버가 재시작 차단).
  const startTrial = async () => {
    if (subscribeBusy) return;
    setSubscribeBusy('trial');
    try {
      const r = await authFetch(`${SERVER_URL}/billing/start-trial`, { method: 'POST' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { notify(errMsg(d, '체험 시작 실패')); return; }
      setShowUpgradeModal(false);
      notify('30일 무료체험이 시작됐습니다.', 'success');
      fetchBillingBalance();
    } catch {
      notify('네트워크 오류 — 체험 시작 실패');
    } finally {
      setSubscribeBusy(null);
    }
  };
  // 크레딧 충전(2단계, 포트원) — 서버가 포트원 미설정(501)이면 기존 "접수 안내" 문구로 자동
  // 폴백한다(운영에 아직 포트원 키가 안 들어간 동안도 화면이 안 깨지게). 설정돼 있으면
  // PortOne.js 결제창을 띄우고, 실제 크레딧 반영은 서버 웹훅이 비동기로 처리하므로 결제
  // 완료 직후 몇 차례 잔액을 다시 조회한다.
  const startTopup = async (amount) => {
    if (topupBusy) return;
    setTopupBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/billing/topup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount, payMethod: topupPayMethod }) });
      const d = await r.json().catch(()=>({}));
      if (r.status === 501) {
        setShowUpgradeModal(false);
        notify(`${amount.toLocaleString()}원 충전 신청이 접수됐습니다. 담당자가 확인 후 연락드립니다.`, 'success');
        return;
      }
      if (!r.ok) { notify(errMsg(d, '결제 요청 실패')); return; }
      const topup = parseOr(TopupResponseSchema, d, null);
      if (!topup) { notify('결제 요청 응답을 처리할 수 없습니다'); return; }

      const { requestPayment } = await import('@portone/browser-sdk/v2');
      const response = await requestPayment({
        storeId: topup.storeId,
        channelKey: topup.channelKey,
        paymentId: topup.paymentId,
        orderName: topup.orderName,
        totalAmount: topup.amount,
        currency: 'KRW',
        // 2026-09-01: 결제수단 선택 버튼 추가 — 카카오페이(기존 채널)/카드(이니시스 일반결제
        // 채널) 중 사용자가 고른 값을 그대로 전달. 서버가 payMethod에 맞는 channelKey를
        // 이미 골라서 내려주므로 프론트는 값만 그대로 넘기면 된다.
        payMethod: topup.payMethod,
        // 일부 PG는 customer.fullName(또는 email)이 없으면 prepare 단계에서 400을 낸다.
        customer: { email: me?.email || undefined, fullName: me?.name || me?.orgName || '고객', phoneNumber: me?.phone || undefined },
        // 무통장입금은 입금 기한이 필수 파라미터(이니시스 실측: accountExpiry 없으면 400).
        ...(topup.payMethod === 'VIRTUAL_ACCOUNT' ? { virtualAccount: { accountExpiry: { validHours: 24 } } } : {}),
      });
      if (response?.code !== undefined) { notify(`결제 실패: ${response.message || response.code}`); return; }

      setShowUpgradeModal(false);
      if (topup.payMethod === 'VIRTUAL_ACCOUNT') {
        // 무통장입금은 결제창이 끝나도 "결제 완료"가 아니라 "계좌 발급"일 뿐 — 서버가 웹훅으로
        // 계좌 정보를 받아 저장할 때까지 몇 차례 폴링해서 화면에 보여준다(실제 입금 여부와 무관).
        for (const delayMs of [1500, 3000, 5000, 8000, 12000]) {
          await new Promise(res => setTimeout(res, delayMs));
          try {
            const sr = await authFetch(`${SERVER_URL}/billing/payment/${topup.paymentId}`);
            if (!sr.ok) continue;
            const status = parseOr(PaymentStatusSchema, await sr.json(), null);
            if (status?.virtualAccount?.accountNumber) {
              setVirtualAccountInfo({ amount, ...status.virtualAccount });
              return;
            }
          } catch { /* 다음 시도에서 재시도 */ }
        }
        notify('계좌 발급 확인이 지연되고 있습니다. 잠시 후 결제 내역에서 다시 확인해 주세요.', 'info');
        return;
      }
      setPaymentSuccess({ amount, desc: `${amount.toLocaleString()}원 충전 요청이 접수됐습니다.` });
      [3000, 7000, 15000].forEach(ms => setTimeout(fetchBillingBalance, ms));
    } catch {
      notify('네트워크 오류 — 결제 요청 실패');
    } finally {
      setTopupBusy(false);
    }
  };
  // 결제 내역 — 업그레이드 모달의 "결제 내역" 탭에서 조회
  const fetchPaymentHistory = async () => {
    setPaymentHistoryLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/billing/payments`);
      const d = await r.json().catch(()=>({}));
      setPaymentHistory(Array.isArray(d?.payments) ? d.payments : []);
    } catch { notify('결제 내역 조회 실패'); }
    finally { setPaymentHistoryLoading(false); }
  };
  // 환불 요청 — 실제 환불은 총괄 관리자가 콘솔에서 승인해야 실행된다(여기선 요청만 남긴다)
  const submitRefundRequest = async () => {
    const reason = refundReasonPreset === '직접 입력' ? refundReasonCustom.trim() : refundReasonPreset;
    if (!reason) { notify('환불 사유를 입력해 주세요'); return; }
    setRefundRequestBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/billing/payment/${refundTarget.id}/refund-request`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason }),
      });
      const d = await r.json().catch(()=>({}));
      if (r.ok) { notify('환불 요청이 접수됐습니다. 담당자 확인 후 처리됩니다.', 'success'); setRefundTarget(null); fetchPaymentHistory(); }
      else notify(errMsg(d, '환불 요청 실패'));
    } catch { notify('네트워크 오류 — 환불 요청 실패'); }
    finally { setRefundRequestBusy(false); }
  };
  // 정액제 자동결제(빌링키) 현재 상태 — 다음 청구일·최근 오류 등. 업그레이드 모달을 열 때/결제 확정 후 갱신한다.
  const fetchSubscriptionStatus = async () => {
    try {
      const r = await authFetch(`${SERVER_URL}/billing/subscription`);
      if (r.ok) setSubStatus(parseOr(SubscriptionStatusSchema, await r.json(), null));
    } catch {}
  };
  // 정액제 자동결제 등록 — 1단계(빌링키 발급 요청) → PortOne.js `requestIssueBillingKey()`로 결제수단
  // 등록 → 2단계(서버가 빌링키 재검증 후 첫 결제를 그 자리에서 승인, 다음 달부터는 서버 크론이 자동 재청구).
  // 서버가 포트원 미설정(501)이면 기존 "접수 안내" 문구로 자동 폴백한다.
  const startSubscription = async (planKey, planName) => {
    if (subscribeBusy) return;
    setSubscribeBusy(planKey);
    try {
      // 다른 플랜으로 자동결제 중이었다면 먼저 해지 — 안 그러면 두 플랜이 동시에 자동 청구된다.
      if (subStatus?.autoRenew && subStatus.plan !== planKey) {
        await authFetch(`${SERVER_URL}/billing/subscribe/cancel`, { method: 'POST' }).catch(() => {});
      }

      const r = await authFetch(`${SERVER_URL}/billing/subscribe/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ planKey }) });
      const d = await r.json().catch(()=>({}));
      if (r.status === 501) {
        setShowUpgradeModal(false);
        notify(`"${planName}" 플랜 신청이 접수됐습니다. 담당자가 확인 후 연락드립니다.`, 'success');
        return;
      }
      if (!r.ok) { notify(errMsg(d, '결제 요청 실패')); return; }
      const reg = parseOr(SubscribeRegisterResponseSchema, d, null);
      if (!reg) { notify('결제 요청 응답을 처리할 수 없습니다'); return; }

      const { requestIssueBillingKey } = await import('@portone/browser-sdk/v2');
      const response = await requestIssueBillingKey({
        storeId: reg.storeId,
        channelKey: reg.channelKey,
        // 2026-09-01: 카카오페이(EASY_PAY) 채널은 빌링키 발급 자체를 지원하지 않았다(실측:
        // PG_PROVIDER_ERROR "onetime order should have amount!") — 이제 이니시스 정기결제
        // 채널로 바뀌었으므로(백엔드 channelKey도 함께 교체됨) CARD로 발급한다.
        billingKeyMethod: 'CARD',
        issueId: reg.issueId,
        issueName: reg.issueName,
        // 이니시스는 customer.phoneNumber가 필수(REQUIRED) — 없으면 issue-prepare 자체가 400.
        customer: { email: me?.email || undefined, fullName: me?.name || me?.orgName || '고객', phoneNumber: me?.phone || undefined },
      });
      if (response?.code !== undefined) { notify(`자동결제 등록 실패: ${response.message || response.code}`); return; }

      const confirmRes = await authFetch(`${SERVER_URL}/billing/subscribe/confirm`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ issueId: reg.issueId, billingKey: response.billingKey }),
      });
      const confirmData = await confirmRes.json().catch(()=>({}));
      if (!confirmRes.ok) { notify(errMsg(confirmData, '결제 승인 실패')); return; }

      setShowUpgradeModal(false);
      setPaymentSuccess({ amount: confirmData.amount, desc: `"${planName}" 플랜 자동결제가 등록되고 첫 결제가 완료됐습니다. 다음 달부터 자동으로 청구됩니다.` });
      fetchMe();
      fetchSubscriptionStatus();
    } catch {
      notify('네트워크 오류 — 결제 요청 실패');
    } finally {
      setSubscribeBusy(null);
    }
  };
  // 정액제 자동결제 해지 — 다음 달부터 청구되지 않는다(이미 낸 이번 달 요금은 환불되지 않음)
  const cancelSubscription = async () => {
    if (subCancelBusy) return;
    if (!window.confirm('자동결제를 해지할까요? 다음 달부터 청구되지 않습니다.')) return;
    setSubCancelBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/billing/subscribe/cancel`, { method: 'POST' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { notify(errMsg(d, '해지 실패')); return; }
      notify('자동결제가 해지됐습니다.', 'success');
      fetchSubscriptionStatus();
    } catch {
      notify('네트워크 오류 — 해지 실패');
    } finally {
      setSubCancelBusy(false);
    }
  };
  // 기관 주소 변경 (R5: 저장 즉시 관할·기상 데이터 재생성 — 재로그인 불필요)
  const saveOrgAddress = () => {
    const SIDO = {'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','강원도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
    const run = () => new window.daum.Postcode({ oncomplete: async (d) => {
      const sido = SIDO[d.sido] || d.sido;
      const address = d.roadAddress || d.address;
      const region = `${sido} ${d.sigungu}`.trim();
      try {
        const r = await authFetch(`${SERVER_URL}/org/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, region }) });
        const j = await r.json().catch(() => null); // 404 등 HTML 응답이어도 '네트워크 오류'로 뭉개지 않게
        if (j && j.success) { setAdminMsg(`기관 주소가 저장되었습니다 — 관할: ${region} (기상 데이터 자동 연동)`); fetchMe(); fetchWeather(); }
        else if (r.status === 404) notify('서버에 주소 저장 기능이 아직 반영되지 않았습니다 — 서버 배포 후 다시 시도해 주세요');
        else notify(errMsg(j, `주소 저장 실패 (오류 코드 ${r.status})`));
      } catch { notify('네트워크 오류 — 주소 저장 실패'); }
    } }).open();
    if (window.daum && window.daum.Postcode) return run();
    const s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload = run;
    s.onerror = () => notify('주소 검색을 불러오지 못했습니다. 네트워크를 확인해 주세요.');
    document.body.appendChild(s);
  };
  const [alertSettingSaving, setAlertSettingSaving] = useState('');   // 저장 중인 키('autoForestFireCall' 등), 중복 클릭 방지용
  // 경보 자동 안부콜 옵트인 — 기상특보·산불위험 감지 시 어르신 전원(또는 해당 지역)에게 자동 발신할지 켜고 끄기
  const updateAlertSetting = async (key: 'autoForestFireCall' | 'autoWeatherAlertCall' | 'autoDisasterCall', value: boolean) => {
    setAlertSettingSaving(key);
    try {
      const r = await authFetch(`${SERVER_URL}/org/alert-settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) });
      const j = await r.json().catch(() => null);
      if (j && j.success) { setMe((m: any) => ({ ...m, [key]: value })); }
      else notify(errMsg(j, '설정 저장 실패'));
    } catch { notify('네트워크 오류 — 설정 저장 실패'); }
    finally { setAlertSettingSaving(''); }
  };
  const fetchOrgs = async () => {
    try { const r = await authFetch(`${SERVER_URL}/admin/orgs`); const d = await r.json(); setOrgs(Array.isArray(d) ? d : []); } catch { setOrgs([]); }
  };
  // 기관 정지/재개 — 콘솔 최초의 쓰기 액션(정지되면 그 기관 소속 전원 접근 차단)이라 확인창을 거친다
  const toggleOrgSuspend = async (org, nextSuspended) => {
    const verb = nextSuspended ? '정지' : '재개';
    if (!window.confirm(`"${org.name}" 기관을 ${verb}하시겠습니까?${nextSuspended ? ' 정지하면 소속 직원 전원이 즉시 로그인/이용이 막힙니다.' : ''}`)) return;
    setOrgSuspending(org.orgId);
    try {
      const r = await authFetch(`${SERVER_URL}/console/orgs/${org.orgId}/suspend`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ suspended: nextSuspended }) });
      if (r.ok) { notify(`"${org.name}" 기관을 ${verb}했습니다.`, 'success'); fetchOrgs(); }
      else { const d = await r.json().catch(()=>({})); notify(errMsg(d, `${verb} 실패`)); }
    } catch { notify('네트워크 오류 — 기관 상태 변경 실패'); }
    finally { setOrgSuspending(''); }
  };
  // 크레딧 수동 충전(1단계, 포트원 연동 전) — 금액은 window.prompt로 간단히 입력받는다
  const creditOrg = async (org) => {
    const input = window.prompt(`"${org.name}" 기관에 충전할 금액(원)을 입력하세요.`, '1000');
    if (input === null) return;
    const amount = parseInt(input, 10);
    if (!Number.isInteger(amount) || amount <= 0) { notify('1원 이상의 정수를 입력해 주세요'); return; }
    setOrgSuspending(org.orgId); // 처리중 표시는 정지/충전 버튼이 공유(동시에 하나만 가능)
    try {
      const r = await authFetch(`${SERVER_URL}/console/orgs/${org.orgId}/credit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount }) });
      const d = await r.json().catch(()=>({}));
      if (r.ok) { notify(`"${org.name}"에 ${amount.toLocaleString()}원 충전했습니다 (잔액 ${Number(d.creditBalance).toLocaleString()}원).`, 'success'); fetchOrgs(); }
      else notify(errMsg(d, '충전 실패'));
    } catch { notify('네트워크 오류 — 충전 실패'); }
    finally { setOrgSuspending(''); }
  };
  const fetchAccounts = async () => {
    try { const r = await authFetch(`${SERVER_URL}/admin/users`); const d = await r.json(); setAccounts(Array.isArray(d) ? d : []); } catch { setAccounts([]); }
  };
  const createOrg = async () => {
    const name = newOrgName.trim();
    if (!name) { setAdminMsg('기관명을 입력하세요'); return; }
    setAdminMsg('생성 중…');
    try {
      const r = await authFetch(`${SERVER_URL}/admin/orgs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, orgType: newOrgType }) });
      const d = await r.json();
      if (d.success) { setAdminMsg(`"${name}" 생성됨 · 기관코드: ${d.code}`); setNewOrgName(''); fetchOrgs(); }
      else setAdminMsg(errMsg(d, '생성 실패'));
    } catch { setAdminMsg('네트워크 오류'); }
  };
  const createAccount = async () => {
    const { email, password, name, phone, orgId, role } = newAcct;
    if (!name.trim()) { setAdminMsg('복지사 이름을 입력하세요'); return; }
    if (!email || !password || (isSuper && !orgId)) { setAdminMsg(isSuper?'이메일·비밀번호·기관을 모두 입력하세요':'이메일·비밀번호를 입력하세요'); return; }
    setAdminMsg('생성 중…');
    try {
      const r = await authFetch(`${SERVER_URL}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, name, phone, orgId, role }) });
      const d = await r.json();
      if (d.success) { setAdminMsg(`계정 생성됨: ${name} (${email})`); setNewAcct({ email:'', password:'', name:'', phone:'', orgId:'', role:'worker' }); fetchAccounts(); }
      else setAdminMsg(errMsg(d, '생성 실패'));
    } catch { setAdminMsg('네트워크 오류'); }
  };
  // ── 구성원 초대 링크: 생성 → 링크 복사 → 초대받은 사람이 링크로 가입하면 기관·역할 자동 귀속 ──
  const [invites, setInvites] = useState([]);
  const [inviteRole, setInviteRole] = useState('worker');
  const [copiedInvite, setCopiedInvite] = useState('');
  const fetchInvites = async () => {
    try { const r = await authFetch(`${SERVER_URL}/invites`); const d = await r.json(); setInvites(Array.isArray(d) ? d : []); } catch { setInvites([]); }
  };
  const inviteLink = (code) => `${window.location.origin}/#invite=${code}`;
  const createInvite = async () => {
    setAdminMsg('초대 링크 생성 중…');
    try {
      const r = await authFetch(`${SERVER_URL}/invites`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role: inviteRole }) });
      const d = await r.json();
      if (d.success) {
        setAdminMsg('초대 링크가 생성됐어요. 복사해서 전달하세요.');
        fetchInvites();
        try { await navigator.clipboard.writeText(inviteLink(d.code)); setCopiedInvite(d.code); setTimeout(()=>setCopiedInvite(''), 2500); } catch {}
      } else setAdminMsg(errMsg(d, '생성 실패'));
    } catch { setAdminMsg('네트워크 오류'); }
  };
  const copyInvite = async (code) => {
    try { await navigator.clipboard.writeText(inviteLink(code)); setCopiedInvite(code); setTimeout(()=>setCopiedInvite(''), 2500); } catch {}
  };
  const deleteInvite = async (code) => {
    try { await authFetch(`${SERVER_URL}/invites/${code}`, { method:'DELETE' }); fetchInvites(); } catch {}
  };
  const deleteAccount = async (uid, email) => {
    if (!window.confirm(`계정 "${email}"을(를) 삭제할까요?\n(어르신 데이터는 유지됩니다)`)) return;
    try {
      const r = await authFetch(`${SERVER_URL}/admin/users/${uid}`, { method:'DELETE' });
      const d = await r.json();
      if (d.success) { setAdminMsg(`삭제됨: ${email}`); fetchAccounts(); }
      else setAdminMsg(errMsg(d, '삭제 실패'));
    } catch { setAdminMsg('네트워크 오류'); }
  };

  // silent=true면 로딩 표시 없이 조용히 갱신(자동 폴링용)
  const fetchHealth = async (silent = false) => {
    if (!silent) setHealthLoading(true);
    try {
      const [hRes, aRes] = await Promise.all([
        authFetch(`${SERVER_URL}/health/all`),
        authFetch(`${SERVER_URL}/alerts`),
      ]);
      const hData = await hRes.json();
      const aData = await aRes.json();
      // 401/에러 응답은 배열이 아닌 객체 → .filter 크래시 방지 (로그아웃/토큰만료 시 흰화면 차단)
      const hArr = Array.isArray(hData) ? hData : [];
      const aArr = Array.isArray(aData) ? aData : [];
      setHealthData(hArr);
      setAlertsData(aArr);
      setAlertCount(aArr.filter(a => a.status ? a.status === 'new' : !a.read).length);
    } catch (err) {
      console.error('건강 데이터 오류:', err);
    } finally {
      if (!silent) setHealthLoading(false);
    }
  };

  // silent=true면 로딩 표시 없이 조용히 갱신(자동 폴링용) — 총괄 관리자 전용(비-superadmin은 401)
  const fetchConsole = async (silent = false) => {
    if (!silent) setConsoleLoading(true);
    try {
      const [hRes, cRes] = await Promise.all([
        authFetch(`${SERVER_URL}/console/health`),
        authFetch(`${SERVER_URL}/console/calls/active`),
      ]);
      const hData = await hRes.json();
      const cData = await cRes.json();
      if (hData && Array.isArray(hData.components)) setConsoleHealth(hData);
      if (Array.isArray(cData)) setConsoleCalls(cData);
    } catch (err) {
      console.error('콘솔 데이터 오류:', err);
    } finally {
      if (!silent) setConsoleLoading(false);
    }
  };

  // 통화 이력 — 필터(기관/기간) 변경 또는 "조회" 클릭 시 수동 호출(진행 중 통화처럼 자동 폴링하지 않음)
  const fetchConsoleHistory = async () => {
    setConsoleHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (consoleHistoryOrg) params.set('org', consoleHistoryOrg);
      if (consoleHistoryFrom) params.set('from', consoleHistoryFrom);
      if (consoleHistoryTo) params.set('to', consoleHistoryTo);
      const r = await authFetch(`${SERVER_URL}/console/calls/history?${params.toString()}`);
      const d = await r.json();
      setConsoleHistory(Array.isArray(d?.calls) ? d.calls : []);
      setConsoleHistoryPage(1);   // 새로 조회하면 1페이지로
    } catch (err) {
      console.error('콘솔 통화 이력 오류:', err);
    } finally {
      setConsoleHistoryLoading(false);
    }
  };

  // 감사 로그 — 통화 이력과 동일하게 수동 조회(자동 폴링 안 함)
  const fetchConsoleAuditLogs = async () => {
    setConsoleAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (consoleAuditActor) params.set('actor', consoleAuditActor);
      const r = await authFetch(`${SERVER_URL}/console/audit-logs?${params.toString()}`);
      const d = await r.json();
      setConsoleAuditLogs(Array.isArray(d?.logs) ? d.logs : []);
    } catch (err) {
      console.error('콘솔 감사 로그 오류:', err);
    } finally {
      setConsoleAuditLoading(false);
    }
  };

  // 정기결제 현황(전체 기관, 총괄 관리자 전용) — 정액제 자동결제(빌링키) 등록 여부·다음 청구일·최근 오류
  const fetchConsoleSubscriptions = async () => {
    setConsoleSubsLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/subscriptions`);
      const d = await r.json();
      setConsoleSubs(Array.isArray(d?.orgs) ? d.orgs : []);
    } catch (err) {
      console.error('콘솔 정기결제 현황 오류:', err);
    } finally {
      setConsoleSubsLoading(false);
    }
  };
  // 마운트 시 + 어르신/대시보드 진입 시 서버에서 어르신 목록 로드
  // 로그인 완료(authUser) 시 토큰이 생기므로 재로드 — 안 그러면 로그인 전 무토큰 호출로 빈 화면
  // authUser 확정 후 재조회 — 특히 fetchWeather: 마운트 시 첫 호출은 토큰 복원 전(비인증)이라
  // 서버가 기본(대구) 지역을 반환함 → 로그인 확정 시점에 토큰 포함으로 다시 불러 기관 관할 지역 반영
  // 계정 전환(로그아웃→다른 계정 로그인) 시 새 조회가 끝나기 전까지 이전 계정의 크레딧 잔액이
  // 화면에 그대로 남아있던 버그(2026-08-31 실사용 지적) — 잔액은 곧바로 null로 비워 재조회가
  // 끝날 때까지는 아무것도 안 보이게 한다(다른 기관 금액을 잘못 보여주는 것보다 안전).
  useEffect(() => { setBilling(null); setSubStatus(null); fetchElders(); fetchCaregivers(); fetchCalls(); fetchMe(); if (authUser) { fetchWeather(); fetchForestFire(); fetchSpecialWarning(); fetchBillingBalance(); fetchOrgNotices(); } }, [authUser]); // eslint-disable-line
  useEffect(() => { if (page === 'admin' && isStaffUp) { if (isSuper) fetchOrgs(); fetchAccounts(); fetchInvites(); setAdminMsg(''); } }, [page, isStaffUp, isSuper]); // eslint-disable-line
  // 어르신 등록/수정 폼: 담당 지원사 배정 드롭다운용 계정 목록
  useEffect(() => { if (page === 'register' && isStaffUp && accounts.length === 0) fetchAccounts(); }, [page, isStaffUp]); // eslint-disable-line
  useEffect(() => { if (page === 'help' && hasNewNotice) { try { localStorage.setItem('youngsili_help_seen', String(LATEST_NOTICE)); } catch {} setHelpSeen(LATEST_NOTICE); } }, [page]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'elders' && page !== 'dashboard' && page !== 'calls' && page !== 'safety') return;
    fetchElders();
    // 어르신 관리에 있는 동안 15초 자동 갱신 → 다른 담당자의 등록/삭제·앱 등록 승인도 반영
    // (pollRecent/pollAlerts는 기존 목록의 통화·상태만 patch — 목록 추가/삭제는 여기서)
    if (page !== 'elders') return;
    const t = setInterval(whileVisible(() => fetchElders()), 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'health') return;
    fetchHealth();
    const t = setInterval(whileVisible(() => fetchHealth(true)), 15000);   // 건강 리포트도 15초 자동 갱신(알림과 동일)
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'console') return;
    fetchConsole();
    fetchConsoleHistory();
    if (orgs.length === 0) fetchOrgs();   // 통화 이력 기관 필터 드롭다운용(기관 관리 화면과 공유)
    const t = setInterval(whileVisible(() => fetchConsole(true)), 15000);   // 운영 모니터링도 15초 자동 갱신
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line
  useEffect(() => { if (page === 'consoleSubscriptions') fetchConsoleSubscriptions(); }, [page]); // eslint-disable-line
  // authUser 의존 추가: 새로고침으로 #report 직행 시 로그인 복원 전 무토큰 401로 통계가 0건 고정되던 버그
  // (elders 등은 로그인 시 재로드되는데 stats만 빠져 있었음 — 로그인 복원되면 자동 재조회)
  useEffect(() => { if (page === 'report') fetchStats(); }, [page, statsRange, statsFrom, statsTo, authUser]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'calls' && page !== 'elders' && page !== 'dashboard' && page !== 'safety' && page !== 'health') return;   // safety=안전확인 관리(주기 준수율) · health=행 확장 상세의 최근 7일 이력(P2-9)
    fetchCalls();
    // 통화기록 탭·홈에 있는 동안 15초 자동 갱신 → 방금 끝난 통화가 새로고침 없이 표시
    // (홈 '오늘 통화 현황'의 긴급/주의/정상 KPI도 callsHistory 기반이라 홈도 포함 — 발신 KPI만 갱신되던 반쪽 불일치 해소)
    // (5초는 /calls가 매번 30일치 문서를 읽어 Firestore 비용 과다 → 다른 실시간 요소와 동일한 15초로 통일)
    if (page !== 'calls' && page !== 'dashboard' && page !== 'safety') return;
    const t = setInterval(whileVisible(() => fetchCalls(true)), 15000);
    return () => clearInterval(t);
  }, [page, callsRange, callsFrom, callsTo]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'health') return;
    fetchHealthHistory();
    const t = setInterval(whileVisible(() => fetchHealthHistory(true)), 15000);   // 건강 이력도 15초 자동 갱신
    return () => clearInterval(t);
  }, [page, healthRange, healthHistFrom, healthHistTo]); // eslint-disable-line
  // 통화 시각 ISO → "오늘 14:23" / "어제 09:10" / "6/14 15:30"
  const formatCallTime = (iso) => {
    if (!iso) return '통화 없음';
    const d = new Date(iso), now = new Date();
    const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const days = Math.round(((new Date(now.toDateString()) as any) - (new Date(d.toDateString()) as any)) / 86400000);
    if (days === 0) return `오늘 ${hm}`;
    if (days === 1) return `어제 ${hm}`;
    return `${days}일 전 · ${d.getMonth() + 1}/${d.getDate()}`;
  };
  // 마지막 통화 후 경과일 (무응답 강조용: 0=오늘 … null=기록없음)
  const daysSinceCall = (iso) => {
    if (!iso) return null;
    return Math.round(((new Date(new Date().toDateString()) as any) - (new Date(new Date(iso).toDateString()) as any)) / 86400000);
  };
  // 통화 시각 포맷 (오전/오후 H:MM)
  const fmtCallTime = (iso) => {
    const d = new Date(iso), hh = d.getHours(), mm = String(d.getMinutes()).padStart(2,'0');
    return `${hh < 12 ? '오전' : '오후'} ${(hh % 12) || 12}:${mm}`;
  };
  // 어르신 관리 "마지막 통화" 표시 — lastCallAt(실제 타임스탬프) 기준으로 오늘/어제/날짜 정확히 계산
  // (lastCall 문자열은 갱신 안 되는 옛 더미가 박힐 수 있어 타임스탬프를 우선 사용)
  const renderLastCall = (e) => {
    const ds = daysSinceCall(e.lastCallAt);
    let label;
    if (e.lastCallAt && ds != null) {
      const d = new Date(e.lastCallAt);
      label = ds === 0 ? `오늘 ${fmtCallTime(e.lastCallAt)}`
            : ds === 1 ? `어제 ${fmtCallTime(e.lastCallAt)}`
            : `${d.getMonth()+1}월 ${d.getDate()}일 ${fmtCallTime(e.lastCallAt)}`;
    } else {
      label = e.lastCall || '통화 없음';
    }
    const danger = ds != null && ds >= 3;
    return <span style={{color: danger ? '#dc2626' : '#64748b', fontWeight: danger ? 800 : 600}}>{label}{danger ? ` · ${ds}일째 무응답` : ''}</span>;
  };
  // 통화기록 날짜 그룹 헤더: 'YYYY-MM-DD' → '6/23(월) · 오늘'
  const formatDateHeader = (dateStr) => {
    if (!dateStr) return '미상';
    const d = new Date(dateStr + 'T00:00:00'), now = new Date();
    const days = Math.round(((new Date(now.toDateString()) as any) - (d as any)) / 86400000);
    const wd = ['일','월','화','수','목','금','토'][d.getDay()];
    const md = `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
    if (days === 0) return `${md} · 오늘`;
    if (days === 1) return `${md} · 어제`;
    return md;
  };
  // silent=true면 로딩 표시 없이 조용히 갱신(자동 폴링용 — 목록 깜빡임 방지). 실패 시 기존 목록 유지.
  const fetchCalls = async (silent = false) => {
    callsRequestRef.current?.abort();
    const controller = new AbortController();
    callsRequestRef.current = controller;
    if (!silent) setCallsLoading(true);
    try {
      const now = new Date();
      let from = new Date(now.getTime() - 30 * 86400000), to = now;
      if (callsRange === 'week') from = new Date(now.getTime() - 7 * 86400000);
      else if (callsRange === 'custom') { if (callsFrom) from = new Date(callsFrom); if (callsTo) to = new Date(callsTo + 'T23:59:59'); }
      const r = await authFetch(`${SERVER_URL}/calls?from=${from.toISOString()}&to=${to.toISOString()}`, { signal: controller.signal });
      const j = await r.json();
      if (!controller.signal.aborted) setCallsHistory(parseOr(CallListSchema, j && j.calls, []));
    } catch { if (!silent && !controller.signal.aborted) setCallsHistory([]); }
    finally {
      if (callsRequestRef.current === controller) {
        callsRequestRef.current = null;
        if (!silent) setCallsLoading(false);
      }
    }
  };
  const fetchHealthHistory = async (silent = false) => {
    try {
      const now = new Date();
      let from = new Date(now.getTime() - 30 * 86400000), to = now;
      if (healthRange === 'week') from = new Date(now.getTime() - 7 * 86400000);
      else if (healthRange === 'custom') { if (healthHistFrom) from = new Date(healthHistFrom); if (healthHistTo) to = new Date(healthHistTo + 'T23:59:59'); }
      const r = await authFetch(`${SERVER_URL}/health/history?from=${from.toISOString()}&to=${to.toISOString()}`);
      const j = await r.json();
      setHealthHistory(j.events || []);
    } catch { if (!silent) setHealthHistory([]); }   // 폴링 순간 실패로 목록이 비워지지 않게
  };

  // 실시간 폴링 — 위험 알림(사이드바 🔴 배지)은 항상, 마지막통화는 필요한 페이지에서만.
  // 15초 주기(서버 부하·비용 절감) + 페이지 진입 시 즉시 1회 갱신.
  useEffect(() => {
    const pollAlerts = () => authFetch(`${SERVER_URL}/alerts`).then(r=>r.json()).then(raw => {
      const data = parseOr(AlertListSchema, raw, []);   // zod 검증 — 401/계약 위반 응답이면 [] (크래시 차단)
      setLastSync(new Date());
      setAlertsData(data);
      const unread = data.filter(a=>a.status ? a.status === 'new' : !a.read);   // 폐루프: 미확인(new)만 배지
      setAlertCount(unread.length);
      // 어르신별 "가장 최근" 위험 알림만 반영 (data는 최신순 → 이름별 첫 항목이 최신)
      const latestByName = {};
      unread.forEach(a => {
        if ((a.level === 'critical' || a.level === 'urgent') && !latestByName[a.name]) latestByName[a.name] = a;
      });
      setElders(prev => prev.map(e => {
        const a = latestByName[e.name];
        if (!a) return e;
        // 영문 코드값(missed/help/safe)은 짧은 한글 라벨로 (어르신 카드 키워드 태그용)
        const EN_TAG = { missed: '전화 미응답', help: '구조 요청', safe: '안전 확인', sos: '긴급 호출' };
        const kw = EN_TAG[a.keyword] || EN_TAG[a.category] || (a.keyword || (a.message ? a.message.split('감지:').pop().trim() : '') || a.message);
        return { ...e, status: a.level === 'critical' ? 'danger' : 'warning', keyword: kw, keywordAt: a.timestamp };
      }));
    }).catch(()=>{});
    // 최근 통화 → 마지막 통화 시각/상태 갱신 (마지막통화를 보여주는 페이지에서만)
    const pollRecent = () => {
      if (!['dashboard','elders','schedule'].includes(page)) return;
      authFetch(`${SERVER_URL}/calls/recent`).then(r=>r.json()).then(calls => {
        setElders(prev => prev.map(e => {
          const c = calls[e.name];
          if (!c) return e;
          return { ...e, lastCall: formatCallTime(c.timestamp), lastCallAt: c.timestamp, lastCallRisk: c.riskLevel, lastTranscript: c.transcript };
        }));
      }).catch(()=>{});
    };
    pollAlerts(); pollRecent();   // 진입 즉시 1회
    const t = setInterval(whileVisible(() => { pollAlerts(); pollRecent(); }), 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line

  const [popData, setPopData]       = useState(null);
  const [popLoading, setPopLoading] = useState(false);
  const [popError, setPopError]     = useState(null);

  const fetchPopulation = async (retry = 0) => {
    setPopLoading(true); setPopError(null);
    try {
      const res = await authFetch(`${SERVER_URL}/population`);
      const data = await res.json();
      setPopData(data);
      // 타 시도 첫 조회는 서버가 백그라운드 수집 → 잠시 후 자동 재조회 (최대 6회)
      if (data && data.collecting && retry < 6) setTimeout(() => fetchPopulation(retry + 1), 12000);
    } catch { setPopError('데이터를 불러오지 못했습니다.'); }
    finally { setPopLoading(false); }
  };

  useEffect(() => { if (page === 'data' && !popData) fetchPopulation(); }, [page]); // eslint-disable-line
  // 어르신 목록은 서버(Firestore)가 원본 — localStorage 저장 제거 (PC마다 다르게 노는 문제 방지)
  useEffect(() => { try { localStorage.setItem('youngsili_memos', JSON.stringify(memos)); } catch {} }, [memos]);
  useEffect(() => { localStorage.removeItem('youngsili_callLogs'); }, []);  // 옛 더미 통화로그 1회 정리
  const [mainScript]                    = useState(DEFAULT_SCRIPT);
  const [activeAlert, setActiveAlert]   = useState('none');
  const [alertScript, setAlertScript]   = useState(ALERT_TEMPLATES.none);
  const [wildfireStage, setWildfireStage] = useState('prepare');   // 산불 3단계 선택
  const [shelterName, setShelterName]     = useState('');          // {{대피소}} 담당자 입력
  const [fireLoc, setFireLoc]             = useState('');          // 산불 발생 위치({{지역}} 치환 + 위치질문 답변)
  const [alertResponses, setAlertResponses] = useState([]);        // 경보 응답 현황(safe/help/missed)
  const [, setAlertRespLoading] = useState(false);                 // 로딩 플래그는 요청 중복·완료 흐름 유지용
  const [draftingCallId, setDraftingCallId] = useState(null);      // 통화→일지 초안 생성 중인 통화 id
  const [reportMonth, setReportMonth] = useState(new Date().toLocaleDateString('sv-SE').slice(0, 7));  // 월간 보고서 대상 월
  const [monthlyBusy, setMonthlyBusy] = useState(false);
  const [savedAlertTpl, setSavedAlertTpl]  = useState({});         // 서버 저장된 경보 멘트(기관 공유) — 키별
  // 안부 질문(전역) — 서버 미저장 시 기본값. 통화 엔진(브릿지)의 기본 질문과 문구가 같아야 한다.
  const [questions, setQuestions]          = useState(() => DEFAULT_QUESTIONS.map(q => ({ ...q })));
  const [questionsSaving, setQuestionsSaving] = useState(false);
  const [questionsMsg, setQuestionsMsg]    = useState('');
  // 070 발신번호(전역) — KCT에 등록된 번호만 실발신됨. 빈 값이면 서버 환경변수 폴백.
  const [pstnCallerId, setPstnCallerId]    = useState('');
  const [pstnSaving, setPstnSaving]        = useState(false);
  const [pstnMsg, setPstnMsg]              = useState('');
  const [alertTplSaving, setAlertTplSaving] = useState(false);
  const [alertTplSaved, setAlertTplSaved]  = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherTime, setWeatherTime] = useState('');
  const [weatherStale, setWeatherStale] = useState(false); // 기상 연동 지연 — 마지막 성공 수신 데이터를 유지한 채 표시
  const [weatherData, setWeatherData]   = useState({});  // 서버 /weather 실데이터로 로드 (가짜 날씨 폐지)
  const [forestFireData, setForestFireData] = useState<Record<string, any>>({}); // 서버 /forest-fire — 날씨 카드와 동일 지역 key
  const [specialWarningData, setSpecialWarningData] = useState<Record<string, any>>({}); // 서버 /special-warning — 기상청 공식 특보(단기예보 추정과 별개)
  const [disasterMsgs, setDisasterMsgs] = useState<any[]>([]);           // 서버 /disaster-msg — 기관 관할지역 오늘자 긴급재난문자
  const [disasterMsgConfigured, setDisasterMsgConfigured] = useState(true); // false면 행안부 키 미발급 — 배너 자체를 숨긴다
  const [formErrors, setFormErrors] = useState<any>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [calling, setCalling]   = useState(null);
  const [callResult, setCallResult] = useState(null);
  const [callModal, setCallModal]   = useState(null);
  const [checked, setChecked]       = useState([]);
  const [smartFilter, setSmartFilter] = useState('all');
  const [bulkQueue, setBulkQueue]   = useState([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone]     = useState([]);
  const [bulkCurrent, setBulkCurrent] = useState(null);
  const [bulkChannel, setBulkChannel] = useState<'app'|'pstn'>('app');   // 진행 중인 일괄 발신이 앱 알림인지 일반전화(070)인지
  const [dispatchHist, setDispatchHist] = useState([]);   // 발신 이력(날짜별) — 서버 dispatches
  const [histLoading, setHistLoading] = useState(false);
  const [histDays, setHistDays]     = useState(7);
  const [histStatus, setHistStatus] = useState('all');   // 발신 이력 상태 필터 all|received|missed (KPI 드릴다운)
  const [expandedHistDays, setExpandedHistDays] = useState(new Set());  // 발신 이력 — 하루 안에서 4건째부터 더 보기
  const [histDayOv, setHistDayOv] = useState({});         // P2-8: 날짜별 아코디언 펼침 override (기본: 오늘만 펼침)
  const [histAllOpen, setHistAllOpen] = useState(false);  // P2-8: 전체 접기/펼치기 버튼 상태
  const [callsDayOv, setCallsDayOv] = useState({});       // P2-9: 통화 기록 날짜별 아코디언 (기본: 오늘만 펼침)
  const [callsAllOpen, setCallsAllOpen] = useState(false);
  const [expandedCallDays, setExpandedCallDays] = useState(new Set());  // 통화 기록 — 하루 안에서 4건째부터 더 보기
  const [healthFilter, setHealthFilter] = useState('all');  // P2-9 건강 상태: 상태 필터 all|danger|warning|normal
  const [healthRowOv, setHealthRowOv] = useState({});       // P2-9 건강 상태: 행별 펼침 override (기본: 위험만 펼침)
  const [healthAllOpen, setHealthAllOpen] = useState(false);
  const [healthNormalShown, setHealthNormalShown] = useState(10);  // 정상 어르신 10명 단위 지연 로드
  const [elderSecOv, setElderSecOv] = useState({});         // P2-9 어르신 관리: 상태별 섹션 펼침 (기본: 위험·주의만)
  const [normalCardView, setNormalCardView] = useState(false);  // 정상 그룹 카드/컴팩트 리스트 전환
  const [popDoneOpen, setPopDoneOpen] = useState({});       // P2-9 공공데이터: 확인 완료 어르신 더보기
  const [batchSize, setBatchSize]   = useState(5);    // 배치당 발신 인원 (AI서버 동시통화 부하 분산)
  const [batchIntervalSec, setBatchIntervalSec] = useState(90);  // 배치 간 대기(초)
  const [batchWait, setBatchWait]   = useState(0);    // 다음 배치까지 남은 초(카운트다운 표시)
  const bulkRef = useRef(false);
  // 이번 일괄 발신이 경보 발신이었는지 — 부재중 재발신 때 같은 종류로 다시 걸기 위해 기억한다
  const bulkWithAlertRef = useRef(false);
  // 상담·방문 일지(caseNotes)
  const [caseNotes, setCaseNotes]   = useState([]);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseType, setCaseType]     = useState('all');       // 유형 필터
  const [caseSearch, setCaseSearch] = useState('');          // 어르신 이름 검색
  const [caseFollowUpOnly, setCaseFollowUpOnly] = useState(false);
  const [expandedNoteDays, setExpandedNoteDays] = useState(new Set());
  const [selectedNotes, setSelectedNotes] = useState(new Set());  // 일괄 선택
  const [selectedElders, setSelectedElders] = useState(new Set());  // 어르신 일괄 선택
  const [csvImport, setCsvImport]   = useState(null);   // CSV 일괄 등록 미리보기 { rows }
  const [csvOverwrite, setCsvOverwrite] = useState(false);
  const [csvSaving, setCsvSaving]   = useState(false);
  const csvInputRef = useRef(null);
  const [noteModal, setNoteModal]   = useState(null);        // null | { note?, prefill? }
  const [noteForm, setNoteForm]     = useState(null);        // 작성/수정 폼 값
  const [noteSaving, setNoteSaving] = useState(false);

  const danger  = elders.filter(e => e.status==='danger').length;
  const warning = elders.filter(e => e.status==='warning').length;
  const normal  = elders.filter(e => e.status==='normal').length;
  const cycleLabel = (c, days) => c==='daily'?'매일':c==='custom'?((days&&days.length)?`매주 ${days.join('·')}`:'요일 미정'):c==='every2days'?'격일':'주 1회';
  // 통화기록의 전화번호로 현재 명단(elders)의 이름을 찾음 — 이름 변경/재등록돼도 통화기록이 명단과 일치
  const nameByPhone = (phone, fallback) => {
    const p = String(phone || '').replace(/\D/g, '');
    const e = p && elders.find(el => String(el.phone || '').replace(/\D/g, '') === p);
    return e ? e.name : (fallback || phone || '미상');
  };

  const getNoResponseDays = (lastCall, lastCallAt) => {
    const ds = daysSinceCall(lastCallAt);   // 실제 타임스탬프가 있으면 우선 (옛 더미 문자열 무시)
    if (ds != null) return ds;
    if (!lastCall || lastCall === '아직 없음') return 99;
    if (lastCall.includes('오늘')) return 0;
    if (lastCall.includes('어제')) return 1;
    if (lastCall.includes('2일')) return 2;
    if (lastCall.includes('3일')) return 3;
    return 99;
  };

  const getSolitudeRisk = (elder) => {
    let score = 0;
    const days = getNoResponseDays(elder.lastCall, elder.lastCallAt);
    if (days >= 3) score += 40;
    else if (days >= 1) score += 20;
    if (elder.keyword) score += 25;
    if (elder.status === 'danger') score += 20;
    else if (elder.status === 'warning') score += 10;
    if (elder.visits > 0) score += 10;
    if (!elder.callActive) score += 15;
    if (elder.mobility === '거동 불가') score += 10;
    if (elder.age >= 80) score += 5;
    if (score >= 50) return { level: 'high',   label: '고위험', color: '#ef4444', bg: '#fef2f2' };
    if (score >= 25) return { level: 'medium', label: '주의',   color: '#f59e0b', bg: '#fffbeb' };
    return               { level: 'low',    label: '안전',   color: '#22c55e', bg: '#f0fdf4' };
  };

  // R4 지역 라벨 하드코딩 금지 — 등록된 어르신 지역 + 기관 관할 지역에서 동적 생성
  const REGIONS = useMemo(() => ['전체', ...[...new Set([...elders.map(e => (e.region || '').trim()), (me?.orgRegion || '').trim()])].filter(Boolean).sort()], [elders, me?.orgRegion]);
  // 특보 등급 시맨틱: 경보급('매우 더움'·'많은 비'·'…경보')=danger(레드), 그 외 특보=warn(앰버), 없음=none
  const alertSeverity = w => (!w || w.alert === 'none') ? 'none' : (/매우|많은|경보/.test(w.alertText || '') ? 'danger' : 'warn');

  const filteredElders = elders
    .filter(e => e.approved !== false)   // 승인 대기(앱 신청)는 별도 '승인 대기' 섹션에 표시
    .filter(e => filter === 'all' || e.status === filter)
    .filter(e => regionFilter === '전체' || e.region === regionFilter)
    .filter(e => searchName === '' || (e.name||'').includes(searchName))
    .sort((a, b) => {
      if (sortBy === 'status') { const order = { danger: 0, warning: 1, normal: 2 }; return order[a.status] - order[b.status]; }
      if (sortBy === 'risk') { const riskOrder = { high: 0, medium: 1, low: 2 }; return riskOrder[getSolitudeRisk(a).level] - riskOrder[getSolitudeRisk(b).level]; }
      if (sortBy === 'noResponse') return getNoResponseDays(b.lastCall, b.lastCallAt) - getNoResponseDays(a.lastCall, a.lastCallAt);
      if (sortBy === 'age') return b.age - a.age;
      if (sortBy === 'name') return (a.name||'').localeCompare(b.name||'');
      return 0;
    });

  // 방식2: 앱에서 등록 신청된 승인 대기 어르신
  const pendingElders = elders.filter(e => e.approved === false);
  const approveElder = async (phone) => {
    try {
      await authFetch(`${SERVER_URL}/elder/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      fetchElders();
    } catch (e) { console.error('승인 실패:', e); }
  };

  // 어르신별 최종 경보 멘트(모든 변수 치환). 산불도 alertScript에 현재 단계 텍스트가 들어있음.
  // {{대피소}}: 담당자가 입력한 대피소명(한 칸)을 그대로 사용. 비우면 fillAlertVars가 '가까운 대피소'로.
  // 산불이면 {{지역}}=발생 위치(fireLoc, 비우면 어르신 지역).
  const alertMsgFor = (elder) => activeAlert === 'none' ? '' : fillAlertVars(alertScript, elder, shelterName, activeAlert === 'wildfire' ? fireLoc.trim() : '', me?.orgName);
  const alertStageFor = () => activeAlert === 'wildfire' ? wildfireStage : '';

  const fetchWeather = async () => {
    setFetchingWeather(true);
    try {
      const res = await authFetch(`${SERVER_URL}/weather`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
        const _n = new Date();
        const _d = ['일','월','화','수','목','금','토'][_n.getDay()];
        const _h = _n.getHours();
        setWeatherTime(`(${_d}요일) ${_h < 12 ? '오전' : '오후'} ${_h % 12 || 12}:${String(_n.getMinutes()).padStart(2,'0')}`);
        const hasHeatwave = Object.values(data as Record<string, any>).some(w => w.alert === 'heatwave');
        const hasCold     = Object.values(data as Record<string, any>).some(w => w.alert === 'cold');
        const hasRain     = Object.values(data as Record<string, any>).some(w => w.alert === 'rain');
        // 날씨로 경보가 자동 선택될 때도 **서버에 저장된 멘트**를 우선한다.
        // 기본값을 그대로 넣으면 담당자가 수정해 둔 멘트가 화면에서 사라진 것처럼 보인다.
        //
        // 2026-08-21: 경보 종류가 실제로 "바뀔 때"만 편집창을 갈아끼운다. 예전에는 5분마다
        // 도는 날씨 갱신이 같은 경보인데도 매번 setAlertScript를 불러서, 담당자가 고치던
        // 멘트가 저장 전에 날아가거나 저장 후에도 기본값으로 되돌아갔다.
        // (tplText가 savedAlertTplRef를 보는 것도 같은 이유 — 이 인터벌은 deps가 []라
        //  첫 렌더의 빈 savedAlertTpl을 계속 붙잡고 있어서 항상 기본값으로 떨어졌다.)
        // 담당자가 경보를 직접 고르거나 멘트를 고치기 시작했으면 자동선택은 물러난다.
        // 안 그러면 편집 중에 5분 타이머가 다른 경보로 화면을 바꿔 버린다.
        const pick = (k) => {
          if (alertUserTouchedRef.current) return;
          setActiveAlert(k);
          if (appliedAlertKeyRef.current === k) return;
          appliedAlertKeyRef.current = k;
          setAlertScript(tplText(k, ALERT_TEMPLATES[k]));
        };
        if (hasHeatwave)     pick('heatwave');
        else if (hasCold)    pick('cold');
        else if (hasRain)    pick('rain');
        else                 pick('none');
        // 서버가 기상청 장애 시 stale:true(직전 성공 데이터 유지)로 내려줌 → '연동 지연' 표시
        setWeatherStale(Object.values(data as Record<string, any>).some(w => w && w.stale));
      } else { setWeatherStale(true); }
    } catch (err) {
      console.error('날씨 API 오류:', err);
      setWeatherStale(true);
    } finally { setFetchingWeather(false); }
  };

  // R3: 기상 데이터 5분 주기 자동 갱신 (서버도 지역별 5분 캐시 — 기상청 호출량 안전)
  useEffect(() => {
    fetchWeather();
    const t = setInterval(whileVisible(() => fetchWeather()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  // 산불위험지수 — 날씨 카드와 같은 지역 key로 내려오므로 같은 카드 안에 이어 붙인다.
  // 서버가 30분 캐시라 여기도 5분마다 다시 부를 필요는 없지만, fetchWeather와 같은 타이밍에 맞춰 갱신한다.
  const fetchForestFire = async () => {
    try {
      const res = await authFetch(`${SERVER_URL}/forest-fire`);
      if (res.ok) {
        const data = parseOr(ForestFireMapSchema, await res.json(), null);
        if (data) setForestFireData(data);
      }
    } catch (err) {
      console.error('산불위험지수 API 오류:', err);
    }
  };
  useEffect(() => {
    fetchForestFire();
    const t = setInterval(whileVisible(() => fetchForestFire()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  // 기상청 공식 특보 — 단기예보 기온 추정(weatherData.alertText)과 별개 소스. 발효 중일 때만 카드에 표시.
  const fetchSpecialWarning = async () => {
    try {
      const res = await authFetch(`${SERVER_URL}/special-warning`);
      if (res.ok) {
        const data = parseOr(SpecialWarningMapSchema, await res.json(), null);
        if (data) setSpecialWarningData(data);
      }
    } catch (err) {
      console.error('기상특보 API 오류:', err);
    }
  };
  useEffect(() => {
    fetchSpecialWarning();
    const t = setInterval(whileVisible(() => fetchSpecialWarning()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  // 긴급재난문자 — 기관 관할지역 오늘자 목록. configured:false면 행안부 키 미발급(선구현 상태)이라 배너를 숨긴다.
  const fetchDisasterMsg = async () => {
    try {
      const res = await authFetch(`${SERVER_URL}/disaster-msg`);
      if (res.ok) {
        const data = parseOr(DisasterMsgResponseSchema, await res.json(), null);
        if (data) {
          setDisasterMsgConfigured(data.configured !== false);
          setDisasterMsgs(Array.isArray(data.messages) ? data.messages : []);
        }
      }
    } catch (err) {
      console.error('재난문자 API 오류:', err);
    }
  };
  useEffect(() => {
    fetchDisasterMsg();
    const t = setInterval(whileVisible(() => fetchDisasterMsg()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  const goPage  = p => { setPage(p); setSelected(null); setCallResult(null); };
  // 헤더 새로고침 — 현재 페이지에 필요한 데이터만 다시 불러오기
  const refreshPage = () => {
    setLastSync(new Date());
    fetchElders();
    if (page === 'health') { fetchHealth(); fetchHealthHistory(); }
    if (page === 'report') fetchStats();
    if (page === 'calls' || page === 'dashboard' || page === 'elders' || page === 'detail' || page === 'health') fetchCalls();  // health: 행 확장 상세의 최근 7일 이력용
    if (page === 'data') { fetchPopulation(); fetchWeather(); fetchDisasterMsg(); }
    if (page === 'script') fetchWeather();
    if (page === 'casenotes') loadCaseNotes();
  };
  // 실시간 위험 알림: 등록된 어르신 것만 표시 (테스트/더미 이름 제외)
  const _normPhone = s => String(s||'').replace(/[^0-9]/g,'');
  const alertIsReal = a => elders.some(e => e.name === a.name || (_normPhone(a.phone) && _normPhone(e.phone) === _normPhone(a.phone)));
  // 서버 내부 코드값(영문)은 화면에 그대로 노출하지 않고 사람이 읽는 한글로 변환.
  // 원칙: 대시보드에 영문 원문값 노출 금지 — 새 코드값이 생기면 EN_ALERT_KO에 추가.
  const EN_ALERT_KO = { missed: '전화 미응답', help: '도와줘 (구조 요청)', safe: '괜찮아 (안전 확인)', sos: '긴급 호출(SOS)' };
  const alertIsMissed = a => a.category === 'missed' || a.keyword === 'missed';
  const alertEnCode = a => EN_ALERT_KO[a.keyword] ? a.keyword : (EN_ALERT_KO[a.category] ? a.category : null);
  const alertKw = a => {
    const code = alertEnCode(a);
    if (code) {
      // 서버 message가 "이름 — (한글 설명)" 형식 → 이름 뒤 본문을 그대로 쓰면 가장 정확
      const body = ((a.message || '').split('— ')[1] || '').replace(/\s*·.*$/, '').trim();
      return body || EN_ALERT_KO[code];
    }
    return a.keyword || (a.message ? a.message.split(/감지[::]?/).pop().trim() : '') || a.message || '';
  };
  // 브라우저 뒤로가기 → 대시보드 홈 (SPA 히스토리 연동: 하위 탭에서 뒤로가기 시 새 탭/이탈 대신 홈으로)
  // URL 해시에 페이지 기록 → 새로고침(F5) 시 현재 페이지 유지, 뒤로가기 시 이전 페이지로
  useEffect(() => {
    try { localStorage.setItem('youngsili_current_page', page); } catch {}
    if (/invite=/.test(window.location.hash)) return;   // 초대 해시는 AuthScreen이 읽기 전까지 보존
    if (((window.location.hash || '').replace('#','') || 'dashboard') !== page) window.history.pushState({ page }, '', '#' + page);
  }, [page]);
  useEffect(() => {
    const onPop = () => { const h = (window.location.hash || '').replace('#','').split('/')[0]; setPage(RESTORABLE_PAGES.includes(h) ? h : 'dashboard'); setSelected(null); setCallResult(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openDetail = elder => { try { localStorage.setItem('youngsili_selected_elder_id', String(elder.id)); } catch {} setSelected(elder); setCallResult(null); setPage('detail'); };
  const openRegister = () => { setForm({...EMPTY_FORM}); setFormStep(1); setFormErrors({}); setSaveSuccess(false); setEditMode(false); setPage('register'); };
  const openEdit = elder => { setForm({...elder}); setFormStep(1); setFormErrors({}); setSaveSuccess(false); setEditMode(true); setPage('register'); };
  // 안전확인 관리에서 이름 클릭 → 곧장 돌봄군·주기 설정(정보수정 3단계)으로 (탭 왕복 불편 해소)
  const openEditSchedule = elder => { setForm({...elder}); setFormStep(3); setFormErrors({}); setSaveSuccess(false); setEditMode(true); setPage('register'); };

  const smartElders = useMemo(() => {
    if (smartFilter==='danger')  return elders.filter(e=>e.status==='danger'||e.status==='warning');
    if (smartFilter==='noCall')  return elders.filter(e=>e.lastCall==='아직 없음'||(e.lastCall||'').includes('어제')||(e.lastCall||'').includes('2일'));
    if (smartFilter==='active')  return elders.filter(e=>e.callActive);
    return elders;
  }, [elders, smartFilter]);

  const toggleCheck = id => setChecked(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const checkAll    = () => setChecked(smartElders.map(e=>e.id));
  const uncheckAll  = () => setChecked([]);
  const applySmartFilter = f => { setSmartFilter(f); setChecked([]); };

  // 2026-08-25: 경보 문구를 고르거나 고치는 즉시(발신 버튼 누르기 훨씬 전에) TTS를 미리
  // 만들어 캐시해둔다 — Gemini TTS가 문구 길이에 따라 18~20초 걸려서, 실제 발신 시점에야
  // 만들면 어르신이 전화 받고도 한참 무음을 듣게 된다(실사용 발견). 여기서 미리 만들어두면
  // 담당자가 확인하고 발신 버튼을 누르기까지의 시간(보통 수십 초~수 분)을 벌 수 있다.
  // 입력마다 쏘면 낭비이므로 800ms 동안 추가 수정이 없을 때만 요청한다(디바운스).
  const alertPrewarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (alertPrewarmTimerRef.current) clearTimeout(alertPrewarmTimerRef.current);
    if (activeAlert === 'none' || !alertScript.trim()) return;
    alertPrewarmTimerRef.current = setTimeout(() => {
      const targets = (checked.length ? elders.filter(e => checked.includes(e.id)) : smartElders.slice(0, 1));
      const texts = Array.from(new Set(targets.map(alertMsgFor).filter(Boolean)));
      texts.forEach(text => {
        authFetch(`${SERVER_URL}/call/alert-tts-prewarm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
        }).catch(() => {});
      });
    }, 800);
    return () => { if (alertPrewarmTimerRef.current) clearTimeout(alertPrewarmTimerRef.current); };
  }, [activeAlert, alertScript, shelterName, fireLoc, checked]);

  // ── 일괄 발신 (FCM 앱 푸시) ──
  /**
   * 발신 요청 바디.
   *
   * withAlert=false면 경보 필드를 아예 안 싣는다. activeAlert는 "전화 멘트 관리 화면에서
   * 지금 편집 중인 경보"일 뿐인데, 날씨에 따라 자동으로 rain/heatwave 등이 잡힌다.
   * 예전에는 그 값을 모든 발신에 그대로 실어서, 어르신 상세에서 그냥 전화를 걸어도
   * 호우 경보 안내가 나가버렸다(2026-08-21 지적). 경보는 경보 발신 버튼으로만 나간다.
   */
  const bulkCallBody = (elder: any, channel: 'app'|'pstn', withAlert: boolean) => JSON.stringify({
    channel, confirmPstn: channel === 'pstn',
    phone:        elder.phone,
    elderName:    elder.name,
    elderTitle:   elder.title || '어르신',
    region:       elder.region,
    script:       mainScript,
    ...(withAlert && activeAlert !== 'none' ? {
      alertMessage: alertMsgFor(elder),
      alertType: activeAlert,
      alertStage: alertStageFor(),
      // 경보 안내 뒤 안부 질문까지 이어갈지 (발신 확인 창에서 선택)
      includeCare: alertIncludeCare,
      shelter: activeAlert === 'wildfire' ? shelterName.trim() : '',   // 앱 긴급 안내 대피소 일치용
      fireLoc: activeAlert === 'wildfire' ? fireLoc.trim() : '',       // 산불 발생 위치(위치질문 답변 일치용)
    } : {}),
  });

  const dialElder = async (elder: any, channel: 'app'|'pstn', withAlert: boolean) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    try {
      const res = await authFetch(`${SERVER_URL}/call/app`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: bulkCallBody(elder, channel, withAlert),
      });
      const data = await res.json();
      setBulkDone(prev => [...prev, { id: elder.id, callId: data.callId, success: data.success, status: data.success ? 'ringing' : 'failed' }]);
      if (data.success) {
        setElders(prev => prev.map(e => e.id===elder.id ? {...e, lastCall:`오늘 ${timeStr}`} : e));
      }
    } catch {
      setBulkDone(prev => [...prev, { id: elder.id, success: false, status: 'failed' }]);
    }
  };

  const startBulkCall = async (customQueue?: any, channel: 'app'|'pstn' = 'app', withAlert = false) => {
    const queue = Array.isArray(customQueue) ? customQueue : elders.filter(e => checked.includes(e.id));
    if (queue.length === 0) return;
    setBulkQueue(queue); setBulkDone([]); setBulkRunning(true); setBulkChannel(channel); bulkRef.current = true;
    bulkWithAlertRef.current = withAlert;   // 부재중 재발신(resendMissed)이 같은 종류로 나가도록 기억

    if (channel === 'pstn') {
      // 일반전화(070)는 콜엔진이 동시 발신을 감당하므로 배치 안에서는 전부 한꺼번에 건다
      // (앱 알림처럼 AI서버 부하 때문에 한 명씩 늦출 필요가 없다) — 배치 간격만 유지.
      for (let i = 0; i < queue.length; i += batchSize) {
        if (!bulkRef.current) break;
        const batch = queue.slice(i, i + batchSize);
        setBulkCurrent(batch[batch.length - 1]?.id ?? null);
        await Promise.allSettled(batch.map(elder => dialElder(elder, 'pstn', withAlert)));
        const isLastBatch = i + batchSize >= queue.length;
        if (!isLastBatch && bulkRef.current) {
          for (let s = batchIntervalSec; s > 0 && bulkRef.current; s--) { setBatchWait(s); await new Promise(r => setTimeout(r, 1000)); }
          setBatchWait(0);
        }
      }
    } else {
      for (let i = 0; i < queue.length; i++) {
        const elder = queue[i];
        if (!bulkRef.current) break;
        setBulkCurrent(elder.id);
        await dialElder(elder, 'app', withAlert);
        // 배치 분산: batchSize명마다 batchIntervalSec초 대기(AI서버 동시통화 부하 완화). 배치 내는 1.5초 간격
        const isLast = i === queue.length - 1;
        if (!isLast) {
          if ((i + 1) % batchSize === 0) {
            for (let s = batchIntervalSec; s > 0 && bulkRef.current; s--) { setBatchWait(s); await new Promise(r => setTimeout(r, 1000)); }
            setBatchWait(0);
          } else {
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }
    }
    setBulkCurrent(null); setBulkRunning(false); bulkRef.current = false; setBatchWait(0);
  };

  const stopBulkCall = () => { bulkRef.current = false; setBulkRunning(false); setBulkCurrent(null); setBatchWait(0); };

  // 발신 후 받음/부재중 상태 폴링(5초) — 수신대기/통화중이 남은 동안만 동작, 모두 확정되면 자동 중지
  useEffect(() => {
    const ids = bulkDone.filter(d => d.callId && (d.status === 'ringing' || d.status === 'answered')).map(d => d.callId);
    if (ids.length === 0) return;
    const t = setInterval(async () => {
      try {
        const r = await authFetch(`${SERVER_URL}/call/dispatch-statuses?ids=${ids.join(',')}`);
        const m = await r.json();
        setBulkDone(prev => prev.map(d => (d.callId && m[d.callId]) ? { ...d, status: m[d.callId].status, durationSec: m[d.callId].durationSec } : d));
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [bulkDone]); // eslint-disable-line

  // 부재중인 어르신만 다시 발신
  const resendMissed = () => {
    const ids = bulkDone.filter(d => d.status === 'missed').map(d => d.id);
    const queue = elders.filter(e => ids.includes(e.id));
    if (queue.length > 0) startBulkCall(queue, bulkChannel, bulkWithAlertRef.current);
  };

  // 발신 이력: 발신 페이지에서 서버 dispatches를 최근 N일치 불러와 날짜별로 표시(복지사/관리자가 언제 발신했는지 확인)
  // silent=true면 로딩 표시 없이 조용히 갱신(자동 폴링용 — 목록 깜빡임 방지)
  const loadDispatchHistory = async (days = histDays, silent = false) => {
    if (!silent) setHistLoading(true);
    try {
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const r = await authFetch(`${SERVER_URL}/call/dispatches?from=${encodeURIComponent(from)}`);
      const d = await r.json();
      setDispatchHist(Array.isArray(d.dispatches) ? d.dispatches : []);
    } catch { if (!silent) setDispatchHist([]); }   // 조용한 갱신 실패 시 기존 목록 유지
    if (!silent) setHistLoading(false);
  };
  // 발신 관리 탭에 있는 동안 15초마다 자동 갱신 → 발신 90초 뒤 부재중 등이 새로고침 없이 반영
  useEffect(() => {
    if (page !== 'schedule' && page !== 'dashboard' && page !== 'safety') return;   // 홈·안전확인 페이지도 발신 집계 필요
    loadDispatchHistory(histDays);
    const t = setInterval(whileVisible(() => loadDispatchHistory(histDays, true)), 15000);
    return () => clearInterval(t);
  }, [page, histDays]); // eslint-disable-line

  // ── 경보 응답 현황 (산불 대피: 안전확인/도움요청/미응답) ── 15초 자동 갱신
  const loadAlertResponses = async (silent = false) => {
    if (!silent) setAlertRespLoading(true);
    try {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const r = await authFetch(`${SERVER_URL}/alert/responses?from=${encodeURIComponent(from)}`);
      const d = await r.json();
      setAlertResponses(Array.isArray(d.responses) ? d.responses : []);
    } catch { if (!silent) setAlertResponses([]); }
    if (!silent) setAlertRespLoading(false);
  };
  useEffect(() => {
    if (page !== 'schedule') return;
    loadAlertResponses();
    const t = setInterval(whileVisible(() => loadAlertResponses(true)), 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line


  // ── 안부 질문: 서버 저장분 로드. 비어 있으면 아래 DEFAULT_QUESTIONS(통화 엔진 기본값과 동일) ──
  useEffect(() => {
    if (page !== 'script') return;
    authFetch(`${SERVER_URL}/settings/questions`).then(r => r.json())
      .then(d => { if (d && Array.isArray(d.questions) && d.questions.length) setQuestions(d.questions); })
      .catch(() => {});
    authFetch(`${SERVER_URL}/settings/pstn`).then(r => r.json())
      .then(d => { if (d && typeof d.callerId === 'string') setPstnCallerId(d.callerId); })
      .catch(() => {});
  }, [page]); // eslint-disable-line

  const savePstnCallerId = async () => {
    const v = pstnCallerId.replace(/[^0-9]/g, '');
    if (!/^0\d{8,10}$/.test(v)) { setPstnMsg('0으로 시작하는 숫자 9~11자리로 입력해 주세요 (예: 07045014906)'); return; }
    setPstnSaving(true); setPstnMsg('');
    try {
      const r = await authFetch(`${SERVER_URL}/settings/pstn`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerId: v }),
      });
      const d = await r.json();
      if (d && d.success) { setPstnCallerId(d.callerId); setPstnMsg('저장했습니다. 다음 발신부터 이 번호로 표시됩니다.'); }
      else setPstnMsg(errMsg(d, '저장 실패'));
    } catch { setPstnMsg('서버 연결 실패'); }
    setPstnSaving(false);
  };

  const setQuestionField = (key, field, value) =>
    setQuestions(prev => prev.map(q => q.key === key ? { ...q, [field]: value } : q));

  const saveQuestions = async () => {
    const bad = questions.find(q => q.enabled && !String(q.text || '').trim());
    if (bad) { setQuestionsMsg(`"${bad.label}" 질문이 비어 있습니다.`); return; }
    setQuestionsSaving(true); setQuestionsMsg('');
    try {
      const r = await authFetch(`${SERVER_URL}/settings/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      const d = await r.json();
      if (d && d.success) {
        setQuestions(d.questions);
        setQuestionsMsg('저장했습니다. 다음 통화부터 적용됩니다.');
      } else setQuestionsMsg(errMsg(d, '저장 실패'));
    } catch { setQuestionsMsg('서버 연결 실패'); }
    setQuestionsSaving(false);
  };

  const resetQuestions = () => { setQuestions(DEFAULT_QUESTIONS.map(q => ({ ...q }))); setQuestionsMsg('기본값으로 되돌렸습니다. 저장해야 반영됩니다.'); };

  // ── 경보 멘트: 서버 저장분 로드(기관 공유) → 담당자 수정이 모든 계정에 즉시 적용 ──
  // script(전화 멘트 관리)가 **편집 화면**이므로 여기서도 불러와야 한다.
  // 예전에는 schedule 에서만 불러와, script 에서 저장한 멘트가 새로고침하면 기본값으로
  // 되돌아간 것처럼 보였다(서버에는 저장돼 있는데 화면이 읽지 않음).
  useEffect(() => {
    if (page !== 'schedule' && page !== 'script') return;
    authFetch(`${SERVER_URL}/settings/alerts`).then(r => r.json())
      .then(d => setSavedAlertTpl((d && d.templates) || {})).catch(() => {});
  }, [page]); // eslint-disable-line
  // 5분 날씨 인터벌(deps [])이 붙잡은 낡은 클로저에서도 최신 저장분을 읽게 하는 통로
  const savedAlertTplRef = useRef({});
  useEffect(() => { savedAlertTplRef.current = savedAlertTpl; }, [savedAlertTpl]);
  // 편집창에 마지막으로 적용한 경보 종류 — 같은 경보가 다시 선택될 때 편집 중인 내용을 지키기 위함
  const appliedAlertKeyRef = useRef(null);
  // 담당자가 경보를 직접 고르거나 멘트를 고치면 true. 이후 날씨 자동선택은 화면을 건드리지 않는다.
  const alertUserTouchedRef = useRef(false);
  // 편집 중인 멘트의 키 (산불은 단계별, 그 외는 경보 종류)
  const curAlertKey = () => activeAlert === 'wildfire' ? `wildfire_${wildfireStage}` : activeAlert;

  /**
   * 저장분이 도착하면 편집창에 반영한다.
   *
   * 서버 조회는 비동기라, 사용자가 먼저 경보를 선택했거나 날씨로 자동 선택된 뒤에 도착할 수 있다.
   * 그때 갱신하지 않으면 기본값이 그대로 보여 "저장이 안 됐다"고 느끼게 된다.
   * 편집 중인 내용을 덮어쓰지 않도록, 지금 값이 기본값과 같을 때만 저장분으로 바꾼다.
   */
  useEffect(() => {
    const key = curAlertKey();
    if (!key || key === 'none') return;
    const saved = savedAlertTpl[key];
    if (!saved || !saved.trim()) return;
    const def = activeAlert === 'wildfire'
      ? (WILDFIRE_STAGES.find(s => s.id === wildfireStage) || WILDFIRE_STAGES[0]).text
      : ALERT_TEMPLATES[activeAlert];
    setAlertScript(cur => (cur === def ? saved : cur));
  }, [savedAlertTpl, activeAlert, wildfireStage]); // eslint-disable-line
  // 저장분 우선, 없으면 기본 텍스트.
  // ref로 읽는 이유: 이 함수를 부르는 fetchWeather가 deps [] 인 5분 인터벌에 갇혀 있어,
  // state로 읽으면 첫 렌더의 빈 값({})만 계속 보게 된다 → 저장해 둔 멘트가 매번 기본값으로 덮였다.
  const tplText = (key, def) => {
    const saved = savedAlertTplRef.current[key];
    return saved && saved.trim() ? saved : def;
  };
  // 현재 편집 멘트를 서버에 저장(기관 공유)
  const saveAlertTemplate = async () => {
    const key = curAlertKey();
    if (!key || key === 'none') return;
    setAlertTplSaving(true); setAlertTplSaved(false);
    try {
      const r = await authFetch(`${SERVER_URL}/settings/alerts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: { [key]: alertScript } }),
      });
      const d = await r.json();
      if (d && d.templates) {
        setSavedAlertTpl(d.templates);
        // 저장분이 곧 화면 내용이 됐으니, 이제부터는 날씨 자동선택이 다시 들어와도 된다
        alertUserTouchedRef.current = false;
        setAlertTplSaved(true); setTimeout(() => setAlertTplSaved(false), 2500);
      } else {
        // 저장이 실패해도 아무 표시가 없어서 "저장했는데 새로고침하면 사라진다"로 보였다(2026-08-21)
        alert('경보 멘트 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (e) {
      alert('경보 멘트 저장에 실패했습니다. 네트워크 상태를 확인해 주세요.');
      console.error('경보 멘트 저장 실패:', e);
    }
    setAlertTplSaving(false);
  };
  // 저장분을 기본값으로 되돌리기(빈 값 저장 → 서버가 해당 키 삭제)
  const resetAlertTemplate = async () => {
    const key = curAlertKey();
    if (!key || key === 'none') return;
    const def = activeAlert === 'wildfire' ? (WILDFIRE_STAGES.find(s => s.id === wildfireStage) || WILDFIRE_STAGES[0]).text : ALERT_TEMPLATES[activeAlert];
    setAlertTplSaving(true);
    try {
      const r = await authFetch(`${SERVER_URL}/settings/alerts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: { [key]: '' } }),
      });
      const d = await r.json();
      if (d && d.templates) setSavedAlertTpl(d.templates);
      setAlertScript(def);
    } catch { /* noop */ }
    setAlertTplSaving(false);
  };

  // ── 상담·방문 일지(caseNotes) ──
  const CASE_TYPE_META = {
    visit:    { label: '가정방문', icon: '🏠', color: '#246BEB', bg: '#dbeafe' },
    phone:    { label: '전화상담', icon: '📞', color: '#16a34a', bg: '#dcfce7' },
    office:   { label: '내소상담', icon: '🏢', color: '#7c3aed', bg: '#ede9fe' },
    guardian: { label: '보호자상담', icon: '👪', color: '#c2410c', bg: '#ffedd5' },
    etc:      { label: '기타', icon: '📄', color: '#64748b', bg: '#f1f5f9' },
  };
  const CASE_CAT_META = { safety:'안전', health:'건강', meal:'식사', emotional:'정서', welfare:'복지연계', etc:'기타' };
  // 통화 종료 시 서버가 자동 생성한 일지 — 담당자가 열어 수정하면 status가 confirmed로 바뀐다.
  // 서버가 레거시 문서에는 source:'manual'/status:'confirmed'를 채워 주므로 예전 일지는 걸리지 않는다.
  const isAutoDraft = (n) => n && n.source === 'auto-call' && n.status !== 'confirmed';
  const AutoDraftBadge = () => (
    <span title="통화 내용으로 자동 작성된 초안입니다 — 담당자가 확인·수정해야 확정됩니다"
      style={{fontSize:14,fontWeight:700,color:'#b45309',background:'#fef3c7',border:'1px solid #fde68a',padding:'2px 8px',borderRadius:20}}>
      자동기록 · 확인 필요
    </span>
  );
  // 주간업무 보고서(공식 양식)의 업무 구분 체크박스: □사회 □신체 □가사 □기타
  const CASE_TOPIC_META = { social:'사회', physical:'신체', housework:'가사', etc:'기타' };

  const loadCaseNotes = async (silent = false) => {
    if (!silent) setCaseLoading(true);
    try {
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const r = await authFetch(`${SERVER_URL}/case-notes?from=${encodeURIComponent(from)}`);
      const d = await r.json();
      setCaseNotes(Array.isArray(d.notes) ? d.notes : []);
    } catch { if (!silent) setCaseNotes([]); }
    if (!silent) setCaseLoading(false);
  };
  useEffect(() => {
    if (page !== 'casenotes' && page !== 'detail') return;
    loadCaseNotes();
    // 일지는 기관 공유 데이터 — 다른 담당자가 쓴 일지도 15초 안에 보이게 자동 갱신
    if (page !== 'casenotes') return;
    const t = setInterval(whileVisible(() => loadCaseNotes(true)), 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line

  // 날짜/시간 헬퍼 (상담 일시를 날짜 입력 + 시간 드롭다운으로 분리)
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateStrOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const timeStrOf = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const roundHalf = (d) => { let h = d.getHours(), m = d.getMinutes(); if (m < 15) m = 0; else if (m < 45) m = 30; else { m = 0; h = (h + 1) % 24; } return `${pad2(h)}:${pad2(m)}`; };
  const fmtTimeK = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad2(m)}`; };
  const TIME_OPTS = (() => { const a = []; for (let h = 0; h < 24; h++) for (const m of [0, 30]) a.push(`${pad2(h)}:${pad2(m)}`); return a; })();

  // 새 일지 작성 폼 열기 (prefill: 어르신/주제/연동알림)
  // 통화 내용 → 활동일지 초안 생성 (AI서버 Gemini 요약, Railway 프록시) → 일지 작성 모달 프리필
  const makeNoteDraft = async (c) => {
    if (draftingCallId) return;
    setDraftingCallId(c.id);
    try {
      const r = await authFetch(`${SERVER_URL}/case-notes/draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elderName: nameByPhone(c.phone, c.elderName), transcript: c.transcript, riskLevel: c.riskLevel, durationSec: c.durationSec }),
      });
      const d = await r.json();
      openNewNote({
        elderPhone: c.phone, elderName: nameByPhone(c.phone, c.elderName), type: 'phone',
        category: d.category || 'safety', content: d.content || '', action: d.action || '', visitedAt: c.at,
      });
    } catch { notify('일지 초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'); }
    setDraftingCallId(null);
  };

  // 통화 행의 '일지 작성' — 통화 종료 시 서버가 만들어 둔 자동 일지가 있으면 그것을 열어 수정한다.
  // (새로 만들면 같은 통화에 일지가 2건 생긴다. 자동 일지 문서 id는 auto_{callId} 규칙)
  const openNoteForCall = (c) => {
    const exist = c.callId && caseNotes.find(n => n.callId === c.callId);
    if (exist) { openEditNote(exist); return; }
    makeNoteDraft(c);
  };

  // 일지 → 정부 노인맞춤돌봄시스템 붙여넣기용 텍스트 복사 (현장 최다 사용 흐름)
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const noteToText = (n) => {
    const TYPE_KO = { visit: '가정방문', phone: '전화상담', office: '내소상담', guardian: '보호자상담', etc: '기타' };
    const CAT_KO = { safety: '안전', health: '건강', meal: '식사', emotional: '정서', welfare: '생활지원', etc: '기타' };
    const when = n.visitedAt ? new Date(n.visitedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const lines = [
      `[상담·방문 일지] ${when} · ${TYPE_KO[n.type] || n.type} · ${CAT_KO[n.category] || n.category}`,
      `어르신: ${n.elderName || ''}`,
      '', n.content || '',
    ];
    if (n.topics && n.topics.length) lines.push('', `업무 구분: ${n.topics.map(t=>({social:'사회',physical:'신체',housework:'가사',etc:'기타'}[t])).filter(Boolean).join(', ')}`);
    if (n.action) lines.push('', `조치사항: ${n.action}`);
    if (n.followUp && n.followUp.needed) lines.push(`후속조치 필요${n.followUp.dueDate ? ` (기한: ${n.followUp.dueDate})` : ''}`);
    return lines.join('\n');
  };
  const copyNote = async (n, key) => {
    try {
      await navigator.clipboard.writeText(noteToText(n));
      setCopiedNoteId(key); setTimeout(() => setCopiedNoteId(null), 2000);
    } catch { notify('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.'); }
  };
  // 일지 목록 엑셀 다운로드 (기관 내부 보관·결재용)
  const exportNotesXlsx = async (list) => {
    const XLSX = await loadXLSX();
    const TYPE_KO = { visit: '가정방문', phone: '전화상담', office: '내소상담', guardian: '보호자상담', etc: '기타' };
    const CAT_KO = { safety: '안전', health: '건강', meal: '식사', emotional: '정서', welfare: '생활지원', etc: '기타' };
    const aoa = [['일시', '어르신', '유형', '분류', '내용', '조치사항', '후속필요', '후속기한', '작성자', '상태']];
    [...list].sort((a, b) => (a.visitedAt || '').localeCompare(b.visitedAt || '')).forEach(n => {
      aoa.push([
        n.visitedAt ? new Date(n.visitedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '',
        n.elderName || '', TYPE_KO[n.type] || n.type, CAT_KO[n.category] || n.category,
        n.content || '', n.action || '',
        (n.followUp && n.followUp.needed) ? 'O' : '', (n.followUp && n.followUp.dueDate) || '',
        (n.authorEmail || '').split('@')[0],
        isAutoDraft(n) ? '자동기록(확인 필요)' : '확인 완료',
      ]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 60 }, { wch: 26 }, { wch: 8 }, { wch: 11 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, '상담방문일지');
    XLSX.writeFile(wb, `영실이_상담방문일지_${new Date().toLocaleDateString('sv-SE')}.xlsx`);
  };

  // ── 주간업무 보고서 (공식 PDF 양식 재현) ──
  // 월 단위 1장: 1~5주차 블록에 그 주의 일지를 자동 채움(일반돌봄 주2회·중점 주1회 통화라 주차당 한 칸에 충분).
  // 각 주차 상단에 □사회 □신체 □가사 □기타 — 일지의 '업무 구분' 체크 합집합. 새 창에서 인쇄 → PDF 저장.
  const [weeklyModal, setWeeklyModal] = useState(null);   // { phone, ym, benefit, author } — 선택
  const [weeklyDoc, setWeeklyDoc] = useState(null);       // { weeks:{1..5:{content,topics}}, note, workerName, birth, loaded } — 편집본
  const [weeklyAll, setWeeklyAll] = useState([]);         // 해당 월 전체(일괄 출력용)
  // 앱(지원사)이 주차별로 저장한 보고서를 불러옴. 문서가 없거나 빈 주차는 상담일지에서 자동 프리필(참고용).
  const loadWeekly = async (phone, ym) => {
    setWeeklyDoc({ weeks: {}, note: '', workerName: '', birth: '', loaded: false });
    try {
      const r = await authFetch(`${SERVER_URL}/weekly-reports?ym=${ym}`).then(x => x.json());
      const all = (r && r.reports) || [];
      setWeeklyAll(all);
      const mine = all.find(w => String(w.elderPhone||'').replace(/\D/g,'') === phone) || {};
      const weeks = {};
      for (let i = 1; i <= 5; i++) {
        const w = (mine.weeks || {})[String(i)] || {};
        weeks[i] = { content: w.content || '', topics: w.topics || [] };
      }
      // 빈 주차는 그 주의 상담일지로 프리필 (지원사가 일지로만 남긴 경우 대비 — 저장 전까지는 참고 초안)
      const [y, m] = ym.split('-').map(Number);
      const TYPE_KO = { visit: '가정방문', phone: '전화상담', office: '내소상담', guardian: '보호자상담', etc: '기타' };
      caseNotes.filter(n => {
        const ph = String(n.elderPhone||'').replace(/\D/g,'');
        const d = n.visitedAt ? new Date(n.visitedAt) : null;
        return ph === phone && d && d.getFullYear() === y && (d.getMonth()+1) === m;
      }).sort((a,b)=>(a.visitedAt||'').localeCompare(b.visitedAt||'')).forEach(n => {
        const d = new Date(n.visitedAt);
        const wk = Math.min(5, Math.floor((d.getDate()-1)/7) + 1);
        if (weeks[wk].content) return;   // 앱에서 작성한 주차는 건드리지 않음
        weeks[wk]._fromNotes = true;
        weeks[wk].content = `${weeks[wk].content ? weeks[wk].content + '\n' : ''}${m}/${d.getDate()} [${TYPE_KO[n.type]||'기타'}] ${n.content}${n.action ? `\n  → 조치: ${n.action}` : ''}`;
        weeks[wk].topics = [...new Set([...(weeks[wk].topics||[]), ...(n.topics||[])])];
      });
      const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === phone) || {};
      setWeeklyDoc({
        weeks, note: mine.note || '', birth: mine.birth || juminToBirth(el.jumin) || '',
        workerName: mine.workerName || (accounts.find(u=>u.email===el.assignedTo)||{}).name || '',
        loaded: true,
      });
    } catch { setWeeklyDoc(f => ({ ...(f||{}), weeks: {}, loaded: true })); }
  };
  const openWeeklyReport = (ymArg) => {
    const first = elders[0];
    const phone = first ? String(first.phone||'').replace(/\D/g,'') : '';
    const ym0 = (typeof ymArg === 'string' && /^\d{4}-\d{2}$/.test(ymArg)) ? ymArg : new Date().toISOString().slice(0,7);
    setWeeklyModal({
      phone, ym: ym0,
      benefit: T.benefit,
      author: '',   // 관리자: 지원사(작성자)별 필터. ''=전체
    });
    if (isStaffUp && accounts.length === 0) fetchAccounts();   // 작성자 이름 표시용
    if (phone) loadWeekly(phone, ym0);
  };
  // 주간업무 보고서를 엑셀 파일로 — '다른 이름으로 저장' 대화상자
  const exportWeeklyXlsx = async () => {
    if (!weeklyModal || !weeklyDoc) return;
    const XLSX = await loadXLSX();
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === weeklyModal.phone) || {};
    const [y, m] = weeklyModal.ym.split('-').map(Number);
    const topicsKo = (t) => (t||[]).map(k=>CASE_TOPIC_META[k]).filter(Boolean).join(', ');
    const aoa = [
      [`${y}년 ${m}월 주간업무 보고서`],
      ['이용자 성명', el.name||'', '이용자 생년월일', weeklyDoc.birth||'', '지원사 성명', weeklyDoc.workerName||''],
      ['급여종류', weeklyModal.benefit||''],
      [],
      ['주차', '업무 구분', '업무내용 · 특이사항'],
    ];
    for (let i = 1; i <= 5; i++) {
      const w = weeklyDoc.weeks[i] || {};
      aoa.push([`${i}주차`, topicsKo(w.topics), w.content || '']);
    }
    aoa.push([], ['전담인력 지시사항', '', weeklyDoc.note || '']);
    aoa.push([], [`작성일: ${new Date().toLocaleDateString('ko-KR')}`, '', '전담인력:            (서명 또는 印)']);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 80 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, '주간업무보고서');
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    await saveBlobAs(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `주간업무보고서_${el.name||'이용자'}_${weeklyModal.ym}.xlsx`);
  };
  const saveWeekly = async () => {
    if (!weeklyModal || !weeklyDoc) return;
    // 서버에 저장하지 않음(사용자 결정) — 로컬 '다른 이름으로 저장'만. 앱이 저장한 내용의 열람은 유지.
    await exportWeeklyXlsx();
  };
  // 보고서 1장(폼) HTML — 저장본(weeklyReports 문서) 기반. report={elderPhone,elderName,ym,weeks,note,benefit,workerName,birth}
  const buildWeeklyForm = (report) => {
    const phoneKey = String(report.elderPhone||'').replace(/\D/g,'');
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === phoneKey) || {};
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    const [y, m] = report.ym.split('-').map(Number);
    const weeks = report.weeks || {};
    const hasAny = [1,2,3,4,5].some(i => ((weeks[i]||weeks[String(i)]||{}).content||'').trim());
    if (!hasAny) return null;
    const weekRows = [1,2,3,4,5].map(i => {
      const w = weeks[i] || weeks[String(i)] || {};
      const tset = new Set(w.topics || []);
      const boxes = Object.entries(CASE_TOPIC_META).map(([k,l]) => `<span class="cb">${tset.has(k)?'&#9745;':'&#9744;'}${l}</span>`).join('');
      return `<tr><td class="wkhead" colspan="2">${i}주차</td></tr>
        <tr><td class="lbl">업무내용<br>특이사항</td><td class="cell"><div class="boxes" contenteditable="true">${boxes}</div><div contenteditable="true" class="body">${esc(w.content)||'&nbsp;'}</div></td></tr>`;
    }).join('');
    const today = new Date();
    return `
      <h1>${y}년 ${m}월 주간업무 보고서</h1>
      <table class="hd">
        <tr><td class="k">이용자 성명</td><td class="v" contenteditable="true">${esc(report.elderName||el.name||'')}</td><td class="k">이용자 생년월일</td><td class="v" contenteditable="true">${esc(report.birth) || (el.age?('만 '+el.age+'세'):'')}</td></tr>
        <tr><td class="k">급여종류</td><td class="v" contenteditable="true">${esc(report.benefit||'노인맞춤돌봄서비스')}</td><td class="k">생활지원사 성명</td><td class="v" contenteditable="true">${esc(report.workerName||'')}</td></tr>
      </table>
      <table style="margin-top:-1.5px">${weekRows}
        <tr><td class="lbl">전담인력<br>지시사항</td><td class="cell"><div contenteditable="true" class="body">${esc(report.note)||'&nbsp;'}</div></td></tr>
      </table>
      <div class="sign">${today.getFullYear()}년 &nbsp; ${today.getMonth()+1}월 &nbsp; ${today.getDate()}일</div>
      <div class="sig2">전담인력 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (서명 또는 印)</div>`;
  };
  const openReportWindow = (pages, title) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;margin:28px auto;max-width:760px;color:#111}
      h1{text-align:center;font-size:24px;letter-spacing:2px;text-decoration:underline;text-underline-offset:6px;margin:10px 0 24px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      td{border:1.5px solid #333;padding:8px 10px;font-size:13.5px;vertical-align:top;word-break:break-all}
      .hd td.k{background:#e8e8e8;font-weight:800;text-align:center;width:19%}
      .hd td.v{width:31%}
      .wkhead{background:#d9d9d9;font-weight:800;text-align:center;padding:5px}
      .lbl{width:16%;font-weight:800;text-align:center;vertical-align:middle;background:#fff}
      .cell{min-height:86px}
      .boxes{margin-bottom:6px;font-weight:700}
      .cb{margin-right:22px}
      .body{min-height:64px;line-height:1.55}
      .sign{margin-top:26px;text-align:center;font-size:15px;font-weight:700}
      .sig2{text-align:right;margin-top:14px;font-size:14px}
      .foot{text-align:right;margin-top:22px;font-size:13px;font-weight:700}
      .noprint{position:fixed;top:12px;right:12px}
      .noprint button{padding:10px 18px;font-size:14px;font-weight:800;border-radius:8px;border:0;background:#246BEB;color:#fff;cursor:pointer}
      .hint{position:fixed;top:12px;left:12px;font-size:12px;color:#64748b;background:#f1f5f9;padding:6px 10px;border-radius:8px}
      .pgbrk{page-break-after:always;border-top:2px dashed #cbd5e1;margin:40px 0}
      @media print{.noprint,.hint{display:none}body{margin:0 auto}.pgbrk{border:0;margin:0}}
    </style></head><body>
      <div class="hint">✏️ 칸을 클릭하면 인쇄 전에 내용을 고칠 수 있어요</div>
      <div class="noprint"><button onclick="window.print()">🖨 인쇄 / PDF 저장</button></div>
      ${pages.join('<div class="pgbrk"></div>')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { notify('팝업이 차단됐습니다. 팝업을 허용해 주세요.'); return; }
    w.document.write(html); w.document.close();
    setWeeklyModal(null);
  };
  // 단건 출력 — 현재 편집 중인 내용 그대로 (저장 안 한 수정도 반영)
  const printWeeklyReport = () => {
    if (!weeklyModal || !weeklyModal.phone || !weeklyDoc) { notify('이용자를 선택해 주세요.'); return; }
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === weeklyModal.phone) || {};
    const [y, m] = weeklyModal.ym.split('-').map(Number);
    const page = buildWeeklyForm({
      elderPhone: weeklyModal.phone, elderName: el.name, ym: weeklyModal.ym,
      weeks: weeklyDoc.weeks, note: weeklyDoc.note, benefit: weeklyModal.benefit,
      workerName: weeklyDoc.workerName, birth: weeklyDoc.birth,
    });
    if (!page) { notify('작성된 주차가 없습니다. 지원사 앱에서 작성하거나 여기서 입력해 주세요.'); return; }
    openReportWindow([page], `${y}년 ${m}월 주간업무 보고서`);
  };
  // 관리자 일괄 출력: 그 달에 저장된 보고서 전체(작성자 필터 가능) — 한 창에 여러 장(장마다 인쇄 페이지 분리)
  const printWeeklyBatch = () => {
    if (!weeklyModal) return;
    const [y, m] = weeklyModal.ym.split('-').map(Number);
    const pages = weeklyAll
      .filter(w => !weeklyModal.author || (w.authorEmail||'') === weeklyModal.author)
      .map(w => buildWeeklyForm({ ...w, benefit: w.benefit || weeklyModal.benefit }))
      .filter(Boolean);
    if (!pages.length) { notify('선택한 조건(월·작성자)에 저장된 보고서가 없습니다. 지원사 앱에서 주차별로 저장하면 여기에 모입니다.'); return; }
    openReportWindow(pages, `${y}년 ${m}월 주간업무 보고서 일괄 (${pages.length}명)`);
  };

  // ── 급여제공 일정표 (스트림 C): 세로(날짜 리스트) 입력 → 저장 → 공식 달력 양식 인쇄 ──
  const [schedModal, setSchedModal] = useState(null);   // { phone, ym, days:{}, holidays:[], categories:[], birth, residence, workerName, saving }
  const modalOpenKey = [bulkConfirm, callModal, csvImport, schedModal, weeklyModal, noteForm].map(Boolean).join(':');

  // 모든 모달에 공통으로 적용되는 키보드 접근성: 첫 포커스, Tab 순환, Escape 닫기.
  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>('.modal-overlay');
    if (!overlay) return;
    const dialog = overlay.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"], .modal');
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
    (focusable()[0] || dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { overlay.click(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = oldOverflow; previous?.focus?.(); };
  }, [modalOpenKey]);
  // 급여 산정: 월 인정 한도 120시간, 주말·공휴일 1.5배 (입력 2h → 인정 3h)
  const SCHED_CAP = 120, SCHED_RATE = 1.5;
  // 2026년 법정 공휴일(대체 포함) — 자동 반영. 임시·대체 변경은 날짜 클릭으로 수동 지정/해제.
  const KR_HOLIDAYS = ['2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02','2026-05-05','2026-05-24','2026-05-25','2026-06-06','2026-07-17','2026-08-15','2026-08-17','2026-09-24','2026-09-25','2026-09-26','2026-09-28','2026-10-03','2026-10-05','2026-10-09','2026-12-25'];
  const autoHolidays = (ym) => KR_HOLIDAYS.filter(d => d.startsWith(ym)).map(d => Number(d.slice(8)));
  // 반응형: PC(≥900px)=달력형(가로 7열, 공식 양식과 동일 배치·주 합계 열) / 모바일=세로 날짜 리스트(한 손 입력)
  const [winWide, setWinWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 900);
  useEffect(() => {
    const on = () => setWinWide(window.innerWidth >= 900);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const [schedMonthAll, setSchedMonthAll] = useState([]);   // 해당 월 전체 일정표(일괄 출력용)
  const loadSchedule = async (phone, ym) => {
    try {
      const r = await authFetch(`${SERVER_URL}/schedules?ym=${ym}`).then(x => x.json());
      const all = (r && r.schedules) || [];
      setSchedMonthAll(all);
      const minePh = all.find(s => String(s.elderPhone||'').replace(/\D/g,'') === phone);
      const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === phone) || {};
      setSchedModal(f => ({
        ...f, phone, ym, loaded: true,
        days: (minePh && minePh.days) || {},
        holidays: (minePh && minePh.holidays) || autoHolidays(ym),
        categories: (minePh && minePh.categories) || [],
        // 생년월일: 저장값 → 어르신 주민등록번호에서 자동 변환 순
        birth: (minePh && minePh.birth) || juminToBirth(el.jumin) || '',
        residence: (minePh && minePh.residence) || el.region || '',
        // 활동지원사 성명: 저장값 → 담당 지원사 계정 이름 → 내 계정 이름 순 (자동 입력)
        workerName: (minePh && minePh.workerName) || (accounts.find(u=>u.email===el.assignedTo)||{}).name || (me && me.name) || '',
      }));
    } catch { setSchedModal(f => ({ ...f, loaded: true })); }
  };
  const openSchedule = (ymArg) => {
    const first = elders[0];
    const phone = first ? String(first.phone||'').replace(/\D/g,'') : '';
    const ym = (typeof ymArg === 'string' && /^\d{4}-\d{2}$/.test(ymArg)) ? ymArg : new Date().toISOString().slice(0,7);
    setSchedModal({ phone, ym, days: {}, holidays: autoHolidays(ym), categories: [], birth: '', residence: '', workerName: '', loaded: false });
    if (isStaffUp && accounts.length === 0) fetchAccounts();
    if (phone) loadSchedule(phone, ym);
  };
  // 일정표를 엑셀 파일로 — "다른 이름으로 저장" 대화상자(지원 브라우저)로 저장 위치 선택
  const exportScheduleXlsx = async () => {
    if (!schedModal) return;
    const XLSX = await loadXLSX();
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === schedModal.phone) || {};
    const [y, m] = schedModal.ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const hset = new Set(schedModal.holidays || []);
    const is15x = (d) => { const dw = new Date(y, m-1, d).getDay(); return dw === 0 || dw === 6 || hset.has(d); };
    const recX = (d) => Number((schedModal.days||{})[String(d)]||0) * (is15x(d) ? SCHED_RATE : 1);
    const totalIn = Object.values((schedModal.days||{}) as Record<string, any>).reduce((a,b)=>a+Number(b),0);
    const totalRc = Math.round(Array.from({length:lastDay},(_,i)=>recX(i+1)).reduce((a,b)=>a+b,0)*100)/100;
    // 달력형 시트: 주별 2행(날짜 / 시간) + 주합계 열
    const offset = new Date(y, m-1, 1).getDay();
    const cells = [...Array(offset).fill(null), ...Array.from({length:lastDay},(_,i)=>i+1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const aoa = [
      [`급여제공 일정표 ( ${y}년 ${m}월 )`],
      ['수급자 성명', el.name||'', '수급자 생년월일', schedModal.birth||'', '활동지원사성명', schedModal.workerName||''],
      ['급여종류', '활동지원서비스', '월 근로시간(인정)', `${totalRc}시간 / 120시간`, '입력 시간', `${totalIn}시간`],
      [],
      ['일','월','화','수','목','금','토','주 합계(인정)'],
    ];
    for (let i = 0; i < cells.length; i += 7) {
      const w = cells.slice(i, i+7);
      aoa.push(w.map(d => d ? `${m}/${d}${is15x(d)?' (休×1.5)':''}` : ''));
      const wkSum = Math.round(w.reduce((a,d)=>a+(d?recX(d):0),0)*100)/100;
      aoa.push([...w.map(d => { const h = d && (schedModal.days||{})[String(d)]; return h ? `${h}시간${is15x(d)?` → 인정 ${recX(d)}`:''}` : ''; }), wkSum ? `${wkSum}시간` : '']);
    }
    aoa.push([], ['※ 주말·공휴일(休)은 1.5배 인정 · 월 인정시간 한도 120시간'], ['※ 매월 작성하여 기관보관 (보관기간: 작성일로부터 3년)']);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = Array(8).fill({ wch: 15 });
    XLSX.utils.book_append_sheet(wb, ws, '급여제공일정표');
    const fname = `급여제공일정표_${el.name||'이용자'}_${schedModal.ym}.xlsx`;
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    await saveBlobAs(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname);
  };
  // 공용: '다른 이름으로 저장' 대화상자(크롬·엣지 위치 선택) → 미지원 브라우저는 다운로드 폴더 폴백
  const saveBlobAs = async (blob, fname) => {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'Excel 파일', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; /* 취소 시 조용히 */ }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); URL.revokeObjectURL(a.href);
  };
  const saveSchedule = async () => {
    if (!schedModal || !schedModal.phone) return;
    // 서버에 저장하지 않음(사용자 결정) — 로컬 '다른 이름으로 저장'만. 앱이 저장한 내용의 열람은 유지.
    await exportScheduleXlsx();
  };
  // 공식 달력 양식 1장 HTML (일~토, 일요일 칸에 주 합계, 하단 서명·보관 문구)
  const buildScheduleForm = (sched) => {
    const [y, m] = sched.ym.split('-').map(Number);
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === String(sched.elderPhone||sched.phone||'').replace(/\D/g,'')) || {};
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const days = sched.days || {};
    const lastDay = new Date(y, m, 0).getDate();
    const offset = new Date(y, m - 1, 1).getDay();   // 0=일
    const hset = new Set((sched.holidays || []).map(Number));
    const is15p = (d) => { const dw = new Date(y, m-1, d).getDay(); return dw === 0 || dw === 6 || hset.has(d); };
    const recOfp = (d) => Number(days[String(d)] || 0) * (is15p(d) ? SCHED_RATE : 1);
    const totalInputP = Object.values(days as Record<string, any>).reduce((a, b) => a + Number(b), 0);
    const total = Math.round(Array.from({length:lastDay},(_,i)=>recOfp(i+1)).reduce((a,b)=>a+b,0)*100)/100;   // 인정시간
    // 주(일~토) 단위 셀 구성
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    // 입력 화면과 동일한 배치: 날짜(×1.5 표시) + 시간 박스, 행 끝 '주 합계' 열
    const rows = weeks.map(w => {
      const weekSum = Math.round(w.reduce((a, d) => a + (d ? recOfp(d) : 0), 0) * 100) / 100;   // 주 인정 합계
      const tds = w.map((d, col) => {
        if (!d) return '<td class="day empty"></td>';
        const h = days[String(d)];
        const cls = is15p(d) ? 'red' : (col === 6 ? 'blue' : '');
        const badge = is15p(d) ? '<span class="x15">&times;1.5</span>' : '';
        return `<td class="day${is15p(d) ? ' holbg' : ''}"><div class="dnum ${cls}">${m}/${d}${badge}</div><div class="val">${h ? h : '&nbsp;'}</div></td>`;
      }).join('');
      return `<tr>${tds}<td class="wksum">${weekSum ? weekSum + '시간' : ''}</td></tr>`;
    }).join('');
    const today = new Date();
    return `
      <h1>급여제공 일정표( ${m}월 )</h1>
      <table class="hd">
        <tr><td class="k">수급자 성명</td><td class="v" contenteditable="true">${esc(el.name||sched.elderName||'')}</td><td class="k">수급자 생년월일</td><td class="v" contenteditable="true">${esc(sched.birth||'')}</td><td class="k">활동지원사성명</td><td class="v" contenteditable="true">${esc(sched.workerName||'')}</td></tr>
        <tr><td class="k">급여종류</td><td class="v" contenteditable="true">활동지원서비스</td><td class="k">월 근로시간</td><td class="v" colspan="3">${total ? `${total}시간 (입력 ${totalInputP}시간)` : ''}</td></tr>
      </table>
      <div class="legend">※ 주말·공휴일(&times;1.5)은 1.5배 인정 · 월 인정시간 한도 120시간 · 주 합계는 인정 기준</div>
      <table class="cal">
        <tr>${['일','월','화','수','목','금','토'].map((d,i)=>`<th class="${i===0?'sun':i===6?'sat':''}">${d}</th>`).join('')}<th class="wkh">주 합계</th></tr>
        ${rows}
        <tr><td class="total" colspan="8">입력 ${totalInputP}시간 · <b>인정 ${total} / 120시간</b></td></tr>
      </table>
      <div class="sign">${today.getFullYear()}년 &nbsp; ${today.getMonth()+1}월 &nbsp; ${today.getDate()}일</div>
      <div class="sig2">담당자 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (서명 또는 인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 수급자 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (서명 또는 인)</div>
      <div class="keep">※ 매월 작성하여 기관보관. (보관기간: 작성일로부터 3년)</div>
      <div class="orgn">${esc(me?.orgName||'')}</div>`;
  };
  const openSchedPrint = (pages, title) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;margin:24px auto;max-width:900px;color:#111}
      h1{text-align:center;font-size:22px;letter-spacing:2px;margin:8px 0 16px;font-weight:900}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      td,th{border:1.5px solid #333;font-size:12.5px;vertical-align:top;word-break:break-all}
      .hd td{padding:8px 10px;border:1px solid #cbd5e1}
      .hd .k{background:#f1f5f9;color:#334155;font-weight:800;text-align:center;width:12%}
      .hd .v{width:21.3%}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cal{margin-top:8px;border-radius:10px;overflow:hidden}
      .cal th{background:#1e3a6e;color:#fff;padding:8px 4px;font-weight:800;font-size:13px;border:1px solid #1e3a6e}
      .cal th.sun{color:#fca5a5}.cal th.sat{color:#93c5fd}.cal th.wkh{border-left:2px solid #3b5488}
      .cal td{border:1px solid #e2e8f0}
      .day{padding:6px 6px 8px;vertical-align:top;background:#fff;min-height:56px}
      .day.holbg{background:#fef7f7}
      .day.empty{background:#fafafa}
      .dnum{font-size:12px;font-weight:800;color:#334155;margin-bottom:5px}
      .dnum.red{color:#dc2626}.dnum.blue{color:#246BEB}
      .x15{font-size:9.5px;font-weight:900;color:#7c3aed;margin-left:3px}
      .val{border:1px solid #cbd5e1;border-radius:8px;padding:6px 4px;text-align:center;font-size:14px;font-weight:700;color:#0f172a;background:#fff;min-height:18px}
      .wksum{background:#f8fafc;border-left:2px solid #e2e8f0;text-align:center;vertical-align:middle;font-weight:900;font-size:13px;color:#1e3a6e;width:88px}
      .total{background:#eff6ff;text-align:right;font-weight:700;font-size:13.5px;color:#1e3a6e;padding:9px 12px}
      .legend{font-size:11px;color:#555;margin:6px 2px}
      .sign{margin-top:18px;text-align:center;font-size:14px;font-weight:700}
      .sig2{text-align:center;margin-top:10px;font-size:13.5px}
      .keep{margin-top:14px;font-size:12px}
      .orgn{text-align:right;font-size:13px;font-weight:800;margin-top:4px}
      .pgbrk{page-break-after:always;border-top:2px dashed #cbd5e1;margin:36px 0}
      .noprint{position:fixed;top:12px;right:12px}
      .noprint button{padding:10px 18px;font-size:14px;font-weight:800;border-radius:8px;border:0;background:#246BEB;color:#fff;cursor:pointer}
      .hint{position:fixed;top:12px;left:12px;font-size:12px;color:#64748b;background:#f1f5f9;padding:6px 10px;border-radius:8px}
      @media print{.noprint,.hint{display:none}body{margin:0 auto}.pgbrk{border:0;margin:0}}
    </style></head><body>
      <div class="hint">✏️ 칸을 클릭하면 인쇄 전에 내용을 고칠 수 있어요</div>
      <div class="noprint"><button onclick="window.print()">🖨 인쇄 / PDF 저장</button></div>
      ${pages.join('<div class="pgbrk"></div>')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { notify('팝업이 차단됐습니다. 팝업을 허용해 주세요.'); return; }
    w.document.write(html); w.document.close();
  };
  const printSchedule = () => {
    if (!schedModal) return;
    if (!Object.keys(schedModal.days||{}).length) { notify('입력된 제공시간이 없습니다. 먼저 시간을 입력·저장해 주세요.'); return; }
    const [y, m] = schedModal.ym.split('-').map(Number);
    openSchedPrint([buildScheduleForm({ ...schedModal, elderPhone: schedModal.phone })], `${y}년 ${m}월 급여제공 일정표`);
  };
  const printScheduleBatch = () => {
    if (!schedModal) return;
    const pages = schedMonthAll.filter(s => Object.keys(s.days||{}).length).map(s => buildScheduleForm(s));
    if (!pages.length) { notify('이 달에 저장된 일정표가 없습니다.'); return; }
    const [y, m] = schedModal.ym.split('-').map(Number);
    openSchedPrint(pages, `${y}년 ${m}월 급여제공 일정표 일괄 (${pages.length}명)`);
  };

  // ── 📥 보고서·서식 통합 메뉴: 월 선택 → 서식별 작성 현황·열람·일괄 다운로드 ──
  const [formsYm, setFormsYm] = useState(new Date().toISOString().slice(0,7));
  const [formsCounts, setFormsCounts] = useState({ weekly: 0, sched: 0 });
  const loadFormsCounts = async (ym) => {
    try {
      const [w, sc] = await Promise.all([
        authFetch(`${SERVER_URL}/weekly-reports?ym=${ym}`).then(r=>r.json()).catch(()=>null),
        authFetch(`${SERVER_URL}/schedules?ym=${ym}`).then(r=>r.json()).catch(()=>null),
      ]);
      setFormsCounts({
        weekly: ((w && w.reports) || []).filter(x => Object.values((x.weeks||{}) as Record<string, any>).some(v=>((v&&v.content)||'').trim())).length,
        sched: ((sc && sc.schedules) || []).filter(x => Object.keys(x.days||{}).length).length,
      });
    } catch {}
  };
  // ⚠️ 이 효과는 formsYm·loadFormsCounts 선언 뒤에 있어야 함 (앞에 두면 선언 전 참조로 앱 전체 크래시)
  useEffect(() => { if (page === 'forms') { loadFormsCounts(formsYm); if (caseNotes.length === 0) loadCaseNotes(true); if (isStaffUp && accounts.length === 0) fetchAccounts(); } }, [page, formsYm]); // eslint-disable-line
  // 모달 없이 곧바로 일괄 출력 (서식 메뉴 카드용)
  const printWeeklyBatchFor = async (ym) => {
    const r = await authFetch(`${SERVER_URL}/weekly-reports?ym=${ym}`).then(x=>x.json()).catch(()=>null);
    const pages = ((r && r.reports) || []).map(w => buildWeeklyForm({ ...w, benefit: w.benefit || T.benefit })).filter(Boolean);
    if (!pages.length) { notify('이 달에 저장된 주간업무 보고서가 없습니다. 지원사 앱에서 주차별로 저장하면 여기에 모입니다.'); return; }
    const [y, m] = ym.split('-').map(Number);
    openReportWindow(pages, `${y}년 ${m}월 주간업무 보고서 일괄 (${pages.length}명)`);
  };
  const printScheduleBatchFor = async (ym) => {
    const r = await authFetch(`${SERVER_URL}/schedules?ym=${ym}`).then(x=>x.json()).catch(()=>null);
    const pages = ((r && r.schedules) || []).filter(s2 => Object.keys(s2.days||{}).length).map(s2 => buildScheduleForm(s2)).filter(Boolean);
    if (!pages.length) { notify('이 달에 저장된 일정표가 없습니다.'); return; }
    const [y, m] = ym.split('-').map(Number);
    openSchedPrint(pages, `${y}년 ${m}월 급여제공 일정표 일괄 (${pages.length}명)`);
  };

  // 건강 알림 → 일지 작성: 알림 시각 근처(±3시간)의 통화를 찾아 초안(요약)까지 채워서 열기.
  // 통화를 못 찾으면 감지 신호 문구만이라도 채움(빈 내용란 방지 — 담당자는 추가 작성만).
  const [draftingAlertId, setDraftingAlertId] = useState(null);
  const ALERT_CAT_NOTE = { health: 'health', fall: 'safety', emotion: 'emotional', living: 'welfare', meal: 'meal', missed: 'safety', help: 'safety', safe: 'safety' };
  const openNoteFromAlert = async (alert) => {
    if (draftingAlertId) return;
    setDraftingAlertId(alert.id);
    const when = alert.timestamp ? new Date(alert.timestamp).toLocaleString('ko-KR') : '';
    let content = alertIsMissed(alert)
      ? `[안부전화 부재중] ${alertKw(alert)} (${when}) — 유선·방문으로 안전확인 필요`
      : `[신호 감지] "${alert.keyword || alert.message || ''}" (${when})`;
    let category = ALERT_CAT_NOTE[alert.category] || 'safety';
    let action = '';
    try {
      const ph = String(alert.phone || '').replace(/\D/g, '');
      if (ph) {
        const t = alert.timestamp ? new Date(alert.timestamp) : new Date();
        const from = new Date(t.getTime() - 3 * 3600000).toISOString();
        const to = new Date(t.getTime() + 3 * 3600000).toISOString();
        const r = await authFetch(`${SERVER_URL}/calls?phone=${ph}&from=${from}&to=${to}`).then(x => x.json());
        const cands = (r.calls || []).filter(c => c.transcript);
        cands.sort((a, b) => Math.abs((new Date(a.at) as any) - (t as any)) - Math.abs((new Date(b.at) as any) - (t as any)));   // 알림 시각과 가장 가까운 통화
        const call = cands[0];
        if (call) {
          const d = await authFetch(`${SERVER_URL}/case-notes/draft`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ elderName: nameByPhone(alert.phone, alert.name), transcript: call.transcript, riskLevel: call.riskLevel, durationSec: call.durationSec }),
          }).then(x => x.json());
          if (d && d.content) {
            content = `${d.content}

[감지 신호] "${alertKw(alert)}" (${when})`;
            if (d.category) category = d.category;
            action = d.action || '';
          }
        }
      }
    } catch { /* 폴백: 감지 문구만 */ }
    openNewNote({
      elderPhone: alert.phone, elderName: nameByPhone(alert.phone, alert.name), type: 'phone',
      category, content, action, linkedAlertId: alert.id, visitedAt: alert.timestamp,
    });
    setDraftingAlertId(null);
  };

  const openNewNote = (prefill: any = {}) => {
    const now = prefill.visitedAt ? new Date(prefill.visitedAt) : new Date();   // 통화→초안이면 통화 시각을 상담일시로
    setNoteForm({
      id: null,
      elderPhone: prefill.elderPhone || '',
      elderName: prefill.elderName || '',
      type: prefill.type || 'visit',
      category: prefill.category || 'safety',
      content: prefill.content || '', action: prefill.action || '',
      topics: prefill.topics || [],
      visitedDate: dateStrOf(now), visitedTime: roundHalf(now),
      linkedAlertId: prefill.linkedAlertId || '',
      followUpNeeded: false, followUpDue: '',
    });
    setNoteModal({});
  };
  const openEditNote = (n) => {
    const d = n.visitedAt ? new Date(n.visitedAt) : new Date();
    setNoteForm({
      id: n.id,
      elderPhone: n.elderPhone || '', elderName: n.elderName || '',
      type: n.type || 'visit', category: n.category || 'safety',
      content: n.content || '', action: n.action || '',
      topics: n.topics || [],
      visitedDate: dateStrOf(d), visitedTime: timeStrOf(d),
      linkedAlertId: n.linkedAlertId || '',
      followUpNeeded: !!(n.followUp && n.followUp.needed), followUpDue: (n.followUp && n.followUp.dueDate) || '',
      autoDraft: isAutoDraft(n),   // 저장 시 '확인 완료'로 확정된다는 안내용
    });
    setNoteModal({ note: n });
  };
  const saveNote = async () => {
    if (!noteForm) return;
    if (!noteForm.content.trim() && !noteForm.action.trim()) { notify('상담·방문 내용을 입력해 주세요.'); return; }
    setNoteSaving(true);
    const body = {
      elderPhone: noteForm.elderPhone, elderName: noteForm.elderName,
      type: noteForm.type, category: noteForm.category,
      content: noteForm.content, action: noteForm.action,
      topics: noteForm.topics || [],
      visitedAt: (noteForm.visitedDate && noteForm.visitedTime) ? new Date(`${noteForm.visitedDate}T${noteForm.visitedTime}`).toISOString() : new Date().toISOString(),
      linkedAlertId: noteForm.linkedAlertId,
      followUp: { needed: noteForm.followUpNeeded, dueDate: noteForm.followUpNeeded ? (noteForm.followUpDue || null) : null, done: false },
    };
    const localNote = {
      id: noteForm.id || null,
      elderPhone: noteForm.elderPhone, elderName: noteForm.elderName,
      type: noteForm.type, category: noteForm.category,
      content: noteForm.content, action: noteForm.action,
      topics: noteForm.topics || [],
      authorEmail: (authUser && authUser.email) || '',
      linkedAlertId: noteForm.linkedAlertId, visitedAt: body.visitedAt, followUp: body.followUp,
    };
    try {
      if (noteForm.id) {
        await authFetch(`${SERVER_URL}/case-notes/${noteForm.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setCaseNotes(prev => prev.map(n => n.id === noteForm.id ? { ...n, ...localNote } : n));   // 낙관적 반영
      } else {
        const r = await authFetch(`${SERVER_URL}/case-notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        let newId = null; try { const d = await r.json(); newId = d && d.id; } catch {}
        setCaseNotes(prev => [{ ...localNote, id: newId || `local_${Date.now()}` }, ...prev]);      // 낙관적 반영(저장 즉시 표시)
        // 폐루프: 알림에서 시작한 일지면 해당 알림을 자동 '조치 완료' 처리 (일지 = 조치 기록)
        if (noteForm.linkedAlertId && !String(noteForm.linkedAlertId).startsWith('alertresp_')) {
          authFetch(`${SERVER_URL}/alerts/${noteForm.linkedAlertId}/status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'done', note: '상담·방문 일지 작성으로 조치 완료' }),
          }).then(() => fetchHealth()).catch(() => {});
        }
      }
      setNoteModal(null); setNoteForm(null);
      loadCaseNotes();   // 백그라운드 재조회로 서버와 정합성 보정(낙관적 반영이 먼저 보임)
    } catch { notify('저장에 실패했습니다. 다시 시도해 주세요.'); }
    setNoteSaving(false);
  };
  const deleteNote = async (id) => {
    if (!window.confirm('이 일지를 삭제할까요?')) return;
    setCaseNotes(prev => prev.filter(n => n.id !== id));   // 낙관적
    setSelectedNotes(prev => { const s = new Set(prev); s.delete(id); return s; });
    try { await authFetch(`${SERVER_URL}/case-notes/${id}`, { method: 'DELETE' }); } catch {}
    loadCaseNotes();
  };
  // 일지 선택/일괄 삭제
  const toggleNoteSel = (id) => setSelectedNotes(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const deleteSelectedNotes = async () => {
    if (selectedNotes.size === 0) return;
    const ids = [...selectedNotes];
    if (!window.confirm(`선택한 ${ids.length}건의 일지를 삭제할까요?`)) return;
    setCaseNotes(prev => prev.filter(n => !selectedNotes.has(n.id)));   // 낙관적
    setSelectedNotes(new Set());
    try { await Promise.all(ids.map(id => authFetch(`${SERVER_URL}/case-notes/${id}`, { method: 'DELETE' }))); } catch {}
    loadCaseNotes();
  };

  // ── 단건 전화 ──
  // channel 'app'  = 앱 푸시(FCM) 우선, 실패 시 서버가 전화로 폴백
  // channel 'pstn' = 앱을 건너뛰고 070 번호로 바로 전화 (앱 미설치 어르신용)
  const makeCall = async (elder, channel: 'app' | 'pstn' = 'app', confirmPstn = false) => {
    setCallModal(null); setCalling(elder.id); setCallResult(null);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    const viaPhone = channel === 'pstn';
    try {
      const res = await authFetch(`${SERVER_URL}/call/app`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        // 어르신 상세의 전화 버튼은 **평소 안부 통화**다. 경보 필드를 싣지 않는다 —
        // 예전에는 activeAlert(전화 멘트 관리 화면에서 편집 중인 경보, 날씨로 자동 선택됨)를
        // 그대로 실어서, 그냥 전화를 걸어도 호우 경보 안내가 나갔다(2026-08-21 지적).
        // 경보 발신은 전화 멘트 관리 화면의 경보 발신 버튼으로만 나간다.
        body: JSON.stringify({
          channel,
          confirmPstn,
          phone:        elder.phone,
          elderName:    elder.name,
          elderTitle:   elder.title || '어르신',
          region:       elder.region,
          script:       mainScript,
        }),
      });
      const data = await res.json();
      // 앱 토큰이 아직 없는 어르신(방금 재등록 등) — 확인 없이 실전화로 조용히 넘어가던 문제(2026-08-20)
      // 방지: 여기서 한 번 물어보고, 승낙하면 confirmPstn:true로 같은 요청을 다시 보낸다.
      if (data.needsConfirm) {
        setCalling(null);
        if (window.confirm(data.error || '이 어르신은 앱 토큰이 없어요. 실제 전화로 걸까요?')) {
          await makeCall(elder, channel, true);
        }
        return;
      }
      if (data.success) {
        setElders(prev => prev.map(e => e.id===elder.id?{...e,lastCall:`오늘 ${timeStr}`}:e));
        if (selected?.id===elder.id) setSelected(prev=>({...prev,lastCall:`오늘 ${timeStr}`}));
        setCallResult({elderId:elder.id, status:'success',
          message:`${elder.name} ${elder.title||'어르신'} ${viaPhone ? '전화 발신 완료' : '앱으로 수신 알림 전송 완료'}`});
      } else {
        setCallResult({elderId:elder.id, status:'error',
          message:`${viaPhone ? '전화 발신 실패' : '앱 알림 전송 실패'}: ${errMsg(data)}`});
      }
    } catch {
      setCallResult({elderId:elder.id, status:'error', message:'서버 연결 실패.'});
    } finally { setCalling(null); }
  };

  const toggleCallActive = id => {
    const tgt = elders.find(e=>e.id===id);
    if (!tgt) return;
    const next = !tgt.callActive;
    setElders(prev=>prev.map(e=>e.id===id?{...e,callActive:next}:e));
    if (selected?.id===id) setSelected(prev=>({...prev,callActive:next}));
    // 서버에 영구 저장(누락 시 새로고침마다 재개로 되돌아가던 버그). phone 키로 callActive만 merge, 승인상태 보존.
    if (tgt.phone) authFetch(`${SERVER_URL}/elders/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: tgt.phone, callActive: next, approved: tgt.approved }) }).catch(()=>{});
  };

  const validateStep = step => {
    const errors: any = {};
    if (step===1) { if(!form.name.trim()) errors.name='이름을 입력하세요'; if(!form.age) errors.age='나이를 입력하세요'; if(!form.phone.trim()) errors.phone='전화번호를 입력하세요'; if(!form.address.trim()) errors.address='주소를 입력하세요'; }
    if (step===2) { if(!form.guardian.trim()) errors.guardian='보호자 이름을 입력하세요'; if(!form.guardianPhone.trim()) errors.guardianPhone='보호자 연락처를 입력하세요'; }
    setFormErrors(errors); return Object.keys(errors).length===0;
  };
  const nextStep = () => { if(validateStep(formStep)) setFormStep(s=>s+1); };
  const saveElder = () => {
    let saved;
    // 수정 전 번호 — 서버 문서 ID가 전화번호라, 번호를 바꾸면 옛 문서가 남아 목록에 중복으로 뜨고
    // 그쪽을 고르면 옛 번호로 전화가 간다. 서버가 옛 문서를 지울 수 있게 함께 보낸다.
    const prevPhone = editMode ? (elders.find(e=>e.id===form.id)?.phone ?? '') : '';
    if (editMode) { saved = {...form, prevPhone}; setElders(prev=>prev.map(e=>e.id===form.id?{...e,...form}:e)); setSelected(prev=>({...prev,...form})); }
    else { saved = {...form,id:Date.now(),status:'normal',lastCall:'아직 없음',keyword:null,visits:0,age:parseInt(form.age),callActive:true}; setElders(prev=>[...prev,saved]); }
    // 자동연동: 서버 elders에 저장 → 앱이 어르신 전화번호로 조회
    authFetch(`${SERVER_URL}/elders/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(saved) })
      .then(r=>r.json())
      .then(d=>{
        if (d && d.success) {
          // 번호가 바뀌면 서버에서 문서 ID가 통째로 달라진다(옛 문서는 서버가 정리).
          // 낙관적 반영본은 옛 번호를 들고 있으므로 반드시 서버 목록으로 덮어써야 한다.
          if (prevPhone && String(prevPhone).replace(/\D/g,'') !== String(form.phone||'').replace(/\D/g,'')) {
            setChecked([]);            // 옛 id 로 잡힌 발신 대상 선택을 해제
            setSelectedElders(new Set());
          }
          fetchElders();
        } else {
          const m = errMsg(d, '어르신 저장 실패');
          // 다른 기관에 이미 등록된 번호 → 담당자에게 이관 등록 여부를 중앙 모달로 확인
          if (/다른 기관/.test(m)) setForceReg({ payload: saved });
          else notify(m, 'info');
        }
      })
      .catch(()=>{});
    setSaveSuccess(true);
    setTimeout(()=>{setSaveSuccess(false);setPage(editMode?'detail':'elders');},1800);
  };
  // '다른 기관 어르신' 확인 후 강제(이관) 등록
  const [forceReg, setForceReg] = useState<any>(null);
  const confirmForceReg = async () => {
    const payload = forceReg?.payload; setForceReg(null);
    if (!payload) return;
    try {
      const r = await authFetch(`${SERVER_URL}/elders/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...payload, force: true }) });
      const d = await r.json();
      if (d && d.success) { notify(`${payload.name||''} 어르신이 우리 기관으로 등록되었습니다.`, 'success'); }
      else notify(errMsg(d, '어르신 저장 실패'), 'info');
    } catch { notify('네트워크 오류 — 잠시 후 다시 시도해 주세요.'); }
    fetchElders();
  };
  const deleteElder = id => { if(window.confirm('정말 삭제하시겠습니까?')){const tgt=elders.find(e=>e.id===id);setElders(prev=>prev.filter(e=>e.id!==id));if(tgt?.phone)authFetch(`${SERVER_URL}/elders/${tgt.phone.replace(/[^0-9]/g,'')}`,{method:'DELETE'}).catch(()=>{});setPage('elders');setSelected(null);} };
  // 어르신 선택/일괄 삭제
  const toggleElderSel = id => setSelectedElders(prev=>{const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s;});
  const toggleAllElders = (list) => setSelectedElders(prev=>{const s=new Set(prev); const all=list.length>0&&list.every(e=>s.has(e.id)); list.forEach(e=> all?s.delete(e.id):s.add(e.id)); return s;});
  const deleteSelectedElders = async () => {
    if(selectedElders.size===0) return;
    const targets=elders.filter(e=>selectedElders.has(e.id));
    if(!window.confirm(`선택한 ${targets.length}명을 어르신 명단에서 삭제할까요?`)) return;
    setElders(prev=>prev.filter(e=>!selectedElders.has(e.id)));   // 낙관적
    setSelectedElders(new Set());
    try { await Promise.all(targets.map(t=> t.phone ? authFetch(`${SERVER_URL}/elders/${String(t.phone).replace(/[^0-9]/g,'')}`,{method:'DELETE'}) : Promise.resolve())); } catch {}
    fetchElders();
  };

  // ── CSV 일괄 등록 ──
  const CSV_HEADERS = ['이름','전화번호','나이','성별(남/여)','호칭(할머니/할아버지)','지역','담당복지사','전화시간(예 09:00)','보호자','보호자연락처','질환','복약','돌봄군(일반/중점)'];
  const downloadCsvTemplate = () => {
    const example = ['홍복순','010-1234-5678','82','여','할머니','대구 북구','김복지','09:00','홍길동','010-8765-4321','고혈압','혈압약 아침'].join(',');
    const csv = '﻿' + CSV_HEADERS.join(',') + '\n' + example + '\n';   // BOM: 엑셀에서 한글 안 깨짐
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
    a.download = '영실이_어르신_등록양식.csv'; a.click();
  };
  const parseCsv = (text) => {
    const rows=[]; let row=[], cur='', q=false;
    for (let i=0;i<text.length;i++){ const ch=text[i];
      if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
      else if(ch==='"'){ q=true; }
      else if(ch===','){ row.push(cur); cur=''; }
      else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else if(ch!=='\r'){ cur+=ch; }
    }
    if(cur!==''||row.length){ row.push(cur); rows.push(row); }
    return rows.filter(r=>r.some(c=>String(c).trim()));
  };
  const handleCsvFile = async (file) => {
    if(!file) return;
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if(/�/.test(text)){ try{ text = new TextDecoder('euc-kr').decode(buf); }catch{} }   // 한글 깨지면 cp949로 재디코딩
    const rows = parseCsv(text);
    if(rows.length<2){ notify('데이터가 없습니다. 양식에 어르신 정보를 채워 주세요.'); return; }
    const alias = {'이름':'name','성함':'name','성명':'name','전화번호':'phone','연락처':'phone','휴대폰':'phone','전화':'phone','나이':'age','연세':'age','성별':'gender','호칭':'title','지역':'region','주소':'region','담당복지사':'caregiver','담당':'caregiver','복지사':'caregiver','전화시간':'callTime','시간':'callTime','보호자':'guardian','보호자연락처':'guardianPhone','보호자전화':'guardianPhone','질환':'disease','병력':'disease','복약':'medicine','약':'medicine','돌봄군':'careGroup'};
    const colIdx: any = {};
    rows[0].forEach((h,i)=>{ const base=String(h).replace(/^﻿/,'').replace(/\(.*?\)/g,'').replace(/\s/g,'').trim(); const k=alias[base]; if(k&&colIdx[k]===undefined)colIdx[k]=i; });
    if(colIdx.name===undefined||colIdx.phone===undefined){ notify('양식에 "이름"과 "전화번호" 열이 있어야 합니다. CSV 양식을 받아 사용해 주세요.'); return; }
    const existPhones = new Set(elders.map(e=>String(e.phone||'').replace(/\D/g,'')));
    const seen = new Set();
    // 엑셀에서 전화번호 열이 숫자로 인식되면 앞자리 0이 사라진다(01012345678→1012345678) —
    // 대시보드 미리보기는 통과해도 서버(isValidMobile, 010은 11자리 고정)가 거부해서
    // "이유 모를 등록 실패"로 보이던 문제(2026-08-27 실사용 지적). 010/011~019 패턴이면 복원한다.
    const restoreLeadingZero = (d) => /^1[016789]\d{6,8}$/.test(d) ? '0'+d : d;
    const parsed = rows.slice(1).map((r,ri)=>{
      const get=k=>colIdx[k]!==undefined?String(r[colIdx[k]]||'').trim():'';
      const name=get('name'); const phone=restoreLeadingZero(get('phone').replace(/\D/g,'')); const gender=/남/.test(get('gender'))?'male':'female';
      const rec={ name, phone, age:get('age').replace(/\D/g,''), gender, title:get('title')||(gender==='male'?'할아버지':'할머니'), region:normalizeRegion(get('region')), caregiver:get('caregiver'), callTime:/^\d{1,2}:\d{2}$/.test(get('callTime'))?get('callTime'):'09:00', guardian:get('guardian'), guardianPhone:restoreLeadingZero(get('guardianPhone').replace(/\D/g,'')), disease:get('disease'), medicine:get('medicine'), careGroup:/중점/.test(get('careGroup'))?'intensive':/일반/.test(get('careGroup'))?'general':'' };
      let st='ok', why='';
      if(!name){st='error';why='이름 없음';}
      else if(!phone||phone.length<9){st='error';why='전화번호 오류';}
      else if(seen.has(phone)){st='error';why='파일 내 중복';}
      else if(existPhones.has(phone)){st='dup';why='이미 등록됨';}
      seen.add(phone);
      return {...rec,_row:ri+2,_status:st,_reason:why};
    });
    setCsvOverwrite(false); setCsvImport({ rows: parsed });
  };
  const confirmCsvImport = async () => {
    const rows = csvImport.rows.filter(r=>r._status==='ok'||(r._status==='dup'&&csvOverwrite));
    if(rows.length===0){ notify('등록할 유효한 행이 없습니다.'); return; }
    setCsvSaving(true); let ok=0, fail=0; const failReasons=[];
    for(const r of rows){
      const saved={...EMPTY_FORM, name:r.name, phone:r.phone, age:r.age, gender:r.gender, title:r.title, region:r.region, caregiver:r.caregiver, callTime:r.callTime, guardian:r.guardian, guardianPhone:r.guardianPhone, disease:r.disease, medicine:r.medicine, careGroup:r.careGroup||'', ...(CARE_GROUPS[r.careGroup]?{callCycle:'custom',callDays:[...CARE_GROUPS[r.careGroup].days]}:{}), id:Date.now()+Math.floor(Math.random()*100000), status:'normal', lastCall:'아직 없음', callActive:true };
      // 실패 사유를 그냥 삼키면(2026-08-27 이전) "몇 명 실패"만 보이고 왜인지 알 길이 없었다 —
      // 서버 에러 메시지를 행 번호와 함께 모아서 보여준다(실사용 지적: 원인 불명 CSV 등록 실패).
      try{
        const res=await authFetch(`${SERVER_URL}/elders/save`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(saved)});
        const d=await res.json();
        if(d&&d.success) ok++;
        else { fail++; failReasons.push(`${r._row}행(${r.name}): ${d?.error?.message||d?.message||'등록 실패'}`); }
      }catch(e){ fail++; failReasons.push(`${r._row}행(${r.name}): ${e?.message||'네트워크 오류'}`); }
    }
    setCsvSaving(false); setCsvImport(null); await fetchElders();
    if(fail && failReasons.length) console.warn('[CSV 일괄등록] 실패 상세:', failReasons);
    notify(`등록 완료: 성공 ${ok}명${fail?` · 실패 ${fail}명 (${failReasons.slice(0,3).join('; ')}${failReasons.length>3?' 등':''})`:''}`, fail ? 'info' : 'success');
  };
  const inp = field => ({ value:form[field]??'', onChange:e=>setForm(f=>({...f,[field]:e.target.value})), className:`form-input ${formErrors[field]?'input-error':''}` });

  // 다음(카카오) 우편번호 검색 → 주소 자동입력 + 관할구역(시/구) 자동추출
  const openAddressSearch = () => {
    const SIDO = {'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','강원도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
    const run = () => {
      new window.daum.Postcode({ oncomplete: (data) => {
        const sido = SIDO[data.sido] || data.sido;
        setForm(f => ({ ...f, address: data.roadAddress || data.address, region: `${sido} ${data.sigungu}`.trim() }));
        setFormErrors(e => ({ ...e, address: '' }));
      }}).open();
    };
    if (window.daum && window.daum.Postcode) return run();
    const s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload = run;
    s.onerror = () => notify('주소 검색을 불러오지 못했습니다. 네트워크를 확인해 주세요.');
    document.body.appendChild(s);
  };

  // 홈 "오늘 통화 현황" — 서버 실통화(callsHistory)에서 오늘 날짜만 집계 (더미 폐지)
  const _todayStr = new Date().toLocaleDateString('sv-SE');  // YYYY-MM-DD (로컬/KST)
  const todayCalls = callsHistory.filter(c => c.date === _todayStr);
  const totalCalls = todayCalls.length;
  const criticalCount = todayCalls.filter(c=>c.riskLevel==='critical').length;
  const urgentCount   = todayCalls.filter(c=>c.riskLevel==='urgent'||c.riskLevel==='warning').length;
  const normalCount   = todayCalls.filter(c=>!c.riskLevel||c.riskLevel==='normal').length;
  // 오늘 발신(dispatches) 집계 — 발신 이력과 일치하게: 발신 = 받음 + 부재중(+실패)
  const todayDispatches = dispatchHist.filter(d => (d.sentAtIso||'').slice(0,10) === _todayStr);
  const dispatchTotal = todayDispatches.length;
  const answeredCount = todayDispatches.filter(d => d.status==='completed'||d.status==='answered').length;
  const missedCount   = todayDispatches.filter(d => d.status==='missed').length;
  // 오늘 안전확인 집계 (홈 보드 + 안전확인 관리 페이지 공용)
  const safetyToday = () => {
    const norm = (p) => String(p || '').replace(/\D/g, '');
    const okPhones = new Set(todayCalls.map(c => norm(c.phone)).filter(Boolean));
    todayDispatches.forEach(d => { if (d.status === 'completed' || d.status === 'answered') okPhones.add(norm(d.phone)); });
    const lastDisp = {};
    todayDispatches.forEach(d => { const p = norm(d.phone); if (!p) return; const prev = lastDisp[p]; if (!prev || (d.sentAtIso || '') > (prev.sentAtIso || '')) lastDisp[p] = d; });
    const active = elders.filter(e => e.callActive !== false && norm(e.phone));
    const unchecked = active.filter(e => !okPhones.has(norm(e.phone))).map(e => ({ e, d: lastDisp[norm(e.phone)] })).filter(x => x.d && (x.d.status === 'missed' || x.d.status === 'failed'));
    const undialed = active.filter(e => !okPhones.has(norm(e.phone)) && !lastDisp[norm(e.phone)]).length;
    const checkedCount = active.filter(e => okPhones.has(norm(e.phone))).length;
    return { unchecked, undialed, checkedCount, activeCount: active.length };
  };
  // 통화기록 위험도 필터 매칭 (KPI 드릴다운)
  const callsRiskMatch = (c) => callsRisk==='all' ? true : callsRisk==='critical' ? c.riskLevel==='critical' : callsRisk==='urgent' ? (c.riskLevel==='urgent'||c.riskLevel==='warning') : (!c.riskLevel||c.riskLevel==='normal');
  // KPI 클릭 → 상세로 이동(+필터). 위험도는 오늘 범위로 좁혀 KPI 숫자와 일치.
  const drillCalls = (risk) => { setCallsRisk(risk); setCallsRange('custom'); setCallsFrom(_todayStr); setCallsTo(_todayStr); goPage('calls'); };
  const drillDispatch = (status) => { setHistStatus(status); setHistDays(7); goPage('schedule'); };

  // 목록 빈 상태 — '미등록'과 '검색·필터 결과 없음'은 원인이 다르므로 문구·행동을 분리한다.
  const EldersEmpty = () => {
    const filtering = !!searchName || regionFilter !== '전체' || filter !== 'all';
    if (filtering) return (
      <EmptyState title={`조건에 맞는 ${T.elder} 정보가 없습니다`} description="검색어나 필터를 바꾸면 다른 결과를 볼 수 있습니다." actions={
          <button className="btn-secondary" onClick={()=>{ setSearchName(''); setRegionFilter('전체'); setFilter('all'); }}>필터 초기화</button>
      } />
    );
    return (
      <EmptyState title={`아직 등록된 ${T.elder} 정보가 없습니다`} description={<>등록하면 자동 안부전화 대상이 되고, 통화·건강 기록이 이 목록에 쌓입니다.<br/>여러 명은 CSV로 한 번에 등록할 수 있습니다.</>} actions={<>
          <button className="btn-primary" onClick={openRegister}>신규 등록</button>
          <button className="btn-secondary" onClick={downloadCsvTemplate}>CSV 양식 받기</button>
      </>} />
    );
  };

  // ── 로그인/회원가입 가드 ──
  // 1) 미로그인 → 로그인/회원가입  2) 로그인했지만 이메일 미인증 → 인증대기  3) 기관 미설정 → 기관설정
  if (authEnabled && !authChecked) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b'}}>로딩 중…</div>;
  // 이메일 미인증은 차단하지 않음(리마인더 배너로 안내). 미로그인/기관미설정만 차단.
  if (authEnabled && (!authUser || me?.needsProvision)) {
    return <AuthScreen authUser={authUser} needsProvision={me?.needsProvision} authFetch={authFetch} serverUrl={SERVER_URL} onReload={reloadUser} onProvisioned={fetchMe} />;
  }
  // 선불 충전식 크레딧(1단계) — 잔액 0 이하면 서버(OrgGuard)가 다른 요청을 전부 403으로
  // 막으므로, 화면도 "왜 막혔는지"를 바로 보여주고 다른 메뉴 진입을 막는다. superadmin(orgId='*')과
  // 잔액 미조회(billing===null, 로딩 중이거나 구기관=무제한)는 차단하지 않는다.
  const trialActive = !!billing?.trialEndsAt && new Date(billing.trialEndsAt).getTime() > Date.now();
  if (me && me.role !== 'superadmin' && billing && typeof billing.creditBalance === 'number' && billing.creditBalance <= 0 && !trialActive && !showUpgradeModal) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',padding:20}}>
        <div style={{maxWidth:420,background:'#fff',borderRadius:16,padding:'40px 32px',textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:40,marginBottom:12}}>💳</div>
          <h2 style={{margin:'0 0 8px',fontSize:20,fontWeight:800,color:'#0f172a'}}>충전 잔액이 없습니다</h2>
          <p style={{color:'#64748b',fontSize:15,lineHeight:1.6,margin:'0 0 24px'}}>
            {me.orgName || '소속 기관'}의 이용 크레딧이 없어 서비스 이용이 제한되어 있습니다.<br/>
            아래에서 바로 충전하시면 확인 후 이용하실 수 있습니다.
          </p>
          <div style={{background:'#f1f5f9',borderRadius:10,padding:'12px 16px',fontSize:14,color:'#334155',marginBottom:20}}>
            현재 잔액: <b>{billing.creditBalance.toLocaleString()}원</b>
          </div>
          <button className="btn-primary" style={{width:'100%',marginBottom:10}} onClick={()=>{ setUpgradeTab('metered'); setShowUpgradeModal(true); }}>충전하기</button>
          <button className="btn-secondary" style={{width:'100%'}} onClick={()=>{fetchBillingBalance();}}>새로고침</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 일괄 발신 확인 — 실제 전화가 나가는 되돌릴 수 없는 행위. 대상 수·멘트 종류를 다시 보여준다. */}
      {/* 하단 토스트 — notify() 공용. 화면을 가리지 않고 잠시 떴다 자동으로 사라진다 */}
      {toast && (
        <div className="toast-viewport">
          <div className={`toast toast--${toast.tone} ${toast.hiding ? 'toast--hiding' : ''}`} role="status" onClick={dismissToast}>
            {toast.tone === 'success' ? <CheckCircle2 size={18}/> : toast.tone === 'info' ? <AlertCircle size={18}/> : <AlertTriangle size={18}/>}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
      {/* 결제 접수 완료 — 실제 크레딧 반영은 서버 웹훅이 비동기로 처리하므로 "완료"가 아니라
          "접수" 상태를 보여준다(과장 방지). 결제 실패/네트워크 오류는 여전히 공용 notify()로. */}
      {paymentSuccess !== null && (
        <div className="modal-overlay" onClick={()=>setPaymentSuccess(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:380,width:'92%',textAlign:'center',padding:'36px 28px'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:'#ecfdf5',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
              <CheckCircle2 size={30} color="#16a34a"/>
            </div>
            <div style={{fontWeight:800,fontSize:18,color:'#0f172a',marginBottom:8}}>결제가 접수됐습니다</div>
            <div style={{fontSize:15,color:'#64748b',lineHeight:1.6,marginBottom:24}}>
              {paymentSuccess.desc}<br/>
              결제 확인 후 반영됩니다.
            </div>
            <button className="btn-primary" style={{width:'100%'}} onClick={()=>setPaymentSuccess(null)}>확인</button>
          </div>
        </div>
      )}
      {/* 무통장입금 계좌 발급 안내 — 카드/카카오페이와 달리 이 시점엔 아직 입금 전이라
          "완료"가 아니라 계좌 정보 + 입금 기한을 보여주고 명시적으로 안내한다. */}
      {virtualAccountInfo !== null && (
        <div className="modal-overlay" onClick={()=>setVirtualAccountInfo(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400,width:'92%',textAlign:'center',padding:'36px 28px'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
              <Database size={26} color="#246BEB"/>
            </div>
            <div style={{fontWeight:800,fontSize:18,color:'#0f172a',marginBottom:16}}>입금 계좌가 발급됐습니다</div>
            <div style={{background:'#f8fafc',borderRadius:12,padding:'16px 18px',textAlign:'left',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:13,color:'#64748b'}}>은행</span>
                <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{BANK_LABELS[virtualAccountInfo.bank] || virtualAccountInfo.bank || '-'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:13,color:'#64748b'}}>계좌번호</span>
                <span style={{fontSize:15,fontWeight:800,color:'#0f172a',fontFamily:'monospace'}}>{virtualAccountInfo.accountNumber}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:13,color:'#64748b'}}>예금주</span>
                <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{virtualAccountInfo.remitteeName || 'AI영실이'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:13,color:'#64748b'}}>입금액</span>
                <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{virtualAccountInfo.amount?.toLocaleString()}원</span>
              </div>
              {virtualAccountInfo.expiredAt && (
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,color:'#64748b'}}>입금 기한</span>
                  <span style={{fontSize:14,fontWeight:700,color:'#c5221f'}}>{new Date(virtualAccountInfo.expiredAt).toLocaleString('ko-KR')}</span>
                </div>
              )}
            </div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20,lineHeight:1.6}}>
              위 계좌로 입금하시면 확인 후 자동으로 크레딧에 반영됩니다.
            </div>
            <button className="btn-primary" style={{width:'100%'}} onClick={()=>setVirtualAccountInfo(null)}>확인</button>
          </div>
        </div>
      )}
      {/* 사이드바 크레딧 잔액 클릭 → 현재 플랜·남은 크레딧·정기결제(결제수단) 요약. 새 데이터를
          따로 안 받고 이미 떠 있는 billing·subStatus를 그대로 보여주는 조회 전용 모달이다. */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={()=>setShowPlanModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400,width:'92%',textAlign:'left',padding:0,overflow:'hidden',borderRadius:20}}>
            <div style={{
              background:'linear-gradient(135deg,#1e293b 0%,#334155 100%)',
              padding:'24px 24px 60px',position:'relative'
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,color:'#e2e8f0',fontSize:13,fontWeight:600,letterSpacing:0.2}}>
                  <Crown size={16} color="#fbbf24"/> 내 요금제
                </div>
                <button onClick={()=>setShowPlanModal(false)} style={{background:'rgba(255,255,255,0.1)',border:0,borderRadius:8,cursor:'pointer',color:'#cbd5e1',padding:5,display:'flex'}}><X size={16}/></button>
              </div>
              <div style={{marginTop:18,fontSize:20,fontWeight:800,color:'#fff'}}>
                {subStatus?.autoRenew
                  ? (UPGRADE_PLANS.find(p=>p.key===subStatus.plan)?.name || subStatus.plan)
                  : trialActive ? '시범사업(30일 체험)'
                  : '정량제(선불 충전)'}
              </div>
              {trialActive && !subStatus?.autoRenew && (
                <div style={{fontSize:12.5,color:'#94a3b8',marginTop:4}}>
                  체험 종료 {new Date(billing.trialEndsAt).toLocaleDateString('ko-KR')}까지
                </div>
              )}
            </div>

            <div style={{padding:'0 24px 24px'}}>
              <div style={{
                background:'#fff',border:'1px solid #eef1f5',borderRadius:16,padding:'18px 20px',
                marginTop:-40,marginBottom:16,boxShadow:'0 8px 24px -8px rgba(15,23,42,0.18)',position:'relative'
              }}>
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#94a3b8',fontWeight:600}}>
                  <Wallet size={14}/> 남은 크레딧
                </div>
                <div style={{fontSize:28,fontWeight:900,marginTop:6,letterSpacing:-0.5,color: billing?.creditBalance<=200?'#dc2626':'#0f172a'}}>
                  {typeof billing?.creditBalance === 'number' ? billing.creditBalance.toLocaleString() : '-'}
                  <span style={{fontSize:15,fontWeight:700,marginLeft:4,color:'#94a3b8'}}>원</span>
                </div>
                {billing?.creditBalance<=200 && (
                  <div style={{fontSize:12,color:'#dc2626',marginTop:6,fontWeight:600}}>잔액이 얼마 남지 않았어요</div>
                )}
              </div>

              <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'14px 4px',borderTop:'1px solid #f1f5f9'}}>
                <div style={{width:32,height:32,borderRadius:10,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <CreditCard size={16} color="#64748b"/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>결제수단(정기결제)</div>
                  {subStatus?.autoRenew ? (
                    <>
                      <div style={{fontSize:14.5,fontWeight:700,color:'#15803d',marginTop:2}}>등록됨 · 자동결제 중</div>
                      {subStatus.nextChargeAt && <div style={{fontSize:12.5,color:'#64748b',marginTop:3}}>다음 청구일 {new Date(subStatus.nextChargeAt).toLocaleDateString('ko-KR')}</div>}
                      {subStatus.monthlyAmount != null && <div style={{fontSize:12.5,color:'#64748b'}}>{subStatus.monthlyAmount.toLocaleString()}원/월</div>}
                      {subStatus.lastChargeError && <div style={{fontSize:12.5,color:'#c5221f',marginTop:3}}>최근 청구 실패: {subStatus.lastChargeError}</div>}
                    </>
                  ) : (
                    <div style={{fontSize:14,color:'#64748b',marginTop:2}}>등록 안 됨 · 정량제 충전으로만 이용 중</div>
                  )}
                </div>
              </div>

              <div style={{display:'flex',gap:8,marginTop:18}}>
                <button className="btn-primary" style={{flex:1}} onClick={()=>{ setShowPlanModal(false); setShowUpgradeModal(true); }}>충전·플랜 변경</button>
                <button className="btn-secondary" style={{flex:1}} onClick={()=>{ setShowPlanModal(false); setShowUpgradeModal(true); setUpgradeTab('history'); fetchPaymentHistory(); }}>결제 내역 보기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 요금제 업그레이드 — 요금 정책 v1.0(2026-08-28) §3(정량제)·§5(정액제 4등급). 1단계(포트원
          연동 전)라 "신청 접수"만 하고 실제 충전·플랜 전환은 담당자가 후속 처리한다. */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={()=>setShowUpgradeModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:920,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
              <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>요금제 선택</div>
              <button onClick={()=>setShowUpgradeModal(false)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:18}}>
              {[['metered','정량제'],['flat','정액제'],['history','결제 내역']].map(([k,label])=>(
                <button key={k} onClick={()=>{ setUpgradeTab(k); if (k==='history') fetchPaymentHistory(); }} style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(upgradeTab===k?'#246BEB':'#e2e8f0'),background:upgradeTab===k?'#eff6ff':'#fff',color:upgradeTab===k?'#246BEB':'#64748b',fontWeight:700,fontSize:14,cursor:'pointer'}}>{label}</button>
              ))}
            </div>

            {upgradeTab==='metered' ? (<>
              <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
                발신 시도마다 <b>발신 기본료 40원</b> + 실제 연결된 통화에만 <b>통화 요금</b>이 충전액에서 차감됩니다.
                발신이 없는 달은 차감도 청구도 없습니다(VAT 별도). 아래는 대표적인 충전 단위입니다 — 원하는 금액을 직접 입력해도 됩니다.
              </p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:14}}>
                {CHARGE_TIERS.map(c=>(
                  <div key={c.key} style={{border:c.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{fontWeight:900,fontSize:22,color:'#0f172a'}}>{c.amount.toLocaleString()}원</div>
                    <div style={{fontSize:14,fontWeight:700,color:'#246BEB'}}>{c.calls} 도달(3분 통화 기준)</div>
                    <div style={{fontSize:13,color:'#475467',lineHeight:1.5,flex:1}}>{c.usage}</div>
                    <button
                      className="btn-primary"
                      style={{width:'100%'}}
                      onClick={()=>setPendingTopup({amount:c.amount})}
                    >신청</button>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',marginTop:16}}>
                <input
                  className="form-input"
                  style={{marginBottom:0,flex:1}}
                  type="number"
                  min={10000}
                  step={1000}
                  placeholder="직접 입력(원, 10,000원 이상)"
                  value={customAmount}
                  onChange={e=>setCustomAmount(e.target.value)}
                />
                <button
                  className="btn-secondary"
                  disabled={!customAmount || Number(customAmount) < 10000}
                  onClick={()=>setPendingTopup({amount:Number(customAmount)})}
                >직접 충전</button>
              </div>
              {/* 실결제 파이프라인(포트원 연동·웹훅) 자체가 살아있는지 실제 결제해 확인하는
                  테스트 버튼 — 서버가 amount===1000만 예외로 허용한다(일반 충전 최소단위는 그대로
                  유지). 처음엔 1원으로 뒀는데 PG사 최소 결제금액 미만이라 결제가 안 돼 1,000원으로 조정. */}
              <button
                className="btn-secondary"
                style={{marginTop:8,fontSize:12,color:'#94a3b8'}}
                onClick={()=>setPendingTopup({amount:1000})}
              >1,000원 테스트 결제</button>
              <p style={{color:'#94a3b8',fontSize:12,margin:'18px 0 0'}}>정확한 채널 배정·이용 패턴별 견적은 담당 매니저에게 문의해 주세요.</p>
            </>) : upgradeTab==='flat' ? (<>
              <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
                예산을 매월 고정해야 하는 기관을 위한 인·월 정액 요금제입니다(앱 설치 방식 기준, VAT 별도).
              </p>
              {subStatus?.autoRenew && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:16,flexWrap:'wrap'}}>
                  <div style={{fontSize:14,color:'#1e3a6e'}}>
                    <b>{UPGRADE_PLANS.find(p=>p.key===subStatus.plan)?.name || subStatus.plan}</b> 플랜 자동결제 중
                    {subStatus.nextChargeAt && <> · 다음 청구일 {new Date(subStatus.nextChargeAt).toLocaleDateString('ko-KR')}</>}
                    {subStatus.monthlyAmount != null && <> · {subStatus.monthlyAmount.toLocaleString()}원/월</>}
                    {subStatus.lastChargeError && <div style={{color:'#c5221f',marginTop:4}}>최근 청구 실패: {subStatus.lastChargeError}</div>}
                  </div>
                  <button className="btn-secondary" style={{fontSize:13,padding:'6px 14px',color:'#c5221f',flexShrink:0}} disabled={subCancelBusy} onClick={cancelSubscription}>
                    {subCancelBusy ? '처리 중...' : '자동결제 해지'}
                  </button>
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))',gap:14}}>
                {UPGRADE_PLANS.map(p=>{
                  const isCurrent = subStatus?.autoRenew && subStatus.plan === p.key;
                  return (
                  <div key={p.key} style={{border:isCurrent?'2px solid #1e8e3e':p.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:12}}>
                    <div style={{fontWeight:800,fontSize:16,color:'#0f172a'}}>{p.name}</div>
                    <div><span style={{fontWeight:900,fontSize:22,color:'#0f172a'}}>{p.price}</span><span style={{fontSize:13,color:'#94a3b8',marginLeft:4}}>/{p.unit}</span></div>
                    <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:6,flex:1}}>
                      {p.features.map(f=>(
                        <li key={f} style={{fontSize:13,color:'#475467',display:'flex',gap:6,alignItems:'flex-start'}}>
                          <CheckCircle2 size={14} color="#246BEB" style={{flexShrink:0,marginTop:2}}/>{f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <div style={{width:'100%',textAlign:'center',fontSize:13,fontWeight:700,color:'#1e8e3e',background:'#e6f4ea',borderRadius:10,padding:'9px 0'}}>자동결제 중</div>
                    ) : (
                      // 2026-09-01: 이니시스 정기결제 채널 연동으로 빌링키 발급이 가능해져
                      // startSubscription() 실결제 흐름을 다시 켠다(trial은 결제 없이 startTrial()).
                      // 2026-09-04: trial 카드가 "신청 접수" 토스트만 띄우고 실제로 아무 것도 안
                      // 바꾸던 문제 수정 — POST /billing/start-trial로 실제 30일 체험을 시작한다.
                      <button
                        className="btn-primary"
                        style={{width:'100%'}}
                        disabled={subscribeBusy === p.key || (p.key === 'trial' && !!billing?.trialEndsAt)}
                        onClick={()=> p.key === 'trial' ? startTrial() : startSubscription(p.key, p.name)}
                      >{subscribeBusy === p.key ? '처리 중...' : (p.key === 'trial' && billing?.trialEndsAt) ? '이미 시작됨' : '신청'}</button>
                    )}
                  </div>
                  );
                })}
              </div>
              <p style={{color:'#94a3b8',fontSize:12,margin:'18px 0 0'}}>정액제 세부 조건은 담당 매니저에게 문의해 주세요.</p>
            </>) : (<>
              <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
                크레딧 충전·정액제 결제 내역입니다. 완료된 크레딧 충전 건은 환불을 요청할 수 있습니다(실제 처리는 담당자 확인 후 진행됩니다).
              </p>
              {paymentHistoryLoading ? (
                <div style={{color:'#94a3b8',fontSize:14,padding:'20px 4px'}}>불러오는 중...</div>
              ) : paymentHistory.length === 0 ? (
                <div style={{color:'#94a3b8',fontSize:14,padding:'20px 4px'}}>결제 내역이 없습니다</div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                    <thead><tr style={{textAlign:'left',color:'#94a3b8',borderBottom:'1px solid #e2e8f0'}}>
                      <th style={{padding:'8px 10px',fontWeight:600}}>시각</th><th style={{padding:'8px 10px',fontWeight:600}}>종류</th>
                      <th style={{padding:'8px 10px',fontWeight:600}}>금액</th><th style={{padding:'8px 10px',fontWeight:600}}>상태</th><th style={{padding:'8px 10px',fontWeight:600}}></th>
                    </tr></thead>
                    <tbody>{paymentHistory.map((p:any)=>{
                      const canRequest = p.status==='paid' && p.type!=='subscription' && !p.refundRequestStatus;
                      return (
                      <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'10px',color:'#94a3b8'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                        <td style={{padding:'10px'}}>{p.type==='subscription' ? `정액제${p.planKey?`(${p.planKey})`:''}` : '크레딧 충전'}</td>
                        <td style={{padding:'10px',fontWeight:700}}>{p.amount.toLocaleString()}원</td>
                        <td style={{padding:'10px'}}>
                          {p.status==='cancelled' ? <span style={{color:'#94a3b8'}}>환불됨</span>
                            : p.refundRequestStatus==='pending' ? <span style={{color:'#754d00'}}>환불 요청됨</span>
                            : p.refundRequestStatus==='rejected' ? <span style={{color:'#c5221f'}}>환불 거절됨</span>
                            : p.status==='paid' ? <span style={{color:'#1e8e3e'}}>완료</span>
                            : <span style={{color:'#94a3b8'}}>{p.status}</span>}
                        </td>
                        <td style={{padding:'10px'}}>
                          {canRequest && (
                            <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px'}}
                              onClick={()=>{ setRefundTarget({id:p.id, amount:p.amount}); setRefundReasonPreset(REFUND_REASON_PRESETS[0]); setRefundReasonCustom(''); }}
                            >환불 요청</button>
                          )}
                        </td>
                      </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}
            </>)}
          </div>
        </div>
      )}
      {/* 환불 요청 — 프리셋 사유 5개 + 직접 입력. 실제 환불은 담당자 승인 후 처리됨(요청만 접수) */}
      {refundTarget !== null && (
        <div className="modal-overlay" onClick={()=>!refundRequestBusy && setRefundTarget(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420,width:'92%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>환불 요청</div>
              <button onClick={()=>setRefundTarget(null)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
            </div>
            <div style={{fontSize:14,color:'#64748b',marginBottom:18}}>
              <b style={{color:'#0f172a',fontSize:20,fontWeight:900}}>{refundTarget.amount.toLocaleString()}원</b> 결제 건 환불 요청
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'#475467',marginBottom:8}}>환불 사유</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
              {REFUND_REASON_PRESETS.map(reason=>(
                <button key={reason} onClick={()=>setRefundReasonPreset(reason)}
                  style={{textAlign:'left',padding:'10px 14px',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:refundReasonPreset===reason?700:500,
                    border:'2px solid '+(refundReasonPreset===reason?'#246BEB':'#e2e8f0'),background:refundReasonPreset===reason?'#eff6ff':'#fff',color:refundReasonPreset===reason?'#246BEB':'#0f172a'}}
                >{reason}</button>
              ))}
            </div>
            {refundReasonPreset==='직접 입력' && (
              <textarea className="form-input" style={{width:'100%',minHeight:70,marginBottom:14,boxSizing:'border-box'}} placeholder="환불 사유를 입력해 주세요"
                value={refundReasonCustom} onChange={e=>setRefundReasonCustom(e.target.value)} />
            )}
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:18}}>요청 후 담당자 확인을 거쳐 실제 환불·크레딧 회수가 진행됩니다.</div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
              <button className="btn-primary" style={{width:'100%'}} disabled={refundRequestBusy} onClick={submitRefundRequest}>
                {refundRequestBusy ? '요청 중...' : '환불 요청 보내기'}
              </button>
              <button style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:14,fontWeight:600,padding:4}} disabled={refundRequestBusy} onClick={()=>setRefundTarget(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
      {/* 결제수단 선택 — "신청"/"직접 충전" 클릭 시 여기서 수단을 고르고 "결제하기"를 눌러야
          실제 결제창(PortOne.js)이 뜬다. 요금제 모달 위에 겹쳐서 뜬다. */}
      {pendingTopup !== null && (
        <div className="modal-overlay" onClick={()=>!topupBusy && setPendingTopup(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420,width:'92%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>결제 수단 선택</div>
              <button onClick={()=>setPendingTopup(null)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
            </div>
            <div style={{fontSize:14,color:'#64748b',marginBottom:18}}>
              <b style={{color:'#0f172a',fontSize:20,fontWeight:900}}>{pendingTopup.amount.toLocaleString()}원</b> 충전
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:22}}>
              {PAY_METHOD_OPTIONS.map(m=>{
                const Icon = m.icon;
                const selected = topupPayMethod===m.key;
                return (
                  <button key={m.key} onClick={()=>setTopupPayMethod(m.key)}
                    style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,padding:'14px',borderRadius:12,cursor:'pointer',textAlign:'left',
                      border:'2px solid '+(selected?'#246BEB':'#e2e8f0'),background:selected?'#eff6ff':'#fff'}}>
                    <Icon size={22} color={selected?'#246BEB':'#64748b'}/>
                    <div style={{fontSize:14,fontWeight:800,color:selected?'#246BEB':'#0f172a'}}>{m.label}</div>
                    <div style={{fontSize:12,color:'#94a3b8'}}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
              <button className="btn-primary" style={{width:'100%'}} disabled={topupBusy} onClick={async ()=>{ const amt = pendingTopup.amount; await startTopup(amt); setPendingTopup(null); }}>
                {topupBusy ? '처리 중...' : '결제하기'}
              </button>
              <button
                style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:14,fontWeight:600,padding:4}}
                disabled={topupBusy}
                onClick={()=>setPendingTopup(null)}
              >취소</button>
            </div>
          </div>
        </div>
      )}
      {/* 다른 기관 어르신 → 이관 등록 확인 (중앙) */}
      {forceReg && <Dialog open alert tone="danger" className="modal--confirm" title="이미 다른 기관에 등록된 어르신입니다"
        description="같은 전화번호가 다른 기관에 등록되어 있습니다. 그래도 등록하면 이 어르신은 우리 기관 소속으로 이관되며, 기존 기관에서는 더 이상 보이지 않게 됩니다."
        onClose={()=>{ setForceReg(null); fetchElders(); }} actions={<>
        <button className="btn-secondary" onClick={()=>{ setForceReg(null); fetchElders(); }}>취소</button>
        <button className="btn-primary" onClick={confirmForceReg}>그래도 등록</button>
      </>} />}
      {bulkConfirm && <Dialog open title={`${bulkConfirm.count}명에게 지금 전화를 발신합니다`} alert tone={bulkConfirm.isAlert?'danger':'default'} className="modal--confirm" onClose={()=>setBulkConfirm(null)} actions={<>
              <Button onClick={()=>setBulkConfirm(null)}>취소</Button>
              <Button variant="primary" onClick={()=>{ const q = bulkConfirm.queue; const ch = bulkConfirm.channel || 'app'; const wa = !!bulkConfirm.isAlert; setBulkConfirm(null); startBulkCall(q, ch, wa); }}>발신 시작</Button>
            </>}>
            <div className="confirm-facts">
              <div className="confirm-row"><span>대상</span><b>{bulkConfirm.count}명</b></div>
              <div className="confirm-row"><span>내용</span><b>{bulkConfirm.alertLabel || '일반 안부 통화'}</b></div>
              {bulkConfirm.count > batchSize && (
                <div className="confirm-row"><span>발신 방식</span><b>
                  {bulkConfirm.channel === 'pstn'
                    ? `${batchSize}명씩 동시 발신, 배치 간 ${batchIntervalSec}초 대기`
                    : `${batchSize}명씩 ${batchIntervalSec}초 간격`}
                </b></div>
              )}
            </div>
            {/* 경보 통화만 선택지가 생긴다 — 경보만 전할지, 안부 질문까지 이어갈지 */}
            {bulkConfirm.isAlert && (
              <div style={{marginTop:14,padding:'12px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10}}>
                <div style={{fontSize:16,fontWeight:700,color:'#334155',marginBottom:8}}>통화 내용 선택</div>
                {[
                  { v:false, t:'경보 멘트만',        d:'경보를 전하고 이해하셨는지 확인한 뒤 끊습니다. (약 3분)' },
                  { v:true,  t:'경보 + 안부 질문',   d:'경보를 먼저 전하고, 이어서 평소 안부 질문까지 여쭙니다. (약 5분)' },
                ].map(o => (
                  <label key={String(o.v)} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'8px 4px',cursor:'pointer'}}>
                    <input type="radio" name="alertFlow" checked={alertIncludeCare===o.v} onChange={()=>setAlertIncludeCare(o.v)} style={{marginTop:3}} />
                    <span>
                      <span style={{fontSize:17,fontWeight:600,color:'#1f2937'}}>{o.t}</span>
                      <span style={{display:'block',fontSize:15,color:'#64748b',marginTop:2}}>{o.d}</span>
                    </span>
                  </label>
                ))}
                {activeAlert==='wildfire' && wildfireStage==='evacuate' && alertIncludeCare && (
                  <div style={{fontSize:15,color:'#b45309',marginTop:6,lineHeight:1.5}}>
                    긴급 대피 단계에서는 어르신이 빨리 움직이셔야 해서 <b>안부 질문을 생략</b>하고 경보만 안내합니다.
                  </div>
                )}
              </div>
            )}
            <div className={`confirm-warn ${bulkConfirm.isAlert ? 'is-alert' : ''}`}>
              {bulkConfirm.isAlert
                ? '경보 멘트는 어르신에게 대피·안전 행동을 안내합니다. 대상과 단계를 반드시 확인해 주세요.'
                : bulkConfirm.channel === 'pstn'
                  ? '발신하면 어르신 전화로 실제 전화가 걸립니다. 시작 후에는 남은 발신만 중단할 수 있습니다.'
                  : '발신하면 어르신 휴대폰에 실제로 수신 알림이 갑니다. 시작 후에는 남은 발신만 중단할 수 있습니다.'}
            </div>
          </Dialog>}
      {callModal && <Dialog open title={<>{callModal.name} 어르신 앱으로<br/>수신 알림을 보내시겠습니까?</>} description="영실이 앱 → 수신화면 표시 → 받기 클릭 → AI 영실이 대화" onClose={()=>setCallModal(null)} actions={<>
              <Button onClick={()=>setCallModal(null)}>취소</Button>
              <Button variant="call" onClick={()=>makeCall(callModal)}>앱으로 알림 보내기</Button>
            </>} />}

      {csvImport && (
        <div className="modal-overlay" onClick={()=>!csvSaving&&setCsvImport(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:860,width:'95%',textAlign:'left'}}>
            <div className="modal-title" style={{textAlign:'left',marginBottom:8}}>CSV 일괄 등록 미리보기</div>
            {(()=>{
              const ok=csvImport.rows.filter(r=>r._status==='ok').length;
              const dup=csvImport.rows.filter(r=>r._status==='dup').length;
              const err=csvImport.rows.filter(r=>r._status==='error').length;
              const willRegister=ok+(csvOverwrite?dup:0);
              return (<>
                <div style={{fontSize:16,marginBottom:12,display:'flex',gap:14,flexWrap:'wrap'}}>
                  <span style={{color:'#16a34a',fontWeight:700}}>등록 {ok}</span>
                  <span style={{color:'#f59e0b',fontWeight:700}}>중복 {dup}</span>
                  <span style={{color:'#dc2626',fontWeight:700}}>오류 {err}</span>
                  <span style={{color:'#64748b'}}>· 총 {csvImport.rows.length}행</span>
                </div>
                <div style={{maxHeight:'50vh',overflowY:'auto',border:'1px solid #e2e8f0',borderRadius:10}}>
                  <table className="table" style={{margin:0}}>
                    <thead><tr><th>행</th><th>상태</th><th>이름</th><th>전화번호</th><th>나이</th><th>지역</th><th>담당</th></tr></thead>
                    <tbody>
                      {csvImport.rows.map((r,i)=>{
                        const c=r._status==='ok'?{t:'등록',bg:'#f0fdf4',col:'#16a34a'}:r._status==='dup'?{t:'중복',bg:'#fffbeb',col:'#f59e0b'}:{t:'오류',bg:'#fef2f2',col:'#dc2626'};
                        return (<tr key={i} style={{background:c.bg}}>
                          <td style={{color:'#94a3b8',fontSize:15}}>{r._row}</td>
                          <td><span style={{fontSize:15,fontWeight:700,color:c.col}}>{c.t}{r._reason?` · ${r._reason}`:''}</span></td>
                          <td><strong>{r.name||'—'}</strong></td>
                          <td style={{fontSize:16}}>{r.phone||'—'}</td>
                          <td style={{fontSize:16}}>{r.age||'—'}</td>
                          <td style={{fontSize:16,color:'#64748b'}}>{r.region||'—'}</td>
                          <td style={{fontSize:16,color:'#64748b'}}>{r.caregiver||'—'}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                {dup>0 && (
                  <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12,fontSize:16,color:'#334155',cursor:'pointer'}}>
                    <input type="checkbox" checked={csvOverwrite} onChange={e=>setCsvOverwrite(e.target.checked)}/>
                    이미 등록된 어르신(중복 {dup}명)도 <b>덮어쓰기</b>로 갱신
                  </label>
                )}
                <div style={{fontSize:15,color:'#94a3b8',marginTop:10}}>· 오류 행은 등록에서 제외됩니다. 한글이 깨지면 엑셀에서 "CSV UTF-8"로 저장해 주세요.</div>
                <div className="modal-btns" style={{marginTop:16,justifyContent:'flex-end'}}>
                  <button className="btn-secondary" disabled={csvSaving} onClick={()=>setCsvImport(null)}>취소</button>
                  <button className="btn-primary" disabled={csvSaving||willRegister===0} onClick={confirmCsvImport}>{csvSaving?'등록 중...':`${willRegister}명 등록`}</button>
                </div>
              </>);
            })()}
          </div>
        </div>
      )}

      {schedModal && (()=>{
        const [y, m] = schedModal.ym.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const DOW = ['일','월','화','수','목','금','토'];
        const hset = new Set(schedModal.holidays || []);
        const dowOf = (d) => new Date(y, m-1, d).getDay();
        const is15 = (d) => dowOf(d) === 0 || dowOf(d) === 6 || hset.has(d);   // 주말·공휴일 = 1.5배
        const recOf = (d) => Number((schedModal.days||{})[String(d)]||0) * (is15(d) ? SCHED_RATE : 1);
        const totalInput = Object.values((schedModal.days||{}) as Record<string, any>).reduce((a,b)=>a+Number(b),0);
        const totalRec = Math.round(Array.from({length:lastDay},(_,i)=>recOf(i+1)).reduce((a,b)=>a+b,0)*100)/100;
        const overCap = totalRec > SCHED_CAP;
        const setDay = (d, v) => setSchedModal(f=>{
          const days = { ...(f.days||{}) };
          const h = Math.round(Number(v)*2)/2;
          if (!v || h <= 0) delete days[String(d)]; else days[String(d)] = h;
          return { ...f, days };
        });
        // 평일을 공휴일로(대체·임시공휴일) 지정/해제 — 날짜 클릭. 주말은 이미 1.5배라 토글 불필요.
        const toggleHoliday = (d) => { if (dowOf(d)===0||dowOf(d)===6) return; setSchedModal(f=>{ const hs = new Set(f.holidays||[]); hs.has(d)?hs.delete(d):hs.add(d); return { ...f, holidays: [...hs] }; }); };
        // 주간 소계(일~토, 인정시간): 각 토요일 뒤에 표시
        const weekSumUpTo = (d) => { let s=0; for(let i=d; i>=1; i--){ s += recOf(i); if(dowOf(i)===0) break; } return Math.round(s*100)/100; };
        // PC: 달력형 셀 데이터 (일~토, 오프셋 포함)
        const offset = new Date(y, m-1, 1).getDay();
        const cells = [...Array(offset).fill(null), ...Array.from({length:lastDay},(_,i)=>i+1)];
        while (cells.length % 7 !== 0) cells.push(null);
        const calWeeks = []; for (let i=0;i<cells.length;i+=7) calWeeks.push(cells.slice(i,i+7));
        const rowSum = (w)=>Math.round(w.reduce((a,d)=>a+(d?recOf(d):0),0)*100)/100;
        return (
        <div className="modal-overlay" onClick={()=>setSchedModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:winWide?1000:520,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
            <h3 style={{margin:'0 0 6px'}}>급여제공 일정표</h3>
            <div style={{fontSize:16,color:'#64748b',marginBottom:8}}>날짜별 제공시간을 입력하고 저장하세요. 인쇄하면 공식 달력 양식(PDF)으로 출력됩니다.</div>
            <div style={{fontSize:15,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,padding:'7px 10px',marginBottom:12}}>
              산정 규칙: 월 인정시간 <b>한도 120시간</b> · <b>주말·공휴일은 1.5배 인정</b> (2시간 근무 → 3시간 인정). 공휴일(<span style={{color:'#dc2626'}}>×1.5</span>)은 자동 표시되며, 평일 날짜를 클릭하면 공휴일로 지정/해제할 수 있어요.
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <select className="form-input" style={{flex:1,margin:0}} value={schedModal.phone} onChange={e=>{ const p=e.target.value; setSchedModal(f=>({...f,phone:p,loaded:false})); loadSchedule(p, schedModal.ym); }}>
                {elders.map(e=>(<option key={e.id} value={String(e.phone||'').replace(/\D/g,'')}>{e.name} ({e.phone})</option>))}
              </select>
              <input type="month" className="form-input" style={{width:150,margin:0}} value={schedModal.ym} onChange={e=>{ const ym=e.target.value; setSchedModal(f=>({...f,ym,loaded:false})); loadSchedule(schedModal.phone, ym); }}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              <input className="form-input" style={{margin:0}} placeholder="수급자 생년월일 (예: 1948.05.12)" value={schedModal.birth} onChange={e=>setSchedModal(f=>({...f,birth:e.target.value}))}/>
              <input className="form-input" style={{margin:0}} placeholder="활동지원사 성명" value={schedModal.workerName} onChange={e=>setSchedModal(f=>({...f,workerName:e.target.value}))}/>
            </div>
            {!schedModal.loaded ? (
              <div style={{textAlign:'center',color:'#94a3b8',padding:20}}>불러오는 중…</div>
            ) : winWide ? (
            /* PC: 공식 양식과 같은 달력형 그리드 (일~토 + 주 합계 열) — 한 달이 한 화면에 */
            <div style={{border:'1px solid #e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:12}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr) 96px',background:'#1e3a6e'}}>
                {[...DOW,'주 합계'].map((d,i)=>(<div key={d} style={{padding:'7px 4px',textAlign:'center',fontSize:16,fontWeight:800,color:i===0?'#fca5a5':i===6?'#93c5fd':'#fff'}}>{d}</div>))}
              </div>
              {calWeeks.map((w,wi)=>(
                <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr) 96px',borderTop:'1px solid #e2e8f0'}}>
                  {w.map((d,ci)=>(
                    <div key={ci} style={{padding:'6px 6px 8px',borderLeft:ci>0?'1px solid #f1f5f9':'none',background:d?(ci===0?'#fef7f7':ci===6?'#f6f9ff':'#fff'):'#fafafa',minHeight:62}}>
                      {d && <>
                        <div onClick={()=>toggleHoliday(d)} title={(dowOf(d)!==0&&dowOf(d)!==6)?'클릭: 공휴일 지정/해제 (1.5배 인정)':''}
                          style={{fontSize:15,fontWeight:800,color:is15(d)?'#dc2626':ci===6?'#246BEB':'#334155',marginBottom:4,cursor:(dowOf(d)!==0&&dowOf(d)!==6)?'pointer':'default'}}>
                          {m}/{d}{is15(d)&&<span style={{fontSize:14,marginLeft:3,fontWeight:900,color:'#7c3aed'}}>×1.5</span>}
                        </div>
                        <input type="number" min="0" max="24" step="0.5" className="form-input" style={{width:'100%',margin:0,padding:'5px 6px',fontSize:17,textAlign:'center'}}
                          value={(schedModal.days||{})[String(d)]??''} placeholder="시간" onChange={e=>setDay(d, e.target.value)}/>
                      </>}
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',borderLeft:'2px solid #e2e8f0',background:'#f8fafc',fontSize:16,fontWeight:900,color:'#1e3a6e'}}>{rowSum(w)||''}{rowSum(w)?'시간':''}</div>
                </div>
              ))}
              <div style={{textAlign:'right',fontSize:17,fontWeight:900,color:overCap?'#dc2626':'#1e3a6e',background:overCap?'#fef2f2':'#eff6ff',padding:'9px 14px',borderTop:'1px solid #e2e8f0'}}>
                입력 {totalInput}시간 · <b>인정 {totalRec} / {SCHED_CAP}시간</b>{overCap && ' · 한도 초과'}
              </div>
            </div>
            ) : (
            /* 모바일: 세로 날짜 리스트 — 한 손 입력·큰 터치 영역 */
            <div style={{border:'1px solid #e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:12}}>
              {Array.from({length:lastDay},(_,i)=>i+1).map(d=>{
                const dow = new Date(y, m-1, d).getDay();
                const isSat = dow === 6, isSun = dow === 0;
                return (
                <div key={d}>
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',background:is15(d)?'#fef7f7':isSat?'#eff6ff':'#fff',borderTop:d>1?'1px solid #f1f5f9':'none'}}>
                    <span onClick={()=>toggleHoliday(d)} style={{width:96,fontSize:16,fontWeight:700,color:is15(d)?'#dc2626':isSat?'#246BEB':'#334155',cursor:(!isSun&&!isSat)?'pointer':'default'}}
                      title={(!isSun&&!isSat)?'클릭: 공휴일 지정/해제 (1.5배 인정)':''}>
                      {m}/{d} ({DOW[dow]}){is15(d)&&<span style={{fontSize:14,marginLeft:3,fontWeight:900,color:'#7c3aed'}}>×1.5</span>}
                    </span>
                    <input type="number" min="0" max="24" step="0.5" className="form-input" style={{width:110,margin:0,padding:'6px 10px'}}
                      value={(schedModal.days||{})[String(d)]??''} placeholder="시간" onChange={e=>setDay(d, e.target.value)}/>
                    <span style={{fontSize:15,color:'#94a3b8'}}>시간{is15(d)&&(schedModal.days||{})[String(d)]?` → 인정 ${recOf(d)}시간`:''}</span>
                  </div>
                  {isSat && <div style={{textAlign:'right',fontSize:15,fontWeight:800,color:'#1e3a6e',background:'#f8fafc',padding:'4px 14px',borderTop:'1px dashed #e2e8f0'}}>주간 인정 합계 {weekSumUpTo(d)}시간</div>}
                </div>
                );
              })}
              <div style={{textAlign:'right',fontSize:17,fontWeight:900,color:overCap?'#dc2626':'#1e3a6e',background:overCap?'#fef2f2':'#eff6ff',padding:'8px 14px'}}>입력 {totalInput}시간 · <b>인정 {totalRec} / {SCHED_CAP}시간</b>{overCap && ' · 한도 초과'}</div>
            </div>
            )}
            <div className="modal-btns" style={{justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              {isStaffUp ? <button className="btn-secondary" onClick={printScheduleBatch} title="이 달에 저장된 모든 이용자의 일정표를 한 번에 인쇄(PDF 한 파일)">일괄 출력</button> : <span/>}
              <div style={{display:'flex',gap:8}}>
                <button className="btn-secondary" onClick={()=>setSchedModal(null)}>닫기</button>
                <button className="btn-secondary" onClick={printSchedule}>양식 인쇄</button>
                <button className="btn-primary" onClick={saveSchedule} disabled={schedModal.saving||overCap} title={overCap?'월 인정시간 한도(120시간)를 초과해 저장할 수 없습니다':''}>{schedModal.saving?'저장 중…':overCap?'한도 초과':'파일로 저장'}</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {weeklyModal && (
        <div className="modal-overlay" onClick={()=>{setWeeklyModal(null);setWeeklyDoc(null);}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:winWide?1020:640,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
            <h3 style={{margin:'0 0 6px'}}>주간업무 보고서 — 확인·수정·출력</h3>
            <div style={{fontSize:16,color:'#64748b',marginBottom:12}}>지원사가 앱에서 주차별로 작성(음성→텍스트)한 내용입니다. 오타를 고치고 지시사항을 적은 뒤 저장·출력하세요.</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <select className="form-input" style={{flex:1,margin:0}} value={weeklyModal.phone} onChange={e=>{const p=e.target.value;setWeeklyModal(f=>({...f,phone:p}));loadWeekly(p,weeklyModal.ym);}}>
                {elders.map(e=>(<option key={e.id} value={String(e.phone||'').replace(/\D/g,'')}>{e.name} ({e.phone})</option>))}
              </select>
              <input type="month" className="form-input" style={{width:150,margin:0}} value={weeklyModal.ym} onChange={e=>{const ym=e.target.value;setWeeklyModal(f=>({...f,ym}));loadWeekly(weeklyModal.phone,ym);}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
              <input className="form-input" style={{margin:0}} placeholder="급여종류" value={weeklyModal.benefit} onChange={e=>setWeeklyModal(f=>({...f,benefit:e.target.value}))}/>
              <input className="form-input" style={{margin:0}} placeholder="이용자 생년월일" value={(weeklyDoc&&weeklyDoc.birth)||''} onChange={e=>setWeeklyDoc(f=>({...f,birth:e.target.value}))}/>
              <input className="form-input" style={{margin:0}} placeholder="지원사 성명" value={(weeklyDoc&&weeklyDoc.workerName)||''} onChange={e=>setWeeklyDoc(f=>({...f,workerName:e.target.value}))}/>
            </div>
            {(!weeklyDoc || !weeklyDoc.loaded) ? (
              <div style={{textAlign:'center',color:'#94a3b8',padding:24}}>불러오는 중…</div>
            ) : (
              <>
                {/* PC(와이드): 주차 2열 그리드로 모니터 폭 활용 (5주차는 전체 폭), 모바일: 세로 1열 */}
                <div style={{display:'grid',gridTemplateColumns:winWide?'1fr 1fr':'1fr',gap:10,marginBottom:10}}>
                {[1,2,3,4,5].map(i=>{
                  const w = weeklyDoc.weeks[i] || { content:'', topics:[] };
                  const setW = (patch)=>setWeeklyDoc(f=>({...f,weeks:{...f.weeks,[i]:{...(f.weeks[i]||{content:'',topics:[]}),...patch, _fromNotes:false}}}));
                  return (
                  <div key={i} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',background:w._fromNotes?'#fffbeb':'#fff',...(winWide&&i===5?{gridColumn:'1 / -1'}:{})}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
                      <span style={{fontWeight:900,color:'#1e3a6e'}}>{i}주차</span>
                      {w._fromNotes && <span style={{fontSize:15,fontWeight:700,color:'#b45309',background:'#fef3c7',padding:'2px 8px',borderRadius:12}}>상담일지에서 자동 채움 — 저장 시 확정</span>}
                      <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
                        {Object.entries(CASE_TOPIC_META).map(([k,l])=>(
                          <label key={k} style={{display:'flex',alignItems:'center',gap:4,fontSize:16,fontWeight:600,cursor:'pointer'}}>
                            <input type="checkbox" checked={(w.topics||[]).includes(k)}
                              onChange={e=>setW({topics:e.target.checked?[...(w.topics||[]),k]:(w.topics||[]).filter(t=>t!==k)})}/>
                            {l}
                          </label>
                        ))}
                      </div>
                    </div>
                    <textarea className="form-input" style={{width:'100%',minHeight:winWide?96:64,margin:0,fontSize:16,lineHeight:1.5}} value={w.content}
                      placeholder="이 주차 업무내용·특이사항 (지원사 앱에서 녹음하면 자동으로 채워집니다)"
                      onChange={e=>setW({content:e.target.value})}/>
                  </div>
                  );
                })}
                </div>
                <div style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',marginBottom:12}}>
                  <div style={{fontWeight:900,color:'#1e3a6e',marginBottom:6}}>전담인력 지시사항</div>
                  <textarea className="form-input" style={{width:'100%',minHeight:48,margin:0,fontSize:16}} value={weeklyDoc.note}
                    placeholder="검토 후 지원사에게 전달할 지시사항" onChange={e=>setWeeklyDoc(f=>({...f,note:e.target.value}))}/>
                </div>
              </>
            )}
            {isStaffUp && (()=>{
              const authorName = (em)=>{ const a=accounts.find(u=>u.email===em); return (a&&a.name)?`${a.name} (${em.split('@')[0]})`:em; };
              const authors = [...new Set(weeklyAll.map(w=>w.authorEmail).filter(Boolean))];
              return (
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'8px 10px'}}>
                <select className="form-input" style={{flex:1,margin:0}} value={weeklyModal.author} onChange={e=>setWeeklyModal(f=>({...f,author:e.target.value}))}>
                  <option value="">전체 작성자</option>
                  {authors.map(em=>(<option key={em} value={em}>{authorName(em)}</option>))}
                </select>
                <button className="btn-secondary" style={{whiteSpace:'nowrap'}} onClick={printWeeklyBatch} title="그 달에 저장된 보고서 전체를 한 번에 — PDF 한 파일">일괄 출력</button>
              </div>
              );
            })()}
            <div className="modal-btns" style={{justifyContent:'flex-end',gap:8}}>
              <button className="btn-secondary" onClick={()=>{setWeeklyModal(null);setWeeklyDoc(null);}}>닫기</button>
              <button className="btn-secondary" onClick={printWeeklyReport}>양식 출력</button>
              <button className="btn-primary" onClick={saveWeekly} disabled={!!(weeklyDoc&&weeklyDoc.saving)}>{weeklyDoc&&weeklyDoc.saving?'저장 중…':'파일로 저장'}</button>
            </div>
          </div>
        </div>
      )}

      {noteModal && noteForm && (()=>{
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
                  {Object.entries(CASE_TYPE_META).map(([k,m])=>(
                    <button key={k} type="button" onClick={()=>setNoteForm(f=>({...f,type:k}))} style={{fontSize:16,padding:'7px 13px',borderRadius:20,cursor:'pointer',fontWeight:600,border:'1px solid '+(noteForm.type===k?m.color:'#d1d5db'),background:noteForm.type===k?m.bg:'#fff',color:noteForm.type===k?m.color:'#374151'}}>{m.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={L}>주제</label>
                <select className="form-input" style={I} value={noteForm.category} onChange={e=>setNoteForm(f=>({...f,category:e.target.value}))}>
                  {Object.entries(CASE_CAT_META).map(([k,l])=>(<option key={k} value={k}>{l}</option>))}
                </select>
              </div>
              <div>
                <label style={L}>업무 구분 <span style={{fontWeight:500,color:'#94a3b8'}}>(주간업무 보고서 체크란 — 복수 선택)</span></label>
                <div style={{display:'flex',gap:14,flexWrap:'wrap',padding:'6px 2px'}}>
                  {Object.entries(CASE_TOPIC_META).map(([k,l])=>(
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
      })()}

      <aside className="sidebar">
        <div className="logo" onClick={()=>goPage('dashboard')} style={{cursor:'pointer'}} title="대시보드 홈으로">
          <img src="/youngsili.png" alt="영실이" className="logo-icon" style={{width:42,height:42,borderRadius:12,objectFit:'cover',padding:0}} />
          <div><div className="logo-title">영실이</div><div className="logo-sub">어르신 관리 시스템</div></div>
        </div>
        <nav className="nav">
          {/* 주요 행동 — 화면당 하나만 강조 (레퍼런스: 상단 고정 CTA) */}
          <button className="nav-cta" onClick={()=>goPage('schedule')}>오늘 전화 시작</button>

          {/* 바로가기 — 숫자가 곧 처리해야 할 양 */}
          <div className="nav-quick">
            {(isDisability
              ? [ {id:'q-elders', label:T.elder, icon:'elders', go:'elders', count:elders.length},
                  {id:'q-calls',  label:'통화',  icon:'calls',  go:'calls',  count:null},
                  {id:'q-notes',  label:'일지',  icon:'casenotes', go:'casenotes', count:null},
                  {id:'q-forms',  label:'서식',  icon:'forms',  go:'forms',  count:null} ]
              : [ {id:'q-danger', label:'위험',  icon:'safety', go:'safety', count:elders.filter(e=>e.status==='danger').length, tone:'danger'},
                  {id:'q-alert',  label:'알림',  icon:'health', go:'health', count:alertCount, tone:'danger'},
                  {id:'q-calls',  label:'통화',  icon:'calls',  go:'calls',  count:null},
                  {id:'q-notes',  label:'일지',  icon:'casenotes', go:'casenotes', count:null} ]
            ).map(q=>(
              <button key={q.id} className="nav-quick-item" onClick={()=>goPage(q.go)}>
                <span className={`nav-quick-num ${q.count>0 && (q as any).tone==='danger' ? 'is-danger' : ''}`}>
                  {q.count===null ? <NavIcon name={q.icon}/> : q.count}
                </span>
                <span className="nav-quick-label">{q.label}</span>
              </button>
            ))}
          </div>

          {/* 메뉴 검색 — 메뉴가 많아 찾기 어렵던 문제 해소 */}
          <div className="nav-search">
            <Search size={16} aria-hidden="true"/>
            <input value={navQuery} onChange={e=>setNavQuery(e.target.value)} placeholder="메뉴 검색" aria-label="메뉴 검색" />
            {navQuery && (
              <button onClick={()=>setNavQuery('')} aria-label="검색어 지우기">
                <X size={14}/>
              </button>
            )}
          </div>

          {(() => {
            // 활동지원 기관: 일지·서식이 주 업무 → 상단 배치, 노인돌봄 전용(안전확인·건강·공공데이터)은 숨김.
            // AI 안부전화는 보조 기능으로 유지(발신·멘트·통화기록).
            // P1-1: 모니터링 → 기록 → 운영 설정 → 외부 데이터 순 (디자인팀 확정)
            const groups: any[] = isDisability ? [
              { label:'모니터링', items:[
                {id:'dashboard', icon:'dashboard', label:'대시보드'},
                {id:'elders',    icon:'elders',    label:`${T.elder} 관리`, badge: pendingElders.length},
              ]},
              { label:'기록', items:[
                {id:'calls',     icon:'calls',     label:'통화 기록'},
                {id:'casenotes', icon:'casenotes', label:'상담·방문 일지'},
                {id:'forms',     icon:'forms',     label:'보고서·서식'},
                {id:'report',    icon:'report',    label:'리포트 / 통계'},
              ]},
              { label:'운영 설정', items:[
                {id:'schedule', icon:'schedule', label:'전화 발신 관리'},
                {id:'script',   icon:'script',   label:'전화 멘트 관리'},
              ]},
            ] : [
              { label:'모니터링', items:[
                {id:'dashboard', icon:'dashboard', label:'대시보드'},
                {id:'health',    icon:'health',    label:'건강 상태', badge: alertCount},
                {id:'elders',    icon:'elders',    label:`${T.elder} 관리`, badge: pendingElders.length},
                {id:'safety',    icon:'safety',    label:'안전확인 관리'},
              ]},
              { label:'기록', items:[
                {id:'calls',     icon:'calls',     label:'통화 기록'},
                {id:'casenotes', icon:'casenotes', label:'상담·방문 일지'},
                {id:'forms',     icon:'forms',     label:'보고서·서식'},
                {id:'report',    icon:'report',    label:'리포트 / 통계'},
              ]},
              { label:'운영 설정', items:[
                {id:'schedule', icon:'schedule', label:'전화 발신 관리'},
                {id:'script',   icon:'script',   label:'전화 멘트 관리'},
              ]},
              { label:'외부 데이터', items:[
                {id:'data', icon:'data', label:'공공데이터 현황'},
              ]},
            ];
            // 영실이 콘솔 — 기관 무관, 서비스 전체를 총괄하는 계정(SUPERADMIN_EMAILS)에게만 노출
            if (isSuper) {
              groups.push({ label:'영실이 콘솔', items:[
                {id:'console', icon:'console', label:'시스템 모니터링'},
                {id:'consoleSubscriptions', icon:'console', label:'정기결제 현황'},
              ]});
            }
            // 관리·도움말은 하단 분리 영역(레퍼런스의 휴지통 자리)으로 뺀다
            const bottomItems = [
              ...(isStaffUp ? [{id:'admin', icon:'admin', label: isSuper?'기관 관리':'구성원 관리'}] : []),
              {id:'help', icon:'help', label:'도움말 보기', dot: hasNewNotice},
            ];
            const q = navQuery.trim();
            const isActive = (id) => page===id || (page==='detail'&&id==='elders') || (page==='register'&&id==='elders');
            const NavBtn = (item) => (
              <button key={item.id} className={`nav-item ${isActive(item.id)?'active':''}`} onClick={()=>goPage(item.id)}>
                <span className="nav-icon"><NavIcon name={item.icon}/></span>
                <span>{item.label}</span>
                {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                {item.dot && <span className="nav-dot"/>}
              </button>
            );
            // 검색 중에는 그룹 접힘을 무시하고 일치 항목만 보여준다
            const visible = groups
              .map(g => ({ ...g, items: q ? g.items.filter(i => i.label.includes(q)) : g.items }))
              .filter(g => g.items.length > 0);
            const bottomVisible = q ? bottomItems.filter(i => i.label.includes(q)) : bottomItems;
            if (q && visible.length === 0 && bottomVisible.length === 0) {
              return <div className="nav-empty">일치하는 메뉴가 없습니다</div>;
            }
            return (
              <>
                {visible.map(group=>{
                  const folded = !q && navFold[group.label];
                  return (
                    <div key={group.label} className="nav-group">
                      <button className="nav-group-label" onClick={()=>toggleNavGroup(group.label)} aria-expanded={!folded}>
                        <ChevronDown className={`nav-chevron ${folded?'is-folded':''}`} size={14}/>
                        <span>{group.label}</span>
                      </button>
                      {!folded && group.items.map(NavBtn)}
                    </div>
                  );
                })}
                {bottomVisible.length > 0 && (
                  <div className="nav-group nav-group--bottom">{bottomVisible.map(NavBtn)}</div>
                )}
              </>
            );
          })()}
        </nav>
        <div className="sidebar-footer">
          <div className="worker-info">
            <div className="worker-avatar"><Building2 size={18}/></div>
            <div>
              <div className="worker-name">{me?.orgName || (isSuper ? '영실이 운영자' : '기관 정보 확인 중')}</div>
              <div className="sidebar-account-email">{authUser?.email || me?.email || '계정 정보 확인 중'}</div>
            </div>
          </div>
          <div className={`sidebar-org-code ${me?.orgCode?'':'is-disabled'}`} onClick={me?.orgCode?copyOrgCode:undefined} title={me?.orgCode?'클릭하면 복사 · 어르신 앱 등록 시 입력':'기관코드가 아직 발급되지 않았습니다'}>
            <span className="sidebar-org-label">기관코드</span>
            <span className="sidebar-org-value">{me?.orgCode || '미등록'}</span>
            {me?.orgCode && <span className={`sidebar-org-copy ${orgCopied?'is-copied':''}`}><Copy size={13}/>{orgCopied?'복사됨':'복사'}</span>}
          </div>
          {/* 2026-08-31: 선불 충전식 크레딧(1단계) — 평소(잔액>0)엔 이 잔액 표시가 유일한 확인
              경로다(콘솔은 superadmin 전용, 차단화면은 잔액 0일 때만 뜬다). superadmin은
              소속 기관이 없어(orgId='*') billing이 항상 null이라 자동으로 안 보인다. */}
          {billing && typeof billing.creditBalance === 'number' && (
            <div className="sidebar-org-code sidebar-credit-balance" style={{cursor:'pointer'}} title="클릭하면 현재 플랜·잔액·결제수단을 볼 수 있어요"
              onClick={()=>{ setShowPlanModal(true); fetchSubscriptionStatus(); }}>
              <span className="sidebar-org-label">크레딧 잔액</span>
              <span className="sidebar-org-value" style={{color: billing.creditBalance <= 200 ? '#dc2626' : undefined}}>
                {billing.creditBalance.toLocaleString()}
              </span>
            </div>
          )}
          {authEnabled&&authUser&&<button className="sidebar-logout" onClick={doLogout}><LogOut size={15}/> 로그아웃</button>}
        </div>
      </aside>

      <main className="main" id="main-content">
        {orgNotices.filter(n => !dismissedNoticeIds.includes(n.id)).map(n => (
          <div key={n.id} style={{background:'#eff6ff',borderBottom:'1px solid #bfdbfe',padding:'10px 16px',display:'flex',alignItems:'flex-start',gap:12,fontSize:15}}>
            <span style={{color:'#1d4ed8',fontWeight:700,flexShrink:0}}>{n.title}</span>
            <span style={{color:'#1e3a8a',flex:1,whiteSpace:'pre-wrap'}}>{n.body}</span>
            <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px',flexShrink:0}} onClick={()=>setDismissedNoticeIds(prev=>[...prev, n.id])}>닫기</button>
          </div>
        ))}
        {authEnabled && authUser && !authUser.emailVerified && (
          <div style={{background:'#fffbeb',borderBottom:'1px solid #fde68a',padding:'10px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',fontSize:17}}>
            <span style={{color:'#b45309',fontWeight:700}}>이메일 인증을 완료해 주세요.</span>
            <span style={{color:'#92400e'}}>{authUser.email}로 보낸 메일의 링크를 클릭하시면 됩니다. (지금도 사용 가능)</span>
            <span style={{flex:1}}/>
            {verifyNote && <span style={{color:'#166534',fontSize:16}}>{verifyNote}</span>}
            <button className="btn-secondary" style={{fontSize:16,padding:'6px 12px'}} disabled={verifyCooldown>0} onClick={resendVerify}>{verifyCooldown>0?`재발송 (${verifyCooldown}초)`:'인증 메일 재발송'}</button>
            <button className="btn-secondary" style={{fontSize:16,padding:'6px 12px'}} onClick={reloadUser}>인증 완료 → 새로고침</button>
          </div>
        )}
        <header className="header">
          {(()=>{
            const title =
              page==='dashboard'?'대시보드':page==='elders'?`${T.elder} 관리`:page==='schedule'?'전화 발신 관리'
              :page==='safety'?'안전확인 관리':page==='calls'?'통화 기록':page==='script'?'전화 멘트 관리'
              :page==='report'?'리포트 / 통계':page==='data'?'공공데이터 현황':page==='health'?'건강 상태'
              :page==='casenotes'?'상담·방문 일지':page==='forms'?'보고서·서식'
              :page==='admin'?(isSuper?'기관 관리 (운영자)':'구성원 관리'):page==='help'?'도움말 보기'
              :page==='console'?'영실이 콘솔 — 시스템 모니터링'
              :page==='consoleSubscriptions'?'영실이 콘솔 — 정기결제 현황'
              :page==='detail'?`${T.elder} 상세 정보`:page==='register'?(editMode?`${T.elder} 정보 수정`:`${T.elder} 신규 등록`):'';
            return (
              <div>
                <div className="header-crumb">홈 <span className="crumb-sep">/</span> {title}</div>
                <div className="header-title">{title}</div>
              </div>
            );
          })()}
          <div className="header-right">
            <span className="header-date">{new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}</span>
            {lastSync && <span className="header-sync">· 마지막 갱신 {lastSync.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>}
            <button className="btn-refresh" onClick={refreshPage}><RefreshIcon/> 새로고침</button>
          </div>
        </header>

        <div className={`content page-${page}`}>
          <PageErrorBoundary key={page}>

          {page==='dashboard' && (
            <DashboardHomePage
              me={me} openRegister={openRegister} goPage={goPage} alertsData={alertsData}
              alertIsReal={alertIsReal} alertEnCode={alertEnCode} alertKw={alertKw} elders={elders}
              getNoResponseDays={getNoResponseDays} weatherData={weatherData} alertsOpen={alertsOpen}
              setAlertsOpen={setAlertsOpen} openDetail={openDetail} setCallModal={setCallModal} T={T}
              isDisability={isDisability} setSortBy={setSortBy} noRespOpen={noRespOpen}
              setNoRespOpen={setNoRespOpen} danger={danger} warning={warning} normal={normal}
              todoDone={todoDone} setTodoDone={setTodoDone} todayCalls={todayCalls}
              drillDispatch={drillDispatch} dispatchTotal={dispatchTotal} answeredCount={answeredCount}
              missedCount={missedCount} drillCalls={drillCalls} totalCalls={totalCalls}
              criticalCount={criticalCount} urgentCount={urgentCount} normalCount={normalCount}
              safetyToday={safetyToday} calling={calling} makeCall={makeCall} alertCount={alertCount}
              getSolitudeRisk={getSolitudeRisk} renderLastCall={renderLastCall}
            />
          )}

          {page==='safety' && (
            <SafetyPage
              refreshPage={refreshPage} safetyToday={safetyToday} callsHistory={callsHistory}
              elders={elders} calling={calling} makeCall={makeCall} openEditSchedule={openEditSchedule}
            />
          )}

          {page==='schedule' && (
            <SchedulePage
              alertResponses={alertResponses} loadAlertResponses={loadAlertResponses} openNewNote={openNewNote}
              elders={elders} smartFilter={smartFilter} applySmartFilter={applySmartFilter} checked={checked}
              checkAll={checkAll} uncheckAll={uncheckAll} batchSize={batchSize} setBatchSize={setBatchSize}
              batchIntervalSec={batchIntervalSec} setBatchIntervalSec={setBatchIntervalSec} bulkRunning={bulkRunning}
              setBulkConfirm={setBulkConfirm} stopBulkCall={stopBulkCall} bulkDone={bulkDone} bulkQueue={bulkQueue}
              bulkChannel={bulkChannel} batchWait={batchWait} bulkCurrent={bulkCurrent} setBulkDone={setBulkDone}
              setBulkQueue={setBulkQueue} setChecked={setChecked} resendMissed={resendMissed} histStatus={histStatus}
              setHistStatus={setHistStatus} histDays={histDays} setHistDays={setHistDays}
              loadDispatchHistory={loadDispatchHistory} histAllOpen={histAllOpen} setHistAllOpen={setHistAllOpen}
              setHistDayOv={setHistDayOv} dispatchHist={dispatchHist} histLoading={histLoading} histDayOv={histDayOv}
              expandedHistDays={expandedHistDays} setExpandedHistDays={setExpandedHistDays}
              formatDateHeader={formatDateHeader} nameByPhone={nameByPhone} smartElders={smartElders}
              toggleCheck={toggleCheck} openEdit={openEdit} cycleLabel={cycleLabel} renderLastCall={renderLastCall}
              toggleCallActive={toggleCallActive}
            />
          )}


          {page==='elders' && (
            <EldersPage
              me={me} T={T} copyOrgCode={copyOrgCode} orgCopied={orgCopied} searchName={searchName}
              setSearchName={setSearchName} REGIONS={REGIONS} regionFilter={regionFilter}
              setRegionFilter={setRegionFilter} filter={filter} setFilter={setFilter} elders={elders}
              sortBy={sortBy} setSortBy={setSortBy} viewMode={viewMode} setViewMode={setViewMode}
              downloadCsvTemplate={downloadCsvTemplate} csvInputRef={csvInputRef} handleCsvFile={handleCsvFile}
              openRegister={openRegister} filteredElders={filteredElders} pendingElders={pendingElders}
              approveElder={approveElder} selectedElders={selectedElders} toggleAllElders={toggleAllElders}
              bulkRunning={bulkRunning} bulkChannel={bulkChannel} stopBulkCall={stopBulkCall} bulkDone={bulkDone}
              bulkQueue={bulkQueue} setBulkConfirm={setBulkConfirm} deleteSelectedElders={deleteSelectedElders}
              EldersEmpty={EldersEmpty} getSolitudeRisk={getSolitudeRisk} getNoResponseDays={getNoResponseDays}
              openDetail={openDetail} toggleElderSel={toggleElderSel} renderLastCall={renderLastCall}
              elderSecOv={elderSecOv} setElderSecOv={setElderSecOv} normalCardView={normalCardView}
              setNormalCardView={setNormalCardView} calling={calling} setCallModal={setCallModal}
              setSelectedElders={setSelectedElders}
            />
          )}

          {page==='script' && (
            <ScriptPage
              me={me} weatherData={weatherData} weatherTime={weatherTime} weatherStale={weatherStale}
              fetchingWeather={fetchingWeather} fetchWeather={fetchWeather}
              forestFireData={forestFireData} specialWarningData={specialWarningData} alertSeverity={alertSeverity}
              activeAlert={activeAlert} setActiveAlert={setActiveAlert} alertUserTouchedRef={alertUserTouchedRef} appliedAlertKeyRef={appliedAlertKeyRef}
              wildfireStage={wildfireStage} setWildfireStage={setWildfireStage} setAlertScript={setAlertScript} tplText={tplText}
              fireLoc={fireLoc} setFireLoc={setFireLoc} shelterName={shelterName} setShelterName={setShelterName}
              alertScript={alertScript} setAlertTplSaved={setAlertTplSaved}
              saveAlertTemplate={saveAlertTemplate} resetAlertTemplate={resetAlertTemplate} alertTplSaving={alertTplSaving} alertTplSaved={alertTplSaved} savedAlertTpl={savedAlertTpl} curAlertKey={curAlertKey}
              checked={checked} elders={elders} alertMsgFor={alertMsgFor} setChecked={setChecked} toggleCheck={toggleCheck}
              bulkRunning={bulkRunning} setBulkConfirm={setBulkConfirm} bulkDone={bulkDone} bulkQueue={bulkQueue} stopBulkCall={stopBulkCall}
              questions={questions} setQuestionField={setQuestionField} saveQuestions={saveQuestions} resetQuestions={resetQuestions} questionsSaving={questionsSaving} questionsMsg={questionsMsg}
              T={T} pstnCallerId={pstnCallerId} setPstnCallerId={setPstnCallerId} savePstnCallerId={savePstnCallerId} pstnSaving={pstnSaving} pstnMsg={pstnMsg}
            />
          )}

          {page==='calls' && (
            <CallsPage
              callsHistory={callsHistory} callsPhone={callsPhone} callsSearch={callsSearch}
              callsRiskMatch={callsRiskMatch} nameByPhone={nameByPhone} callsRange={callsRange}
              setCallsRange={setCallsRange} callsFrom={callsFrom} setCallsFrom={setCallsFrom}
              callsTo={callsTo} setCallsTo={setCallsTo} fetchCalls={fetchCalls} callsLoading={callsLoading}
              callsAllOpen={callsAllOpen} setCallsAllOpen={setCallsAllOpen} setCallsDayOv={setCallsDayOv}
              callsRisk={callsRisk} setCallsRisk={setCallsRisk} elders={elders} setCallsSearch={setCallsSearch}
              setCallsPhone={setCallsPhone} callsDayOv={callsDayOv} expandedCallDays={expandedCallDays}
              setExpandedCallDays={setExpandedCallDays} formatDateHeader={formatDateHeader}
              kwFromTranscript={kwFromTranscript} draftingCallId={draftingCallId}
              openNoteForCall={openNoteForCall}
            />
          )}

          {page==='report' && (
            <ReportPage
              exportStatsCSV={exportStatsCSV} me={me} reportMonth={reportMonth} setReportMonth={setReportMonth}
              monthlyBusy={monthlyBusy} downloadMonthlyReport={downloadMonthlyReport} reportCalls={reportCalls}
              elders={elders} statsRange={statsRange} setStatsRange={setStatsRange} statsFrom={statsFrom}
              setStatsFrom={setStatsFrom} statsTo={statsTo} setStatsTo={setStatsTo} fetchStats={fetchStats}
              statsLoading={statsLoading} statsData={statsData} priorityScore={priorityScore}
              statsPrev={statsPrev} LV_COLOR={LV_COLOR} kwLevel={kwLevel} danger={danger} warning={warning}
              reportDispatches={reportDispatches}
            />
          )}

          {page==='health' && (
            <HealthPage
              healthLoading={healthLoading} fetchHealth={fetchHealth} healthData={healthData} elders={elders}
              alertsData={alertsData} alertIsReal={alertIsReal} nameByPhone={nameByPhone} alertEnCode={alertEnCode}
              alertKw={alertKw} draftingAlertId={draftingAlertId} openNoteFromAlert={openNoteFromAlert}
              healthFilter={healthFilter} setHealthFilter={setHealthFilter} healthAllOpen={healthAllOpen}
              setHealthAllOpen={setHealthAllOpen} setHealthRowOv={setHealthRowOv}
              setHealthNormalShown={setHealthNormalShown} healthRowOv={healthRowOv}
              getNoResponseDays={getNoResponseDays} callsHistory={callsHistory} kwFromTranscript={kwFromTranscript}
              healthHistory={healthHistory} setCallModal={setCallModal} openDetail={openDetail}
              healthRange={healthRange} setHealthRange={setHealthRange} healthHistFrom={healthHistFrom}
              setHealthHistFrom={setHealthHistFrom} healthHistTo={healthHistTo} setHealthHistTo={setHealthHistTo}
              formatDateHeader={formatDateHeader} healthNormalShown={healthNormalShown}
            />
          )}


          {page==='casenotes' && (
            <CasenotesPage
              T={T} caseSearch={caseSearch} setCaseSearch={setCaseSearch} openSchedule={openSchedule}
              openWeeklyReport={openWeeklyReport} exportNotesXlsx={exportNotesXlsx} caseNotes={caseNotes}
              openNewNote={openNewNote} caseType={caseType} setCaseType={setCaseType}
              caseFollowUpOnly={caseFollowUpOnly} setCaseFollowUpOnly={setCaseFollowUpOnly}
              memoText={memoText} setMemoText={setMemoText} memos={memos} setMemos={setMemos}
              isAutoDraft={isAutoDraft} caseLoading={caseLoading} nameByPhone={nameByPhone}
              CASE_TYPE_META={CASE_TYPE_META} selectedNotes={selectedNotes} setSelectedNotes={setSelectedNotes}
              deleteSelectedNotes={deleteSelectedNotes} expandedNoteDays={expandedNoteDays}
              setExpandedNoteDays={setExpandedNoteDays} formatDateHeader={formatDateHeader}
              toggleNoteSel={toggleNoteSel} copyNote={copyNote} copiedNoteId={copiedNoteId}
              openEditNote={openEditNote} deleteNote={deleteNote} CASE_CAT_META={CASE_CAT_META}
              CASE_TOPIC_META={CASE_TOPIC_META} AutoDraftBadge={AutoDraftBadge}
            />
          )}

          {page==='data' && (
            <DataPage
              popData={popData} weatherData={weatherData} disasterMsgConfigured={disasterMsgConfigured}
              disasterMsgs={disasterMsgs} popError={popError} popLoading={popLoading} elders={elders}
              alertSeverity={alertSeverity} calling={calling} setCallModal={setCallModal}
              popDoneOpen={popDoneOpen} setPopDoneOpen={setPopDoneOpen} fetchPopulation={fetchPopulation}
              fetchWeather={fetchWeather} getNoResponseDays={getNoResponseDays} weatherStale={weatherStale}
              weatherTime={weatherTime} T={T}
            />
          )}

          {page==='detail' && selected && (
            <DetailPage
              selected={selected} setPage={setPage} setSelected={setSelected} openEdit={openEdit}
              deleteElder={deleteElder} callResult={callResult} calling={calling} setCallModal={setCallModal}
              makeCall={makeCall} toggleCallActive={toggleCallActive} cycleLabel={cycleLabel}
              callsHistory={callsHistory} draftingCallId={draftingCallId} openNoteForCall={openNoteForCall}
              caseNotes={caseNotes} CASE_TYPE_META={CASE_TYPE_META} CASE_CAT_META={CASE_CAT_META}
              isAutoDraft={isAutoDraft} AutoDraftBadge={AutoDraftBadge} copyNote={copyNote}
              copiedNoteId={copiedNoteId} openEditNote={openEditNote} deleteNote={deleteNote}
              openNewNote={openNewNote}
            />
          )}

          {/* 영실이 콘솔(총괄 관리자 전용) — GCP 콘솔 참고: 좌측 카드형 상태 요약 + 초록/빨강 인디케이터 +
              깔끔한 데이터 테이블. 기관 대시보드와 완전히 별개 화면이라 여기서 뭘 해도 기관 데이터엔 영향 없다. */}
          {page==='console' && (
            <ConsolePage
              consoleHealth={consoleHealth} consoleLoading={consoleLoading} consoleCalls={consoleCalls}
              fetchConsole={fetchConsole} consoleHistory={consoleHistory} consoleHistoryLoading={consoleHistoryLoading}
              fetchConsoleHistory={fetchConsoleHistory} consoleHistoryOrg={consoleHistoryOrg}
              setConsoleHistoryOrg={setConsoleHistoryOrg} orgs={orgs} consoleHistoryFrom={consoleHistoryFrom}
              setConsoleHistoryFrom={setConsoleHistoryFrom} consoleHistoryTo={consoleHistoryTo}
              setConsoleHistoryTo={setConsoleHistoryTo} consoleHistoryPage={consoleHistoryPage}
              setConsoleHistoryPage={setConsoleHistoryPage} orgSuspending={orgSuspending} creditOrg={creditOrg}
              toggleOrgSuspend={toggleOrgSuspend} consoleAuditLogs={consoleAuditLogs}
              consoleAuditLoading={consoleAuditLoading} fetchConsoleAuditLogs={fetchConsoleAuditLogs}
              consoleAuditActor={consoleAuditActor} setConsoleAuditActor={setConsoleAuditActor}
            />
          )}

          {page==='consoleSubscriptions' && (
            <ConsoleSubscriptionsPage
              consoleSubs={consoleSubs} consoleSubsLoading={consoleSubsLoading}
              fetchConsoleSubscriptions={fetchConsoleSubscriptions}
            />
          )}

          {page==='help' && <HelpGuide orgCode={me?.orgCode} />}

          {page==='forms' && (
            <FormsPage
              formsYm={formsYm} setFormsYm={setFormsYm} setReportMonth={setReportMonth}
              formsCounts={formsCounts} openWeeklyReport={openWeeklyReport}
              printWeeklyBatchFor={printWeeklyBatchFor} openSchedule={openSchedule}
              printScheduleBatchFor={printScheduleBatchFor} caseNotes={caseNotes}
              exportNotesXlsx={exportNotesXlsx} monthlyBusy={monthlyBusy}
              downloadMonthlyReport={downloadMonthlyReport}
            />
          )}

          {page==='admin' && (
            <AdminPage
              isStaffUp={isStaffUp} adminMsg={adminMsg} isSuper={isSuper} me={me} saveOrgAddress={saveOrgAddress}
              alertSettingSaving={alertSettingSaving} updateAlertSetting={updateAlertSetting} inviteRole={inviteRole}
              setInviteRole={setInviteRole} grantableRoles={grantableRoles} ROLE_KO={ROLE_KO}
              createInvite={createInvite} invites={invites} inviteLink={inviteLink} copyInvite={copyInvite}
              copiedInvite={copiedInvite} deleteInvite={deleteInvite} newOrgName={newOrgName}
              setNewOrgName={setNewOrgName} newOrgType={newOrgType} setNewOrgType={setNewOrgType}
              createOrg={createOrg} orgs={orgs} ORG_TYPE_KO={ORG_TYPE_KO} newAcct={newAcct}
              setNewAcct={setNewAcct} createAccount={createAccount} accounts={accounts} isAdmin={isAdmin}
              deleteAccount={deleteAccount}
            />
          )}

          {page==='register' && (
            <RegisterPage
              setPage={setPage} editMode={editMode} saveSuccess={saveSuccess} formStep={formStep}
              form={form} setForm={setForm} inp={inp} formErrors={formErrors}
              openAddressSearch={openAddressSearch} caregivers={caregivers} elders={elders}
              addCaregiver={addCaregiver} accounts={accounts} ROLE_KO={ROLE_KO} nextStep={nextStep}
              setFormStep={setFormStep} isDisability={isDisability} cycleLabel={cycleLabel}
              saveElder={saveElder}
            />
          )}

          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
