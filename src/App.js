import { useState, useEffect, useRef, Component } from 'react';
import './App.css';
import { auth, authEnabled } from './firebase';
import { onAuthStateChanged, signOut, sendEmailVerification } from 'firebase/auth';
import * as XLSX from 'xlsx';
import HelpGuide, { LATEST_NOTICE } from './HelpGuide';
import AuthScreen from './AuthScreen';

const SERVER_URL = 'https://youngsili-server-production.up.railway.app';

// 모든 서버 요청에 Firebase ID 토큰 첨부 → 서버가 기관(orgId)을 식별·격리.
// (서버는 토큰의 uid로 users/{uid}.orgId를 조회해 본인 기관 데이터만 반환)
async function authFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  try {
    if (authEnabled && auth && auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = 'Bearer ' + token;
    }
  } catch (e) { /* 토큰 실패 시 무첨부 → 서버 401 */ }
  return fetch(url, { ...opts, headers });
}

// 통화내용 표시: 화자(영실이/어르신)별 줄바꿈 + 길면 그 자리서 펼치기(인라인). 잘림 없음.
function CallTranscript({ text }) {
  const [open, setOpen] = useState(false);
  const raw = (text || '').trim();
  if (!raw) return <div style={{ color: '#94a3b8', fontSize: 13 }}>—</div>;
  // "영실이:" / "어르신:" 앞에서 분리해 화자별 턴으로 나눔
  const turns = raw.split(/(?=영실이\s*[:：]|어르신\s*[:：])/g).map(s => s.trim()).filter(Boolean);
  const PREVIEW = 4;
  const shown = open ? turns : turns.slice(0, PREVIEW);
  const more = turns.length - PREVIEW;
  return (
    <div style={{ width: '100%', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
      {shown.map((t, i) => {
        const m = t.match(/^(영실이|어르신)\s*[:：]\s*([\s\S]*)$/);
        const who = m ? m[1] : '';
        const body = m ? m[2].trim() : t;
        const isElder = who === '어르신';
        return (
          <div key={i} style={{ marginBottom: 3, wordBreak: 'break-word' }}>
            {who && <span style={{ fontWeight: 700, color: isElder ? '#1e3a6e' : '#94a3b8', marginRight: 6 }}>{who}</span>}
            <span style={{ color: isElder ? '#1f2937' : '#64748b' }}>{body}</span>
          </div>
        );
      })}
      {more > 0 && (
        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 4, background: 'none', border: 'none', color: '#2563eb', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {open ? '접기 ▴' : `전체 대화 ${more}턴 더 보기 ▾`}
        </button>
      )}
    </div>
  );
}

const CAREGIVERS = [];  // 서버 /settings/caregivers + 등록된 어르신의 담당 복지사에서 파생 (더미 폐지)
// (더미 INIT_ELDERS 제거 — 어르신 목록은 서버 /elders에서 로드)

// 본 서비스: 모든 통계·통화·현황은 서버(Firestore) 실데이터로 표시 (고정 더미 폐지)
const STATUS_CONFIG = {
  danger:  { label: '위험', color: '#ef4444', bg: '#fef2f2' },
  warning: { label: '주의', color: '#f59e0b', bg: '#fffbeb' },
  normal:  { label: '정상', color: '#22c55e', bg: '#f0fdf4' },
};
const RISK_CONFIG = {
  critical: { label: '긴급', color: '#ef4444' },
  urgent:   { label: '주의', color: '#f59e0b' },
  warning:  { label: '주의', color: '#f59e0b' },   // 앱이 어지럼·소화·기력저하 등을 warning으로 보냄 → 주의 표시
  normal:   { label: '정상', color: '#22c55e' },
};
// SPA 페이지 목록 (URL 해시 라우팅 — F5 시 현재 페이지 유지)
const PAGES = ['dashboard','elders','safety','schedule','script','calls','health','casenotes','forms','report','data','admin','help'];

// 페이지 렌더 오류가 앱 전체를 흰 화면으로 만들지 않게 방어. 오류 시 메시지 표시 + 메뉴 이동(resetKey) 시 복구.
class PageErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{padding:40,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
        <h3 style={{color:'#dc2626',margin:'0 0 8px'}}>이 페이지를 표시하는 중 오류가 발생했습니다</h3>
        <pre style={{whiteSpace:'pre-wrap',fontSize:12,color:'#64748b',background:'#f8fafc',padding:12,borderRadius:8,textAlign:'left',overflow:'auto'}}>{String((this.state.error && this.state.error.message) || this.state.error)}</pre>
        <p style={{color:'#64748b',fontSize:14}}>다른 메뉴를 누르거나 새로고침(F5) 해주세요.</p>
      </div>
    );
    return this.props.children;
  }
}
const EMPTY_FORM = { name:'', age:'', gender:'female', title:'할머니', region:'', address:'', addressDetail:'', phone:'', jumin:'', caregiver:'', caregiverPhone:'', assignedTo:'', guardian:'', guardianPhone:'', disease:'', medicine:'', mobility:'독립보행 가능', careGroup:'', callCycle:'daily', callDays:[], callTime:'09:00', callActive:true };
// 주민등록번호 앞 6자리 → 생년월일 (7번째 자리로 세기 판정: 1·2=1900년대, 3·4=2000년대)
const juminToBirth = (jumin) => {
  const d = String(jumin||'').replace(/[^0-9]/g,'');
  if (d.length < 7) return '';
  const century = ['1','2','5','6'].includes(d[6]) ? '19' : '20';
  return `${century}${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4,6)}`;
};

// 노인맞춤돌봄서비스 돌봄군 — 전화 안전확인 권장 주기(제도 기준): 일반돌봄군 주 2회, 중점돌봄군 주 1회(방문이 주 2회라 전화는 1회)
const CARE_GROUPS = {
  general:   { label: '일반돌봄군', weeklyCalls: 2, days: ['월','목'], color: '#2563eb' },
  intensive: { label: '중점돌봄군', weeklyCalls: 1, days: ['수'],     color: '#7c3aed' },
};

const TITLE_OPTIONS = {
  female: ['할머니', '어머니', '여사님'],
  male:   ['할아버지', '아버지', '어르신'],
};

const DEFAULT_SCRIPT = `{{호칭}}, 안녕하세요. 저 영실이인데요~
오늘 하루 어떻게 보내고 계세요?
식사는 하셨나요? 꼭 챙겨 드셔야 해요.
{{경보멘트}}
혹시 몸이 불편하신 곳은 없으세요?
무슨 일 있으시면 언제든지 말씀해 주세요.
그럼 저 영실이가 또 연락드릴게요. 건강하게 지내세요.`;

const ALERT_TEMPLATES = {
  heatwave: `오늘 {{지역}} 폭염경보가 발령되었어요. 야외 활동은 자제하시고, 물을 자주 드시고 시원한 곳에 계세요.`,
  cold:     `오늘 {{지역}} 한파경보가 발령되었어요. 외출 시 따뜻하게 입으시고, 가급적 실내에 계세요.`,
  dust:     `오늘 {{지역}} 미세먼지 농도가 매우 나쁨이에요. 외출 시 마스크를 꼭 착용하세요.`,
  rain:     `오늘 {{지역}} 비가 많이 온다고 해요. 외출 시 우산을 챙기시고 미끄러운 곳을 조심하세요.`,
  typhoon:  `{{지역}} 태풍 영향권에 들어있어요. 오늘은 밖에 나가지 마시고 안전한 실내에 계세요. 창문은 꼭 닫아 잠그시고, 창문에서 떨어진 곳에 계시는 게 좋아요. 정전이 될 수 있으니 손전등이나 휴대폰을 가까이 두세요. 몸이 불편하거나 걱정되는 일이 있으면 언제든 말씀해 주세요.`,
  wildfire: `오늘 {{지역}} 인근에 산불이 발생했어요. 안내 방송에 귀 기울이시고, 대피 안내가 있으면 꼭 따르세요. 위급하면 119로 연락하세요.`,
  none:     ``,
};

// 산불 3단계 대본 (발생 초기 → 긴급 대피 → 안전 확인). 각 단계는 응답 분기(괜찮아/도와줘)로 마무리.
const WILDFIRE_STAGES = [
  { id: 'prepare',  label: '① 발생 초기(대피 준비)', color: '#f59e0b',
    text: `어르신, 저 영실이예요. 지금 {{지역}} 가까운 곳에 산불이 났어요. 놀라지 마시고 제 말 잘 들어주세요. 지금 바로 나갈 준비를 해두세요. 신발이랑 겉옷, 그리고 이 전화기 꼭 챙기세요. 대피소는 {{대피소}} 쪽으로 가시면 돼요. 혼자 나가기 힘드시면 지금 저한테 "도와줘" 라고 말씀해 주세요. 바로 119로 연결해 드릴게요.` },
  { id: 'evacuate', label: '② 긴급 대피(불길 접근)', color: '#dc2626',
    text: `어르신, 지금 바로 밖으로 나가셔야 해요. {{지역}} 산불이 가까워졌어요. 가스 밸브 잠그시고, 젖은 수건으로 코와 입을 막고 낮은 자세로 나가세요. 나가시면 {{대피소}} 쪽으로 가시거나 이웃과 함께 움직이세요. 위급하면 꼭 119에 전화하세요. 혼자 못 움직이시면 지금 "도와줘" 라고 말씀해 주세요. 바로 119로 연결해 드릴게요.` },
  { id: 'safety',   label: '③ 안전 확인(상황 종료)', color: '#16a34a',
    text: `어르신, 저 영실이예요. 지금 안전한 곳에 계신가요? 몸은 괜찮으세요? 괜찮으시면 "괜찮아", 도움이 필요하면 "도와줘" 라고 말씀해 주세요.` },
];

// 경보 멘트 변수 치환 (실제 발송·미리보기 공통). 값이 없으면 자연스럽게 생략.
// {{이름}}은 UI에서 제거했으나, 과거 저장분 호환을 위해 치환은 유지(있으면 '어르신'으로).
// fireLoc(산불 발생 위치)이 있으면 {{지역}}은 발생 위치로 치환 — 산불 위치는 어르신 거주지와 다른 개념
// (예: 달서구 거주 어르신에게 "봉화군 도개면 야산 산불" 안내). 없으면 기존대로 어르신 지역.
function fillAlertVars(text, elder, shelter, fireLoc) {
  return String(text || '')
    .replace(/\{\{이름\}\}/g, (elder && elder.name) || '어르신')
    .replace(/\{\{호칭\}\}/g, (elder && elder.title) || '어르신')
    .replace(/\{\{지역\}\}/g, (fireLoc || (elder && elder.region) || ''))
    .replace(/\{\{보호자\}\}/g, (elder && elder.guardian) ? `${elder.guardian}님` : '보호자님')
    .replace(/\{\{대피소\}\}/g, (shelter || '가까운 대피소'))
    .replace(/\{\{([^{}]*)\}\}/g, '$1')   // 미등록 변수({{봉화군 …}} 등 오기입)는 괄호 벗겨 내용만 발화
    .replace(/\s{2,}/g, ' ').trim();
}

const getWeatherIcon = (c = '') => {
  if (c.includes('소나기')) return '🌦️';
  if (c.includes('비'))     return '🌧️';
  if (c.includes('눈'))     return '❄️';
  if (c.includes('흐림'))   return '☁️';
  if (c.includes('구름'))   return '⛅';
  if (c.includes('폭염'))   return '🥵';
  return '☀️';
};

export default function App() {
  const [page, setPage]         = useState(() => { try { const h = (window.location.hash || '').replace('#',''); return PAGES.includes(h) ? h : 'dashboard'; } catch { return 'dashboard'; } });
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
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  useEffect(() => { if (verifyCooldown <= 0) return; const t = setTimeout(() => setVerifyCooldown(c => c - 1), 1000); return () => clearTimeout(t); }, [verifyCooldown]);
  const resendVerify = async () => {
    if (verifyCooldown > 0 || !auth.currentUser) return;
    setVerifyNote('');
    try { await sendEmailVerification(auth.currentUser); setVerifyNote('✅ 인증 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.'); setVerifyCooldown(60); }
    catch (e) { setVerifyNote(e.code === 'auth/too-many-requests' ? '⏳ 잠시 후 다시 시도해 주세요 (발송 한도).' : '발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'); setVerifyCooldown(30); }
  };
  // 기관코드 복사 (어르신 앱 등록 시 사용)
  const [orgCopied, setOrgCopied] = useState(false);
  const copyOrgCode = () => { if (!me?.orgCode) return; try { navigator.clipboard.writeText(me.orgCode); setOrgCopied(true); setTimeout(() => setOrgCopied(false), 1500); } catch {} };
  const [elders, setElders] = useState([]);  // 서버(Firestore) /elders에서 로드 (localStorage 더미 폐지)
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState('all');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [formStep, setFormStep] = useState(1);
  const [searchName, setSearchName]   = useState('');
  const [regionFilter, setRegionFilter] = useState('전체');
  const [sortBy, setSortBy]           = useState('status');
  const [viewMode, setViewMode]       = useState('card');
  const [memoText, setMemoText]       = useState('');
  const [memos, setMemos]             = useState(() => { try { return JSON.parse(localStorage.getItem('youngsili_memos')) || []; } catch { return []; } });
  const [healthData, setHealthData]     = useState([]);
  const [caregivers, setCaregivers]     = useState(CAREGIVERS);
  const [alertsData, setAlertsData]     = useState([]);
  const [alertCount, setAlertCount]     = useState(0);
  const [healthLoading, setHealthLoading] = useState(false);
  // ── 멀티테넌트: 본인 정보 + 운영자 기관·계정 관리 ──
  const [me, setMe]               = useState(null);   // {role, orgId, orgName, orgCode, email}
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
      const [cur, prev, callsRes] = await Promise.all([
        authFetch(`${SERVER_URL}/stats?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/stats?from=${prevFrom.toISOString()}&to=${prevTo.toISOString()}`).then(r => r.json()),
        authFetch(`${SERVER_URL}/calls?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
      ]);
      setStatsData(cur); setStatsPrev(prev); setReportCalls(callsRes.calls || []);
    } catch { setStatsData({ available: false }); setStatsPrev(null); }
    finally { setStatsLoading(false); }
  };

  const priorityScore = (es) => {
    if (!es) return 0;
    const w = { critical: 3, urgent: 1.5, warning: 1 };
    let s = 0;
    Object.entries(es.byLevel || {}).forEach(([lvl, c]) => { s += c * (w[lvl] || 1); });
    if (es.lastAt) { const d = (Date.now() - new Date(es.lastAt).getTime()) / 86400000; if (d < 1) s *= 1.5; else if (d < 3) s *= 1.2; }
    return Math.round(s * 10) / 10;
  };

  // 위험 키워드 통계 → 엑셀(UTF-8 CSV, BOM 포함 → Excel 한글 정상)
  const exportStatsCSV = () => {
    if (!statsData || !statsData.elders || Object.keys(statsData.elders).length === 0) { alert('내보낼 통계 데이터가 없습니다.'); return; }
    const { from, to } = rangeToDates(statsRange);
    const fmt = (d) => new Date(d).toLocaleDateString('ko-KR');
    const entries = Object.entries(statsData.elders)
      .map(([name, es]) => ({ name, es, score: priorityScore(es), prevTotal: (statsPrev && statsPrev.elders && statsPrev.elders[name] && statsPrev.elders[name].total) || 0 }))
      .sort((a, b) => b.score - a.score);
    const rows = [];
    rows.push(['위험 키워드 통계 리포트']);
    rows.push(['기간', `${fmt(from)} ~ ${fmt(to)}`]);
    rows.push(['총 위험 감지', `${statsData.totalEvents || 0}건`]);
    rows.push([]);
    rows.push(['순위', '어르신', '우선순위 점수', '총 감지', '주요 키워드(빈도)', '긴급', '주의', '마지막 감지', '지난기간', '증감']);
    entries.forEach((e, i) => {
      const kwStr = Object.entries(e.es.keywords || {}).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}(${c})`).join(' ');
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
    } catch (e) { window.alert('보고서 생성에 실패했습니다: ' + e.message); }
    setMonthlyBusy(false);
  };

  const fetchElders = async () => {
    try {
      const res = await authFetch(`${SERVER_URL}/elders`);
      const data = await res.json();
      if (Array.isArray(data)) setElders(data.filter(e => e && e.phone));  // 번호 없는 잘못된 문서 제외
    } catch (err) { console.error('어르신 목록 오류:', err); }
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
    try { const r = await authFetch(`${SERVER_URL}/me`); if (r.ok) setMe(await r.json()); } catch {}
  };
  const fetchOrgs = async () => {
    try { const r = await authFetch(`${SERVER_URL}/admin/orgs`); const d = await r.json(); setOrgs(Array.isArray(d) ? d : []); } catch { setOrgs([]); }
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
      if (d.success) { setAdminMsg(`✅ "${name}" 생성됨 · 기관코드: ${d.code}`); setNewOrgName(''); fetchOrgs(); }
      else setAdminMsg('❌ ' + (d.error || '생성 실패'));
    } catch { setAdminMsg('❌ 네트워크 오류'); }
  };
  const createAccount = async () => {
    const { email, password, name, phone, orgId, role } = newAcct;
    if (!name.trim()) { setAdminMsg('복지사 이름을 입력하세요'); return; }
    if (!email || !password || (isSuper && !orgId)) { setAdminMsg(isSuper?'이메일·비밀번호·기관을 모두 입력하세요':'이메일·비밀번호를 입력하세요'); return; }
    setAdminMsg('생성 중…');
    try {
      const r = await authFetch(`${SERVER_URL}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, name, phone, orgId, role }) });
      const d = await r.json();
      if (d.success) { setAdminMsg(`✅ 계정 생성됨: ${name} (${email})`); setNewAcct({ email:'', password:'', name:'', phone:'', orgId:'', role:'worker' }); fetchAccounts(); }
      else setAdminMsg('❌ ' + (d.error || '생성 실패'));
    } catch { setAdminMsg('❌ 네트워크 오류'); }
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
        setAdminMsg('✅ 초대 링크가 생성됐어요. 복사해서 전달하세요.');
        fetchInvites();
        try { await navigator.clipboard.writeText(inviteLink(d.code)); setCopiedInvite(d.code); setTimeout(()=>setCopiedInvite(''), 2500); } catch {}
      } else setAdminMsg('❌ ' + (d.error || '생성 실패'));
    } catch { setAdminMsg('❌ 네트워크 오류'); }
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
      if (d.success) { setAdminMsg(`🗑️ 삭제됨: ${email}`); fetchAccounts(); }
      else setAdminMsg('❌ ' + (d.error || '삭제 실패'));
    } catch { setAdminMsg('❌ 네트워크 오류'); }
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

  // 마운트 시 + 어르신/대시보드 진입 시 서버에서 어르신 목록 로드
  // 로그인 완료(authUser) 시 토큰이 생기므로 재로드 — 안 그러면 로그인 전 무토큰 호출로 빈 화면
  useEffect(() => { fetchElders(); fetchCaregivers(); fetchCalls(); fetchMe(); }, [authUser]); // eslint-disable-line
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
    const t = setInterval(() => fetchElders(), 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'health') return;
    fetchHealth();
    const t = setInterval(() => fetchHealth(true), 15000);   // 건강 리포트도 15초 자동 갱신(알림과 동일)
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line
  // authUser 의존 추가: 새로고침으로 #report 직행 시 로그인 복원 전 무토큰 401로 통계가 0건 고정되던 버그
  // (elders 등은 로그인 시 재로드되는데 stats만 빠져 있었음 — 로그인 복원되면 자동 재조회)
  useEffect(() => { if (page === 'report') fetchStats(); }, [page, statsRange, statsFrom, statsTo, authUser]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'calls' && page !== 'elders' && page !== 'dashboard' && page !== 'safety') return;   // safety=안전확인 관리(주기 준수율)
    fetchCalls();
    // 통화기록 탭·홈에 있는 동안 15초 자동 갱신 → 방금 끝난 통화가 새로고침 없이 표시
    // (홈 '오늘 통화 현황'의 긴급/주의/정상 KPI도 callsHistory 기반이라 홈도 포함 — 발신 KPI만 갱신되던 반쪽 불일치 해소)
    // (5초는 /calls가 매번 30일치 문서를 읽어 Firestore 비용 과다 → 다른 실시간 요소와 동일한 15초로 통일)
    if (page !== 'calls' && page !== 'dashboard' && page !== 'safety') return;
    const t = setInterval(() => fetchCalls(true), 15000);
    return () => clearInterval(t);
  }, [page, callsRange, callsFrom, callsTo]); // eslint-disable-line
  useEffect(() => {
    if (page !== 'health') return;
    fetchHealthHistory();
    const t = setInterval(() => fetchHealthHistory(true), 15000);   // 건강 이력도 15초 자동 갱신
    return () => clearInterval(t);
  }, [page, healthRange, healthHistFrom, healthHistTo]); // eslint-disable-line
  // 통화 시각 ISO → "오늘 14:23" / "어제 09:10" / "6/14 15:30"
  const formatCallTime = (iso) => {
    if (!iso) return '통화 없음';
    const d = new Date(iso), now = new Date();
    const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (days === 0) return `오늘 ${hm}`;
    if (days === 1) return `어제 ${hm}`;
    return `${days}일 전 · ${d.getMonth() + 1}/${d.getDate()}`;
  };
  // 마지막 통화 후 경과일 (무응답 강조용: 0=오늘 … null=기록없음)
  const daysSinceCall = (iso) => {
    if (!iso) return null;
    return Math.round((new Date(new Date().toDateString()) - new Date(new Date(iso).toDateString())) / 86400000);
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
    return <span style={{color: danger ? '#dc2626' : '#64748b', fontWeight: danger ? 800 : 600}}>{label}{danger ? ` · ${ds}일째 무응답 ⚠️` : ''}</span>;
  };
  // 통화기록 날짜 그룹 헤더: 'YYYY-MM-DD' → '6/23(월) · 오늘'
  const formatDateHeader = (dateStr) => {
    if (!dateStr) return '미상';
    const d = new Date(dateStr + 'T00:00:00'), now = new Date();
    const days = Math.round((new Date(now.toDateString()) - d) / 86400000);
    const wd = ['일','월','화','수','목','금','토'][d.getDay()];
    const md = `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
    if (days === 0) return `${md} · 오늘`;
    if (days === 1) return `${md} · 어제`;
    return md;
  };
  // silent=true면 로딩 표시 없이 조용히 갱신(자동 폴링용 — 목록 깜빡임 방지). 실패 시 기존 목록 유지.
  const fetchCalls = async (silent = false) => {
    if (!silent) setCallsLoading(true);
    try {
      const now = new Date();
      let from = new Date(now.getTime() - 30 * 86400000), to = now;
      if (callsRange === 'week') from = new Date(now.getTime() - 7 * 86400000);
      else if (callsRange === 'custom') { if (callsFrom) from = new Date(callsFrom); if (callsTo) to = new Date(callsTo + 'T23:59:59'); }
      const r = await authFetch(`${SERVER_URL}/calls?from=${from.toISOString()}&to=${to.toISOString()}`);
      const j = await r.json();
      setCallsHistory(j.calls || []);
    } catch { if (!silent) setCallsHistory([]); }
    if (!silent) setCallsLoading(false);
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
      const data = Array.isArray(raw) ? raw : [];   // 401/에러 응답(객체) 방어 → .filter 크래시 차단
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
    const t = setInterval(() => { pollAlerts(); pollRecent(); }, 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line

  const [popData, setPopData]       = useState(null);
  const [popLoading, setPopLoading] = useState(false);
  const [popError, setPopError]     = useState(null);

  const fetchPopulation = async () => {
    setPopLoading(true); setPopError(null);
    try {
      const res = await authFetch(`${SERVER_URL}/population`);
      const data = await res.json();
      setPopData(data);
    } catch { setPopError('데이터를 불러오지 못했습니다.'); }
    finally { setPopLoading(false); }
  };

  useEffect(() => { if (page === 'data' && !popData) fetchPopulation(); }, [page]); // eslint-disable-line
  // 어르신 목록은 서버(Firestore)가 원본 — localStorage 저장 제거 (PC마다 다르게 노는 문제 방지)
  useEffect(() => { try { localStorage.setItem('youngsili_memos', JSON.stringify(memos)); } catch {} }, [memos]);
  useEffect(() => { localStorage.removeItem('youngsili_callLogs'); }, []);  // 옛 더미 통화로그 1회 정리
  const [mainScript, setMainScript]     = useState(DEFAULT_SCRIPT);
  const [editScript, setEditScript]     = useState(DEFAULT_SCRIPT);
  const [activeAlert, setActiveAlert]   = useState('none');
  const [alertScript, setAlertScript]   = useState(ALERT_TEMPLATES.none);
  const [wildfireStage, setWildfireStage] = useState('prepare');   // 산불 3단계 선택
  const [shelterName, setShelterName]     = useState('');          // {{대피소}} 담당자 입력
  const [fireLoc, setFireLoc]             = useState('');          // 산불 발생 위치({{지역}} 치환 + 위치질문 답변)
  const [alertResponses, setAlertResponses] = useState([]);        // 경보 응답 현황(safe/help/missed)
  const [alertRespLoading, setAlertRespLoading] = useState(false);
  const [draftingCallId, setDraftingCallId] = useState(null);      // 통화→일지 초안 생성 중인 통화 id
  const [reportMonth, setReportMonth] = useState(new Date().toLocaleDateString('sv-SE').slice(0, 7));  // 월간 보고서 대상 월
  const [monthlyBusy, setMonthlyBusy] = useState(false);
  const [savedAlertTpl, setSavedAlertTpl]  = useState({});         // 서버 저장된 경보 멘트(기관 공유) — 키별
  const [alertTplSaving, setAlertTplSaving] = useState(false);
  const [alertTplSaved, setAlertTplSaved]  = useState(false);
  const [previewElder, setPreviewElder] = useState(null);
  const [scriptSaved, setScriptSaved]   = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherTime, setWeatherTime] = useState('');
  const [weatherData, setWeatherData]   = useState({});  // 서버 /weather 실데이터로 로드 (가짜 날씨 폐지)
  const [formErrors, setFormErrors] = useState({});
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
  const [dispatchHist, setDispatchHist] = useState([]);   // 발신 이력(날짜별) — 서버 dispatches
  const [histLoading, setHistLoading] = useState(false);
  const [histDays, setHistDays]     = useState(7);
  const [histStatus, setHistStatus] = useState('all');   // 발신 이력 상태 필터 all|received|missed (KPI 드릴다운)
  const [expandedHistDays, setExpandedHistDays] = useState(new Set());  // 발신 이력 날짜별 펼침
  const [batchSize, setBatchSize]   = useState(5);    // 배치당 발신 인원 (AI서버 동시통화 부하 분산)
  const [batchIntervalSec, setBatchIntervalSec] = useState(90);  // 배치 간 대기(초)
  const [batchWait, setBatchWait]   = useState(0);    // 다음 배치까지 남은 초(카운트다운 표시)
  const bulkRef = useRef(false);
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
  const filtered = filter==='all' ? elders : elders.filter(e => e.status===filter); // eslint-disable-line
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
    if (score >= 50) return { level: 'high',   label: '🔴 고위험', color: '#ef4444', bg: '#fef2f2' };
    if (score >= 25) return { level: 'medium', label: '🟡 주의',   color: '#f59e0b', bg: '#fffbeb' };
    return               { level: 'low',    label: '🟢 안전',   color: '#22c55e', bg: '#f0fdf4' };
  };

  const REGIONS = ['전체', '대구 북구', '대구 달서구', '대구 수성구', '대구 중구', '대구 동구', '대구 서구', '대구 남구', '대구 달성군'];

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
  const alertMsgFor = (elder) => activeAlert === 'none' ? '' : fillAlertVars(alertScript, elder, shelterName, activeAlert === 'wildfire' ? fireLoc.trim() : '');
  const alertStageFor = () => activeAlert === 'wildfire' ? wildfireStage : '';

  const buildPreview = (elder) => {
    // 산불(대피)은 안부 대본을 얹지 않고 경보 멘트만 발화 → 미리보기도 경보 멘트 그대로
    if (activeAlert === 'wildfire') return `${elder?.name || '어르신'} 어르신, ${alertMsgFor(elder)}`.slice(0, 500);
    const alertMsg = alertMsgFor(elder);
    return mainScript
      .replace(/{{호칭}}/g, elder?.title || '어르신')
      .replace(/{{이름}}/g, elder?.name || '어르신')
      .replace(/{{지역}}/g, elder?.region || '')
      .replace(/{{경보멘트}}/g, alertMsg)
      .replace(/\n\s*\n/g, '\n').trim();
  };

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
        const hasHeatwave = Object.values(data).some(w => w.alert === 'heatwave');
        const hasCold     = Object.values(data).some(w => w.alert === 'cold');
        const hasRain     = Object.values(data).some(w => w.alert === 'rain');
        if (hasHeatwave)     { setActiveAlert('heatwave'); setAlertScript(ALERT_TEMPLATES.heatwave); }
        else if (hasCold)    { setActiveAlert('cold');     setAlertScript(ALERT_TEMPLATES.cold); }
        else if (hasRain)    { setActiveAlert('rain');     setAlertScript(ALERT_TEMPLATES.rain); }
        else                 { setActiveAlert('none');     setAlertScript(ALERT_TEMPLATES.none); }
      }
    } catch (err) {
      console.error('날씨 API 오류:', err);
    } finally { setFetchingWeather(false); }
  };

  useEffect(() => { fetchWeather(); }, []); // eslint-disable-line

  const saveScript = () => { setMainScript(editScript); setScriptSaved(true); setTimeout(() => setScriptSaved(false), 2000); };
  const resetScript = () => { setEditScript(DEFAULT_SCRIPT); setMainScript(DEFAULT_SCRIPT); };

  const goPage  = p => { setPage(p); setSelected(null); setCallResult(null); };
  // 실시간 위험 알림: 등록된 어르신 것만 표시 (테스트/더미 이름 제외)
  const _normPhone = s => String(s||'').replace(/[^0-9]/g,'');
  const alertIsReal = a => elders.some(e => e.name === a.name || (_normPhone(a.phone) && _normPhone(e.phone) === _normPhone(a.phone)));
  // 서버 내부 코드값(영문)은 화면에 그대로 노출하지 않고 사람이 읽는 한글로 변환.
  // 원칙: 대시보드에 영문 원문값 노출 금지 — 새 코드값이 생기면 EN_ALERT_KO에 추가.
  const EN_ALERT_KO = { missed: '⚠️ 전화 미응답', help: '🚨 도와줘 (구조 요청)', safe: '✅ 괜찮아 (안전 확인)', sos: '🚨 긴급 호출(SOS)' };
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
    if (((window.location.hash || '').replace('#','') || 'dashboard') !== page) window.history.pushState({ page }, '', '#' + page);
  }, [page]);
  useEffect(() => {
    const onPop = () => { const h = (window.location.hash || '').replace('#',''); setPage(PAGES.includes(h) ? h : 'dashboard'); setSelected(null); setCallResult(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openDetail = elder => { setSelected(elder); setCallResult(null); setPage('detail'); };
  const openRegister = () => { setForm({...EMPTY_FORM}); setFormStep(1); setFormErrors({}); setSaveSuccess(false); setEditMode(false); setPage('register'); };
  const openEdit = elder => { setForm({...elder}); setFormStep(1); setFormErrors({}); setSaveSuccess(false); setEditMode(true); setPage('register'); };
  // 안전확인 관리에서 이름 클릭 → 곧장 돌봄군·주기 설정(정보수정 3단계)으로 (탭 왕복 불편 해소)
  const openEditSchedule = elder => { setForm({...elder}); setFormStep(3); setFormErrors({}); setSaveSuccess(false); setEditMode(true); setPage('register'); };

  const smartElders = (() => {
    if (smartFilter==='danger')  return elders.filter(e=>e.status==='danger'||e.status==='warning');
    if (smartFilter==='noCall')  return elders.filter(e=>e.lastCall==='아직 없음'||(e.lastCall||'').includes('어제')||(e.lastCall||'').includes('2일'));
    if (smartFilter==='active')  return elders.filter(e=>e.callActive);
    return elders;
  })();

  const toggleCheck = id => setChecked(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const checkAll    = () => setChecked(smartElders.map(e=>e.id));
  const uncheckAll  = () => setChecked([]);
  const applySmartFilter = f => { setSmartFilter(f); setChecked([]); };

  // ── 일괄 발신 (FCM 앱 푸시) ──
  const startBulkCall = async (customQueue) => {
    const queue = Array.isArray(customQueue) ? customQueue : elders.filter(e => checked.includes(e.id));
    if (queue.length === 0) return;
    setBulkQueue(queue); setBulkDone([]); setBulkRunning(true); bulkRef.current = true;
    for (let i = 0; i < queue.length; i++) {
      const elder = queue[i];
      if (!bulkRef.current) break;
      setBulkCurrent(elder.id);
      try {
        const res = await authFetch(`${SERVER_URL}/call/app`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            phone:        elder.phone,
            elderName:    elder.name,
            elderTitle:   elder.title || '어르신',
            region:       elder.region,
            script:       mainScript,
            alertMessage: alertMsgFor(elder),
            alertType: activeAlert,
            alertStage: alertStageFor(),
            shelter: activeAlert === 'wildfire' ? shelterName.trim() : '',   // 앱 긴급 안내 대피소 일치용
            fireLoc: activeAlert === 'wildfire' ? fireLoc.trim() : '',       // 산불 발생 위치(위치질문 답변 일치용)
          }),
        });
        const data = await res.json();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
        setBulkDone(prev => [...prev, { id: elder.id, callId: data.callId, success: data.success, status: data.success ? 'ringing' : 'failed' }]);
        if (data.success) {
          setElders(prev => prev.map(e => e.id===elder.id ? {...e, lastCall:`오늘 ${timeStr}`} : e));
        }
      } catch {
        setBulkDone(prev => [...prev, { id: elder.id, success: false, status: 'failed' }]);
      }
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
    if (queue.length > 0) startBulkCall(queue);
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
    const t = setInterval(() => loadDispatchHistory(histDays, true), 15000);
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
    const t = setInterval(() => loadAlertResponses(true), 15000);
    return () => clearInterval(t);
  }, [page]); // eslint-disable-line


  // ── 경보 멘트: 서버 저장분 로드(기관 공유) → 담당자 수정이 모든 계정에 즉시 적용 ──
  useEffect(() => {
    if (page !== 'schedule') return;
    authFetch(`${SERVER_URL}/settings/alerts`).then(r => r.json())
      .then(d => setSavedAlertTpl((d && d.templates) || {})).catch(() => {});
  }, [page]); // eslint-disable-line
  // 편집 중인 멘트의 키 (산불은 단계별, 그 외는 경보 종류)
  const curAlertKey = () => activeAlert === 'wildfire' ? `wildfire_${wildfireStage}` : activeAlert;
  // 저장분 우선, 없으면 기본 텍스트
  const tplText = (key, def) => (savedAlertTpl[key] && savedAlertTpl[key].trim()) ? savedAlertTpl[key] : def;
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
      if (d && d.templates) { setSavedAlertTpl(d.templates); setAlertTplSaved(true); setTimeout(() => setAlertTplSaved(false), 2500); }
    } catch { /* noop */ }
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
    visit:    { label: '가정방문', icon: '🏠', color: '#2563eb', bg: '#dbeafe' },
    phone:    { label: '전화상담', icon: '📞', color: '#16a34a', bg: '#dcfce7' },
    office:   { label: '내소상담', icon: '🏢', color: '#7c3aed', bg: '#ede9fe' },
    guardian: { label: '보호자상담', icon: '👪', color: '#c2410c', bg: '#ffedd5' },
    etc:      { label: '기타', icon: '📄', color: '#64748b', bg: '#f1f5f9' },
  };
  const CASE_CAT_META = { safety:'안전', health:'건강', meal:'식사', emotional:'정서', welfare:'복지연계', etc:'기타' };
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
    const t = setInterval(() => loadCaseNotes(true), 15000);
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
    } catch { window.alert('일지 초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'); }
    setDraftingCallId(null);
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
    } catch { window.alert('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.'); }
  };
  // 일지 목록 엑셀 다운로드 (기관 내부 보관·결재용)
  const exportNotesXlsx = (list) => {
    const TYPE_KO = { visit: '가정방문', phone: '전화상담', office: '내소상담', guardian: '보호자상담', etc: '기타' };
    const CAT_KO = { safety: '안전', health: '건강', meal: '식사', emotional: '정서', welfare: '생활지원', etc: '기타' };
    const aoa = [['일시', '어르신', '유형', '분류', '내용', '조치사항', '후속필요', '후속기한', '작성자']];
    [...list].sort((a, b) => (a.visitedAt || '').localeCompare(b.visitedAt || '')).forEach(n => {
      aoa.push([
        n.visitedAt ? new Date(n.visitedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '',
        n.elderName || '', TYPE_KO[n.type] || n.type, CAT_KO[n.category] || n.category,
        n.content || '', n.action || '',
        (n.followUp && n.followUp.needed) ? 'O' : '', (n.followUp && n.followUp.dueDate) || '',
        (n.authorEmail || '').split('@')[0],
      ]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 60 }, { wch: 26 }, { wch: 8 }, { wch: 11 }, { wch: 12 }];
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
      .noprint button{padding:10px 18px;font-size:14px;font-weight:800;border-radius:8px;border:0;background:#1d4ed8;color:#fff;cursor:pointer}
      .hint{position:fixed;top:12px;left:12px;font-size:12px;color:#64748b;background:#f1f5f9;padding:6px 10px;border-radius:8px}
      .pgbrk{page-break-after:always;border-top:2px dashed #cbd5e1;margin:40px 0}
      @media print{.noprint,.hint{display:none}body{margin:0 auto}.pgbrk{border:0;margin:0}}
    </style></head><body>
      <div class="hint">✏️ 칸을 클릭하면 인쇄 전에 내용을 고칠 수 있어요</div>
      <div class="noprint"><button onclick="window.print()">🖨 인쇄 / PDF 저장</button></div>
      ${pages.join('<div class="pgbrk"></div>')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { window.alert('팝업이 차단됐습니다. 팝업을 허용해 주세요.'); return; }
    w.document.write(html); w.document.close();
    setWeeklyModal(null);
  };
  // 단건 출력 — 현재 편집 중인 내용 그대로 (저장 안 한 수정도 반영)
  const printWeeklyReport = () => {
    if (!weeklyModal || !weeklyModal.phone || !weeklyDoc) { window.alert('이용자를 선택해 주세요.'); return; }
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === weeklyModal.phone) || {};
    const [y, m] = weeklyModal.ym.split('-').map(Number);
    const page = buildWeeklyForm({
      elderPhone: weeklyModal.phone, elderName: el.name, ym: weeklyModal.ym,
      weeks: weeklyDoc.weeks, note: weeklyDoc.note, benefit: weeklyModal.benefit,
      workerName: weeklyDoc.workerName, birth: weeklyDoc.birth,
    });
    if (!page) { window.alert('작성된 주차가 없습니다. 지원사 앱에서 작성하거나 여기서 입력해 주세요.'); return; }
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
    if (!pages.length) { window.alert('선택한 조건(월·작성자)에 저장된 보고서가 없습니다. 지원사 앱에서 주차별로 저장하면 여기에 모입니다.'); return; }
    openReportWindow(pages, `${y}년 ${m}월 주간업무 보고서 일괄 (${pages.length}명)`);
  };

  // ── 급여제공 일정표 (스트림 C): 세로(날짜 리스트) 입력 → 저장 → 공식 달력 양식 인쇄 ──
  const [schedModal, setSchedModal] = useState(null);   // { phone, ym, days:{}, holidays:[], categories:[], birth, residence, workerName, saving }
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
    const el = elders.find(e => String(e.phone||'').replace(/\D/g,'') === schedModal.phone) || {};
    const [y, m] = schedModal.ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const hset = new Set(schedModal.holidays || []);
    const is15x = (d) => { const dw = new Date(y, m-1, d).getDay(); return dw === 0 || dw === 6 || hset.has(d); };
    const recX = (d) => Number((schedModal.days||{})[String(d)]||0) * (is15x(d) ? SCHED_RATE : 1);
    const totalIn = Object.values(schedModal.days||{}).reduce((a,b)=>a+Number(b),0);
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
    const totalInputP = Object.values(days).reduce((a, b) => a + Number(b), 0);
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
      .dnum.red{color:#dc2626}.dnum.blue{color:#2563eb}
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
      .noprint button{padding:10px 18px;font-size:14px;font-weight:800;border-radius:8px;border:0;background:#1d4ed8;color:#fff;cursor:pointer}
      .hint{position:fixed;top:12px;left:12px;font-size:12px;color:#64748b;background:#f1f5f9;padding:6px 10px;border-radius:8px}
      @media print{.noprint,.hint{display:none}body{margin:0 auto}.pgbrk{border:0;margin:0}}
    </style></head><body>
      <div class="hint">✏️ 칸을 클릭하면 인쇄 전에 내용을 고칠 수 있어요</div>
      <div class="noprint"><button onclick="window.print()">🖨 인쇄 / PDF 저장</button></div>
      ${pages.join('<div class="pgbrk"></div>')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { window.alert('팝업이 차단됐습니다. 팝업을 허용해 주세요.'); return; }
    w.document.write(html); w.document.close();
  };
  const printSchedule = () => {
    if (!schedModal) return;
    if (!Object.keys(schedModal.days||{}).length) { window.alert('입력된 제공시간이 없습니다. 먼저 시간을 입력·저장해 주세요.'); return; }
    const [y, m] = schedModal.ym.split('-').map(Number);
    openSchedPrint([buildScheduleForm({ ...schedModal, elderPhone: schedModal.phone })], `${y}년 ${m}월 급여제공 일정표`);
  };
  const printScheduleBatch = () => {
    if (!schedModal) return;
    const pages = schedMonthAll.filter(s => Object.keys(s.days||{}).length).map(s => buildScheduleForm(s));
    if (!pages.length) { window.alert('이 달에 저장된 일정표가 없습니다.'); return; }
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
        weekly: ((w && w.reports) || []).filter(x => Object.values(x.weeks||{}).some(v=>((v&&v.content)||'').trim())).length,
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
    if (!pages.length) { window.alert('이 달에 저장된 주간업무 보고서가 없습니다. 지원사 앱에서 주차별로 저장하면 여기에 모입니다.'); return; }
    const [y, m] = ym.split('-').map(Number);
    openReportWindow(pages, `${y}년 ${m}월 주간업무 보고서 일괄 (${pages.length}명)`);
  };
  const printScheduleBatchFor = async (ym) => {
    const r = await authFetch(`${SERVER_URL}/schedules?ym=${ym}`).then(x=>x.json()).catch(()=>null);
    const pages = ((r && r.schedules) || []).filter(s2 => Object.keys(s2.days||{}).length).map(s2 => buildScheduleForm(s2)).filter(Boolean);
    if (!pages.length) { window.alert('이 달에 저장된 일정표가 없습니다.'); return; }
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
        cands.sort((a, b) => Math.abs(new Date(a.at) - t) - Math.abs(new Date(b.at) - t));   // 알림 시각과 가장 가까운 통화
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

  const openNewNote = (prefill = {}) => {
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
    });
    setNoteModal({ note: n });
  };
  const saveNote = async () => {
    if (!noteForm) return;
    if (!noteForm.content.trim() && !noteForm.action.trim()) { alert('상담·방문 내용을 입력해 주세요.'); return; }
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
    } catch { alert('저장에 실패했습니다. 다시 시도해 주세요.'); }
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

  // ── 단건 전화 (FCM 앱 푸시) ──
  const makeCall = async elder => {
    setCallModal(null); setCalling(elder.id); setCallResult(null);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    try {
      const res = await authFetch(`${SERVER_URL}/call/app`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          phone:        elder.phone,
          elderName:    elder.name,
          elderTitle:   elder.title || '어르신',
          region:       elder.region,
          script:       mainScript,
          alertMessage: alertMsgFor(elder),
          alertType: activeAlert,
          alertStage: alertStageFor(),
          shelter: activeAlert === 'wildfire' ? shelterName.trim() : '',   // 앱 긴급 안내 대피소 일치용
            fireLoc: activeAlert === 'wildfire' ? fireLoc.trim() : '',       // 산불 발생 위치(위치질문 답변 일치용)
        }),
      });
      const data = await res.json();
      if (data.success) {
        setElders(prev => prev.map(e => e.id===elder.id?{...e,lastCall:`오늘 ${timeStr}`}:e));
        if (selected?.id===elder.id) setSelected(prev=>({...prev,lastCall:`오늘 ${timeStr}`}));
        setCallResult({elderId:elder.id, status:'success', message:`📱 ${elder.name} ${elder.title||'어르신'} 앱으로 수신 알림 전송 완료!`});
      } else {
        setCallResult({elderId:elder.id, status:'error', message:`앱 알림 전송 실패: ${data.error}`});
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
    const errors = {};
    if (step===1) { if(!form.name.trim()) errors.name='이름을 입력하세요'; if(!form.age) errors.age='나이를 입력하세요'; if(!form.phone.trim()) errors.phone='전화번호를 입력하세요'; if(!form.address.trim()) errors.address='주소를 입력하세요'; }
    if (step===2) { if(!form.guardian.trim()) errors.guardian='보호자 이름을 입력하세요'; if(!form.guardianPhone.trim()) errors.guardianPhone='보호자 연락처를 입력하세요'; }
    setFormErrors(errors); return Object.keys(errors).length===0;
  };
  const nextStep = () => { if(validateStep(formStep)) setFormStep(s=>s+1); };
  const saveElder = () => {
    let saved;
    if (editMode) { saved = {...form}; setElders(prev=>prev.map(e=>e.id===form.id?{...e,...form}:e)); setSelected(prev=>({...prev,...form})); }
    else { saved = {...form,id:Date.now(),status:'normal',lastCall:'아직 없음',keyword:null,visits:0,age:parseInt(form.age),callActive:true}; setElders(prev=>[...prev,saved]); }
    // 자동연동: 서버 elders에 저장 → 앱이 어르신 전화번호로 조회
    authFetch(`${SERVER_URL}/elders/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(saved) }).then(r=>r.json()).then(d=>{ if(d&&d.success){ fetchElders(); } }).catch(()=>{});
    setSaveSuccess(true);
    setTimeout(()=>{setSaveSuccess(false);setPage(editMode?'detail':'elders');},1800);
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
    if(rows.length<2){ alert('데이터가 없습니다. 양식에 어르신 정보를 채워 주세요.'); return; }
    const alias = {'이름':'name','성함':'name','성명':'name','전화번호':'phone','연락처':'phone','휴대폰':'phone','전화':'phone','나이':'age','연세':'age','성별':'gender','호칭':'title','지역':'region','주소':'region','담당복지사':'caregiver','담당':'caregiver','복지사':'caregiver','전화시간':'callTime','시간':'callTime','보호자':'guardian','보호자연락처':'guardianPhone','보호자전화':'guardianPhone','질환':'disease','병력':'disease','복약':'medicine','약':'medicine','돌봄군':'careGroup'};
    const colIdx={};
    rows[0].forEach((h,i)=>{ const base=String(h).replace(/^﻿/,'').replace(/\(.*?\)/g,'').replace(/\s/g,'').trim(); const k=alias[base]; if(k&&colIdx[k]===undefined)colIdx[k]=i; });
    if(colIdx.name===undefined||colIdx.phone===undefined){ alert('양식에 "이름"과 "전화번호" 열이 있어야 합니다. CSV 양식을 받아 사용해 주세요.'); return; }
    const existPhones = new Set(elders.map(e=>String(e.phone||'').replace(/\D/g,'')));
    const seen = new Set();
    const parsed = rows.slice(1).map((r,ri)=>{
      const get=k=>colIdx[k]!==undefined?String(r[colIdx[k]]||'').trim():'';
      const name=get('name'); const phone=get('phone').replace(/\D/g,''); const gender=/남/.test(get('gender'))?'male':'female';
      const rec={ name, phone, age:get('age').replace(/\D/g,''), gender, title:get('title')||(gender==='male'?'할아버지':'할머니'), region:get('region'), caregiver:get('caregiver'), callTime:/^\d{1,2}:\d{2}$/.test(get('callTime'))?get('callTime'):'09:00', guardian:get('guardian'), guardianPhone:get('guardianPhone').replace(/\D/g,''), disease:get('disease'), medicine:get('medicine'), careGroup:/중점/.test(get('careGroup'))?'intensive':/일반/.test(get('careGroup'))?'general':'' };
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
    if(rows.length===0){ alert('등록할 유효한 행이 없습니다.'); return; }
    setCsvSaving(true); let ok=0, fail=0;
    for(const r of rows){
      const saved={...EMPTY_FORM, name:r.name, phone:r.phone, age:r.age, gender:r.gender, title:r.title, region:r.region, caregiver:r.caregiver, callTime:r.callTime, guardian:r.guardian, guardianPhone:r.guardianPhone, disease:r.disease, medicine:r.medicine, careGroup:r.careGroup||'', ...(CARE_GROUPS[r.careGroup]?{callCycle:'custom',callDays:[...CARE_GROUPS[r.careGroup].days]}:{}), id:Date.now()+Math.floor(Math.random()*100000), status:'normal', lastCall:'아직 없음', callActive:true };
      try{ const res=await authFetch(`${SERVER_URL}/elders/save`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(saved)}); const d=await res.json(); (d&&d.success)?ok++:fail++; }catch{ fail++; }
    }
    setCsvSaving(false); setCsvImport(null); await fetchElders();
    alert(`등록 완료: 성공 ${ok}명${fail?` · 실패 ${fail}명`:''}`);
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
    s.onerror = () => window.alert('주소 검색을 불러오지 못했습니다. 네트워크를 확인해 주세요.');
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

  // ── 로그인/회원가입 가드 ──
  // 1) 미로그인 → 로그인/회원가입  2) 로그인했지만 이메일 미인증 → 인증대기  3) 기관 미설정 → 기관설정
  if (authEnabled && !authChecked) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b'}}>로딩 중…</div>;
  // 이메일 미인증은 차단하지 않음(리마인더 배너로 안내). 미로그인/기관미설정만 차단.
  if (authEnabled && (!authUser || me?.needsProvision)) {
    return <AuthScreen authUser={authUser} needsProvision={me?.needsProvision} authFetch={authFetch} serverUrl={SERVER_URL} onReload={reloadUser} onProvisioned={fetchMe} />;
  }

  return (
    <div className="app">
      {callModal && (
        <div className="modal-overlay" onClick={()=>setCallModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-icon">📱</div>
            <div className="modal-title">{callModal.name} 어르신 앱으로<br/>수신 알림을 보내시겠습니까?</div>
            <div className="modal-sub">📱 영실이 앱 → 수신화면 표시 → 받기 클릭 → AI 영실이 대화</div>
            <div className="modal-btns">
              <button className="btn-secondary" onClick={()=>setCallModal(null)}>취소</button>
              <button className="btn-call" onClick={()=>makeCall(callModal)}>📱 앱으로 알림 보내기</button>
            </div>
          </div>
        </div>
      )}

      {csvImport && (
        <div className="modal-overlay" onClick={()=>!csvSaving&&setCsvImport(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:860,width:'95%',textAlign:'left'}}>
            <div className="modal-title" style={{textAlign:'left',marginBottom:8}}>📥 CSV 일괄 등록 미리보기</div>
            {(()=>{
              const ok=csvImport.rows.filter(r=>r._status==='ok').length;
              const dup=csvImport.rows.filter(r=>r._status==='dup').length;
              const err=csvImport.rows.filter(r=>r._status==='error').length;
              const willRegister=ok+(csvOverwrite?dup:0);
              return (<>
                <div style={{fontSize:13,marginBottom:12,display:'flex',gap:14,flexWrap:'wrap'}}>
                  <span style={{color:'#16a34a',fontWeight:700}}>✅ 등록 {ok}</span>
                  <span style={{color:'#f59e0b',fontWeight:700}}>⚠️ 중복 {dup}</span>
                  <span style={{color:'#dc2626',fontWeight:700}}>❌ 오류 {err}</span>
                  <span style={{color:'#64748b'}}>· 총 {csvImport.rows.length}행</span>
                </div>
                <div style={{maxHeight:'50vh',overflowY:'auto',border:'1px solid #e2e8f0',borderRadius:10}}>
                  <table className="table" style={{margin:0}}>
                    <thead><tr><th>행</th><th>상태</th><th>이름</th><th>전화번호</th><th>나이</th><th>지역</th><th>담당</th></tr></thead>
                    <tbody>
                      {csvImport.rows.map((r,i)=>{
                        const c=r._status==='ok'?{t:'등록',bg:'#f0fdf4',col:'#16a34a'}:r._status==='dup'?{t:'중복',bg:'#fffbeb',col:'#f59e0b'}:{t:'오류',bg:'#fef2f2',col:'#dc2626'};
                        return (<tr key={i} style={{background:c.bg}}>
                          <td style={{color:'#94a3b8',fontSize:12}}>{r._row}</td>
                          <td><span style={{fontSize:12,fontWeight:700,color:c.col}}>{c.t}{r._reason?` · ${r._reason}`:''}</span></td>
                          <td><strong>{r.name||'—'}</strong></td>
                          <td style={{fontSize:13}}>{r.phone||'—'}</td>
                          <td style={{fontSize:13}}>{r.age||'—'}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{r.region||'—'}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{r.caregiver||'—'}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                {dup>0 && (
                  <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12,fontSize:13,color:'#334155',cursor:'pointer'}}>
                    <input type="checkbox" checked={csvOverwrite} onChange={e=>setCsvOverwrite(e.target.checked)}/>
                    이미 등록된 어르신(중복 {dup}명)도 <b>덮어쓰기</b>로 갱신
                  </label>
                )}
                <div style={{fontSize:12,color:'#94a3b8',marginTop:10}}>· 오류 행은 등록에서 제외됩니다. 한글이 깨지면 엑셀에서 "CSV UTF-8"로 저장해 주세요.</div>
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
        const totalInput = Object.values(schedModal.days||{}).reduce((a,b)=>a+Number(b),0);
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
            <h3 style={{margin:'0 0 6px'}}>📅 급여제공 일정표</h3>
            <div style={{fontSize:13,color:'#64748b',marginBottom:8}}>날짜별 제공시간을 입력하고 저장하세요. 인쇄하면 공식 달력 양식(PDF)으로 출력됩니다.</div>
            <div style={{fontSize:12.5,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,padding:'7px 10px',marginBottom:12}}>
              💡 산정 규칙: 월 인정시간 <b>한도 120시간</b> · <b>주말·공휴일은 1.5배 인정</b> (2시간 근무 → 3시간 인정). 공휴일(<span style={{color:'#dc2626'}}>×1.5</span>)은 자동 표시되며, 평일 날짜를 클릭하면 공휴일로 지정/해제할 수 있어요.
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
                {[...DOW,'주 합계'].map((d,i)=>(<div key={d} style={{padding:'7px 4px',textAlign:'center',fontSize:13,fontWeight:800,color:i===0?'#fca5a5':i===6?'#93c5fd':'#fff'}}>{d}</div>))}
              </div>
              {calWeeks.map((w,wi)=>(
                <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr) 96px',borderTop:'1px solid #e2e8f0'}}>
                  {w.map((d,ci)=>(
                    <div key={ci} style={{padding:'6px 6px 8px',borderLeft:ci>0?'1px solid #f1f5f9':'none',background:d?(ci===0?'#fef7f7':ci===6?'#f6f9ff':'#fff'):'#fafafa',minHeight:62}}>
                      {d && <>
                        <div onClick={()=>toggleHoliday(d)} title={(dowOf(d)!==0&&dowOf(d)!==6)?'클릭: 공휴일 지정/해제 (1.5배 인정)':''}
                          style={{fontSize:12.5,fontWeight:800,color:is15(d)?'#dc2626':ci===6?'#2563eb':'#334155',marginBottom:4,cursor:(dowOf(d)!==0&&dowOf(d)!==6)?'pointer':'default'}}>
                          {m}/{d}{is15(d)&&<span style={{fontSize:10,marginLeft:3,fontWeight:900,color:'#7c3aed'}}>×1.5</span>}
                        </div>
                        <input type="number" min="0" max="24" step="0.5" className="form-input" style={{width:'100%',margin:0,padding:'5px 6px',fontSize:14,textAlign:'center'}}
                          value={(schedModal.days||{})[String(d)]??''} placeholder="시간" onChange={e=>setDay(d, e.target.value)}/>
                      </>}
                    </div>
                  ))}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',borderLeft:'2px solid #e2e8f0',background:'#f8fafc',fontSize:13.5,fontWeight:900,color:'#1e3a6e'}}>{rowSum(w)||''}{rowSum(w)?'시간':''}</div>
                </div>
              ))}
              <div style={{textAlign:'right',fontSize:15,fontWeight:900,color:overCap?'#dc2626':'#1e3a6e',background:overCap?'#fef2f2':'#eff6ff',padding:'9px 14px',borderTop:'1px solid #e2e8f0'}}>
                입력 {totalInput}시간 · <b>인정 {totalRec} / {SCHED_CAP}시간</b>{overCap && ' ⚠️ 한도 초과'}
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
                    <span onClick={()=>toggleHoliday(d)} style={{width:96,fontSize:13.5,fontWeight:700,color:is15(d)?'#dc2626':isSat?'#2563eb':'#334155',cursor:(!isSun&&!isSat)?'pointer':'default'}}
                      title={(!isSun&&!isSat)?'클릭: 공휴일 지정/해제 (1.5배 인정)':''}>
                      {m}/{d} ({DOW[dow]}){is15(d)&&<span style={{fontSize:10.5,marginLeft:3,fontWeight:900,color:'#7c3aed'}}>×1.5</span>}
                    </span>
                    <input type="number" min="0" max="24" step="0.5" className="form-input" style={{width:110,margin:0,padding:'6px 10px'}}
                      value={(schedModal.days||{})[String(d)]??''} placeholder="시간" onChange={e=>setDay(d, e.target.value)}/>
                    <span style={{fontSize:12.5,color:'#94a3b8'}}>시간{is15(d)&&(schedModal.days||{})[String(d)]?` → 인정 ${recOf(d)}시간`:''}</span>
                  </div>
                  {isSat && <div style={{textAlign:'right',fontSize:12.5,fontWeight:800,color:'#1e3a6e',background:'#f8fafc',padding:'4px 14px',borderTop:'1px dashed #e2e8f0'}}>주간 인정 합계 {weekSumUpTo(d)}시간</div>}
                </div>
                );
              })}
              <div style={{textAlign:'right',fontSize:14,fontWeight:900,color:overCap?'#dc2626':'#1e3a6e',background:overCap?'#fef2f2':'#eff6ff',padding:'8px 14px'}}>입력 {totalInput}시간 · <b>인정 {totalRec} / {SCHED_CAP}시간</b>{overCap && ' ⚠️ 한도 초과'}</div>
            </div>
            )}
            <div className="modal-btns" style={{justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              {isStaffUp ? <button className="btn-secondary" onClick={printScheduleBatch} title="이 달에 저장된 모든 이용자의 일정표를 한 번에 인쇄(PDF 한 파일)">🖨 일괄 출력</button> : <span/>}
              <div style={{display:'flex',gap:8}}>
                <button className="btn-secondary" onClick={()=>setSchedModal(null)}>닫기</button>
                <button className="btn-secondary" onClick={printSchedule}>🖨 양식 인쇄</button>
                <button className="btn-primary" onClick={saveSchedule} disabled={schedModal.saving||overCap} title={overCap?'월 인정시간 한도(120시간)를 초과해 저장할 수 없습니다':''}>{schedModal.saving?'저장 중…':overCap?'⚠️ 한도 초과':'💾 파일로 저장'}</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {weeklyModal && (
        <div className="modal-overlay" onClick={()=>{setWeeklyModal(null);setWeeklyDoc(null);}}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:winWide?1020:640,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
            <h3 style={{margin:'0 0 6px'}}>📄 주간업무 보고서 — 확인·수정·출력</h3>
            <div style={{fontSize:13,color:'#64748b',marginBottom:12}}>지원사가 앱에서 주차별로 작성(음성→텍스트)한 내용입니다. 오타를 고치고 지시사항을 적은 뒤 저장·출력하세요.</div>
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
                      {w._fromNotes && <span style={{fontSize:11.5,fontWeight:700,color:'#b45309',background:'#fef3c7',padding:'2px 8px',borderRadius:12}}>상담일지에서 자동 채움 — 저장 시 확정</span>}
                      <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
                        {Object.entries(CASE_TOPIC_META).map(([k,l])=>(
                          <label key={k} style={{display:'flex',alignItems:'center',gap:4,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                            <input type="checkbox" checked={(w.topics||[]).includes(k)}
                              onChange={e=>setW({topics:e.target.checked?[...(w.topics||[]),k]:(w.topics||[]).filter(t=>t!==k)})}/>
                            {l}
                          </label>
                        ))}
                      </div>
                    </div>
                    <textarea className="form-input" style={{width:'100%',minHeight:winWide?96:64,margin:0,fontSize:13.5,lineHeight:1.5}} value={w.content}
                      placeholder="이 주차 업무내용·특이사항 (지원사 앱에서 녹음하면 자동으로 채워집니다)"
                      onChange={e=>setW({content:e.target.value})}/>
                  </div>
                  );
                })}
                </div>
                <div style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',marginBottom:12}}>
                  <div style={{fontWeight:900,color:'#1e3a6e',marginBottom:6}}>전담인력 지시사항</div>
                  <textarea className="form-input" style={{width:'100%',minHeight:48,margin:0,fontSize:13.5}} value={weeklyDoc.note}
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
                <button className="btn-secondary" style={{whiteSpace:'nowrap'}} onClick={printWeeklyBatch} title="그 달에 저장된 보고서 전체를 한 번에 — PDF 한 파일">🖨 일괄 출력</button>
              </div>
              );
            })()}
            <div className="modal-btns" style={{justifyContent:'flex-end',gap:8}}>
              <button className="btn-secondary" onClick={()=>{setWeeklyModal(null);setWeeklyDoc(null);}}>닫기</button>
              <button className="btn-secondary" onClick={printWeeklyReport}>🖨 양식 출력</button>
              <button className="btn-primary" onClick={saveWeekly} disabled={!!(weeklyDoc&&weeklyDoc.saving)}>{weeklyDoc&&weeklyDoc.saving?'저장 중…':'💾 파일로 저장'}</button>
            </div>
          </div>
        </div>
      )}

      {noteModal && noteForm && (()=>{
        const L={display:'block',fontSize:13,fontWeight:700,color:'#334155',marginBottom:5,textAlign:'left'};
        const I={width:'100%',display:'block',boxSizing:'border-box',margin:0};
        const close=()=>{setNoteModal(null);setNoteForm(null);};
        return (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600,width:'94%',textAlign:'left'}}>
            <div className="modal-title" style={{textAlign:'left',marginBottom:18}}>{noteForm.id?'✏️ 상담·방문 일지 수정':'📝 새 상담·방문 일지'}</div>
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
                    <button key={k} type="button" onClick={()=>setNoteForm(f=>({...f,type:k}))} style={{fontSize:13,padding:'7px 13px',borderRadius:20,cursor:'pointer',fontWeight:600,border:'1px solid '+(noteForm.type===k?m.color:'#d1d5db'),background:noteForm.type===k?m.bg:'#fff',color:noteForm.type===k?m.color:'#374151'}}>{m.icon} {m.label}</button>
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
                    <label key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:14,fontWeight:600,color:'#374151',cursor:'pointer'}}>
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
                <label style={{fontSize:13,fontWeight:700,color:'#334155',display:'flex',alignItems:'center',gap:7,cursor:'pointer',margin:0}}>
                  <input type="checkbox" checked={noteForm.followUpNeeded} onChange={e=>setNoteForm(f=>({...f,followUpNeeded:e.target.checked}))} style={{width:16,height:16}}/> 🔔 후속조치 필요
                </label>
                {noteForm.followUpNeeded && <input type="date" className="form-input" style={{width:180,margin:0}} value={noteForm.followUpDue} onChange={e=>setNoteForm(f=>({...f,followUpDue:e.target.value}))}/>}
              </div>
            </div>
            <div className="modal-btns" style={{marginTop:20,justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={close}>취소</button>
              <button className="btn-secondary" onClick={()=>copyNote({elderName:noteForm.elderName,type:noteForm.type,category:noteForm.category,content:noteForm.content,action:noteForm.action,visitedAt:(noteForm.visitedDate&&noteForm.visitedTime)?`${noteForm.visitedDate}T${noteForm.visitedTime}`:new Date().toISOString(),followUp:{needed:noteForm.followUpNeeded,dueDate:noteForm.followUpDue}},'modal')} title="정부 노인맞춤돌봄시스템 등에 붙여넣기용 텍스트 복사">{copiedNoteId==='modal'?'✅ 복사됨':'📋 복사'}</button>
              <button className="btn-primary" onClick={saveNote} disabled={noteSaving}>{noteSaving?'저장 중...':(noteForm.id?'수정 저장':'일지 저장')}</button>
            </div>
          </div>
        </div>
        );
      })()}

      <aside className="sidebar">
        <div className="logo" onClick={()=>goPage('dashboard')} style={{cursor:'pointer'}} title="대시보드 홈으로">
          <img src="/youngsili.png" alt="영실이" className="logo-icon" style={{width:42,height:42,borderRadius:12,objectFit:'cover',padding:0}} />
          <div><div className="logo-title">영실이</div><div className="logo-sub">복지사 관리 시스템</div></div>
        </div>
        <nav className="nav">
          {[
            {id:'dashboard', icon:'⊞', label:'대시보드'},
            {id:'elders',    icon:'👥', label:`${T.elder} 관리`},
            // 활동지원 기관: 일지·서식이 주 업무 → 상단 배치, 노인돌봄 전용(안전확인·건강·공공데이터)은 숨김.
            // AI 안부전화는 보조 기능으로 유지(발신·멘트·통화기록).
            ...(isDisability ? [
              {id:'casenotes', icon:'📝', label:'상담·방문 일지'},
              {id:'forms',     icon:'📥', label:'보고서·서식'},
              {id:'report',    icon:'📊', label:'리포트 / 통계'},
              {id:'schedule',  icon:'📅', label:'전화 발신 관리'},
              {id:'script',    icon:'✍️', label:'전화 멘트 관리'},
              {id:'calls',     icon:'📞', label:'통화 기록'},
            ] : [
              {id:'safety',    icon:'✅', label:'안전확인 관리'},
              {id:'schedule',  icon:'📅', label:'전화 발신 관리'},
              {id:'script',    icon:'✍️', label:'전화 멘트 관리'},
              {id:'calls',     icon:'📞', label:'통화 기록'},
              {id:'health', icon:'💊', label: alertCount > 0 ? `건강 상태 🔴${alertCount}` : '건강 상태'},
              {id:'casenotes', icon:'📝', label:'상담·방문 일지'},
              {id:'forms',     icon:'📥', label:'보고서·서식'},
              {id:'report',    icon:'📊', label:'리포트 / 통계'},
              {id:'data',      icon:'🗺️', label:'공공데이터 현황'},
            ]),
            ...(isStaffUp ? [{id:'admin', icon: isSuper?'🏢':'👥', label: isSuper?'기관 관리':'구성원 관리'}] : []),
            {id:'help',      icon:'📖', label: hasNewNotice ? '도움말 보기 🔴' : '도움말 보기'},
          ].map(item=>(
            <button key={item.id}
              className={`nav-item ${(page===item.id||(page==='detail'&&item.id==='elders')||(page==='register'&&item.id==='elders'))?'active':''}`}
              onClick={()=>goPage(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="worker-info">
            <div className="worker-avatar">복</div>
            <div><div className="worker-name">{me?.orgName || (isSuper ? '운영자' : `${T.worker} 관리`)}</div><div className="worker-region">{authEnabled&&authUser?authUser.email:'대구광역시'}{isSuper?' · 운영자':''}</div></div>
          </div>
          {me?.orgCode && (
            <div onClick={copyOrgCode} title="클릭하면 복사 · 어르신 앱 등록 시 입력" style={{marginTop:10,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:11,color:'#93c5fd'}}>🏢 기관코드</span>
              <span style={{fontSize:14,fontWeight:800,letterSpacing:1,color:'#fff',fontFamily:'monospace'}}>{me.orgCode}</span>
              <span style={{marginLeft:'auto',fontSize:11,color:orgCopied?'#4ade80':'#94a3b8'}}>{orgCopied?'✓ 복사됨':'📋 복사'}</span>
            </div>
          )}
          {authEnabled&&authUser&&<button onClick={doLogout} style={{marginTop:10,width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #cbd5e1',background:'#fff',color:'#475569',fontSize:13,fontWeight:600,cursor:'pointer'}}>로그아웃</button>}
        </div>
      </aside>

      <main className="main">
        {authEnabled && authUser && !authUser.emailVerified && (
          <div style={{background:'#fffbeb',borderBottom:'1px solid #fde68a',padding:'10px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',fontSize:14}}>
            <span style={{color:'#b45309',fontWeight:700}}>📧 이메일 인증을 완료해 주세요.</span>
            <span style={{color:'#92400e'}}>{authUser.email}로 보낸 메일의 링크를 클릭하시면 됩니다. (지금도 사용 가능)</span>
            <span style={{flex:1}}/>
            {verifyNote && <span style={{color:'#166534',fontSize:13}}>{verifyNote}</span>}
            <button className="btn-secondary" style={{fontSize:13,padding:'6px 12px'}} disabled={verifyCooldown>0} onClick={resendVerify}>{verifyCooldown>0?`재발송 (${verifyCooldown}초)`:'인증 메일 재발송'}</button>
            <button className="btn-secondary" style={{fontSize:13,padding:'6px 12px'}} onClick={reloadUser}>인증 완료 → 새로고침</button>
          </div>
        )}
        <header className="header">
          <div className="header-title">
            {page==='dashboard'&&'대시보드'}{page==='elders'&&`${T.elder} 관리`}{page==='schedule'&&'전화 발신 관리'}
            {page==='safety'&&'✅ 안전확인 관리'}{page==='calls'&&'통화 기록'}{page==='script'&&'전화 멘트 관리'}{page==='report'&&'리포트 / 통계'}{page==='data'&&'공공데이터 현황'}{page==='health'&&'💊 건강 상태 현황'}{page==='casenotes'&&'📝 상담·방문 일지'}{page==='forms'&&'📥 보고서·서식'}{page==='admin'&&(isSuper?'🏢 기관 관리 (운영자)':'👥 구성원 관리')}{page==='help'&&'📖 도움말 보기'}
            {page==='detail'&&`${T.elder} 상세 정보`}{page==='register'&&(editMode?`${T.elder} 정보 수정`:`${T.elder} 신규 등록`)}
          </div>
          <div className="header-date">{new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</div>
        </header>

        <div className="content">
          <PageErrorBoundary key={page}>

          {page==='dashboard' && (
            <div className="fade-in">
              {(() => {
                const alerts = [];
                // 1) 통화 중 위험 키워드 감지 — 서버 알림(alertsData) 직접 표시 (키워드+시각, localStorage 매칭 무관)
                //    keyword 필드가 비어도(구버전 서버) message에서 "감지: 뒤"를 파싱해 키워드만 깔끔히.
                alertsData
                  .filter(a => !a.read && (a.level === 'critical' || a.level === 'urgent') && alertIsReal(a))
                  .slice(0, 10)
                  .forEach(a => {
                    const kw = alertKw(a);
                    const el = elders.find(e => e.name === a.name);
                    const code = alertEnCode(a);   // missed/help/safe 등 코드 알림은 문구 자체가 설명 → 따옴표 없이
                    alerts.push({ elder: el, name: a.name, msg: code ? `${kw} → ${code === 'missed' ? '안전확인 필요' : '즉시 확인'}` : `"${kw}" 위험 키워드 감지`, time: a.timestamp, color: a.level === 'critical' ? '#ef4444' : '#f59e0b', bg: a.level === 'critical' ? '#fef2f2' : '#fffbeb', icon: code === 'missed' ? '📵' : code ? '🆘' : '🚨' });
                  });
                // 2) 미응답 (어르신 데이터 기반)
                elders.forEach(e => {
                  const days = getNoResponseDays(e.lastCall, e.lastCallAt);
                  // 통화이력 없음(99 sentinel=신규)은 '미응답'이 아님 → 긴급 알림 제외. 실제 무응답(3~98일)만 알림.
                  if (days >= 3 && days < 99) alerts.push({ elder: e, type: 'noResponse', msg: `${days}일째 미응답 → 즉시 확인 필요`, color: '#ef4444', bg: '#fef2f2', icon: '📵' });
                });
                const heatwaveElders = elders.filter(e => weatherData[e.region]?.alert === 'heatwave');
                if (heatwaveElders.length > 0) alerts.push({ type: 'weather', msg: `폭염경보 → ${heatwaveElders.map(e=>e.name).join(', ')} 어르신 안전 확인 필요`, color: '#f59e0b', bg: '#fffbeb', icon: '🌡️' });
                if (alerts.length === 0) return null;
                return (
                  <div className="alert-center">
                    <div className="alert-center-title">🔔 실시간 위험 알림</div>
                    {alerts.map((a, i) => (
                      <div key={i} className="alert-center-item" style={{borderLeftColor: a.color, background: a.bg}} onClick={() => a.elder && openDetail(a.elder)}>
                        <span className="alert-center-icon">{a.icon}</span>
                        <div className="alert-center-content">
                          {(a.elder || a.name) && <span className="alert-center-name">{a.elder ? `${a.elder.name} (${a.elder.age}세)` : a.name}</span>}
                          <span className="alert-center-msg">{a.msg}</span>
                          {a.time && <span className="alert-center-time" style={{fontSize:12,color:'#9ca3af',marginLeft:6}}>{new Date(a.time).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>}
                        </div>
                        {a.elder && <button className="btn-call-sm" onClick={e=>{e.stopPropagation();setCallModal(a.elder);}}>📱 앱 전화</button>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="stat-grid">
                <div className="stat-card stat-total"><div className="stat-num">{elders.length}</div><div className="stat-label">총 담당 어르신</div><div className="stat-icon">👥</div></div>
                <div className="stat-card stat-danger"><div className="stat-num">{danger}</div><div className="stat-label">위험 감지</div><div className="stat-icon">🚨</div></div>
                <div className="stat-card stat-warning"><div className="stat-num">{warning}</div><div className="stat-label">주의 필요</div><div className="stat-icon">⚠️</div></div>
                <div className="stat-card stat-normal"><div className="stat-num">{normal}</div><div className="stat-label">정상</div><div className="stat-icon">✅</div></div>
              </div>

              <div className="dash-two-col">
                <div className="dash-col-left">
                  <div className="section">
                    <div className="section-title">📞 오늘 통화 현황</div>
                    <div className="call-summary">
                      <div className="call-stat" style={{cursor:'pointer'}} title="발신 이력 보기" onClick={()=>drillDispatch('all')}><div className="call-num" style={{color:'#1d4ed8'}}>{dispatchTotal}건</div><div className="call-label">발신</div></div>
                      <div className="call-stat" style={{cursor:'pointer'}} title="받은 통화 보기" onClick={()=>drillDispatch('received')}><div className="call-num" style={{color:'#16a34a'}}>{answeredCount}건</div><div className="call-label">받음</div></div>
                      <div className="call-stat" style={{cursor:'pointer'}} title="부재중만 보기 → 재발신" onClick={()=>drillDispatch('missed')}><div className="call-num" style={{color:'#ea580c'}}>{missedCount}건</div><div className="call-label">부재중</div></div>
                      <div className="call-stat" style={{borderLeft:'1px solid #e2e8f0',cursor:'pointer'}} title="긴급 통화 보기" onClick={()=>drillCalls('critical')}><div className="call-num" style={{color:'#ef4444'}}>{criticalCount}건</div><div className="call-label">긴급 키워드</div></div>
                      <div className="call-stat" style={{cursor:'pointer'}} title="주의 통화 보기" onClick={()=>drillCalls('urgent')}><div className="call-num" style={{color:'#f59e0b'}}>{urgentCount}건</div><div className="call-label">주의 키워드</div></div>
                      <div className="call-stat" style={{cursor:'pointer'}} title="정상 통화 보기" onClick={()=>drillCalls('normal')}><div className="call-num" style={{color:'#22c55e'}}>{normalCount}건</div><div className="call-label">정상 통화</div></div>
                    </div>
                    <div style={{fontSize:12,color:'#94a3b8',marginTop:8}}>· 숫자를 클릭하면 해당 통화·발신 목록으로 이동합니다. (발신 = 받음 + 부재중, 긴급·주의·정상은 받은 통화의 위험 분류)</div>
                  </div>

                  {(() => {
                    // ⚠️ 오늘 안전확인 미완료 보드 — 부재중(자동 재발신 소진)·발신실패로 끝나고 오늘 성공 통화가 없는 어르신
                    // (안전확인의 핵심 = 응답 없는 어르신을 놓치지 않기 → 담당자 재발신/방문으로 폐루프)
                    const { unchecked, undialed } = safetyToday();
                    if (!unchecked.length && !undialed) return null;
                    return (
                      <div className="section" style={unchecked.length ? { borderLeft: '4px solid #dc2626' } : {}}>
                        <div className="section-title">⚠️ 오늘 안전확인 미완료 {unchecked.length > 0 && <span style={{ color: '#dc2626' }}>{unchecked.length}명</span>}</div>
                        {unchecked.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✅ 발신한 어르신은 모두 안전확인 완료됐습니다.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {unchecked.map(({ e, d }) => (
                              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: d.status === 'missed' ? '#fff7ed' : '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
                                <div style={{ minWidth: 90, fontWeight: 800 }}>{e.name}</div>
                                <div style={{ minWidth: 80, fontSize: 13, color: '#64748b' }}>{e.region}</div>
                                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: d.status === 'missed' ? '#ea580c' : '#dc2626' }}>
                                  {d.status === 'missed' ? `📵 부재중 — 자동 재발신 ${d.retryCount || 0}회에도 무응답` : `❌ 발신 실패${d.reason ? ` (${d.reason})` : ''}`}
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{d.sentAtIso ? new Date(d.sentAtIso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                <button className="btn-call" style={{ fontSize: 12, padding: '5px 12px' }} disabled={calling === e.id} onClick={() => makeCall(e)}>{calling === e.id ? '📱 발신 중…' : '📞 재발신'}</button>
                              </div>
                            ))}
                            <div style={{ fontSize: 12.5, color: '#dc2626', fontWeight: 600 }}>🚨 재발신에도 무응답이면 직접 전화 또는 방문 확인이 필요합니다.</div>
                          </div>
                        )}
                        {undialed > 0 && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>· 오늘 아직 발신하지 않은 어르신 {undialed}명 (전화 발신 관리에서 발신)</div>}
                      </div>
                    );
                  })()}

                  <div className="section">
                    <div className="section-title">⚡ 빠른 실행</div>
                    <div className="quick-actions">
                      <button className="quick-btn quick-danger" onClick={()=>goPage('schedule')}><span>🚨</span><span>위험 어르신만 전화</span><span className="quick-count">{elders.filter(e=>e.status!=='normal').length}명</span></button>
                      <button className="quick-btn quick-all" onClick={()=>goPage('schedule')}><span>📱</span><span>전체 일괄 앱 알림</span><span className="quick-count">{elders.filter(e=>e.callActive).length}명</span></button>
                      <button className="quick-btn" style={{background:'#f0fdf4',border:'2px solid #bbf7d0'}} onClick={()=>goPage('health')}><span>💊</span><span>건강 상태 확인</span>{alertCount > 0 && <span className="quick-count" style={{background:'#dc2626'}}>{alertCount}건</span>}</button>
                      <button className="quick-btn quick-report" onClick={()=>goPage('report')}><span>📋</span><span>오늘 리포트 출력</span></button>
                      <button className="quick-btn quick-register" onClick={openRegister}><span>➕</span><span>어르신 신규 등록</span></button>
                    </div>
                  </div>
                </div>

                <div className="dash-col-right">
                  <div className="section">
                    <div className="section-title">📝 메모 / 공지</div>
                    <div className="memo-input-wrap">
                      <input className="memo-input" placeholder="메모 추가..." value={memoText} onChange={e=>setMemoText(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'&&memoText.trim()){const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});setMemos(prev=>[{id:Date.now(),text:memoText.trim(),time:now,done:false},...prev]);setMemoText('');}}}/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:13}} onClick={()=>{if(!memoText.trim())return;const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});setMemos(prev=>[{id:Date.now(),text:memoText.trim(),time:now,done:false},...prev]);setMemoText('');}}>추가</button>
                    </div>
                    <div className="memo-list">
                      {memos.map(memo=>(
                        <div key={memo.id} className={`memo-item ${memo.done?'memo-done':''}`}>
                          <div className="memo-check" onClick={()=>setMemos(prev=>prev.map(m=>m.id===memo.id?{...m,done:!m.done}:m))}>{memo.done?'✅':'⬜'}</div>
                          <div className="memo-text">{memo.text}</div>
                          <div className="memo-time">{memo.time}</div>
                          <button className="memo-del" onClick={()=>setMemos(prev=>prev.filter(m=>m.id!==memo.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="dash-section-header">
                  <div className="section-title">👥 전체 어르신 현황</div>
                  <button className="btn-primary" onClick={openRegister}>+ 신규 등록</button>
                </div>
                <table className="table">
                  <thead><tr><th>어르신</th><th>나이</th><th>지역</th><th>담당 복지사</th><th>마지막 통화</th><th>미응답</th><th>고독사위험</th><th>상태</th><th>즉시 전화</th></tr></thead>
                  <tbody>
                    {elders.sort((a,b)=>{const order={danger:0,warning:1,normal:2};return order[a.status]-order[b.status];}).map(elder=>{
                      const risk = getSolitudeRisk(elder);
                      const days = getNoResponseDays(elder.lastCall, elder.lastCallAt);
                      return (
                        <tr key={elder.id} style={{cursor:'pointer'}} onClick={()=>openDetail(elder)}>
                          <td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:18}}>{elder.gender==='female'?'👵':'👴'}</span><span style={{fontWeight:700}}>{elder.name}</span>{elder.keyword&&<span className="keyword-tag">"{elder.keyword}"</span>}</div></td>
                          <td>{elder.age}세</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.region}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{renderLastCall(elder)}</td>
                          <td>{days===0?<span style={{color:'#22c55e',fontWeight:700,fontSize:12}}>정상</span>:<span style={{color:days>=3?'#ef4444':'#f59e0b',fontWeight:700,fontSize:12}}>{days>=99?'통화이력 없음':`${days}일`}</span>}</td>
                          <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                          <td><div className={`status-badge badge-${elder.status}`}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</div></td>
                          <td onClick={e=>e.stopPropagation()}><button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'⏳':'📱 전화'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page==='safety' && (
            <div className="fade-in">
              <div className="data-banner" style={{marginBottom:16}}>
                <div>
                  <div className="data-banner-title">✅ 안전확인 관리</div>
                  <div className="data-banner-sub">노인맞춤돌봄서비스 전화 안전확인 기준 — 일반돌봄군 주 2회 · 중점돌봄군 주 1회(방문이 주 2회) · 🔄 15초마다 자동 갱신됩니다</div>
                </div>
              </div>
              {(() => {
                const st = safetyToday();
                // ── 이번 주(월~오늘) 주기 준수 집계 — 성공 통화가 있었던 '날 수' 기준 ──
                const now = new Date();
                const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
                const mondayStr = monday.toLocaleDateString('sv-SE');
                const norm = (ph) => String(ph || '').replace(/\D/g, '');
                const weekDays = {};
                callsHistory.forEach(c => { if ((c.date || '') >= mondayStr) { const ph = norm(c.phone); if (ph) (weekDays[ph] = weekDays[ph] || new Set()).add(c.date); } });
                const rows = elders.filter(e => e.callActive !== false && norm(e.phone)).map(e => {
                  const g = CARE_GROUPS[e.careGroup];
                  const target = g ? g.weeklyCalls : (e.callCycle === 'custom' ? (e.callDays || []).length : 7);
                  const done = (weekDays[norm(e.phone)] || new Set()).size;
                  return { e, g, target, done, met: target > 0 && done >= target };
                }).filter(r => r.target > 0);
                const totT = rows.reduce((sum, r) => sum + r.target, 0);
                const totD = rows.reduce((sum, r) => sum + Math.min(r.done, r.target), 0);
                const rate = totT ? Math.round(totD / totT * 100) : 0;
                const sorted = [...rows].sort((a, b) => (a.met === b.met ? (a.done / a.target) - (b.done / b.target) : (a.met ? 1 : -1)));
                const nNone = elders.filter(e => e.callActive !== false && !CARE_GROUPS[e.careGroup]).length;
                const nGen = elders.filter(e => e.careGroup === 'general').length;
                const nInt = elders.filter(e => e.careGroup === 'intensive').length;
                return (<>
                  <div className="report-stat-grid" style={{marginBottom:16}}>
                    <div className="report-stat-card"><div className="report-stat-icon">✅</div><div className="report-stat-value" style={{color:'#16a34a'}}>{st.checkedCount}명</div><div className="report-stat-label">오늘 안전확인 완료</div></div>
                    <div className="report-stat-card"><div className="report-stat-icon">⚠️</div><div className="report-stat-value" style={{color:st.unchecked.length?'#dc2626':'#16a34a'}}>{st.unchecked.length}명</div><div className="report-stat-label">오늘 미확인 (부재중·실패)</div></div>
                    <div className="report-stat-card"><div className="report-stat-icon">📞</div><div className="report-stat-value" style={{color:'#64748b'}}>{st.undialed}명</div><div className="report-stat-label">오늘 미발신</div></div>
                    <div className="report-stat-card"><div className="report-stat-icon">📅</div><div className="report-stat-value" style={{color:rate>=80?'#16a34a':rate>=50?'#f59e0b':'#dc2626'}}>{rate}%</div><div className="report-stat-label">이번 주 주기 준수율</div></div>
                  </div>

                  {st.unchecked.length > 0 && (
                    <div className="section" style={{borderLeft:'4px solid #dc2626'}}>
                      <div className="section-title">⚠️ 오늘 미확인 어르신 — 우선 대응</div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {st.unchecked.map(({ e, d }) => (
                          <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,background:d.status==='missed'?'#fff7ed':'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 14px',flexWrap:'wrap'}}>
                            <div style={{minWidth:90,fontWeight:800,color:'#1d4ed8',cursor:'pointer'}} title="클릭 → 돌봄군·주기 설정" onClick={()=>openEditSchedule(e)}>{e.name}</div>
                            <div style={{minWidth:80,fontSize:13,color:'#64748b'}}>{e.region}</div>
                            <div style={{flex:1,fontSize:13,fontWeight:700,color:d.status==='missed'?'#ea580c':'#dc2626'}}>
                              {d.status==='missed' ? `📵 부재중 — 자동 재발신 ${d.retryCount||0}회에도 무응답` : `❌ 발신 실패${d.reason?` (${d.reason})`:''}`}
                            </div>
                            <button className="btn-call" style={{fontSize:12,padding:'5px 12px'}} disabled={calling===e.id} onClick={()=>makeCall(e)}>{calling===e.id?'📱 발신 중…':'📞 재발신'}</button>
                          </div>
                        ))}
                        <div style={{fontSize:12.5,color:'#dc2626',fontWeight:600}}>🚨 재발신에도 무응답이면 직접 전화 또는 방문 확인 후, 상담·방문 일지에 기록해 주세요.</div>
                      </div>
                    </div>
                  )}

                  <div className="section">
                    <div className="section-title">📅 이번 주 주기 준수 현황 <span style={{fontSize:12,fontWeight:600,color:'#94a3b8'}}>(월요일~오늘 · 통화 성공한 날 수 기준 · 돌봄군: 일반 {nGen}명 · 중점 {nInt}명)</span></div>
                    <div style={{overflowX:'auto'}}>
                      <table className="table" style={{width:'100%'}}>
                        <thead><tr><th>어르신</th><th>돌봄군</th><th>주간 목표</th><th>이번 주 통화</th><th>상태</th><th></th></tr></thead>
                        <tbody>
                          {sorted.map(({ e, g, target, done, met }) => (
                            <tr key={e.id} style={met?{}:{background:'#fffbeb'}}>
                              <td style={{fontWeight:700,color:'#1d4ed8',cursor:'pointer'}} title="클릭 → 돌봄군·주기 설정" onClick={()=>openEditSchedule(e)}>{e.name} <span style={{fontSize:12,color:'#94a3b8',fontWeight:400}}>{e.region}</span></td>
                              <td>{g ? <span style={{fontSize:12,fontWeight:800,color:g.color,background:`${g.color}15`,padding:'2px 8px',borderRadius:6}}>{g.label}</span> : <span style={{fontSize:12,color:'#94a3b8'}}>미지정</span>}</td>
                              <td>{target}회</td>
                              <td style={{fontWeight:800,color:met?'#16a34a':'#f59e0b'}}>{done}회</td>
                              <td>{met ? <span style={{color:'#16a34a',fontWeight:700}}>✅ 달성</span> : <span style={{color:'#f59e0b',fontWeight:700}}>⏳ 진행 중 ({done}/{target})</span>}</td>
                              <td>{!met && <button className="btn-secondary" style={{fontSize:12,padding:'3px 10px'}} disabled={calling===e.id} onClick={()=>makeCall(e)}>📞 발신</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {nNone > 0 && <div style={{fontSize:12,color:'#94a3b8',marginTop:8}}>· 돌봄군 미지정 어르신 {nNone}명은 설정된 전화 주기를 목표로 계산합니다. 위 표에서 어르신 이름을 클릭하면 바로 돌봄군·주기를 설정할 수 있습니다 (제도 기준: 일반 주2회·중점 주1회).</div>}
                  </div>
                </>);
              })()}
            </div>
          )}

          {page==='schedule' && (
            <div className="fade-in">
              {(() => {
                // 어르신별 최신 응답만(safe/help/missed) → help·missed를 상단으로(우선대응)
                const latest = {};
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
                      <div className="section-title" style={{margin:0}}>🔥 경보 응답 현황 <span style={{fontSize:12,fontWeight:600,color:'#94a3b8'}}>(최근 24시간분 표시 · 15초 자동 갱신{checkedCnt>0?` · 확인됨 ${checkedCnt}건 숨김`:''})</span></div>
                      <div style={{display:'flex',gap:10,fontSize:13,fontWeight:700}}>
                        <span style={{color:'#dc2626'}}>🚨 {nHelp}</span>
                        <span style={{color:'#ea580c'}}>⚠️ {nMissed}</span>
                        <span style={{color:'#16a34a'}}>✅ {nSafe}</span>
                        <button className="btn-secondary" style={{fontSize:12,padding:'2px 8px'}} onClick={()=>loadAlertResponses()}>🔄</button>
                      </div>
                    </div>
                    {list.length === 0 && <div style={{marginTop:10,fontSize:13,color:'#16a34a',fontWeight:600}}>✅ 모든 응답이 확인 처리됐습니다. (확인됨 {checkedCnt}건 · 24시간 경과 시 자동으로 사라집니다)</div>}
                    <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
                      {list.map((r, i) => {
                        const c = cfg[r.response] || cfg.safe;
                        return (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:12,background:c.bg,border:`1px solid ${c.color}30`,borderRadius:10,padding:'10px 14px',flexWrap:'wrap'}}>
                            <span style={{fontSize:20}}>{c.icon}</span>
                            <div style={{minWidth:90}}>
                              <div style={{fontWeight:800,color:'#1f2937'}}>{r.elderName || '어르신'}</div>
                              <div style={{fontSize:12,color:'#94a3b8'}}>{r.phone}</div>
                            </div>
                            <span style={{fontWeight:800,color:c.color,fontSize:14,minWidth:74}}>{c.label}</span>
                            <span style={{fontSize:12.5,color:'#64748b',flex:1}}>{c.desc}{r.response==='missed'&&r.retryCount?` (재발신 ${r.retryCount}회)`:''}</span>
                            <span style={{fontSize:11.5,color:'#94a3b8'}}>{stageLabel[r.alertStage]||''} · {fmtTime(r.at)}</span>
                            {(r.response==='help'||r.response==='missed') && (
                              <button className="btn-secondary" style={{fontSize:12,padding:'4px 10px'}}
                                onClick={()=>openNewNote({ elderPhone:r.phone, elderName:r.elderName, type:'phone', category:'safety',
                                  content:`[산불 경보 ${stageLabel[r.alertStage]||''}] ${r.response==='help'?'어르신이 "도와줘" — 도움 요청':`미응답(자동 재발신 ${r.retryCount||0}회 후)`}. 조치 확인 필요.`,
                                  linkedAlertId:`alertresp_${r.id}` })}>📝 일지</button>
                            )}
                            <button className="btn-secondary" style={{fontSize:12,padding:'4px 10px'}}
                              title="확인 처리 — 목록에서 숨겨집니다(기록은 월간 실적에 보존)"
                              onClick={async()=>{await authFetch(`${SERVER_URL}/alert/responses/${r.id}/check`,{method:'POST'}).catch(()=>{});loadAlertResponses(true);}}>✔ 확인</button>
                          </div>
                        );
                      })}
                    </div>
                    {(nHelp>0||nMissed>0) && <div style={{marginTop:10,fontSize:12.5,color:'#ea580c',fontWeight:600}}>🚨 도움 요청·미응답 어르신을 먼저 확인하세요. 목록 상단에 자동 정렬됩니다.</div>}
                  </div>
                );
              })()}
              <div className="bulk-toolbar">
                <div className="bulk-left">
                  <div className="bulk-title">스마트 선택</div>
                  <div className="smart-filters">
                    {[{id:'all',label:'전체',count:elders.length},{id:'danger',label:'⚠️ 위험/주의만',count:elders.filter(e=>e.status!=='normal').length},{id:'noCall',label:'📞 발신 대상',count:elders.filter(e=>e.lastCall==='아직 없음'||(e.lastCall||'').includes('어제')).length},{id:'active',label:'✅ 활성만',count:elders.filter(e=>e.callActive).length}].map(f=>(
                      <button key={f.id} className={`smart-btn ${smartFilter===f.id?'smart-active':''}`} onClick={()=>applySmartFilter(f.id)}>{f.label} <span className="filter-count">{f.count}</span></button>
                    ))}
                  </div>
                </div>
                <div className="bulk-right">
                  <span className="check-count">{checked.length}명 선택됨</span>
                  <button className="btn-secondary" onClick={checkAll}>전체선택</button>
                  <button className="btn-secondary" onClick={uncheckAll}>선택해제</button>
                  {!bulkRunning && checked.length > batchSize && (
                    <span style={{fontSize:12,color:'#64748b',display:'flex',alignItems:'center',gap:4}} title="AI서버 동시통화 부하를 줄이려 나눠서 발신합니다">
                      배치 <input type="number" min="1" max="50" value={batchSize} onChange={e=>setBatchSize(Math.max(1,Number(e.target.value)||1))} style={{width:42,padding:'3px 4px',border:'1px solid #cbd5e1',borderRadius:6,textAlign:'center'}}/>명/
                      <input type="number" min="0" max="600" value={batchIntervalSec} onChange={e=>setBatchIntervalSec(Math.max(0,Number(e.target.value)||0))} style={{width:48,padding:'3px 4px',border:'1px solid #cbd5e1',borderRadius:6,textAlign:'center'}}/>초
                    </span>
                  )}
                  {!bulkRunning
                    ? <button className={`btn-bulk-call ${checked.length===0?'btn-disabled':''}`} onClick={()=>startBulkCall()} disabled={checked.length===0}>📱 앱 알림 발신 ({checked.length}명)</button>
                    : <button className="btn-bulk-stop" onClick={stopBulkCall}>⏹ 발신 중단</button>
                  }
                </div>
              </div>

              {(bulkRunning || bulkDone.length > 0) && (
                <div className="bulk-progress-box">
                  <div className="bulk-progress-header">
                    <span className="bulk-progress-title">{bulkRunning?'📱 앱 알림 발신 중...':'✅ 발신 완료'}</span>
                    <span className="bulk-progress-count">{bulkDone.length} / {bulkQueue.length}</span>
                  </div>
                  <div className="bulk-bar-wrap"><div className="bulk-bar" style={{width:`${bulkQueue.length?bulkDone.length/bulkQueue.length*100:0}%`}}/></div>
                  {batchWait > 0 && <div style={{fontSize:13,color:'#f59e0b',fontWeight:700,margin:'8px 0'}}>⏳ AI서버 부하 분산 — 다음 {batchSize}명 발신까지 {batchWait}초 대기…</div>}
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
                            isCurrent ? '⏳ 발신 중'
                            : !done ? '⏸ 대기'
                            : done.status==='ringing' ? '📲 수신대기'
                            : done.status==='answered' ? '📞 통화중'
                            : done.status==='completed' ? `✅ 받음 (${done.durationSec||0}초)`
                            : done.status==='missed' ? '📵 부재중'
                            : (done.status==='failed'||done.success===false) ? '❌ 발신실패'
                            : '✅ 전송됨'
                          }</span>
                        </div>
                      );
                    })}
                  </div>
                  {!bulkRunning && bulkDone.length>0 && (
                    <div className="bulk-summary">
                      <span className="bulk-success-count">✅ 받음 {bulkDone.filter(d=>d.status==='completed'||d.status==='answered').length}</span>
                      <span style={{color:'#f59e0b',fontWeight:700}}>📲 수신대기 {bulkDone.filter(d=>d.status==='ringing').length}</span>
                      <span className="bulk-fail-count">📵 부재중 {bulkDone.filter(d=>d.status==='missed').length} · ❌ 실패 {bulkDone.filter(d=>d.status==='failed').length}</span>
                      {bulkDone.filter(d=>d.status==='missed').length>0 && <button className="btn-bulk-call" onClick={resendMissed}>📵 부재중 {bulkDone.filter(d=>d.status==='missed').length}명 다시 발신</button>}
                      <button className="btn-secondary" onClick={()=>{setBulkDone([]);setBulkQueue([]);setChecked([]);}}>닫기</button>
                    </div>
                  )}
                </div>
              )}

              {/* 발신 이력(날짜별) — 언제 발신했는지 복지사/관리자가 확인 */}
              <div className="section">
                <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                  <span>📋 발신 이력</span>
                  <span style={{display:'flex',gap:6}}>
                    {[7,30].map(d=>(
                      <button key={d} onClick={()=>setHistDays(d)} className={`smart-btn ${histDays===d?'smart-active':''}`} style={{fontSize:12,padding:'4px 10px'}}>최근 {d}일</button>
                    ))}
                    <button onClick={()=>loadDispatchHistory(histDays)} className="btn-secondary" style={{fontSize:12,padding:'4px 10px'}}>🔄 새로고침</button>
                    <span style={{fontSize:11,color:'#94a3b8',alignSelf:'center'}}>· 15초마다 자동 갱신</span>
                    {histStatus!=='all' && <button onClick={()=>setHistStatus('all')} style={{fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:20,border:'1px solid #fdba74',background:'#fff7ed',color:'#ea580c',cursor:'pointer'}}>{histStatus==='missed'?'📵 부재중만':'✅ 받음만'} ✕</button>}
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
                  const groups={};
                  filtered.forEach(x=>{ const dk=(x.sentAtIso||'').slice(0,10)||'미상'; (groups[dk]=groups[dk]||[]).push(x); });
                  return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>{
                    const recv=rows.filter(r=>r.status==='completed'||r.status==='answered').length;
                    const miss=rows.filter(r=>r.status==='missed').length;
                    const sorted=rows.slice().sort((a,b)=>String(b.sentAtIso).localeCompare(String(a.sentAtIso)));
                    const open=expandedHistDays.has(date);
                    const shown=open?sorted:sorted.slice(0,3);
                    const hiddenBad=sorted.slice(3).filter(r=>r.status==='missed'||r.status==='failed').length;
                    return (
                    <div key={date} style={{marginBottom:16}}>
                      <div style={{fontWeight:800,fontSize:14,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0',display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:13}}>· {rows.length}건</span><span style={{color:'#16a34a',fontWeight:700,fontSize:13}}>✅ 받음 {recv}건</span><span style={{color:'#f59e0b',fontWeight:700,fontSize:13}}>📵 부재중 {miss}건</span></div>
                      {shown.map((x,i)=>{
                        const t=x.sentAtIso?new Date(x.sentAtIso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                        const st=x.status;
                        const info=(st==='completed'||st==='answered')?{ic:'✅',tx:`받음${x.durationSec?` (${x.durationSec}초)`:''}`,c:'#16a34a'}
                          :st==='ringing'?{ic:'📲',tx:'수신대기',c:'#f59e0b'}
                          :st==='missed'?{ic:'📵',tx:'부재중',c:'#f59e0b'}
                          :st==='failed'?{ic:'❌',tx:`실패${x.reason?` · ${x.reason}`:''}`,c:'#ef4444'}
                          :{ic:'✅',tx:'전송됨',c:'#64748b'};
                        return (
                          <div key={x.callId||i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderRadius:10,background:st==='failed'?'#fef2f2':st==='missed'?'#fff7ed':'#f8fafc',marginBottom:6,flexWrap:'wrap'}}>
                            <div style={{minWidth:46,color:'#64748b',fontSize:13,fontWeight:600}}>{t}</div>
                            <div style={{minWidth:90,fontWeight:700,fontSize:14}}>{nameByPhone(x.phone,x.name)}</div>
                            <div style={{minWidth:110,color:'#64748b',fontSize:13}}>{x.phone}</div>
                            <div style={{flex:1,minWidth:120,fontWeight:700,fontSize:13,color:info.c}}>{info.ic} {info.tx}</div>
                          </div>
                        );
                      })}
                      {sorted.length>3 && (
                        <button onClick={()=>setExpandedHistDays(prev=>{const n=new Set(prev); n.has(date)?n.delete(date):n.add(date); return n;})} style={{marginTop:2,marginLeft:2,background:'none',border:'none',color:'#2563eb',fontSize:12.5,fontWeight:700,cursor:'pointer',padding:'2px 0'}}>
                          {open?'접기 ▴':`${sorted.length-3}건 더 보기${hiddenBad>0?` (부재중·실패 ${hiddenBad}건 포함)`:''} ▾`}
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
                        <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="table-avatar">{(elder.name||'?')[0]}</div><div onClick={()=>openEdit(elder)} style={{cursor:'pointer'}} title="클릭 → 어르신 정보 수정"><div style={{fontWeight:700,color:'#1d4ed8'}}>{elder.name}</div><div style={{fontSize:12,color:'#94a3b8'}}>{elder.age}세</div></div>{done&&<span className={`inline-result ${done.success?'success':'error'}`}>{done.success?'✅':'❌'}</span>}</div></td>
                        <td style={{fontSize:13}}>{elder.phone}</td>
                        <td style={{fontSize:13,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                        <td><span className="cycle-badge">{cycleLabel(elder.callCycle, elder.callDays)}</span></td>
                        <td><span className="time-badge">{elder.callTime}</span></td>
                        <td style={{fontSize:13,color:'#64748b'}}>{renderLastCall(elder)}</td>
                        <td><div className={`status-badge badge-${elder.status}`}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</div></td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                            <span style={{fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,whiteSpace:'nowrap',...(elder.callActive?{background:'#dcfce7',color:'#15803d'}:{background:'#fee2e2',color:'#dc2626'})}}>{elder.callActive?'🟢 발신 중':'🔴 발신 중단'}</span>
                            <button onClick={()=>toggleCallActive(elder.id)} style={{fontSize:12,fontWeight:700,padding:'5px 11px',borderRadius:8,cursor:'pointer',whiteSpace:'nowrap',...(elder.callActive?{background:'#fff',color:'#64748b',border:'1px solid #d1d5db'}:{background:'#16a34a',color:'#fff',border:'none'})}}>{elder.callActive?'⏸ 중단하기':'▶ 발신 켜기'}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {page==='elders' && (
            <div className="fade-in">
              {me?.orgCode && (
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:16}}>
                  <span style={{fontSize:22}}>📱</span>
                  <div style={{flex:1,minWidth:220}}>
                    <div style={{fontWeight:800,color:'#1e3a6e'}}>앱으로 어르신 등록하기</div>
                    <div style={{fontSize:13,color:'#475569',marginTop:2}}>어르신 폰 <b>영실이 앱 설정</b>에 아래 <b>기관코드</b>를 입력하고 정보를 등록하면, 여기 <b>승인 대기</b>에 뜹니다.</div>
                  </div>
                  <div onClick={copyOrgCode} title="클릭하면 복사" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:8,background:'#fff',border:'2px solid #2563eb',borderRadius:10,padding:'8px 14px'}}>
                    <span style={{fontSize:20,fontWeight:900,letterSpacing:2,color:'#1d4ed8',fontFamily:'monospace'}}>{me.orgCode}</span>
                    <span style={{fontSize:12,fontWeight:700,color:orgCopied?'#16a34a':'#2563eb'}}>{orgCopied?'✓ 복사됨':'📋 복사'}</span>
                  </div>
                </div>
              )}
              <div className="elder-toolbar">
                <div className="search-box"><span className="search-icon">🔍</span><input className="search-input" placeholder={`${T.elder} 이름 검색...`} value={searchName} onChange={e => setSearchName(e.target.value)}/>{searchName && <button className="search-clear" onClick={() => setSearchName('')}>✕</button>}</div>
                <select className="form-input region-select" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                <div className="filter-bar">{['all','danger','warning','normal'].map(f=>(<button key={f} className={`filter-btn ${filter===f?'filter-active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'전체':STATUS_CONFIG[f].label}<span className="filter-count">{f==='all'?elders.length:elders.filter(e=>e.status===f).length}</span></button>))}</div>
              </div>
              <div className="elder-toolbar2">
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:13,color:'#64748b',fontWeight:600}}>정렬:</span>
                  {[{id:'status',label:'위험도순'},{id:'risk',label:'고독사위험'},{id:'noResponse',label:'미응답순'},{id:'age',label:'나이순'},{id:'name',label:'이름순'}].map(s=>(<button key={s.id} className={`sort-btn ${sortBy===s.id?'sort-active':''}`} onClick={()=>setSortBy(s.id)}>{s.label}</button>))}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <div className="view-toggle"><button className={`view-btn ${viewMode==='card'?'view-active':''}`} onClick={()=>setViewMode('card')}>⊞ 카드</button><button className={`view-btn ${viewMode==='table'?'view-active':''}`} onClick={()=>setViewMode('table')}>☰ 목록</button></div>
                  <button className="btn-secondary" onClick={downloadCsvTemplate} title="엑셀에 채워 넣을 CSV 양식 다운로드">📄 CSV 양식</button>
                  <button className="btn-secondary" onClick={()=>csvInputRef.current&&csvInputRef.current.click()} title="CSV 파일로 어르신 일괄 등록">📥 CSV 일괄 등록</button>
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={e=>{const f=e.target.files&&e.target.files[0]; handleCsvFile(f); e.target.value='';}}/>
                  <button className="btn-primary" onClick={openRegister}>+ 신규 등록</button>
                </div>
              </div>
              <div className="search-result-count">총 <strong>{filteredElders.length}명</strong>{searchName && <span> · "{searchName}" 검색결과</span>}{regionFilter !== '전체' && <span> · {regionFilter}</span>}</div>

              {pendingElders.length > 0 && (
                <div className="section" style={{marginBottom:16,border:'2px solid #fde68a',background:'#fffbeb'}}>
                  <div className="section-title">🔔 승인 대기 ({pendingElders.length}) — 앱에서 등록 신청한 어르신</div>
                  {pendingElders.map(e => (
                    <div key={e.phone} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:'1px solid #fde68a',borderRadius:10,marginBottom:8}}>
                      <div className="table-avatar">{(e.name||'?')[0]}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700}}>{e.name} <span style={{fontSize:12,color:'#94a3b8'}}>{e.age?`${e.age}세 · `:''}{e.region||''}</span></div>
                        <div style={{fontSize:13,color:'#64748b'}}>📞 {e.phone}{e.caregiver?` · 담당 ${e.caregiver}`:''}{e.guardianName?` · 보호자 ${e.guardianName}`:''}</div>
                      </div>
                      <button className="btn-primary" onClick={()=>approveElder(e.phone)}>✅ 승인·활성화</button>
                    </div>
                  ))}
                </div>
              )}

              {filteredElders.length > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10,flexWrap:'wrap'}}>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'#334155',cursor:'pointer'}}>
                    <input type="checkbox" checked={filteredElders.every(e=>selectedElders.has(e.id))} onChange={()=>toggleAllElders(filteredElders)}/> 전체 선택
                  </label>
                  {selectedElders.size>0 && (<>
                    <span style={{fontSize:13,color:'#2563eb',fontWeight:700}}>{selectedElders.size}명 선택됨</span>
                    <button onClick={deleteSelectedElders} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>🗑 선택 삭제</button>
                    <button onClick={()=>setSelectedElders(new Set())} style={{background:'#fff',color:'#64748b',border:'1px solid #d1d5db',borderRadius:8,padding:'6px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>선택 해제</button>
                  </>)}
                </div>
              )}

              {viewMode === 'card' && (
                <div className="elder-grid">
                  {filteredElders.length === 0 && <div className="empty-result">검색 결과가 없습니다 🔍</div>}
                  {filteredElders.map(elder => {
                    const risk = getSolitudeRisk(elder);
                    const noResponseDays = getNoResponseDays(elder.lastCall, elder.lastCallAt);
                    return (
                      <div key={elder.id} className="elder-card" onClick={()=>openDetail(elder)} style={selectedElders.has(elder.id)?{outline:'2px solid #2563eb',outlineOffset:2}:undefined}>
                        <div className="elder-top"><div style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={selectedElders.has(elder.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleElderSel(elder.id)} style={{width:16,height:16,cursor:'pointer'}}/><div className="elder-avatar">{elder.gender==='female'?'👵':'👴'}</div></div><div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}><div className={`status-badge badge-${elder.status}`}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</div><div className="risk-badge" style={{background:risk.bg,color:risk.color}}>{risk.label}</div></div></div>
                        <div className="elder-name">{elder.name}</div>
                        <div className="elder-info">{elder.age}세 · {elder.title} · {elder.region}</div>
                        {elder.caregiver && <div className="elder-info" style={{color:'#1d4ed8',fontWeight:600}}>👤 담당: {elder.caregiver}</div>}
                        {noResponseDays >= 1 && <div className={`no-response-tag ${noResponseDays >= 3 ? 'no-response-danger' : 'no-response-warning'}`}>📵 {noResponseDays >= 99 ? '통화이력 없음' : `${noResponseDays}일째 미응답`}</div>}
                        <div className="elder-last">📞 마지막 통화: {renderLastCall(elder)}</div>
                        {elder.keyword && <div className="keyword-tag mt8">⚠️ "{elder.keyword}" 감지</div>}
                        {elder.visits > 0 && <div className="visit-tag mt8">🏠 방문 필요 {elder.visits}회</div>}
                        {!elder.callActive && <div className="paused-tag mt8">⏸ 전화 중단 중</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === 'table' && (
                <table className="table">
                  <thead><tr><th style={{width:40}}><input type="checkbox" checked={filteredElders.length>0&&filteredElders.every(e=>selectedElders.has(e.id))} onChange={()=>toggleAllElders(filteredElders)} className="cb"/></th><th>어르신</th><th>성별/호칭</th><th>나이</th><th>지역</th><th>담당 복지사</th><th>마지막 통화</th><th>미응답</th><th>고독사 위험도</th><th>상태</th><th>키워드</th><th>즉시 전화</th></tr></thead>
                  <tbody>
                    {filteredElders.length === 0 && <tr><td colSpan={12} style={{textAlign:'center',color:'#94a3b8',padding:32}}>검색 결과가 없습니다 🔍</td></tr>}
                    {filteredElders.map(elder => {
                      const risk = getSolitudeRisk(elder);
                      const noResponseDays = getNoResponseDays(elder.lastCall, elder.lastCallAt);
                      return (
                        <tr key={elder.id} style={{cursor:'pointer',...(selectedElders.has(elder.id)?{background:'#eff6ff'}:{})}} onClick={()=>openDetail(elder)}>
                          <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedElders.has(elder.id)} onChange={()=>toggleElderSel(elder.id)} className="cb"/></td>
                          <td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:20}}>{elder.gender==='female'?'👵':'👴'}</span><strong>{elder.name}</strong></div></td>
                          <td><span className="cycle-badge">{elder.title}</span></td>
                          <td>{elder.age}세</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.region}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{renderLastCall(elder)}</td>
                          <td>{noResponseDays===0?<span style={{color:'#22c55e',fontWeight:700}}>정상</span>:<span style={{color:noResponseDays>=3?'#ef4444':'#f59e0b',fontWeight:700}}>{noResponseDays>=99?'통화이력 없음':`${noResponseDays}일`}</span>}</td>
                          <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                          <td><div className={`status-badge badge-${elder.status}`}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</div></td>
                          <td>{elder.keyword ? <span className="keyword-tag">"{elder.keyword}"</span> : <span style={{color:'#9ca3af',fontSize:12}}>없음</span>}</td>
                          <td onClick={e=>e.stopPropagation()}><button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'⏳':'📱'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {page==='script' && (
            <div className="fade-in">
              <div className="weather-panel">
                <div className="weather-panel-header">
                  <div><div className="weather-panel-title">🌡️ 기상청 공공데이터 연동</div><div className="weather-panel-sub">날씨 경보 발령 시 자동으로 멘트에 삽입됩니다</div></div>
                  <button className={`btn-fetch-weather ${fetchingWeather?'btn-calling':''}`} onClick={fetchWeather} disabled={fetchingWeather}>{fetchingWeather ? '⏳ 불러오는 중...' : '🔄 날씨 데이터 갱신'}</button>
                </div>
                <div className="weather-grid">
                  {Object.entries(weatherData).map(([region, data]) => (
                    <div key={region} className={`weather-card ${data.alert!=='none'?'weather-alert':''}`}>
                      <div className="weather-region">{region}</div>
                      {data.noData ? (
                        <div style={{fontSize:15,color:'#94a3b8',padding:'20px 0',fontWeight:600}}>정보 없음</div>
                      ) : (
                        <>
                          <div className="weather-icon" style={{fontSize:34,lineHeight:1,margin:'4px 0'}}>{getWeatherIcon(data.condition)}</div>
                          <div className="weather-temp">{data.temp}°C</div>
                          <div className="weather-condition">{data.condition}</div>
                          {weatherTime && <div className="weather-time" style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{weatherTime}</div>}
                          {data.alertText && <div className="weather-badge">{data.alertText}</div>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="section">
                <div className="section-title">⚠️ 경보 멘트 설정</div>
                <div className="alert-template-grid">
                  {[{id:'none',icon:'✅',label:'경보 없음',color:'#22c55e'},{id:'heatwave',icon:'🌡️',label:'폭염경보',color:'#ef4444'},{id:'cold',icon:'❄️',label:'한파경보',color:'#3b82f6'},{id:'dust',icon:'😷',label:'미세먼지 나쁨',color:'#f59e0b'},{id:'rain',icon:'🌧️',label:'호우주의보',color:'#6366f1'},{id:'typhoon',icon:'🌀',label:'태풍경보',color:'#7c3aed'},{id:'wildfire',icon:'🔥',label:'산불발생',color:'#ea580c'}].map(t => (
                    <button key={t.id} className={`alert-template-btn ${activeAlert===t.id?'alert-template-active':''}`} style={activeAlert===t.id?{borderColor:t.color,background:`${t.color}15`}:{}} onClick={() => { setActiveAlert(t.id); if (t.id==='wildfire') { setWildfireStage('prepare'); setAlertScript(tplText('wildfire_prepare', WILDFIRE_STAGES[0].text)); } else { setAlertScript(tplText(t.id, ALERT_TEMPLATES[t.id])); } }}>
                      <span style={{fontSize:20}}>{t.icon}</span><span style={{fontWeight:700,color:activeAlert===t.id?t.color:'#374151'}}>{t.label}</span>
                    </button>
                  ))}
                </div>
                {activeAlert === 'wildfire' && (
                  <div style={{marginTop:14}}>
                    <div className="var-hint" style={{marginBottom:8,color:'#ea580c',fontWeight:700}}>🔥 산불 대피 3단계 — 상황에 맞는 단계를 골라 발신하세요. 어르신이 "괜찮아/도와줘"로 응답하면 자동 처리됩니다.</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                      {WILDFIRE_STAGES.map(s => (
                        <button key={s.id} className={`alert-template-btn ${wildfireStage===s.id?'alert-template-active':''}`}
                          style={{flex:'1 1 30%',minWidth:150,justifyContent:'center',...(wildfireStage===s.id?{borderColor:s.color,background:`${s.color}15`}:{})}}
                          onClick={() => { setWildfireStage(s.id); setAlertScript(tplText('wildfire_'+s.id, s.text)); }}>
                          <span style={{fontWeight:700,fontSize:13,color:wildfireStage===s.id?s.color:'#374151'}}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <label className="form-label">🔥 산불 발생 위치 (담당자 입력 · {'{{지역}}'}에 들어감)</label>
                    <input className="form-input" type="text" value={fireLoc} placeholder="예) 봉화군 도개면 야산"
                      onChange={e => setFireLoc(e.target.value)} style={{marginBottom:4}}/>
                    <div className="var-hint" style={{color:'#94a3b8'}}>산불이 난 곳 — 멘트의 {'{{지역}}'} 자리와 어르신이 "어디서 났어?"라고 물을 때의 답변에 쓰입니다. 비워두면 어르신 거주 지역으로 안내됩니다.</div>
                    <label className="form-label" style={{marginTop:10}}>🏠 대피소명 (담당자 입력 · {'{{대피소}}'}에 들어감)</label>
                    <input className="form-input" type="text" value={shelterName} placeholder="예) 봉화초등학교 운동장, 북구민운동장"
                      onChange={e => setShelterName(e.target.value)} style={{marginBottom:4}}/>
                    <div className="var-hint" style={{color:'#94a3b8'}}>여기에 입력한 대피소명이 경보 멘트의 {'{{대피소}}'} 자리에 들어갑니다. 비워두면 "가까운 대피소"로 안내됩니다.</div>
                  </div>
                )}
                {activeAlert !== 'none' && (
                  <div className="alert-script-edit">
                    <label className="form-label">경보 멘트 수정{activeAlert==='wildfire'?' (선택한 단계)':''}</label>
                    <textarea className="script-textarea" value={alertScript} onChange={e => { setAlertScript(e.target.value); setAlertTplSaved(false); }} rows={activeAlert==='wildfire'?5:3}/>
                    <div className="var-hint">사용 가능 변수: <code>{'{{지역}}'}</code> <code>{'{{보호자}}'}</code>{activeAlert==='wildfire'&&<> <code>{'{{대피소}}'}</code></>}</div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap'}}>
                      <button className="btn-primary" style={{fontSize:13,padding:'6px 14px'}} disabled={alertTplSaving} onClick={saveAlertTemplate}>
                        {alertTplSaving ? '저장 중…' : '💾 이 멘트 저장'}
                      </button>
                      <button className="btn-secondary" style={{fontSize:12,padding:'6px 10px'}} disabled={alertTplSaving} onClick={resetAlertTemplate}>기본값으로 되돌리기</button>
                      {alertTplSaved && <span style={{fontSize:12.5,color:'#16a34a',fontWeight:700}}>✅ 저장됨 — 같은 기관 모든 담당자에게 즉시 적용됩니다</span>}
                      {savedAlertTpl[curAlertKey()] && !alertTplSaved && <span style={{fontSize:12,color:'#2563eb'}}>· 저장된 맞춤 멘트 사용 중</span>}
                    </div>
                    {(() => {
                      // 실제 발송 미리보기 — 어르신마다 {{지역}} 등이 자기 값으로 치환됨을 "지역별 예시"로 확인
                      // (체크된 어르신 우선, 없으면 전체 기준. 지역별 1명씩 최대 4개 지역)
                      const pool = (checked.length ? elders.filter(e => checked.includes(e.id)) : elders).filter(e => e.region);
                      const byRegion = [];
                      const seen = new Set();
                      for (const e of pool) { if (!seen.has(e.region)) { seen.add(e.region); byRegion.push(e); } }
                      const shown = byRegion.slice(0, 4);
                      if (!shown.length) shown.push({ name: '어르신', region: '○○구', guardian: '' });
                      return (
                        <div style={{marginTop:12,background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,padding:'12px 14px'}}>
                          <div style={{fontWeight:700,fontSize:13,color:'#0369a1',marginBottom:8}}>📋 실제 발송 미리보기 <span style={{fontWeight:500,color:'#64748b'}}>— 어르신마다 자기 지역·보호자{activeAlert==='wildfire'?'·대피소':''} 값으로 채워져 발송됩니다{checked.length?` (선택한 ${checked.length}명 기준)`:''}.</span></div>
                          {shown.map((e, i) => (
                            <div key={i} style={{marginBottom: i < shown.length - 1 ? 10 : 0}}>
                              <div style={{fontSize:12,fontWeight:800,color:'#0369a1',marginBottom:2}}>📍 {e.region} <span style={{fontWeight:500,color:'#94a3b8'}}>({e.name} 어르신 등)</span></div>
                              <div style={{fontSize:14,lineHeight:1.6,color:'#1f2937',whiteSpace:'pre-wrap'}}>{alertMsgFor(e)}</div>
                            </div>
                          ))}
                          {byRegion.length > shown.length && <div style={{fontSize:12,color:'#94a3b8',marginTop:6}}>… 외 {byRegion.length - shown.length}개 지역도 각자 지역명으로 발송됩니다.</div>}
                          {activeAlert === 'wildfire' && !shelterName.trim() && <div style={{fontSize:12,color:'#f59e0b',marginTop:6}}>⚠️ 위 대피소명 칸이 비어 있어 "가까운 대피소"로 나옵니다. 대피소명을 입력해 보세요.</div>}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {activeAlert !== 'none' && (
                  <div style={{marginTop:18,borderTop:'1px solid #e5e7eb',paddingTop:16}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:10}}>
                      <label className="form-label" style={{margin:0}}>📋 이 경보 멘트로 발신할 어르신 (체크 후 일괄 발신)</label>
                      <div style={{display:'flex',gap:6}}>
                        {(() => {
                          // 자동선택 = "지금 선택한 경보 종류"가 발효 중인 지역만 (예: 폭염 선택 시 비 오는 달서구는 제외 — 호우 멘트를 따로 보내는 설계)
                          const AL = { heatwave:'폭염', cold:'한파', dust:'미세먼지', rain:'호우', typhoon:'태풍', wildfire:'산불' };
                          const label = AL[activeAlert] || '경보';
                          return (
                            <button className="btn-secondary" style={{fontSize:12,padding:'5px 10px'}}
                              title={`지금 선택한 '${label}' 경보가 발효 중인 지역의 어르신만 선택합니다. 다른 경보(예: 호우) 지역은 그 경보를 선택한 뒤 눌러 주세요.`}
                              onClick={()=>setChecked(elders.filter(e=>weatherData[e.region]?.alert===activeAlert).map(e=>e.id))}>🎯 {label} 지역 자동선택</button>
                          );
                        })()}
                        <button className="btn-secondary" style={{fontSize:12,padding:'5px 10px'}} onClick={()=>setChecked(elders.map(e=>e.id))}>전체</button>
                        <button className="btn-secondary" style={{fontSize:12,padding:'5px 10px'}} onClick={()=>setChecked([])}>해제</button>
                      </div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                      {[...new Set(elders.map(e=>e.region))].sort().map(r => {
                        const inR = elders.filter(e=>e.region===r);
                        const allOn = inR.length>0 && inR.every(e=>checked.includes(e.id));
                        const someOn = inR.some(e=>checked.includes(e.id));
                        return (
                          <button key={r} onClick={()=>{ if(allOn) setChecked(prev=>prev.filter(id=>!inR.some(e=>e.id===id))); else setChecked(prev=>[...new Set([...prev,...inR.map(e=>e.id)])]); }} style={{fontSize:13,padding:'6px 12px',borderRadius:20,border:'1px solid '+(allOn?'#2563eb':someOn?'#93c5fd':'#d1d5db'),background:allOn?'#2563eb':someOn?'#eff6ff':'#fff',color:allOn?'#fff':'#374151',fontWeight:600,cursor:'pointer'}}>📍 {r.replace('대구 ','')} ({inR.length})</button>
                        );
                      })}
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14,maxHeight:220,overflowY:'auto',padding:'2px'}}>
                      {elders.map(e => {
                        const inZone = weatherData[e.region]?.alert === activeAlert;
                        const on = checked.includes(e.id);
                        return (
                          <label key={e.id} style={{display:'flex',alignItems:'center',gap:8,border:'1px solid '+(on?'#2563eb':'#e5e7eb'),borderRadius:8,padding:'8px 12px',cursor:'pointer',background:on?'#eff6ff':'#fff'}}>
                            <input type="checkbox" checked={on} onChange={()=>toggleCheck(e.id)} />
                            <span style={{fontWeight:600}}>{e.gender==='female'?'👵':'👴'} {e.name}</span>
                            <span style={{fontSize:12,color:'#6b7280'}}>{e.region}</span>
                            {inZone && <span style={{fontSize:11,color:'#ef4444',fontWeight:700}}>● 경보지역</span>}
                          </label>
                        );
                      })}
                    </div>
                    {!bulkRunning ? (
                      <button className="btn-call" onClick={startBulkCall} disabled={checked.length===0} style={{opacity:checked.length===0?0.5:1,cursor:checked.length===0?'not-allowed':'pointer'}}>📢 선택한 {checked.length}명에게 이 경보 멘트로 발신</button>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontWeight:700,color:'#2563eb'}}>📡 발신 중... ({bulkDone.length}/{bulkQueue.length})</span><button className="btn-secondary" onClick={stopBulkCall}>중지</button></div>
                    )}
                  </div>
                )}
              </div>

              <div className="section">
                <div className="section-title">📋 영실이 실제 안부 질문 (앱 고정)</div>
                <div style={{fontSize:13,color:'#64748b',marginBottom:14,lineHeight:1.6}}>
                  영실이 앱이 통화에서 <b>실제로 하는 질문</b>이에요. 자연스러운 대화와 정확한 순서를 위해 <b>앱에 고정</b>돼 있어 이 내용은 대시보드에서 편집하지 않습니다. (위 <b>경보 멘트</b>만 편집 가능 — 날씨 경보 발신 시 인사말에 삽입됩니다.)
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    {t:'인사·건강', q:'{호칭}, 안녕하세요. 저 영실이에요. 오늘 몸은 좀 어떠세요? 어디 불편한 데는 없으세요?', c:'#dc2626'},
                    {t:'약',     q:'약은 잘 챙겨 드셨어요?', c:'#7c3aed', badge:'격일'},
                    {t:'식사',   q:'오늘 식사는 잘 하셨어요?', c:'#16a34a'},
                    {t:'물',     q:'물도 자주 드시고 계세요?', c:'#0891b2', badge:'격일'},
                    {t:'정서',   q:'요즘 외롭거나 힘든 일은 없으세요?', c:'#2563eb'},
                    {t:'생활',   q:'요즘 장보기나 집안일 하시는 데 불편한 점은 없으세요?', c:'#16a34a'},
                    {t:'마무리', q:'오늘도 이렇게 얘기 나눠서 좋았어요. 건강 잘 챙기시고, 또 연락드릴게요.', c:'#64748b'},
                  ].map((s,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10}}>
                      <span style={{minWidth:48,fontSize:12,fontWeight:800,color:'#fff',background:s.c,padding:'4px 10px',borderRadius:20,textAlign:'center',whiteSpace:'nowrap'}}>{s.t}</span>
                      <span style={{flex:1,fontSize:14,color:'#1f2937'}}>{s.q}</span>
                      {s.badge && <span style={{fontSize:11,fontWeight:700,color:'#f59e0b',background:'#fffbeb',border:'1px solid #fde68a',padding:'2px 8px',borderRadius:20,whiteSpace:'nowrap'}}>{s.badge}</span>}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:13,color:'#334155',marginTop:14,lineHeight:1.6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 14px'}}>
                  💡 <b>약·물</b>은 격일(이틀에 한 번)로 여쭤 통화가 길어지지 않게 합니다. 통화 중 <b>위험·정서·생활 신호</b>를 감지하면 자동으로 보호자·복지사·119 연락을 안내하고, <b>건강 상태</b> 메뉴에 알림이 뜹니다.
                </div>
              </div>
            </div>
          )}

          {page==='calls' && (
            <div className="fade-in">
              {/* 기간 선택 (일/월별 조회) — 서버 calls 컬렉션 실데이터 */}
              <div style={{display:'flex',gap:6,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
                {[['week','최근 7일'],['month','최근 30일'],['custom','직접 선택']].map(([k,label])=>(
                  <button key={k} onClick={()=>setCallsRange(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(callsRange===k?'#1d4ed8':'#e2e8f0'),background:callsRange===k?'#eff6ff':'#fff',color:callsRange===k?'#1d4ed8':'#64748b',fontWeight:700,fontSize:13,cursor:'pointer'}}>{label}</button>
                ))}
                {callsRange==='custom' && (<>
                  <input type="date" value={callsFrom} onChange={e=>setCallsFrom(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
                  <span style={{color:'#94a3b8'}}>~</span>
                  <input type="date" value={callsTo} onChange={e=>setCallsTo(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
                </>)}
                <button onClick={()=>fetchCalls()} className="btn-download" style={{padding:'6px 12px'}}>{callsLoading?'⏳':'🔄'}</button>
                <span style={{fontSize:12,color:'#94a3b8'}}>🔄 15초마다 자동 갱신됩니다</span>
                <input value={callsSearch} onChange={e=>setCallsSearch(e.target.value)} placeholder="🔍 이름 검색" style={{padding:'6px 10px',borderRadius:8,border:'1px solid '+(callsSearch?'#1d4ed8':'#e2e8f0'),fontSize:13,width:120}}/>
                <select value={callsPhone} onChange={e=>setCallsPhone(e.target.value)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid '+(callsPhone?'#1d4ed8':'#e2e8f0'),fontSize:13,fontWeight:700,color:callsPhone?'#1d4ed8':'#334155',background:'#fff',cursor:'pointer'}}>
                  <option value="">전체 어르신</option>
                  {elders.map(e=>{const k=String(e.phone||'').replace(/\D/g,'');return <option key={k} value={k}>{e.name}</option>;})}
                </select>
                <span style={{marginLeft:'auto',color:'#64748b',fontSize:13,fontWeight:700}}>총 {callsHistory.filter(c=>(!callsPhone||String(c.phone||'').replace(/\D/g,'')===callsPhone)&&(!callsSearch||(nameByPhone(c.phone,c.elderName)||'').includes(callsSearch))&&callsRiskMatch(c)).length}건</span>
              </div>
              <div style={{display:'flex',gap:6,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontSize:13,color:'#64748b',fontWeight:600}}>위험도:</span>
                {[['all','전체','#334155'],['critical','🔴 긴급','#dc2626'],['urgent','🟠 주의','#f59e0b'],['normal','🟢 정상','#16a34a']].map(([k,label,col])=>(
                  <button key={k} onClick={()=>setCallsRisk(k)} style={{padding:'5px 12px',borderRadius:20,border:'1px solid '+(callsRisk===k?col:'#e2e8f0'),background:callsRisk===k?col:'#fff',color:callsRisk===k?'#fff':'#64748b',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>{label}</button>
                ))}
                {callsRisk!=='all' && <span style={{fontSize:12,color:'#94a3b8'}}>· 대시보드에서 이동됨</span>}
              </div>
              {callsHistory.length===0 ? (
                <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>{callsLoading?'불러오는 중...':'이 기간 통화 기록이 없습니다.'}</div>
              ) : (()=>{
                const src = callsHistory.filter(c=>(!callsPhone||String(c.phone||'').replace(/\D/g,'')===callsPhone)&&(!callsSearch||(nameByPhone(c.phone,c.elderName)||'').includes(callsSearch))&&callsRiskMatch(c));
                const grouped = {};
                src.forEach(c=>{ const dk=c.date||(c.at?c.at.slice(0,10):'미상'); (grouped[dk]=grouped[dk]||[]).push(c); });
                return Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,logs])=>(
                  <div key={date} style={{marginBottom:18}}>
                    <div style={{fontWeight:800,fontSize:14,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:13}}>· {logs.length}건</span></div>
                    {logs.map(c=>{
                      const R=RISK_CONFIG[c.riskLevel]||{};
                      const hm=c.at?new Date(c.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                      const dur=c.durationSec||0;
                      return (
                        <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:c.riskLevel==='critical'?'#fef2f2':c.riskLevel==='urgent'?'#fff7ed':'#f8fafc',marginBottom:6,flexWrap:'wrap'}}>
                          <div style={{minWidth:80,fontWeight:700,fontSize:14}}>{nameByPhone(c.phone,c.elderName)}</div>
                          <div style={{minWidth:46,color:'#64748b',fontSize:13}}>{hm}</div>
                          <div style={{minWidth:64,color:'#64748b',fontSize:13}}>{Math.floor(dur/60)}분 {dur%60}초</div>
                          <div style={{minWidth:44,fontWeight:700,fontSize:13,color:R.color||'#16a34a'}}>{R.label||'정상'}</div>
                          {c.transcript && (
                            <button className="btn-secondary" style={{fontSize:12,padding:'4px 10px',marginLeft:'auto'}}
                              disabled={!!draftingCallId} title="통화 내용을 AI가 활동일지 초안으로 요약해 일지 작성 창에 채워줍니다"
                              onClick={()=>makeNoteDraft(c)}>
                              {draftingCallId===c.id ? '⏳ 초안 생성 중…' : '📝 일지 초안'}
                            </button>
                          )}
                          <div style={{flexBasis:'100%'}}><CallTranscript text={c.transcript} /></div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}

          {page==='report' && (
            <div className="fade-in">
              <div className="report-banner"><div className="report-banner-title">📊 {new Date().getFullYear()}년 {new Date().getMonth()+1}월 월간 리포트</div><div className="report-banner-sub">대구광역시 AI 영실이 복지 서비스</div><div style={{display:'flex',gap:8}}><button className="btn-download" onClick={exportStatsCSV}>📊 엑셀 다운로드</button><button className="btn-download" onClick={()=>window.print()}>⬇️ PDF 다운로드</button></div></div>
              <div className="section" style={{marginBottom:16,borderLeft:'4px solid #1d4ed8'}}>
                <div className="section-title">📥 월간 실적 보고서 (지자체 보고용 엑셀)</div>
                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                  <input type="month" className="form-input" style={{width:170,marginBottom:0}} value={reportMonth} onChange={e=>setReportMonth(e.target.value)}/>
                  <button className="btn-primary" disabled={monthlyBusy} onClick={downloadMonthlyReport}>{monthlyBusy?'⏳ 생성 중…':'📥 엑셀 다운로드'}</button>
                  <span style={{fontSize:12,color:'#94a3b8'}}>시트 4개 — 요약(안전확인 성공률·위험감지·일지) · 어르신별 실적 · 일별 현황 · 위험 감지 상세</span>
                </div>
              </div>
              <div className="report-stat-grid">
                {[{label:'총 통화',value:`${reportCalls.length}건`,icon:'📞',color:'#1d4ed8'},{label:'긴급 감지',value:`${reportCalls.filter(c=>c.riskLevel==='critical').length}건`,icon:'🚨',color:'#ef4444'},{label:'주의 감지',value:`${reportCalls.filter(c=>c.riskLevel==='urgent').length}건`,icon:'⚠️',color:'#f59e0b'},{label:'정상 통화',value:`${reportCalls.filter(c=>!c.riskLevel||c.riskLevel==='normal').length}건`,icon:'✅',color:'#16a34a'},{label:'총 통화 시간',value:`${Math.round(reportCalls.reduce((s,c)=>s+(c.durationSec||0),0)/60)}분`,icon:'⏱️',color:'#7c3aed'},{label:'관리 어르신',value:`${elders.length}명`,icon:'👥',color:'#0891b2'}].map((s,i)=>(
                  <div key={i} className="report-stat-card"><div className="report-stat-icon">{s.icon}</div><div className="report-stat-value" style={{color:s.color}}>{s.value}</div><div className="report-stat-label">{s.label}</div></div>
                ))}
              </div>
              <div className="section">
                <div className="section-title">📈 주간 통화 현황 (최근 7일)</div>
                <div className="chart-wrap">
                  {(()=>{const last7=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=d.toISOString().slice(0,10);const dn=['일','월','화','수','목','금','토'][d.getDay()];const dc=reportCalls.filter(c=>(c.date||(c.at?c.at.slice(0,10):''))===ds);return{day:dn,calls:dc.length,danger:dc.filter(c=>c.riskLevel==='critical').length,warning:dc.filter(c=>c.riskLevel==='urgent').length};});const maxCalls=Math.max(1,...last7.map(x=>x.calls));return last7.map((d,i)=>(<div key={i} className="chart-col"><div className="chart-bar-wrap"><div className="chart-bar-total" style={{height:`${d.calls/maxCalls*100}%`}}><div className="chart-bar-danger" style={{height:`${d.calls?d.danger/d.calls*100:0}%`}}/><div className="chart-bar-warning" style={{height:`${d.calls?d.warning/d.calls*100:0}%`}}/></div></div><div className="chart-val">{d.calls}</div><div className="chart-day">{d.day}</div></div>));})()}
                </div>
                <div className="chart-legend"><span className="legend-item"><span className="legend-dot" style={{background:'#ef4444'}}/>긴급</span><span className="legend-item"><span className="legend-dot" style={{background:'#f59e0b'}}/>주의</span><span className="legend-item"><span className="legend-dot" style={{background:'#3b82f6'}}/>정상</span></div>
              </div>
              {/* ── 위험 키워드 통계 (실데이터 /stats, 기간선택·빈도·우선순위·추이) ── */}
              <div className="section">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:14}}>
                  <div className="section-title" style={{marginBottom:0}}>🔎 위험 키워드 통계</div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    {[['week','이번 주'],['month','이번 달'],['3month','최근 3개월'],['custom','직접 선택']].map(([k,label])=>(
                      <button key={k} onClick={()=>setStatsRange(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(statsRange===k?'#1d4ed8':'#e2e8f0'),background:statsRange===k?'#eff6ff':'#fff',color:statsRange===k?'#1d4ed8':'#64748b',fontWeight:700,fontSize:13,cursor:'pointer'}}>{label}</button>
                    ))}
                    {statsRange==='custom' && (<>
                      <input type="date" value={statsFrom} onChange={e=>setStatsFrom(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
                      <span style={{color:'#94a3b8'}}>~</span>
                      <input type="date" value={statsTo} onChange={e=>setStatsTo(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
                    </>)}
                    <button onClick={fetchStats} className="btn-download" style={{padding:'6px 12px'}}>{statsLoading?'⏳':'🔄'}</button>
                  </div>
                </div>

                {(!statsData || statsData.available !== true) ? (
                  // available!==true: 실패 응답({error:'인증 필요'} 등)이 '0건'으로 그럴듯하게 표시되지 않게
                  <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>{statsLoading?'불러오는 중...':(statsData&&statsData.error?'통계를 불러오지 못했습니다. 🔄 버튼으로 다시 시도해 주세요.':'아직 통계 데이터가 없습니다. 통화 중 위험 키워드가 감지되면 자동으로 쌓입니다.')}</div>
                ) : (()=>{
                  const elderEntries = Object.entries(statsData.elders||{})
                    .filter(([name])=>elders.some(e=>e.name===name))  // 등록된 어르신만 (옛 이름·더미 제외)
                    .map(([name,es])=>({ name, es, score: priorityScore(es), prevTotal: (statsPrev&&statsPrev.elders&&statsPrev.elders[name]&&statsPrev.elders[name].total)||0 }))
                    .sort((a,b)=>b.score-a.score);
                  const topKw = (statsData.topKeywords||[])[0];
                  const surge = elderEntries.filter(e=>e.es.total>e.prevTotal).sort((a,b)=>(b.es.total-b.prevTotal)-(a.es.total-a.prevTotal))[0];
                  return (<>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:16}}>
                      <div style={{background:'#f8fafc',borderRadius:12,padding:16}}><div style={{fontSize:13,color:'#64748b'}}>총 위험 감지</div><div style={{fontSize:26,fontWeight:900,color:'#0f172a'}}>{statsData.totalEvents||0}건</div></div>
                      <div style={{background:'#fff7ed',borderRadius:12,padding:16}}><div style={{fontSize:13,color:'#9a3412'}}>최다 키워드</div><div style={{fontSize:20,fontWeight:900,color:'#c2410c'}}>{topKw?`"${topKw.keyword}" ${topKw.count}건`:'-'}</div></div>
                      <div style={{background:'#fef2f2',borderRadius:12,padding:16}}><div style={{fontSize:13,color:'#991b1b'}}>위험 급증 어르신</div><div style={{fontSize:20,fontWeight:900,color:'#dc2626'}}>{surge?`${surge.name} (+${surge.es.total-surge.prevTotal})`:'없음'}</div></div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {elderEntries.length===0 && <div style={{color:'#94a3b8',padding:20,textAlign:'center'}}>이 기간엔 위험 감지가 없습니다.</div>}
                      {elderEntries.map((e,idx)=>{
                        const trendDiff = e.es.total - e.prevTotal;
                        return (
                          <div key={e.name} style={{border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10,minWidth:160}}>
                              <div style={{width:30,height:30,borderRadius:15,background:idx===0?'#dc2626':idx===1?'#f59e0b':'#94a3b8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13}}>{idx+1}</div>
                              <div><div style={{fontWeight:800,fontSize:15}}>{e.name}</div><div style={{fontSize:12,color:'#94a3b8'}}>우선순위 {e.score}점 · 총 {e.es.total}건</div></div>
                            </div>
                            <div style={{flex:1,display:'flex',flexWrap:'wrap',gap:6,minWidth:160}}>
                              {Object.entries(e.es.keywords||{}).sort((a,b)=>b[1]-a[1]).map(([kw,cnt])=>{const L=LV_COLOR[kwLevel(kw)];return(<span key={kw} style={{background:L.bg,color:L.c,borderRadius:14,padding:'3px 10px',fontSize:13,fontWeight:700}}>{kw} ×{cnt}</span>);})}
                            </div>
                            <div style={{textAlign:'right',minWidth:90}}>
                              <div style={{fontSize:18,fontWeight:900,color:trendDiff>0?'#dc2626':trendDiff<0?'#16a34a':'#94a3b8'}}>{trendDiff>0?`↑ +${trendDiff}`:trendDiff<0?`↓ ${trendDiff}`:'→ 0'}</div>
                              <div style={{fontSize:11,color:'#94a3b8'}}>지난 기간 {e.prevTotal}건</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>);
                })()}
              </div>
              <div className="section">
                <div className="section-title">🎯 위험도 분포 <span style={{fontSize:12,fontWeight:600,color:'#94a3b8'}}>— 위 키워드 통계와 같은 기간 기준 (긴급 감지=위험, 그 외 감지=주의)</span></div>
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
            </div>
          )}

          {page==='health' && (
            <div className="fade-in">
              <div className="data-banner" style={{marginBottom:20}}>
                <div><div className="data-banner-title">💊 어르신 건강 상태 현황</div><div className="data-banner-sub">영실이 앱에서 어르신이 직접 체크한 건강 상태 · 🔄 15초마다 자동 갱신됩니다</div></div>
                <button className={`btn-download ${healthLoading?'btn-calling':''}`} onClick={()=>fetchHealth()} disabled={healthLoading}>{healthLoading ? '⏳ 불러오는 중...' : '🔄 갱신'}</button>
              </div>
              <div className="report-stat-grid" style={{marginBottom:20}}>
                <div className="report-stat-card"><div className="report-stat-icon">😊</div><div className="report-stat-value" style={{color:'#16a34a'}}>{healthData.filter(h=>h.status==='good').length}명</div><div className="report-stat-label">좋아요</div></div>
                <div className="report-stat-card"><div className="report-stat-icon">😐</div><div className="report-stat-value" style={{color:'#f59e0b'}}>{healthData.filter(h=>h.status==='okay').length}명</div><div className="report-stat-label">그럭저럭</div></div>
                <div className="report-stat-card"><div className="report-stat-icon">😔</div><div className="report-stat-value" style={{color:'#ef4444'}}>{healthData.filter(h=>h.status==='bad').length}명</div><div className="report-stat-label">안 좋아요</div></div>
                <div className="report-stat-card"><div className="report-stat-icon">📱</div><div className="report-stat-value" style={{color:'#6b7280'}}>{elders.length - healthData.length}명</div><div className="report-stat-label">미체크</div></div>
              </div>
              {(()=>{
                const un = alertsData.filter(a=>(a.status ? a.status !== 'done' : !a.read) && alertIsReal(a));   // 폐루프: 완료(done) 전까지 표시
                if (un.length === 0) return null;
                const CAT = {
                  health:  { label:'건강', icon:'❤️', c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
                  fall:    { label:'낙상', icon:'🦴', c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
                  emotion: { label:'정서', icon:'💙', c:'#2563eb', bg:'#eff6ff', bd:'#bfdbfe' },
                  living:  { label:'생활', icon:'🧺', c:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
                  meal:    { label:'식사', icon:'🍚', c:'#ea580c', bg:'#fff7ed', bd:'#fed7aa' },
                  missed:  { label:'부재중', icon:'📵', c:'#b45309', bg:'#fffbeb', bd:'#fde68a' },
                  help:    { label:'구조요청', icon:'🆘', c:'#dc2626', bg:'#fef2f2', bd:'#fecaca' },
                  safe:    { label:'안전확인', icon:'✅', c:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
                };
                const cnt = c => un.filter(a=>(a.category||'health')===c).length;
                return (
                <div className="section" style={{marginBottom:20}}>
                  <div className="section-title">🚨 미처리 알림 ({un.length}건) <span style={{fontSize:12,fontWeight:600,color:'#94a3b8'}}>— 조치 시작 → 조치 완료(또는 일지 작성)로 마감하세요</span></div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                    {['health','fall','emotion','living','meal','missed','help','safe'].map(c=> cnt(c)>0 && (
                      <span key={c} style={{fontSize:12.5,fontWeight:700,color:CAT[c].c,background:CAT[c].bg,border:'1px solid '+CAT[c].bd,padding:'3px 10px',borderRadius:20}}>{CAT[c].icon} {CAT[c].label} {cnt(c)}건</span>
                    ))}
                  </div>
                  {un.map((alert,i) => {
                    const m = CAT[alert.category] || CAT.health;
                    return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:14,background:m.bg,border:'2px solid '+m.bd,borderRadius:12,padding:'14px 18px',marginBottom:10,flexWrap:'wrap'}}>
                      <span style={{fontSize:24}}>{m.icon}</span>
                      <div style={{flex:1,minWidth:180}}><div style={{fontSize:14,fontWeight:700,color:m.c,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontSize:11,fontWeight:800,background:m.c,color:'#fff',padding:'2px 8px',borderRadius:20}}>{m.label}</span>{nameByPhone(alert.phone, alert.name)} · {alertEnCode(alert) ? alertKw(alert) : `"${alertKw(alert)}"`}</div><div style={{fontSize:12,color:m.c,marginTop:2,opacity:0.85}}>{new Date(alert.timestamp).toLocaleString('ko-KR')}</div></div>
                      {alert.status === 'ack' && <span style={{fontSize:12,fontWeight:800,color:'#b45309',background:'#fef3c7',padding:'3px 10px',borderRadius:20}}>🔧 조치중{alert.actionBy?` · ${alert.actionBy.split('@')[0]}`:''}</span>}
                      <button className="btn-small" style={{background:'#1e3a6e',color:'#fff',borderColor:'#1e3a6e'}} disabled={!!draftingAlertId} title="통화 내용을 찾아 초안까지 채워서 엽니다" onClick={()=>openNoteFromAlert(alert)}>{draftingAlertId===alert.id?'⏳ 초안 생성 중…':'📝 일지 작성'}</button>
                      {(!alert.status || alert.status === 'new') && (
                        <button className="btn-small" onClick={async()=>{await authFetch(`${SERVER_URL}/alerts/${alert.id}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'ack'})}).catch(()=>{});fetchHealth();}}>🔧 조치 시작</button>
                      )}
                      {alert.status === 'ack' && (
                        <button className="btn-small" style={{background:'#16a34a',color:'#fff',borderColor:'#16a34a'}} onClick={async()=>{
                          const note = window.prompt('조치 내용을 입력하세요 (예: 유선 확인 — 이상 없음, 보호자 연락, 방문 예정)');
                          if (note === null) return;
                          await authFetch(`${SERVER_URL}/alerts/${alert.id}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done',note})}).catch(()=>{});
                          fetchHealth();
                        }}>✅ 조치 완료</button>
                      )}
                    </div>
                    );
                  })}
                </div>
                );
              })()}
              <div className="section">
                <div className="section-title">📋 어르신별 건강 상태</div>
                {healthData.length === 0 ? (
                  <div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:48}}>📭</div><div style={{marginTop:12}}>아직 건강 체크 데이터가 없습니다</div><div style={{fontSize:13,marginTop:6}}>어르신이 앱에서 건강 체크를 하면 여기에 표시됩니다</div></div>
                ) : (
                  <table className="table">
                    <thead><tr><th>어르신</th><th>건강 상태</th><th>체크 시간</th><th>담당 복지사</th><th>조치</th></tr></thead>
                    <tbody>
                      {healthData.filter(alertIsReal).sort((a,b)=>{const order={bad:0,okay:1,good:2};return order[a.status]-order[b.status];}).map((h,i)=>{
                        const elder=elders.find(e=>String(e.phone||'').replace(/\D/g,'')===String(h.phone||'').replace(/\D/g,''))||elders.find(e=>e.name===h.name);
                        const statusColor={good:'#16a34a',okay:'#f59e0b',bad:'#ef4444'}[h.status];
                        const statusLabel={good:'😊 좋아요',okay:'😐 그럭저럭',bad:'😔 안 좋아요'}[h.status];
                        return (
                          <tr key={i} style={{background:h.status==='bad'?'#fff5f5':'inherit'}}>
                            <td><strong>{nameByPhone(h.phone, h.name)}</strong></td>
                            <td><span style={{color:statusColor,fontWeight:700,fontSize:15}}>{statusLabel}</span></td>
                            <td style={{fontSize:13,color:'#6b7280'}}>{new Date(h.timestamp).toLocaleString('ko-KR')}</td>
                            <td>{elder?.caregiver||'-'}</td>
                            <td>
                              {h.status==='bad'&&<button className="btn-small" style={{background:'#dc2626',color:'#fff',borderColor:'#dc2626'}} onClick={()=>elder&&setCallModal(elder)}>📱 즉시 전화</button>}
                              {h.status==='okay'&&<button className="btn-small" onClick={()=>elder&&setCallModal(elder)}>📱 확인 전화</button>}
                              {h.status==='good'&&<span style={{color:'#22c55e',fontSize:13}}>✅ 정상</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {elders.filter(e=>!healthData.find(h=>h.name===e.name)).length > 0 && (
                <div className="section">
                  <div className="section-title">📵 오늘 미체크 어르신</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                    {elders.filter(e=>!healthData.find(h=>h.name===e.name)).map((e,i)=>(<div key={i} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 16px',fontSize:14}}><strong>{e.name}</strong><span style={{color:'#9ca3af',fontSize:12,marginLeft:8}}>{e.region}</span></div>))}
                  </div>
                </div>
              )}
              {/* 건강 체크 이력 (일/월별) — healthEvents 컬렉션 */}
              <div className="section">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:14}}>
                  <div className="section-title" style={{marginBottom:0}}>📅 건강 체크 이력 (일/월별)</div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    {[['week','최근 7일'],['month','최근 30일'],['custom','직접 선택']].map(([k,label])=>(
                      <button key={k} onClick={()=>setHealthRange(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(healthRange===k?'#1d4ed8':'#e2e8f0'),background:healthRange===k?'#eff6ff':'#fff',color:healthRange===k?'#1d4ed8':'#64748b',fontWeight:700,fontSize:13,cursor:'pointer'}}>{label}</button>
                    ))}
                    {healthRange==='custom' && (<>
                      <input type="date" value={healthHistFrom} onChange={e=>setHealthHistFrom(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
                      <span style={{color:'#94a3b8'}}>~</span>
                      <input type="date" value={healthHistTo} onChange={e=>setHealthHistTo(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13}}/>
                    </>)}
                  </div>
                </div>
                {(()=>{
                  const histReal = healthHistory.filter(alertIsReal);
                  if (histReal.length===0) return <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>이 기간 건강 체크 이력이 없습니다.</div>;
                  const grouped={};
                  histReal.forEach(h=>{const dk=h.date||(h.at?h.at.slice(0,10):'미상');(grouped[dk]=grouped[dk]||[]).push(h);});
                  return Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,evs])=>(
                    <div key={date} style={{marginBottom:16}}>
                      <div style={{fontWeight:800,fontSize:14,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:13}}>· {evs.length}건</span></div>
                      {evs.map((h,i)=>{
                        const sc={good:'#16a34a',okay:'#f59e0b',bad:'#ef4444'}[h.status]||'#64748b';
                        const sl={good:'😊 좋아요',okay:'😐 그럭저럭',bad:'😔 안 좋아요'}[h.status]||h.status||'-';
                        const hm=h.at?new Date(h.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                        return (<div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 14px',borderRadius:10,background:h.status==='bad'?'#fef2f2':'#f8fafc',marginBottom:6}}>
                          <div style={{minWidth:80,fontWeight:700,fontSize:14}}>{h.name||h.phone||'미상'}</div>
                          <div style={{minWidth:46,color:'#64748b',fontSize:13}}>{hm}</div>
                          <div style={{fontWeight:700,fontSize:14,color:sc}}>{sl}</div>
                        </div>);
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {page==='casenotes' && (
            <div className="fade-in">
              <div className="elder-toolbar" style={{marginBottom:12,flexWrap:'wrap',gap:10}}>
                <div className="search-box"><span className="search-icon">🔍</span><input className="search-input" placeholder={`${T.elder} 이름 검색...`} value={caseSearch} onChange={e=>setCaseSearch(e.target.value)}/>{caseSearch&&<button className="search-clear" onClick={()=>setCaseSearch('')}>✕</button>}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  {[['all','전체'],['visit','🏠 방문'],['phone','📞 전화'],['office','🏢 내소'],['guardian','👪 보호자'],['etc','기타']].map(([v,l])=>(
                    <button key={v} className={`smart-btn ${caseType===v?'smart-active':''}`} style={{fontSize:12,padding:'5px 10px'}} onClick={()=>setCaseType(v)}>{l}</button>
                  ))}
                  <span style={{width:1,height:20,background:'#e2e8f0',margin:'0 2px'}}/>
                  <button className="smart-btn" style={{fontSize:12,padding:'5px 10px',...(caseFollowUpOnly?{background:'#f59e0b',borderColor:'#f59e0b',color:'#fff'}:{})}} onClick={()=>setCaseFollowUpOnly(v=>!v)}>🔔 후속 필요{caseFollowUpOnly?' ✕':''}</button>
                  <button className="btn-secondary" onClick={openSchedule} title="이용자별 월 급여제공 일정표 — 날짜별 제공시간 입력·저장 후 공식 달력 양식으로 인쇄(PDF)">📅 급여제공 일정표</button>
                  <button className="btn-secondary" onClick={openWeeklyReport} title="공식 양식(1~5주차·사회/신체/가사/기타)에 이번 달 일지를 자동으로 채워 인쇄(PDF)합니다">📄 주간업무 보고서</button>
                  <button className="btn-secondary" onClick={()=>exportNotesXlsx(caseNotes)} title="일지 전체(최근 90일)를 엑셀로 다운로드 — 기관 보관·결재용">📥 엑셀</button>
                  <button className="btn-primary" onClick={()=>openNewNote()}>＋ 새 일지</button>
                  <span style={{fontSize:12,color:'#94a3b8'}}>🔄 15초마다 자동 갱신됩니다</span>
                </div>
              </div>
              {(()=>{
                const ym=new Date().toISOString().slice(0,7);
                const tm=caseNotes.filter(n=>(n.visitedAt||'').slice(0,7)===ym);
                const stat=[
                  {label:'이번달 가정방문',value:tm.filter(n=>n.type==='visit').length,color:'#2563eb'},
                  {label:'이번달 전화상담',value:tm.filter(n=>n.type==='phone').length,color:'#16a34a'},
                  {label:'이번달 전체 상담',value:tm.length,color:'#7c3aed'},
                  {label:'미처리 후속',value:caseNotes.filter(n=>n.followUp&&n.followUp.needed&&!n.followUp.done).length,color:'#f59e0b'},
                ];
                return (
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
                    {stat.map((s,i)=>(
                      <div key={i} style={{flex:'1 1 140px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px'}}>
                        <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
                        <div style={{fontSize:13,color:'#64748b',marginTop:2}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {caseLoading ? (
                <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>불러오는 중...</div>
              ) : (()=>{
                const filtered=caseNotes.filter(n=>
                  (caseType==='all'||n.type===caseType) &&
                  (!caseSearch||(nameByPhone(n.elderPhone,n.elderName)||'').includes(caseSearch)) &&
                  (!caseFollowUpOnly||(n.followUp&&n.followUp.needed&&!n.followUp.done))
                );
                if(filtered.length===0) {
                  if(caseNotes.length===0) return <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>아직 작성된 상담·방문 일지가 없습니다. ＋ 새 일지로 첫 기록을 남겨보세요.</div>;
                  const active=[caseFollowUpOnly&&'🔔 후속 필요', caseType!=='all'&&`유형: ${(CASE_TYPE_META[caseType]||{}).label||caseType}`, caseSearch&&`검색: "${caseSearch}"`].filter(Boolean);
                  return (
                    <div style={{padding:'30px',textAlign:'center',color:'#64748b'}}>
                      <div style={{fontSize:15,fontWeight:600}}>선택한 필터에 맞는 일지가 없습니다.</div>
                      {active.length>0 && <div style={{fontSize:13,color:'#94a3b8',marginTop:6}}>적용 중인 필터 — {active.join(' · ')}</div>}
                      <div style={{fontSize:13,color:'#94a3b8',marginTop:2}}>전체 {caseNotes.length}건이 있어요. 필터를 끄면 모두 표시됩니다.</div>
                      <button onClick={()=>{setCaseType('all');setCaseSearch('');setCaseFollowUpOnly(false);}} style={{marginTop:14,background:'#2563eb',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:14,fontWeight:700,cursor:'pointer'}}>↺ 필터 초기화</button>
                    </div>
                  );
                }
                const groups={};
                filtered.forEach(n=>{ const dk=(n.visitedAt||'').slice(0,10)||'미상'; (groups[dk]=groups[dk]||[]).push(n); });
                const allSel=filtered.every(n=>selectedNotes.has(n.id));
                const selectAll=()=>setSelectedNotes(prev=>{const s=new Set(prev); if(allSel) filtered.forEach(n=>s.delete(n.id)); else filtered.forEach(n=>s.add(n.id)); return s;});
                return (<>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                    <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'#334155',cursor:'pointer'}}>
                      <input type="checkbox" checked={allSel} onChange={selectAll}/> 전체 선택
                    </label>
                    {selectedNotes.size>0 && (<>
                      <span style={{fontSize:13,color:'#2563eb',fontWeight:700}}>{selectedNotes.size}건 선택됨</span>
                      <button onClick={deleteSelectedNotes} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>🗑 선택 삭제</button>
                      <button onClick={()=>setSelectedNotes(new Set())} style={{background:'#fff',color:'#64748b',border:'1px solid #d1d5db',borderRadius:8,padding:'6px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>선택 해제</button>
                    </>)}
                  </div>
                  {Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>{
                  const open=expandedNoteDays.has(date);
                  const shown=open?rows:rows.slice(0,3);
                  return (
                    <div key={date} style={{marginBottom:16}}>
                      <div style={{fontWeight:800,fontSize:14,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:13}}>· {rows.length}건</span></div>
                      {shown.map(n=>{
                        const tmeta=CASE_TYPE_META[n.type]||CASE_TYPE_META.etc;
                        const time=n.visitedAt?new Date(n.visitedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                        const fu=n.followUp&&n.followUp.needed&&!n.followUp.done;
                        const sel=selectedNotes.has(n.id);
                        return (
                          <div key={n.id} style={{border:'1px solid '+(sel?'#93c5fd':'#e2e8f0'),borderRadius:10,padding:'12px 14px',marginBottom:8,background:sel?'#eff6ff':'#fff'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                              <input type="checkbox" checked={sel} onChange={()=>toggleNoteSel(n.id)} style={{width:16,height:16,cursor:'pointer',flexShrink:0}}/>
                              <span style={{minWidth:44,color:'#64748b',fontSize:13,fontWeight:600}}>{time}</span>
                              <span style={{fontSize:12,fontWeight:700,color:tmeta.color,background:tmeta.bg,padding:'2px 8px',borderRadius:20}}>{tmeta.icon} {tmeta.label}</span>
                              <span style={{fontWeight:700,fontSize:14}}>{nameByPhone(n.elderPhone,n.elderName)}</span>
                              <span style={{fontSize:12,color:'#64748b'}}>· {CASE_CAT_META[n.category]||'기타'}</span>
                              {(n.topics||[]).length>0 && <span style={{fontSize:11.5,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:12,padding:'2px 8px'}}>{(n.topics||[]).map(t=>CASE_TOPIC_META[t]).filter(Boolean).join('·')}</span>}
                              {n.linkedAlertId&&<span style={{fontSize:11,color:'#dc2626',fontWeight:700}}>🔗 알림 대응</span>}
                              {fu&&<span style={{fontSize:11,color:'#f59e0b',fontWeight:700}}>🔔 후속{n.followUp.dueDate?` ~${n.followUp.dueDate}`:''}</span>}
                              <span style={{flex:1}}/>
                              <button onClick={()=>copyNote(n, n.id)} style={{background:'none',border:'none',color:'#16a34a',fontSize:12,fontWeight:700,cursor:'pointer'}} title="붙여넣기용 텍스트 복사">{copiedNoteId===n.id?'✅ 복사됨':'📋 복사'}</button>
                              <button onClick={()=>openEditNote(n)} style={{background:'none',border:'none',color:'#2563eb',fontSize:12,fontWeight:700,cursor:'pointer'}}>수정</button>
                              <button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:12,fontWeight:700,cursor:'pointer'}}>삭제</button>
                            </div>
                            {n.content&&<div style={{fontSize:13.5,color:'#1f2937',marginTop:6,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.content}</div>}
                            {n.action&&<div style={{fontSize:13,color:'#475569',marginTop:5,lineHeight:1.5}}><b style={{color:'#0f766e'}}>조치</b> {n.action}</div>}
                            {n.authorEmail&&<div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>작성: {n.authorEmail}</div>}
                          </div>
                        );
                      })}
                      {rows.length>3 && (
                        <button onClick={()=>setExpandedNoteDays(prev=>{const s=new Set(prev); s.has(date)?s.delete(date):s.add(date); return s;})} style={{background:'none',border:'none',color:'#2563eb',fontSize:12.5,fontWeight:700,cursor:'pointer',padding:'2px 0'}}>
                          {open?'접기 ▴':`${rows.length-3}건 더 보기 ▾`}
                        </button>
                      )}
                    </div>
                  );
                })}
                </>);
              })()}
            </div>
          )}

          {page==='data' && (
            <div className="fade-in">
              <div className="data-banner">
                <div><div className="data-banner-title">📊 대구광역시 독거노인 현황</div><div className="data-banner-sub">출처: {popData?.source || '행정안전부 주민등록인구통계'}{popData && ` · ${popData.year}년 ${popData.month}월 기준`}</div></div>
                <button className={`btn-download ${popLoading?'btn-calling':''}`} onClick={fetchPopulation} disabled={popLoading}>{popLoading ? '⏳ 불러오는 중...' : '🔄 데이터 갱신'}</button>
              </div>
              {popError && <div className="call-result-banner error">❌ {popError}</div>}
              {popLoading && <div style={{textAlign:'center',padding:'40px',color:'#64748b',fontSize:16}}>⏳ 행정안전부 공공데이터 불러오는 중...</div>}
              {popData && (
                <>
                  <div className="data-total-row">
                    {[{num:popData.total.population.toLocaleString()+'명',label:'대구 전체 인구',color:'#0f172a'},{num:popData.total.elderly.toLocaleString()+'명',label:'65세 이상 노인',color:'#1d4ed8'},{num:popData.total.solitary.toLocaleString()+'명',label:'추정 독거노인',color:'#f59e0b'},{num:elders.length+'명',label:'영실이 현재 관리',color:'#22c55e'},{num:(elders.length/popData.total.solitary*100).toFixed(2)+'%',label:'관리 비율',color:'#ef4444'},{num:popData.total.elderlyRatio+'%',label:'고령화율',color:'#7c3aed'}].map((d,i)=>(<div key={i} className="data-total-card"><div className="data-total-num" style={{color:d.color}}>{d.num}</div><div className="data-total-label">{d.label}</div></div>))}
                  </div>
                  {popData.total.elderlyRatio >= 20 && <div style={{background:'#fef2f2',border:'2px solid #fecaca',borderRadius:12,padding:'14px 20px',marginBottom:20,fontSize:14,color:'#dc2626',fontWeight:700}}>🚨 대구광역시 고령화율 {popData.total.elderlyRatio}% → 초고령사회 진입 (20% 이상)</div>}
                  <div className="section">
                    <div className="section-title">🗺️ 구별 독거노인 현황</div>
                    <table className="table">
                      <thead><tr><th>구</th><th>전체 인구</th><th>65세 이상</th><th>고령화율</th><th>추정 독거노인</th><th>영실이 관리</th><th>관리 비율</th><th>커버리지</th></tr></thead>
                      <tbody>
                        {popData.regions.sort((a,b)=>b.solitary-a.solitary).map((d,i)=>{
                          const managed=elders.filter(e=>(e.region||'').replace('대구광역시','').replace('대구','').trim()===d.region).length;
                          const managedRatio=d.solitary>0?(managed/d.solitary*100).toFixed(2):0;
                          const isHighAge=d.elderlyRatio>=20;
                          return (
                            <tr key={i} style={{background:isHighAge?'#fffbeb':'inherit'}}>
                              <td><div style={{display:'flex',alignItems:'center',gap:8}}><strong>{d.region}</strong>{isHighAge&&<span style={{fontSize:11,background:'#f59e0b',color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700}}>초고령</span>}</div></td>
                              <td>{d.total.toLocaleString()}명</td><td>{d.elderly.toLocaleString()}명</td>
                              <td><span style={{color:d.elderlyRatio>=20?'#ef4444':d.elderlyRatio>=14?'#f59e0b':'#22c55e',fontWeight:700}}>{d.elderlyRatio}%</span></td>
                              <td><strong>{d.solitary.toLocaleString()}명</strong></td>
                              <td><span style={{color:'#1d4ed8',fontWeight:700}}>{managed}명</span></td>
                              <td><span style={{color:parseFloat(managedRatio)>5?'#22c55e':'#f59e0b',fontWeight:700}}>{managedRatio}%</span></td>
                              <td><div className="progress-bar" style={{width:120}}><div className="progress-fill" style={{width:`${Math.min(parseFloat(managedRatio)*10,100)}%`}}/></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="section">
                    <div className="section-title">🌡️ 기상특보 집중 케어 대상</div>
                    <div className="data-banner-sub" style={{marginBottom:14}}>기상청 공공데이터 경보가 발령된 지역의 어르신이에요. 오늘 안전 확인이 필요합니다.</div>
                    {(() => {
                      const ALERTS = [
                        {key:'heatwave', icon:'🌡️', label:'폭염경보', color:'#ef4444', tip:'수분 섭취·외출 자제 안내'},
                        {key:'cold', icon:'❄️', label:'한파경보', color:'#3b82f6', tip:'난방·보온 상태 확인'},
                        {key:'dust', icon:'😷', label:'미세먼지 나쁨', color:'#f59e0b', tip:'외출 자제·환기 주의'},
                        {key:'rain', icon:'🌧️', label:'호우주의보', color:'#6366f1', tip:'외출 자제·안부 확인'},
                        {key:'typhoon', icon:'🌀', label:'태풍경보', color:'#7c3aed', tip:'외출 금지·안부 확인'},
                        {key:'wildfire', icon:'🔥', label:'산불발생', color:'#ea580c', tip:'대피 안내 확인·안부 확인'},
                      ];
                      const groups = ALERTS.map(a => ({...a, list: elders.filter(e => weatherData[e.region]?.alert === a.key)})).filter(g => g.list.length > 0);
                      if (groups.length === 0) return <div style={{color:'#16a34a',fontSize:15,padding:'20px 0',textAlign:'center'}}>☀️ 현재 발령된 기상특보가 없습니다. 모든 어르신이 안전한 날씨예요.</div>;
                      return groups.map(g => (
                        <div key={g.key} style={{marginBottom:16}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,fontWeight:700,color:g.color}}>
                            <span style={{fontSize:18}}>{g.icon}</span> {g.label} · {g.list.length}명 <span style={{fontWeight:400,color:'#6b7280',fontSize:13}}>({g.tip})</span>
                          </div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                            {g.list.map(e => (
                              <div key={e.id} style={{border:'1px solid '+g.color+'33',borderRadius:10,padding:'10px 14px',background:'#fff',minWidth:210,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                                <div>
                                  <div style={{fontWeight:700,color:'#0f172a'}}>{e.gender==='female'?'👵':'👴'} {e.name} <span style={{fontWeight:400,fontSize:12,color:e.status==='danger'?'#ef4444':e.status==='warning'?'#f59e0b':'#9ca3af'}}>{e.status==='danger'?'· 위험':e.status==='warning'?'· 주의':''}</span></div>
                                  <div style={{fontSize:12,color:'#6b7280'}}>{e.region} · {weatherData[e.region]?.temp}℃</div>
                                </div>
                                <button onClick={()=>e.callActive&&setCallModal(e)} disabled={calling===e.id||!e.callActive} style={{fontSize:13,padding:'6px 12px',borderRadius:8,border:'none',background:e.callActive?g.color:'#d1d5db',color:'#fff',cursor:e.callActive?'pointer':'not-allowed',fontWeight:700,whiteSpace:'nowrap'}}>{calling===e.id?'⏳':'📞 전화'}</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {page==='detail' && selected && (
            <div className="fade-in">
              <div className="detail-topbar">
                <button className="back-btn" onClick={()=>{setPage('elders');setSelected(null);}}>← 목록으로</button>
                <div className="detail-actions"><button className="btn-secondary" onClick={()=>openEdit(selected)}>✏️ 정보 수정</button><button className="btn-danger-outline" onClick={()=>deleteElder(selected.id)}>🗑️ 삭제</button></div>
              </div>
              {callResult&&callResult.elderId===selected.id&&<div className={`call-result-banner ${callResult.status}`}>{callResult.status==='success'?'✅':'❌'} {callResult.message}</div>}
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-avatar">{(selected.name||'?')[0]}</div>
                  <div className="detail-name">{selected.name}</div>
                  <div className="detail-sub">{selected.age}세 · {selected.region}</div>
                  <div className={`status-badge badge-${selected.status} mt16`}>{(STATUS_CONFIG[selected.status]||STATUS_CONFIG.normal).label}</div>
                  <div className="call-action-box">
                    <button className={`btn-call-lg ${calling===selected.id?'btn-calling':''} ${!selected.callActive?'btn-disabled':''}`} onClick={()=>selected.callActive&&setCallModal(selected)} disabled={calling===selected.id||!selected.callActive}>{calling===selected.id?'⏳ 발신 중...':'📱 앱으로 전화하기'}</button>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginTop:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:700,padding:'5px 12px',borderRadius:20,...(selected.callActive?{background:'#dcfce7',color:'#15803d'}:{background:'#fee2e2',color:'#dc2626'})}}>{selected.callActive?'🟢 자동전화 발신 중':'🔴 자동전화 중단'}</span>
                      <button onClick={()=>toggleCallActive(selected.id)} style={{fontSize:13,fontWeight:700,padding:'7px 14px',borderRadius:8,cursor:'pointer',...(selected.callActive?{background:'#fff',color:'#64748b',border:'1px solid #d1d5db'}:{background:'#16a34a',color:'#fff',border:'none'})}}>{selected.callActive?'⏸ 중단하기':'▶ 발신 켜기'}</button>
                    </div>
                  </div>
                  {[['성별',selected.gender==='female'?'👵 여성':'👴 남성'],['호칭',selected.title||'어르신'],['돌봄군',(CARE_GROUPS[selected.careGroup]||{}).label||'미지정'],['전화번호',selected.phone],['담당 복지사',selected.caregiver||'미배정'],['주소',`${selected.address||''} ${selected.addressDetail||''}`.trim()],['보호자',selected.guardian],['보호자 연락처',selected.guardianPhone],['지병',selected.disease||'없음'],['복용약',selected.medicine||'없음'],['거동상태',selected.mobility],['전화 주기',cycleLabel(selected.callCycle, selected.callDays)],['전화 시간',selected.callTime],['마지막 통화',selected.lastCall],['방문 필요',selected.visits>0?`${selected.visits}회 권고`:'불필요']].map(([label,value],i)=>(<div key={i} className="detail-info-row"><span className="detail-label">{label}</span><span style={{color:label==='방문 필요'&&selected.visits>0?'#ef4444':'inherit',fontWeight:label==='방문 필요'?700:400}}>{value}</span></div>))}
                </div>
                <div className="detail-right">
                  {selected.keyword&&<div className="alert-box"><div className="alert-box-title">🚨 감지된 위험 키워드</div><div className="alert-box-keyword">"{selected.keyword}"</div><div className="alert-box-desc">즉시 방문 또는 가족 연락이 필요합니다.</div></div>}
                  <div className="section">
                    <div className="script-editor-header" style={{marginBottom:12}}>
                      <div className="section-title" style={{marginBottom:0}}>📞 통화 기록</div>
                    </div>
                    {(()=>{
                      // 통화기록 메뉴와 동일한 서버 데이터(callsHistory)에서 이 어르신만 필터 (이름 또는 전화번호 매칭)
                      const mine = callsHistory.filter(c=>c.elderName===selected.name||(c.phone&&selected.phone&&String(c.phone).replace(/\D/g,'')===String(selected.phone).replace(/\D/g,'')));
                      if(mine.length===0) return <div style={{color:'#9ca3af',fontSize:14,padding:'16px 0'}}>통화 기록 없음</div>;
                      return mine.map(c=>{
                        const R=RISK_CONFIG[c.riskLevel]||{};
                        const hm=c.at?new Date(c.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                        const dur=c.durationSec||0;
                        return (
                          <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:c.riskLevel==='critical'?'#fef2f2':c.riskLevel==='urgent'?'#fff7ed':'#f8fafc',marginBottom:6,flexWrap:'wrap'}}>
                            <div style={{minWidth:96,color:'#64748b',fontSize:13}}>{c.date} {hm}</div>
                            <div style={{minWidth:64,color:'#64748b',fontSize:13}}>{Math.floor(dur/60)}분 {dur%60}초</div>
                            <div style={{minWidth:44,fontWeight:700,fontSize:13,color:R.color||'#16a34a'}}>{R.label||'정상'}</div>
                            <div style={{flexBasis:'100%'}}><CallTranscript text={c.transcript} /></div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="section">
                    <div className="script-editor-header" style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div className="section-title" style={{marginBottom:0}}>📝 상담·방문 일지</div>
                      <button className="btn-primary" style={{fontSize:13,padding:'6px 12px'}} onClick={()=>openNewNote({elderPhone:selected.phone,elderName:selected.name})}>＋ 일지 작성</button>
                    </div>
                    {(()=>{
                      const mineNotes=caseNotes.filter(n=>String(n.elderPhone||'').replace(/\D/g,'')===String(selected.phone||'').replace(/\D/g,''));
                      if(mineNotes.length===0) return <div style={{color:'#9ca3af',fontSize:14,padding:'8px 0'}}>상담·방문 일지 없음</div>;
                      return mineNotes.map(n=>{
                        const tmeta=CASE_TYPE_META[n.type]||CASE_TYPE_META.etc;
                        const d=n.visitedAt?new Date(n.visitedAt):null;
                        const when=d?`${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}`:'';
                        return (
                          <div key={n.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',marginBottom:8,background:'#fff'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                              <span style={{color:'#64748b',fontSize:12,fontWeight:600}}>{when}</span>
                              <span style={{fontSize:11,fontWeight:700,color:tmeta.color,background:tmeta.bg,padding:'2px 8px',borderRadius:20}}>{tmeta.icon} {tmeta.label}</span>
                              <span style={{fontSize:12,color:'#64748b'}}>{CASE_CAT_META[n.category]||'기타'}</span>
                              {n.linkedAlertId&&<span style={{fontSize:11,color:'#dc2626',fontWeight:700}}>🔗 알림 대응</span>}
                              <span style={{flex:1}}/>
                              <button onClick={()=>copyNote(n, n.id)} style={{background:'none',border:'none',color:'#16a34a',fontSize:12,fontWeight:700,cursor:'pointer'}} title="붙여넣기용 텍스트 복사">{copiedNoteId===n.id?'✅ 복사됨':'📋 복사'}</button>
                              <button onClick={()=>openEditNote(n)} style={{background:'none',border:'none',color:'#2563eb',fontSize:12,fontWeight:700,cursor:'pointer'}}>수정</button>
                              <button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:12,fontWeight:700,cursor:'pointer'}}>삭제</button>
                            </div>
                            {n.content&&<div style={{fontSize:13,color:'#1f2937',marginTop:5,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.content}</div>}
                            {n.action&&<div style={{fontSize:12.5,color:'#475569',marginTop:4}}><b style={{color:'#0f766e'}}>조치</b> {n.action}</div>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {page==='help' && <HelpGuide orgCode={me?.orgCode} />}

          {page==='forms' && (
            <div className="fade-in">
              <div className="data-banner" style={{marginBottom:20}}>
                <div><div className="data-banner-title">📥 보고서·서식</div><div className="data-banner-sub">제출·보관용 서식을 한곳에서 확인하고 내려받으세요 · 월을 바꾸면 현황이 갱신됩니다</div></div>
                <input type="month" className="form-input" style={{width:170,margin:0}} value={formsYm} onChange={e=>{setFormsYm(e.target.value);setReportMonth(e.target.value);}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:14}}>
                {[
                  { icon:'📄', title:'주간업무 보고서', desc:'지원사가 주차별 작성(음성→텍스트)한 보고서 — 검토·오타 수정 후 출력', badge:`${formsYm.split('-')[1]}월 ${formsCounts.weekly}명 작성`,
                    btns:[ {label:'열람·수정·출력', primary:true, on:()=>openWeeklyReport(formsYm)}, {label:'🖨 일괄 출력', on:()=>printWeeklyBatchFor(formsYm)} ] },
                  { icon:'📅', title:'급여제공 일정표', desc:'일별 제공시간(주말·공휴일 1.5배, 월 120시간 한도) — 공식 달력 양식 출력', badge:`${formsYm.split('-')[1]}월 ${formsCounts.sched}명 작성`,
                    btns:[ {label:'입력·출력', primary:true, on:()=>openSchedule(formsYm)}, {label:'🖨 일괄 출력', on:()=>printScheduleBatchFor(formsYm)} ] },
                  { icon:'📝', title:'상담·방문일지 엑셀', desc:'일지 전체를 엑셀로 — 기관 보관·결재용', badge:`최근 90일 ${caseNotes.length}건`,
                    btns:[ {label:'📥 엑셀 다운로드', primary:true, on:()=>exportNotesXlsx(caseNotes)} ] },
                  { icon:'📊', title:'월간 실적 보고서', desc:'통화·안전확인·위험감지·일지 실적 종합 — 지자체 보고용 엑셀', badge:`${formsYm.split('-')[1]}월 기준`,
                    btns:[ {label: monthlyBusy?'⏳ 생성 중…':'📥 엑셀 다운로드', primary:true, on:()=>downloadMonthlyReport(formsYm)} ] },
                ].map(card=>(
                  <div key={card.title} className="section" style={{display:'flex',flexDirection:'column',gap:10,margin:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:26}}>{card.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:900,color:'#1e3a6e'}}>{card.title}</div>
                        <div style={{fontSize:12.5,color:'#64748b',marginTop:2}}>{card.desc}</div>
                      </div>
                    </div>
                    <div><span style={{fontSize:12.5,fontWeight:800,color:'#1d4ed8',background:'#eff6ff',border:'1px solid #bfdbfe',padding:'3px 10px',borderRadius:20}}>{card.badge}</span></div>
                    <div style={{display:'flex',gap:8,marginTop:'auto',flexWrap:'wrap'}}>
                      {card.btns.map(b=>(
                        <button key={b.label} className={b.primary?'btn-primary':'btn-secondary'} style={{padding:'9px 16px',fontSize:13.5}} onClick={b.on}>{b.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:12.5,color:'#94a3b8',marginTop:14}}>💡 주간업무 보고서·급여제공 일정표의 '저장'은 로컬 파일(엑셀)로 저장됩니다. 인쇄(PDF)는 각 화면의 양식 인쇄 버튼을 사용하세요.</div>
            </div>
          )}

          {page==='admin' && (
            <div className="fade-in">
              {!isStaffUp ? (
                <div className="section" style={{textAlign:'center',color:'#94a3b8',padding:40}}>접근 권한이 없습니다.</div>
              ) : (
              <>
                {adminMsg && <div className="success-banner" style={{marginBottom:16}}>{adminMsg}</div>}

                {/* 구성원 초대 링크 — 센터장: 센터장·전담직원·지원사 / 전담직원: 지원사만 */}
                <div className="section" style={{marginBottom:16}}>
                  <div className="section-title">✉️ 구성원 초대</div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:10}}>초대 링크를 만들어 전달하면, 받은 분이 링크에서 직접 가입해 <b>우리 기관 소속으로 자동 합류</b>합니다. (링크는 7일 유효 · 1인 1회용)</div>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <select className="form-input" style={{width:200,margin:0}} value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                      {grantableRoles.map(r=>(<option key={r} value={r}>{ROLE_KO[r]}</option>))}
                    </select>
                    <button className="btn-primary" style={{padding:'10px 20px'}} onClick={createInvite}>＋ 초대 링크 만들기</button>
                  </div>
                  {invites.length>0 && (
                    <table className="table" style={{marginTop:12}}>
                      <thead><tr><th>역할</th><th>초대 링크</th><th>만든 사람</th><th>유효기간</th><th>관리</th></tr></thead>
                      <tbody>
                        {invites.map(v=>(
                          <tr key={v.code}>
                            <td><span className="status-badge badge-normal">{ROLE_KO[v.role]||v.role}</span></td>
                            <td style={{fontSize:12.5,fontFamily:'monospace',color:'#1d4ed8',wordBreak:'break-all'}}>{inviteLink(v.code)}</td>
                            <td style={{fontSize:13,color:'#64748b'}}>{(v.createdBy||'').split('@')[0]}</td>
                            <td style={{fontSize:13,color:'#64748b'}}>{v.expiresAt?new Date(v.expiresAt).toLocaleDateString('ko-KR'):'-'}</td>
                            <td style={{whiteSpace:'nowrap'}}>
                              <button className="btn-small" onClick={()=>copyInvite(v.code)}>{copiedInvite===v.code?'✅ 복사됨':'📋 복사'}</button>{' '}
                              <button className="btn-danger-outline" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>deleteInvite(v.code)}>취소</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {isSuper && (<>
                {/* 새 기관 만들기 */}
                <div className="section" style={{marginBottom:16}}>
                  <div className="section-title">🏢 새 기관(복지관) 만들기</div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:10}}>기관을 만들면 <b>기관코드</b>가 자동 발급됩니다. 이 코드를 복지사에게 전달하면, 복지사가 어르신 폰 앱에 입력해 해당 기관으로 등록됩니다.</div>
                  <div style={{display:'flex',gap:8,maxWidth:680}}>
                    <input className="form-input" style={{flex:1}} value={newOrgName} onChange={e=>setNewOrgName(e.target.value)} placeholder="예) ○○구 노인복지관 / ○○장애인자립센터" onKeyDown={e=>e.key==='Enter'&&createOrg()}/>
                    <select className="form-input" style={{width:170}} value={newOrgType} onChange={e=>setNewOrgType(e.target.value)}>
                      <option value="senior">노인맞춤돌봄</option>
                      <option value="disability">장애인활동지원</option>
                    </select>
                    <button className="btn-primary" style={{whiteSpace:'nowrap',padding:'0 20px'}} onClick={createOrg}>+ 기관 생성</button>
                  </div>
                </div>

                {/* 기관 목록 */}
                <div className="section" style={{marginBottom:16}}>
                  <div className="section-title">📋 기관 목록 ({orgs.length})</div>
                  <table className="table">
                    <thead><tr><th>기관명</th><th>유형</th><th>기관코드</th><th>대상자</th><th>계정</th></tr></thead>
                    <tbody>
                      {orgs.length===0 && <tr><td colSpan={5} style={{textAlign:'center',color:'#94a3b8',padding:24}}>기관이 없습니다</td></tr>}
                      {orgs.map(o=>(
                        <tr key={o.orgId}>
                          <td><strong>{o.name}</strong></td>
                          <td><span className="status-badge badge-normal">{ORG_TYPE_KO[o.orgType]||'노인맞춤돌봄'}</span></td>
                          <td><span className="cycle-badge" style={{fontFamily:'monospace',fontWeight:800,letterSpacing:1,color:'#1d4ed8',background:'#eff6ff'}}>{o.code}</span></td>
                          <td>{o.elderCount}명</td>
                          <td>{o.userCount}개</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>)}

                {/* 새 구성원 계정 (직접 생성 — 초대 링크 대신 관리자가 만들어 전달할 때) */}
                <div className="section" style={{marginBottom:16}}>
                  <div className="section-title">👤 새 구성원 계정 만들기</div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:10}}>구성원의 로그인 계정을 직접 만듭니다. <b>지원사</b> 계정은 배정된 이용자만 볼 수 있습니다.</div>
                  <div className="form-grid" style={{maxWidth:720}}>
                    <div className="form-field"><label className="form-label">이름</label><input className="form-input" value={newAcct.name} onChange={e=>setNewAcct(a=>({...a,name:e.target.value}))} placeholder="예) 김복지" autoComplete="off"/></div>
                    <div className="form-field"><label className="form-label">전화번호 <span style={{color:'#94a3b8',fontWeight:400}}>(번호만 입력)</span></label><input className="form-input" inputMode="numeric" value={newAcct.phone} onChange={e=>setNewAcct(a=>({...a,phone:e.target.value.replace(/[^0-9]/g,'')}))} placeholder="01012345678" autoComplete="off"/></div>
                    <div className="form-field"><label className="form-label">이메일(로그인 ID)</label><input className="form-input" value={newAcct.email} onChange={e=>setNewAcct(a=>({...a,email:e.target.value}))} placeholder="worker@example.com" autoComplete="off"/></div>
                    <div className="form-field"><label className="form-label">초기 비밀번호(6자 이상)</label><input className="form-input" type="password" value={newAcct.password} onChange={e=>setNewAcct(a=>({...a,password:e.target.value}))} placeholder="복지사에게 전달" autoComplete="new-password"/></div>
                    {isSuper ? (<>
                      <div className="form-field"><label className="form-label">소속 기관</label><select className="form-input" value={newAcct.orgId} onChange={e=>setNewAcct(a=>({...a,orgId:e.target.value}))}><option value="">기관 선택</option>{orgs.map(o=><option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>)}</select></div>
                      <div className="form-field"><label className="form-label">역할</label><select className="form-input" value={newAcct.role} onChange={e=>setNewAcct(a=>({...a,role:e.target.value}))}><option value="admin">센터장(관리자)</option><option value="staff">전담직원</option><option value="worker">지원사</option><option value="superadmin">운영자 (전체 + 기관관리)</option></select></div>
                    </>) : (<>
                      <div className="form-field"><label className="form-label">역할</label><select className="form-input" value={newAcct.role} onChange={e=>setNewAcct(a=>({...a,role:e.target.value}))}>{grantableRoles.map(r=>(<option key={r} value={r}>{ROLE_KO[r]}</option>))}</select></div>
                      <div className="form-field"><label className="form-label">소속 기관</label><div style={{fontSize:14,fontWeight:700,color:'#1e3a6e',padding:'8px 0'}}>🏢 {me?.orgName||'우리 기관'}{me?.orgCode?` (${me.orgCode})`:''}</div></div>
                    </>)}
                  </div>
                  <button className="btn-primary" style={{marginTop:12,padding:'10px 20px'}} onClick={createAccount}>+ 계정 생성</button>
                </div>

                {/* 계정 목록 */}
                <div className="section">
                  <div className="section-title">🔑 대시보드 계정 ({accounts.length})</div>
                  <table className="table">
                    <thead><tr><th>이름</th><th>전화번호</th><th>이메일</th><th>소속 기관</th><th>역할</th><th>관리</th></tr></thead>
                    <tbody>
                      {accounts.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#94a3b8',padding:24}}>계정이 없습니다</td></tr>}
                      {accounts.map(u=>{
                        const org = orgs.find(o=>o.orgId===u.orgId);
                        return (
                          <tr key={u.uid}>
                            <td><strong>{u.name||'—'}</strong>{u.uid===me?.uid&&<span style={{fontSize:11,color:'#16a34a',marginLeft:6}}>(나)</span>}</td>
                            <td style={{fontSize:13,color:'#64748b'}}>{u.phone||'—'}</td>
                            <td style={{fontSize:13,color:'#64748b'}}>{u.email}</td>
                            <td style={{fontSize:13,color:'#64748b'}}>{org?org.name:(me?.orgName||u.orgId)}</td>
                            <td>{u.role==='superadmin'?<span className="status-badge badge-warning">운영자</span>:<span className="status-badge badge-normal">{ROLE_KO[u.role]||'센터장(관리자)'}</span>}</td>
                            <td>{(u.role!=='superadmin'&&u.uid!==me?.uid&&isAdmin)?<button className="btn-danger-outline" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>deleteAccount(u.uid,u.email)}>🗑️ 삭제</button>:<span style={{color:'#cbd5e1',fontSize:12}}>—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
              )}
            </div>
          )}

          {page==='register' && (
            <div className="fade-in">
              <button className="back-btn" onClick={()=>setPage(editMode?'detail':'elders')}>← 돌아가기</button>
              {saveSuccess&&<div className="success-banner">✅ {editMode?'수정이 완료되었습니다!':'어르신 등록이 완료되었습니다!'}</div>}
              <div className="step-bar">
                {[{n:1,label:'기본 정보'},{n:2,label:'보호자 정보'},{n:3,label:'AI 전화 설정'}].map(step=>(<div key={step.n} className={`step-item ${formStep===step.n?'step-active':formStep>step.n?'step-done':''}`}><div className="step-circle">{formStep>step.n?'✓':step.n}</div><div className="step-label">{step.label}</div>{step.n<3&&<div className="step-line"/>}</div>))}
              </div>
              <div className="form-card">
                {formStep===1&&(<div className="fade-in"><div className="form-section-title">👤 기본 정보</div><div className="form-grid">
                  <div className="form-field full-width"><label className="form-label">성별 <span className="required">*</span></label><div className="gender-group">{[{value:'female',icon:'👵',label:'여성'},{value:'male',icon:'👴',label:'남성'}].map(g=>(<label key={g.value} className={`gender-option ${form.gender===g.value?'gender-selected':''}`} onClick={()=>setForm(f=>({...f,gender:g.value,title:TITLE_OPTIONS[g.value][0]}))}><span style={{fontSize:28}}>{g.icon}</span><span style={{fontWeight:700}}>{g.label}</span></label>))}</div></div>
                  <div className="form-field full-width"><label className="form-label">호칭 (전화 시 사용)</label><div className="radio-group">{(TITLE_OPTIONS[form.gender]||[]).map(t=>(<label key={t} className={`radio-option ${form.title===t?'radio-selected':''}`}><input type="radio" name="title" value={t} checked={form.title===t} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{display:'none'}}/>{t}</label>))}</div><div style={{fontSize:12,color:'#94a3b8',marginTop:6}}>💬 전화 시 "{form.title}, 안녕하세요. 저 영실이인데요~" 라고 시작합니다</div></div>
                  <div className="form-field"><label className="form-label">이름 <span className="required">*</span></label><input {...inp('name')} placeholder="예: 김순자"/>{formErrors.name&&<div className="error-msg">{formErrors.name}</div>}</div>
                  <div className="form-field"><label className="form-label">나이 <span className="required">*</span></label><input {...inp('age')} type="number" placeholder="예: 78"/>{formErrors.age&&<div className="error-msg">{formErrors.age}</div>}</div>
                  <div className="form-field"><label className="form-label">전화번호 <span className="required">*</span></label><input {...inp('phone')} placeholder="예: 010-1234-5678"/>{formErrors.phone&&<div className="error-msg">{formErrors.phone}</div>}</div>
                  <div className="form-field"><label className="form-label">주민등록번호 <span style={{fontSize:11,color:'#94a3b8'}}>(급여제공 일정표의 생년월일에 사용)</span></label><input className="form-input" value={form.jumin||''} inputMode="numeric" maxLength={14} placeholder="000000-0000000" onChange={e=>{const d=e.target.value.replace(/[^0-9]/g,'').slice(0,13);setForm(f=>({...f,jumin:d.length>6?`${d.slice(0,6)}-${d.slice(6)}`:d}));}}/></div>
                  <div className="form-field"><label className="form-label">관할 구역 <span style={{fontSize:11,color:'#94a3b8'}}>(주소에서 자동)</span></label><input className="form-input" value={form.region||''} readOnly placeholder="주소 검색 시 자동 입력" style={{background:'#f8fafc'}}/></div>
                  <div className="form-field full-width"><label className="form-label">주소 <span className="required">*</span></label><div style={{display:'flex',gap:8}}><input {...inp('address')} placeholder="🔍 주소 검색을 눌러 선택" style={{flex:1}}/><button type="button" className="btn-secondary" onClick={openAddressSearch} style={{whiteSpace:'nowrap',padding:'0 18px',fontWeight:700}}>🔍 주소 검색</button></div>{formErrors.address&&<div className="error-msg">{formErrors.address}</div>}</div>
                  <div className="form-field full-width"><label className="form-label">상세 주소 <span style={{fontSize:11,color:'#94a3b8'}}>(아파트 동/호수 등)</span></label><input {...inp('addressDetail')} placeholder="예: 101동 1202호"/></div>
                  <div className="form-field"><label className="form-label">지병</label><input {...inp('disease')} placeholder="예: 고혈압, 당뇨"/></div>
                  <div className="form-field"><label className="form-label">복용 중인 약</label><input {...inp('medicine')} placeholder="예: 혈압약"/></div>
                  <div className="form-field full-width"><label className="form-label">거동 상태</label><div className="radio-group">{['독립보행 가능','보조기구 필요','거동 불가'].map(opt=><label key={opt} className={`radio-option ${form.mobility===opt?'radio-selected':''}`}><input type="radio" name="mobility" value={opt} checked={form.mobility===opt} onChange={e=>setForm(f=>({...f,mobility:e.target.value}))} style={{display:'none'}}/>{opt}</label>)}</div></div>
                  <div className="form-field full-width"><label className="form-label">담당 복지사</label><div style={{display:'flex',gap:8}}><select {...inp('caregiver')} style={{flex:1}}><option value="">선택 안 함</option>{[...new Set([...caregivers, ...elders.map(e=>e.caregiver).filter(Boolean)])].map(c=><option key={c} value={c}>{c}</option>)}</select><button type="button" onClick={addCaregiver} style={{padding:'0 16px',borderRadius:8,border:'1px solid #2563eb',background:'#eff6ff',color:'#1d4ed8',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>+ 추가</button></div></div>
                  <div className="form-field full-width"><label className="form-label">복지사 전화번호</label><input {...inp('caregiverPhone')} placeholder="010-0000-0000" /></div>
                  <div className="form-field full-width"><label className="form-label">담당 지원사 배정 <span style={{fontSize:11,color:'#94a3b8'}}>(지원사 계정 — 배정하면 그 지원사에게 이 어르신이 보입니다)</span></label>
                    <select className="form-input" value={form.assignedTo||''} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>
                      <option value="">배정 안 함</option>
                      {accounts.filter(u=>u.role==='worker'||u.role==='staff').map(u=>(<option key={u.uid} value={u.email}>{u.name||u.email.split('@')[0]} ({ROLE_KO[u.role]})</option>))}
                    </select>
                  </div>
                </div><div className="form-footer"><button className="btn-primary btn-lg" onClick={nextStep}>다음 단계 →</button></div></div>)}
                {formStep===2&&(<div className="fade-in"><div className="form-section-title">👨‍👩‍👧 보호자 정보</div><div className="form-grid"><div className="form-field"><label className="form-label">보호자 이름 <span className="required">*</span></label><input {...inp('guardian')} placeholder="예: 김민준"/>{formErrors.guardian&&<div className="error-msg">{formErrors.guardian}</div>}</div><div className="form-field"><label className="form-label">보호자 연락처 <span className="required">*</span></label><input {...inp('guardianPhone')} placeholder="예: 010-9876-5432"/>{formErrors.guardianPhone&&<div className="error-msg">{formErrors.guardianPhone}</div>}</div></div><div className="form-info-box">💡 위험 키워드 감지 시 보호자에게 즉시 알림이 발송됩니다.</div><div className="form-footer"><button className="btn-secondary btn-lg" onClick={()=>setFormStep(1)}>← 이전</button><button className="btn-primary btn-lg" onClick={nextStep}>다음 단계 →</button></div></div>)}
                {formStep===3&&(<div className="fade-in"><div className="form-section-title">📞 AI 전화 설정</div><div className="form-grid">{!isDisability&&<div className="form-field full-width"><label className="form-label">돌봄군 (노인맞춤돌봄서비스)</label><div className="radio-group">{[{value:'',label:'미지정'},{value:'general',label:'일반돌봄군'},{value:'intensive',label:'중점돌봄군'}].map(opt=><label key={opt.value} className={`radio-option ${form.careGroup===opt.value?'radio-selected':''}`}><input type="radio" name="careGroup" value={opt.value} checked={(form.careGroup||'')===opt.value} onChange={()=>{const g=CARE_GROUPS[opt.value];setForm(f=>({...f,careGroup:opt.value,...(g?{callCycle:'custom',callDays:[...g.days]}:{})}));}} style={{display:'none'}}/>{opt.label}</label>)}</div><div style={{fontSize:12,color:'#94a3b8',marginTop:6}}>선택하면 전화 안전확인 권장 주기가 자동 적용됩니다 (일반 주 2회 · 중점 주 1회, 아래에서 수정 가능). 미지정은 기존 주기 그대로.</div></div>}<div className="form-field full-width"><label className="form-label">전화 주기</label><div className="radio-group">{[{value:'daily',label:'매일'},{value:'custom',label:'요일 지정'}].map(opt=><label key={opt.value} className={`radio-option ${form.callCycle===opt.value?'radio-selected':''}`}><input type="radio" name="callCycle" value={opt.value} checked={form.callCycle===opt.value} onChange={e=>setForm(f=>({...f,callCycle:e.target.value}))} style={{display:'none'}}/>{opt.label}</label>)}</div>{form.callCycle==='custom'&&<div style={{marginTop:10}}><div style={{fontSize:13,color:'#64748b',marginBottom:6}}>요일 선택 (여러 개 가능)</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{['월','화','수','목','금','토','일'].map(d=>{const sel=(form.callDays||[]).includes(d);return <button type="button" key={d} onClick={()=>setForm(f=>{const days=f.callDays||[];return{...f,callDays:sel?days.filter(x=>x!==d):[...days,d]};})} style={{padding:'8px 16px',borderRadius:8,border:sel?'2px solid #2563eb':'1px solid #d1d5db',background:sel?'#eff6ff':'#fff',color:sel?'#1d4ed8':'#374151',fontWeight:700,fontSize:15,cursor:'pointer'}}>{d}</button>;})}</div></div>}</div><div className="form-field full-width"><label className="form-label">전화 시간</label>{(()=>{const [hh,mm]=(form.callTime||'09:00').split(':').map(Number);const ampm=hh<12?'오전':'오후';const h12=(hh%12)||12;const set=(a,h,m)=>{let H=h%12;if(a==='오후')H+=12;setForm(f=>({...f,callTime:`${String(H).padStart(2,'0')}:${String(m).padStart(2,'0')}`}));};return(<div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginTop:4}}><select className="form-input" style={{width:100,fontSize:16,fontWeight:700}} value={ampm} onChange={e=>set(e.target.value,h12,mm)}><option value="오전">오전</option><option value="오후">오후</option></select><select className="form-input" style={{width:90,fontSize:16,fontWeight:700}} value={h12} onChange={e=>set(ampm,Number(e.target.value),mm)}>{Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h}>{h}시</option>)}</select><select className="form-input" style={{width:90,fontSize:16,fontWeight:700}} value={mm} onChange={e=>set(ampm,h12,Number(e.target.value))}>{[0,10,20,30,40,50].map(m=><option key={m} value={m}>{String(m).padStart(2,'0')}분</option>)}</select></div>);})()}</div></div><div className="summary-box"><div className="summary-title">📋 등록 정보 확인</div><div className="summary-grid">{[['이름',form.name],['나이',`${form.age}세`],['전화번호',form.phone],['지역',form.region],['담당 복지사',form.caregiver||'미배정'],['담당 지원사',(accounts.find(u=>u.email===form.assignedTo)||{}).name||form.assignedTo||'미배정'],['보호자',form.guardian],['보호자 연락처',form.guardianPhone],['전화 주기',cycleLabel(form.callCycle, form.callDays)],['전화 시간',form.callTime]].map(([label,value])=><div key={label} className="summary-row"><span className="summary-label">{label}</span><span className="summary-value">{value}</span></div>)}</div></div><div className="form-footer"><button className="btn-secondary btn-lg" onClick={()=>setFormStep(2)}>← 이전</button><button className="btn-success btn-lg" onClick={saveElder}>{editMode?'✅ 수정 완료':'✅ 등록 완료'}</button></div></div>)}
              </div>
            </div>
          )}

          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
