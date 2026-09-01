import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { auth, authEnabled } from '../firebase';
import { onAuthStateChanged, signOut, sendEmailVerification } from 'firebase/auth';
import HelpGuide, { LATEST_NOTICE } from '../components/help/HelpGuide';
import AuthScreen from '../components/auth/AuthScreen';
import { ElderListSchema, MeSchema, BillingBalanceSchema, TopupResponseSchema, PaymentStatusSchema, SubscribeRegisterResponseSchema, SubscriptionStatusSchema, AlertListSchema, CallListSchema, ForestFireMapSchema, SpecialWarningMapSchema, DisasterMsgResponseSchema, parseOr } from '../schemas';
import { CallTranscript, GroupHeader, PageErrorBoundary } from '../components/common';
import { Button, Dialog, EmptyState, PageIntro, StatusBadge, Toolbar } from '../components/ui';
import { SERVER_URL, authFetch, errMsg } from '../utils/api';
import { localDayKey } from '../utils/date';
import { CAREGIVERS, STATUS_CONFIG, RISK_CONFIG, PAGES } from '../constants/app';
import { useCountdown } from '../hooks/useCountdown';
import { LayoutGrid, Activity, Users, ShieldCheck, Phone, CalendarDays, MessageSquare,
         PencilLine, FileText, BarChart3, Database, Building2, BookOpen, RotateCw,
         AlertCircle, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, Plus,
         UserRound, UserRoundCheck, X, Search, Copy, LogOut, ChevronDown, List,
         Sun, Snowflake, CloudRain, CloudSun, Wind, Flame, CircleCheck, Clock, Terminal } from 'lucide-react';

// REACT_APP_SERVER_URL(.env.local)로 로컬 서버 테스트 가능 — 미설정 시 운영 서버
const EMPTY_FORM = { name:'', age:'', gender:'female', title:'할머니', region:'', address:'', addressDetail:'', phone:'', jumin:'', caregiver:'', caregiverPhone:'', assignedTo:'', guardian:'', guardianPhone:'', disease:'', medicine:'', mobility:'독립보행 가능', careGroup:'', callCycle:'daily', callDays:[], callTime:'09:00', callActive:true };
// 지역명 정규화 — 주소검색(Daum Postcode)으로 등록하면 "대구 북구"처럼 시·도가 축약형으로
// 통일되는데, CSV 일괄등록은 셀 값을 그대로 저장해 "대구광역시 북구"처럼 다른 표기가 섞였다.
// 그 결과 경보 대상 화면의 지역 필터·자동선택이 같은 구를 서로 다른 그룹으로 갈라 보여주는
// 사고가 있었다(실사용 지적). 시·도 전체 이름은 축약형으로, 그 외(로마자 지명 등 오기입)는
// 그대로 통과시킨다 — 자동 번역/추정은 하지 않는다.
const SIDO_FULL_TO_SHORT = {'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','강원도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
const normalizeRegion = (region) => {
  const s = String(region||'').trim().replace(/\s+/g,' ');
  if (!s) return s;
  const tokens = s.split(' ');
  return [SIDO_FULL_TO_SHORT[tokens[0]] || tokens[0], ...tokens.slice(1)].join(' ');
};
// 콘솔 통화 이력은 최대 500건까지 한 번에 내려오므로 테이블 페이지네이션 기준 페이지당 건수
const HISTORY_PAGE_SIZE = 25;
// 포트원 Bank 코드 → 한글 은행명(주요 시중은행만, 나머지는 코드 그대로 표시)
const BANK_LABELS = {
  KOOKMIN:'국민은행', SHINHAN:'신한은행', WOORI:'우리은행', HANA:'하나은행', IBK:'기업은행',
  NONGHYUP:'NH농협은행', LOCAL_NONGHYUP:'지역농축협', STANDARD_CHARTERED:'SC제일은행', CITI:'한국씨티은행',
  DAEGU:'아이엠뱅크(대구)', BUSAN:'부산은행', KWANGJU:'광주은행', JEJU:'제주은행', JEONBUK:'전북은행',
  KYONGNAM:'경남은행', KFCC:'새마을금고', SHINHYUP:'신협', SAVINGS_BANK:'저축은행', POST:'우체국',
  K_BANK:'케이뱅크', KAKAO:'카카오뱅크', TOSS:'토스뱅크', SUHYUP:'수협은행',
};
// AI영실이 요금 정책 통합본 v1.0(전략기획실, 2026-08-28) §5 정액제 — 앱 설치 방식 4등급.
// 정량제(선불 충전식 크레딧, 지금 쓰고 있는 방식)가 주력 트랙이지만, 예산을 고정해야 하는
// 기관을 위한 보조 트랙으로 별도 안내한다. 실제 결제(포트원) 연동 전까지는 "신청 접수"만
// 하고 담당자가 후속 안내하는 방식(1단계) — 여기서 자동으로 플랜이 바뀌지는 않는다.
const UPGRADE_PLANS = [
  { key:'trial',    name:'시범사업', price:'무료',      unit:'30일',    features:['관리자 대시보드','전화 발신 관리','3단계 위험 감지','119·보호자 자동연결','통화 기록'] },
  { key:'basic',     name:'베이직',   price:'11,000원', unit:'인·월',   features:['시범사업 전체 포함','건강 상태 추적','전화멘트 관리'] },
  { key:'standard',  name:'스탠다드', price:'13,000원', unit:'인·월',   features:['베이직 전체 포함','리포트 / 통계','공공데이터 연동(산불·폭염·재난)'], recommended:true },
  { key:'premium',   name:'프리미엄', price:'19,000원', unit:'인·월',   features:['스탠다드 전체 포함','방문 필요·현장출동 연계','IoT 연동'] },
];
// 같은 문서 §3 "충전 단위별 도달 통화 수(3분 무선 기준)" — 정량제(선불 충전식, 지금 쓰는 방식) 충전 단위.
// 정액제와 달리 매월 고정 요금이 아니라 발신한 만큼만 차감되므로 "플랜"이 아니라 "충전 금액"을 고른다.
const CHARGE_TIERS = [
  { key:'c30',  amount:300000,  calls:'약 350통',   usage:'주 1회 50명 1.6개월 · 특보 발신 300명 1회' },
  { key:'c50',  amount:500000,  calls:'약 585통',   usage:'주 1회 50명 2.7개월 · 특보 발신 300명 2회', recommended:true },
  { key:'c100', amount:1000000, calls:'약 1,170통', usage:'주 1회 100명 2.7개월 · 특보 발신 300명 4회' },
];
// 주민등록번호 앞 6자리 → 생년월일 (7번째 자리로 세기 판정: 1·2=1900년대, 3·4=2000년대)
const juminToBirth = (jumin) => {
  const d = String(jumin||'').replace(/[^0-9]/g,'');
  if (d.length < 7) return '';
  const century = ['1','2','5','6'].includes(d[6]) ? '19' : '20';
  return `${century}${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4,6)}`;
};

// 노인맞춤돌봄서비스 돌봄군 — 전화 안전확인 권장 주기(제도 기준): 일반돌봄군 주 2회, 중점돌봄군 주 1회(방문이 주 2회라 전화는 1회)
const CARE_GROUPS = {
  general:   { label: '일반돌봄군', weeklyCalls: 2, days: ['월','목'], color: '#246BEB' },
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
  heatwave: `{{기관명}}에서 전해드려요. 오늘 {{지역}}에 폭염경보가 발령되었어요. 한낮에는 밖에 나가지 마시고 시원한 곳에서 쉬세요. 목이 마르지 않아도 물을 자주 드시고, 선풍기나 에어컨을 켜 두세요. 어지럽거나 기운이 없으시면 바로 시원한 곳에 누워 쉬시고, {{보호자}}나 저희에게 꼭 알려주세요. 몸이 불편하시면 언제든 말씀해 주세요.`,
  cold:     `{{기관명}}에서 전해드려요. 오늘 {{지역}}에 한파경보가 발령되었어요. 오늘은 되도록 밖에 나가지 마시고 따뜻한 실내에 계세요. 꼭 나가셔야 하면 모자와 장갑, 두꺼운 옷을 챙겨 입으세요. 보일러는 아끼지 마시고 따뜻하게 켜 두시고, 수도가 얼지 않게 물을 조금 틀어 두시면 좋아요. 미끄러운 길 조심하시고, 몸이 안 좋으시면 {{보호자}}나 저희에게 바로 알려주세요.`,
  dust:     `{{기관명}}에서 전해드려요. 오늘 {{지역}} 미세먼지가 매우 나쁨이에요. 오늘은 되도록 밖에 나가지 마시고, 창문도 닫아 두세요. 꼭 나가셔야 하면 마스크를 꼭 쓰시고, 다녀오신 뒤에는 손과 얼굴을 씻으세요. 물을 자주 드시면 목이 덜 칼칼해요. 숨이 차거나 기침이 심해지면 {{보호자}}나 저희에게 꼭 알려주세요.`,
  rain:     `{{기관명}}에서 전해드려요. 오늘 {{지역}}에 호우주의보가 내렸어요. 비가 많이 오니 오늘은 되도록 외출하지 마세요. 꼭 나가셔야 하면 우산을 챙기시고, 미끄러운 길과 물이 고인 곳을 조심하세요. 집 안에 물이 새거나 잠기면 무리해서 치우지 마시고 {{보호자}}나 저희에게 바로 알려주세요. 천둥 번개가 칠 때는 전기 제품을 잠시 꺼 두시는 게 안전해요.`,
  typhoon:  `{{기관명}}에서 전해드려요. 지금 {{지역}}이 태풍 영향권에 들었어요. 오늘은 절대 밖에 나가지 마시고 안전한 실내에 계세요. 창문은 꼭 닫아 잠그시고, 창문에서 떨어진 곳에 계세요. 정전이 될 수 있으니 손전등과 휴대폰을 가까이 두시고, 휴대폰은 미리 충전해 두세요. 무섭거나 걱정되는 일이 있으면 {{보호자}}나 저희에게 언제든 연락하세요. 위급할 때는 119예요.`,
  wildfire: `{{기관명}}에서 전해드려요. 오늘 {{지역}} 인근에 산불이 발생했어요. 창문을 닫아 연기가 들어오지 않게 하시고, 마을 안내 방송에 귀 기울여 주세요. 대피 안내가 있으면 신발과 겉옷, 휴대폰만 챙겨 바로 따라 나서세요. 혼자 움직이기 힘드시면 {{보호자}}나 저희에게 바로 연락 주시고, 위급하면 119에 전화하세요. 놀라지 마시고, 안내대로 하시면 안전해요.`,
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

/**
 * 안부 통화 기본 질문 (전역).
 *
 * 서버 settings/questions 에 저장된 값이 있으면 그쪽이 우선한다. 저장 전에는 이 값이 쓰이며,
 * 통화 엔진(ClawOps 브릿지 prompt.mjs)의 DEFAULT_QUESTIONS 와 **문구가 같아야** 화면과 실제
 * 통화가 어긋나지 않는다. 한쪽만 고치지 말 것.
 *
 * everyday=false 는 격일 질문(약·물) — 통화가 길어지지 않게 이틀에 한 번만 여쭙는다.
 */
const DEFAULT_QUESTIONS = [
  { key:'greeting', label:'인사·건강', text:'{호칭}, 안녕하세요. 저 영실이에요. 오늘 몸은 좀 어떠세요? 어디 불편한 데는 없으세요?', everyday:true,  enabled:true, color:'#dc2626' },
  { key:'medicine', label:'약',        text:'약은 잘 챙겨 드셨어요?',                                                          everyday:false, enabled:true, color:'#7c3aed' },
  { key:'meal',     label:'식사',      text:'오늘 식사는 잘 하셨어요?',                                                        everyday:true,  enabled:true, color:'#16a34a' },
  { key:'water',    label:'물',        text:'물도 자주 드시고 계세요?',                                                        everyday:false, enabled:true, color:'#0891b2' },
  { key:'emotion',  label:'정서',      text:'요즘 외롭거나 힘든 일은 없으세요?',                                               everyday:true,  enabled:true, color:'#246BEB' },
  { key:'living',   label:'생활',      text:'요즘 장보기나 집안일 하시는 데 불편한 점은 없으세요?',                            everyday:true,  enabled:true, color:'#16a34a' },
  { key:'closing',  label:'마무리',    text:'오늘도 이렇게 얘기 나눠서 좋았어요. 건강 잘 챙기시고, 또 연락드릴게요.',          everyday:true,  enabled:true, color:'#64748b' },
];
// 경보 멘트 변수 치환 (실제 발송·미리보기 공통). 값이 없으면 자연스럽게 생략.
// {{이름}}은 UI에서 제거했으나, 과거 저장분 호환을 위해 치환은 유지(있으면 '어르신'으로).
// fireLoc(산불 발생 위치)이 있으면 {{지역}}은 발생 위치로 치환 — 산불 위치는 어르신 거주지와 다른 개념
// (예: 달서구 거주 어르신에게 "봉화군 도개면 야산 산불" 안내). 없으면 기존대로 어르신 지역.
function fillAlertVars(text, elder, shelter, fireLoc, orgName) {
  return String(text || '')
    .replace(/\{\{이름\}\}/g, (elder && elder.name) || '어르신')
    .replace(/\{\{호칭\}\}/g, (elder && elder.title) || '어르신')
    .replace(/\{\{지역\}\}/g, (fireLoc || (elder && elder.region) || ''))
    .replace(/\{\{보호자\}\}/g, (elder && elder.guardian) ? `${elder.guardian}님` : '보호자님')
    .replace(/\{\{대피소\}\}/g, (shelter || '가까운 대피소'))
    // 기관명: 로그인한 계정의 소속 기관(/me 의 orgName).
    // 비었을 때 그냥 지우면 "{{기관명}}에서 알려드려요" → "에서 알려드려요" 처럼 조사가 붕 뜬다.
    // 어느 위치에 넣어도 말이 되도록 중립 표현으로 대체한다.
    .replace(/\{\{기관명\}\}/g, orgName || '저희 기관')
    .replace(/\{\{([^{}]*)\}\}/g, '$1')   // 미등록 변수({{봉화군 …}} 등 오기입)는 괄호 벗겨 내용만 발화
    .replace(/\s{2,}/g, ' ').trim();
}

// 사이드바 아이콘 — Lucide 단일 세트 (P1-3: 이모지·자체 SVG 제거, stroke 1.75)
const NAV_LUCIDE = {
  dashboard: LayoutGrid, health: Activity, elders: Users, safety: ShieldCheck,
  calls: Phone, report: BarChart3, schedule: CalendarDays, script: MessageSquare,
  casenotes: PencilLine, forms: FileText, data: Database, admin: Building2, help: BookOpen,
  console: Terminal,
};
const NavIcon = ({ name }) => {
  const I = NAV_LUCIDE[name] || LayoutGrid;
  return <I size={18} strokeWidth={1.75} aria-hidden="true" />;
};

// 새로고침 아이콘 (헤더)
const RefreshIcon = () => <RotateCw size={13} strokeWidth={2} aria-hidden="true" />;
const RESTORABLE_PAGES = [...PAGES, 'detail'];
// 엑셀 기능은 실제 다운로드 시점에만 로드한다. 초기 화면에서 약 300KB 라이브러리를 메모리에 올리지 않는다.
const loadXLSX = () => import('xlsx');
// 백그라운드 탭에서는 화면 갱신용 폴링을 멈춰 네트워크·메모리 churn을 줄인다.
const whileVisible = (fn) => () => { if (!document.hidden) fn(); };

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
  const [billing, setBilling]     = useState(null);   // {creditBalance: number|null} — null(미조회) 이면 차단 화면 안 띄움
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); // 요금제 정책 v1.0(2026-08-28) §5 기준 정액제 안내
  const [upgradeTab, setUpgradeTab] = useState('metered'); // 'metered'(정량제, 주력) | 'flat'(정액제, 보조)
  const [topupBusy, setTopupBusy] = useState(false); // 포트원 결제 요청 처리 중(버튼 중복 클릭 방지)
  const [paymentSuccess, setPaymentSuccess] = useState(null); // 결제 접수 완료 모달 {amount, desc}(null이면 모달 숨김)
  const [subscribeBusy, setSubscribeBusy] = useState(null); // 결제 요청 처리 중인 planKey(중복 클릭 방지)
  const [subStatus, setSubStatus] = useState(null); // GET /billing/subscription — {plan, autoRenew, nextChargeAt, lastChargeError, elderCount, monthlyAmount}
  const [subCancelBusy, setSubCancelBusy] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [topupPayMethod, setTopupPayMethod] = useState('EASY_PAY'); // 'EASY_PAY'(카카오페이) | 'CARD'(이니시스) | 'VIRTUAL_ACCOUNT'(무통장입금)
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
  // 선불 충전식 크레딧 잔액(1단계) — superadmin은 소속 기관이 없어(orgId='*') 조회 대상이 아니다.
  // /billing/balance는 @BillingExempt라 잔액 0이어도 조회는 항상 성공한다(막힌 이유를 보여줘야 하므로).
  const fetchBillingBalance = async () => {
    try {
      const r = await authFetch(`${SERVER_URL}/billing/balance`);
      if (r.ok) setBilling(parseOr(BillingBalanceSchema, await r.json(), null));
    } catch {}
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
  useEffect(() => { setBilling(null); setSubStatus(null); fetchElders(); fetchCaregivers(); fetchCalls(); fetchMe(); if (authUser) { fetchWeather(); fetchForestFire(); fetchSpecialWarning(); fetchBillingBalance(); } }, [authUser]); // eslint-disable-line
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
    if (score >= 50) return { level: 'high',   label: '고위험', color: '#ef4444', bg: '#fef2f2' };
    if (score >= 25) return { level: 'medium', label: '주의',   color: '#f59e0b', bg: '#fffbeb' };
    return               { level: 'low',    label: '안전',   color: '#22c55e', bg: '#f0fdf4' };
  };

  // R4 지역 라벨 하드코딩 금지 — 등록된 어르신 지역 + 기관 관할 지역에서 동적 생성
  const REGIONS = ['전체', ...[...new Set([...elders.map(e => (e.region || '').trim()), (me?.orgRegion || '').trim()])].filter(Boolean).sort()];
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
  if (me && me.role !== 'superadmin' && billing && typeof billing.creditBalance === 'number' && billing.creditBalance <= 0) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',padding:20}}>
        <div style={{maxWidth:420,background:'#fff',borderRadius:16,padding:'40px 32px',textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:40,marginBottom:12}}>💳</div>
          <h2 style={{margin:'0 0 8px',fontSize:20,fontWeight:800,color:'#0f172a'}}>충전 잔액이 없습니다</h2>
          <p style={{color:'#64748b',fontSize:15,lineHeight:1.6,margin:'0 0 24px'}}>
            {me.orgName || '소속 기관'}의 이용 크레딧이 모두 소진되어 서비스 이용이 일시 중단되었습니다.<br/>
            담당자에게 문의해 충전 후 이용해 주세요.
          </p>
          <div style={{background:'#f1f5f9',borderRadius:10,padding:'12px 16px',fontSize:14,color:'#334155',marginBottom:20}}>
            현재 잔액: <b>{billing.creditBalance.toLocaleString()}원</b>
          </div>
          <button className="btn-secondary" onClick={()=>{fetchBillingBalance();}}>새로고침</button>
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
              {[['metered','정량제'],['flat','정액제']].map(([k,label])=>(
                <button key={k} onClick={()=>setUpgradeTab(k)} style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(upgradeTab===k?'#246BEB':'#e2e8f0'),background:upgradeTab===k?'#eff6ff':'#fff',color:upgradeTab===k?'#246BEB':'#64748b',fontWeight:700,fontSize:14,cursor:'pointer'}}>{label}</button>
              ))}
            </div>

            {upgradeTab==='metered' ? (<>
              <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
                발신 시도마다 <b>발신 기본료 40원</b> + 실제 연결된 통화에만 <b>통화 요금</b>이 충전액에서 차감됩니다.
                발신이 없는 달은 차감도 청구도 없습니다(VAT 별도). 아래는 대표적인 충전 단위입니다 — 원하는 금액을 직접 입력해도 됩니다.
              </p>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <span style={{fontSize:13,fontWeight:700,color:'#475467'}}>결제 수단</span>
                <div style={{display:'flex',gap:6}}>
                  {[['EASY_PAY','카카오페이'],['CARD','카드'],['TRANSFER','실시간 계좌이체'],['VIRTUAL_ACCOUNT','무통장입금']].map(([k,label])=>(
                    <button key={k} onClick={()=>setTopupPayMethod(k)}
                      style={{padding:'7px 14px',borderRadius:9,border:'1px solid '+(topupPayMethod===k?'#246BEB':'#e2e8f0'),background:topupPayMethod===k?'#eff6ff':'#fff',color:topupPayMethod===k?'#246BEB':'#64748b',fontWeight:700,fontSize:13,cursor:'pointer'}}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:14}}>
                {CHARGE_TIERS.map(c=>(
                  <div key={c.key} style={{border:c.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{fontWeight:900,fontSize:22,color:'#0f172a'}}>{c.amount.toLocaleString()}원</div>
                    <div style={{fontSize:14,fontWeight:700,color:'#246BEB'}}>{c.calls} 도달(3분 통화 기준)</div>
                    <div style={{fontSize:13,color:'#475467',lineHeight:1.5,flex:1}}>{c.usage}</div>
                    <button
                      className="btn-primary"
                      style={{width:'100%'}}
                      disabled={topupBusy}
                      onClick={()=>startTopup(c.amount)}
                    >{topupBusy?'처리 중...':'신청'}</button>
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
                  disabled={topupBusy || !customAmount || Number(customAmount) < 10000}
                  onClick={()=>startTopup(Number(customAmount))}
                >{topupBusy?'처리 중...':'직접 충전'}</button>
              </div>
              <p style={{color:'#94a3b8',fontSize:12,margin:'18px 0 0'}}>정확한 채널 배정·이용 패턴별 견적은 담당 매니저에게 문의해 주세요.</p>
            </>) : (<>
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
                      // startSubscription() 실결제 흐름을 다시 켠다(trial만 예외).
                      <button
                        className="btn-primary"
                        style={{width:'100%'}}
                        disabled={subscribeBusy === p.key}
                        onClick={()=> p.key === 'trial'
                          ? (()=>{ setShowUpgradeModal(false); notify(`"${p.name}" 플랜 신청이 접수됐습니다. 담당자가 확인 후 연락드립니다.`, 'success'); })()
                          : startSubscription(p.key, p.name)
                        }
                      >{subscribeBusy === p.key ? '처리 중...' : '신청'}</button>
                    )}
                  </div>
                  );
                })}
              </div>
              <p style={{color:'#94a3b8',fontSize:12,margin:'18px 0 0'}}>정액제 세부 조건은 담당 매니저에게 문의해 주세요.</p>
            </>)}
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
            <div className="sidebar-org-code sidebar-credit-balance" style={{cursor:'default'}} title="선불 충전식 크레딧 잔액">
              <span className="sidebar-org-label">크레딧 잔액</span>
              <span className="sidebar-org-value" style={{color: billing.creditBalance <= 200 ? '#dc2626' : undefined}}>
                {billing.creditBalance.toLocaleString()}
              </span>
            </div>
          )}
          {billing && typeof billing.creditBalance === 'number' && (
            // 1단계(포트원 연동 전) — 실제 결제창은 없고, 요금 정책(정액제 4등급) 안내 후
            // "신청"을 담당자 확인 대상으로만 접수한다. 2단계에서 실제 결제창(PortOne.js)으로 교체.
            <button
              className="sidebar-org-code sidebar-credit-charge"
              style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', fontWeight:700, color:'#246BEB'}}
              onClick={()=>{ setShowUpgradeModal(true); fetchSubscriptionStatus(); }}
            >업그레이드</button>
          )}
          {authEnabled&&authUser&&<button className="sidebar-logout" onClick={doLogout}><LogOut size={15}/> 로그아웃</button>}
        </div>
      </aside>

      <main className="main" id="main-content">
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
                    {elders.sort((a,b)=>{const order={danger:0,warning:1,normal:2};return order[a.status]-order[b.status];}).map(elder=>{
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
          )}

          {page==='safety' && (
            <div className="fade-in safety-page">
              <PageIntro
                title="안전확인 관리"
                description="노인맞춤돌봄서비스 전화 안전확인 기준 · 일반돌봄군 주 2회 · 중점돌봄군 주 1회(방문 주 2회) · 15초마다 자동 갱신됩니다"
                actions={<Button onClick={refreshPage}>갱신</Button>}
              />
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
                    <div className="report-stat-card"><div className="report-stat-dot" style={{background:'#16a34a'}}/><div className="report-stat-value" style={{color:'#16a34a'}}>{st.checkedCount}명</div><div className="report-stat-label">오늘 안전확인 완료</div></div>
                    <div className="report-stat-card"><div className="report-stat-dot" style={{background:'#dc2626'}}/><div className="report-stat-value" style={{color:st.unchecked.length?'#dc2626':'#16a34a'}}>{st.unchecked.length}명</div><div className="report-stat-label">오늘 미확인 (부재중·실패)</div></div>
                    <div className="report-stat-card"><div className="report-stat-dot" style={{background:'#64748b'}}/><div className="report-stat-value" style={{color:'#64748b'}}>{st.undialed}명</div><div className="report-stat-label">오늘 미발신</div></div>
                    <div className="report-stat-card"><div className="report-stat-dot" style={{background:'#246BEB'}}/><div className="report-stat-value" style={{color:rate>=80?'#16a34a':rate>=50?'#f59e0b':'#dc2626'}}>{rate}%</div><div className="report-stat-label">이번 주 주기 준수율</div></div>
                  </div>

                  {st.unchecked.length > 0 && (
                    <div className="section" style={{borderLeft:'4px solid #dc2626'}}>
                      <div className="section-title">오늘 미확인 어르신 — 우선 대응</div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {st.unchecked.map(({ e, d }) => (
                          <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,background:d.status==='missed'?'#fff7ed':'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 14px',flexWrap:'wrap'}}>
                            <div style={{minWidth:90,fontWeight:800,color:'#246BEB',cursor:'pointer'}} title="클릭 → 돌봄군·주기 설정" onClick={()=>openEditSchedule(e)}>{e.name}</div>
                            <div style={{minWidth:80,fontSize:16,color:'#64748b'}}>{e.region}</div>
                            <div style={{flex:1,fontSize:16,fontWeight:700,color:d.status==='missed'?'#ea580c':'#dc2626'}}>
                              {d.status==='missed' ? `부재중 — 자동 재발신 ${d.retryCount||0}회에도 무응답` : `발신 실패${d.reason?` (${d.reason})`:''}`}
                            </div>
                            <button className="btn-call" style={{fontSize:15,padding:'5px 12px'}} disabled={calling===e.id} onClick={()=>makeCall(e)}>{calling===e.id?'발신 중…':'재발신'}</button>
                          </div>
                        ))}
                        <div style={{fontSize:15,color:'#dc2626',fontWeight:600}}>재발신에도 무응답이면 직접 전화 또는 방문 확인 후, 상담·방문 일지에 기록해 주세요.</div>
                      </div>
                    </div>
                  )}

                  <div className="section">
                    <div className="section-title">이번 주 주기 준수 현황 <span style={{fontSize:15,fontWeight:600,color:'#94a3b8'}}>(월요일~오늘 · 통화 성공한 날 수 기준 · 돌봄군: 일반 {nGen}명 · 중점 {nInt}명)</span></div>
                    <div style={{overflowX:'auto'}}>
                      <table className="table" style={{width:'100%'}}>
                        <thead><tr><th>어르신</th><th>돌봄군</th><th>주간 목표</th><th>이번 주 통화</th><th>상태</th><th></th></tr></thead>
                        <tbody>
                          {sorted.map(({ e, g, target, done, met }) => (
                            <tr key={e.id} style={met?{}:{background:'#fffbeb'}}>
                              <td style={{fontWeight:700,color:'#246BEB',cursor:'pointer'}} title="클릭 → 돌봄군·주기 설정" onClick={()=>openEditSchedule(e)}>{e.name} <span style={{fontSize:15,color:'#94a3b8',fontWeight:400}}>{e.region}</span></td>
                              <td>{g ? <span style={{fontSize:15,fontWeight:800,color:g.color,background:`${g.color}15`,padding:'2px 8px',borderRadius:6}}>{g.label}</span> : <span style={{fontSize:15,color:'#94a3b8'}}>미지정</span>}</td>
                              <td>{target}회</td>
                              <td style={{fontWeight:800,color:met?'#16a34a':'#f59e0b'}}>{done}회</td>
                              <td>{met ? <span style={{color:'#16a34a',fontWeight:700}}>달성</span> : <span style={{color:'#f59e0b',fontWeight:700}}>진행 중 ({done}/{target})</span>}</td>
                              <td>{!met && <button className="btn-secondary" style={{fontSize:15,padding:'3px 10px'}} disabled={calling===e.id} onClick={()=>makeCall(e)}>발신</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {nNone > 0 && <div style={{fontSize:15,color:'#94a3b8',marginTop:8}}>· 돌봄군 미지정 어르신 {nNone}명은 설정된 전화 주기를 목표로 계산합니다. 위 표에서 어르신 이름을 클릭하면 바로 돌봄군·주기를 설정할 수 있습니다 (제도 기준: 일반 주2회·중점 주1회).</div>}
                  </div>
                </>);
              })()}
            </div>
          )}

          {page==='schedule' && (
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
          )}

          {page==='elders' && (
            <div className="fade-in elders-page">
              {me?.orgCode && (
                <div className="infobar">
                  <div className="infobar-text">
                    <div className="infobar-title">앱으로 {T.elder} 등록하기</div>
                    <div className="infobar-desc">{T.elder} 폰의 <b>영실이 앱 설정</b>에 아래 <b>기관코드</b>를 입력해 정보를 등록하면 <b>승인 대기</b>에 표시됩니다.</div>
                  </div>
                  <button className="orgcode-chip" onClick={copyOrgCode} title="클릭하면 복사">
                    <span className="orgcode-value">{me.orgCode}</span>
                    <span className="orgcode-action">{orgCopied?'복사됨':'복사'}</span>
                  </button>
                </div>
              )}
              <div className="elders-controls">
                <Toolbar className="elder-toolbar" label={`${T.elder} 검색과 상태 필터`}>
                  <div className="search-box elder-search"><Search size={19} aria-hidden="true"/><input className="search-input" placeholder={`${T.elder} 이름으로 검색`} value={searchName} onChange={e => setSearchName(e.target.value)}/>{searchName && <button className="search-clear" onClick={() => setSearchName('')} aria-label="검색어 지우기"><X size={16}/></button>}</div>
                  <select className="form-input region-select" aria-label="지역 선택" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>{REGIONS.map(r => <option key={r} value={r}>{r==='전체'?'전체 지역':r}</option>)}</select>
                  <div className="filter-bar" aria-label="상태 필터">{['all','danger','warning','normal'].map(f=>(<button key={f} className={`filter-btn ${filter===f?'filter-active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'전체':STATUS_CONFIG[f].label}<span className="filter-count">{f==='all'?elders.length:elders.filter(e=>e.status===f).length}</span></button>))}</div>
                </Toolbar>
                <Toolbar className="elder-toolbar2" label={`${T.elder} 정렬과 보기 설정`}>
                  <div className="elder-sort-row">
                  <span className="elder-control-label">정렬</span>
                  {[{id:'status',label:'위험도순'},{id:'risk',label:'고독사위험'},{id:'noResponse',label:'미응답순'},{id:'age',label:'나이순'},{id:'name',label:'이름순'}].map(s=>(<button key={s.id} className={`sort-btn ${sortBy===s.id?'sort-active':''}`} onClick={()=>setSortBy(s.id)}>{s.label}</button>))}
                </div>
                <div className="elder-actions-row">
                  <div className="view-toggle" role="group" aria-label="보기 방식">
                    <button className={`view-btn ${viewMode==='card'?'view-active':''}`} onClick={()=>setViewMode('card')} aria-pressed={viewMode==='card'}>
                      <LayoutGrid size={16}/>
                      카드
                    </button>
                    <button className={`view-btn ${viewMode==='table'?'view-active':''}`} onClick={()=>setViewMode('table')} aria-pressed={viewMode==='table'}>
                      <List size={16}/>
                      목록
                    </button>
                  </div>
                  <button className="btn-secondary" onClick={downloadCsvTemplate} title="엑셀에 채워 넣을 CSV 양식 다운로드">CSV 양식</button>
                  <button className="btn-secondary" onClick={()=>csvInputRef.current&&csvInputRef.current.click()} title="CSV 파일로 어르신 일괄 등록">CSV 일괄 등록</button>
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={e=>{const f=e.target.files&&e.target.files[0]; handleCsvFile(f); e.target.value='';}}/>
                  <button className="btn-primary elder-register-btn" onClick={openRegister}><Plus size={17}/> 신규 등록</button>
                </div>
                </Toolbar>
              </div>
              <div className="search-result-count">총 <strong>{filteredElders.length}명</strong>{searchName && <span> · "{searchName}" 검색결과</span>}{regionFilter !== '전체' && <span> · {regionFilter}</span>}</div>

              {pendingElders.length > 0 && (
                <div className="section pending-section">
                  <div className="section-title">
                    승인 대기 <span className="pending-badge">{pendingElders.length}</span>
                    <span className="section-sub">앱에서 등록 신청한 {T.elder}입니다. 승인하면 자동 전화 대상에 포함됩니다.</span>
                  </div>
                  {pendingElders.map(e => (
                    <div key={e.phone} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:'1px solid #fde68a',borderRadius:10,marginBottom:8}}>
                      <div className="table-avatar">{(e.name||'?')[0]}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700}}>{e.name} <span style={{fontSize:15,color:'#94a3b8'}}>{e.age?`${e.age}세 · `:''}{e.region||''}</span></div>
                        <div style={{fontSize:16,color:'#64748b'}}>{e.phone}{e.caregiver?` · 담당 ${e.caregiver}`:''}{e.guardianName?` · 보호자 ${e.guardianName}`:''}</div>
                      </div>
                      <button className="btn-primary" onClick={()=>approveElder(e.phone)}>승인·활성화</button>
                    </div>
                  ))}
                </div>
              )}

              {filteredElders.length > 0 && (
                <label className="select-all">
                  <input type="checkbox" checked={filteredElders.every(e=>selectedElders.has(e.id))} onChange={()=>toggleAllElders(filteredElders)}/>
                  <span>전체 선택</span>
                </label>
              )}
              {/* 일괄 작업 바 — 선택했을 때만 나타난다(평상시 위험 버튼 노출 금지, B2B 표준) */}
              {selectedElders.size > 0 && (
                <div className="bulkbar" role="region" aria-label="선택 항목 일괄 작업">
                  <span className="bulkbar-count">{selectedElders.size}명 선택됨</span>
                  <div className="bulkbar-actions">
                    <button className="btn-secondary btn-xs" onClick={()=>setSelectedElders(new Set())}>선택 해제</button>
                    {bulkRunning && bulkChannel==='pstn'
                      ? <button className="btn-secondary btn-xs" onClick={stopBulkCall}>발신 중단 ({bulkDone.length}/{bulkQueue.length})</button>
                      : <button className="btn-secondary btn-xs" disabled={bulkRunning} onClick={()=>{
                          const queue = elders.filter(e=>selectedElders.has(e.id));
                          setBulkConfirm({ count: queue.length, queue, channel: 'pstn', isAlert: false, alertLabel: null });
                        }}>일반전화 동시발신</button>
                    }
                    <button className="btn-danger btn-xs" onClick={deleteSelectedElders}>선택 삭제</button>
                  </div>
                </div>
              )}

              {viewMode === 'card' && (()=>{
                // P2-9: 상태별 섹션 접기 — 위험·주의 기본 펼침, 정상은 접힘 + 컴팩트 리스트/카드 전환 토글
                if (filteredElders.length === 0) return <EldersEmpty/>;
                const renderCard = elder => {
                  const risk = getSolitudeRisk(elder);
                  const noResponseDays = getNoResponseDays(elder.lastCall, elder.lastCallAt);
                  return (
                    <div key={elder.id} className="elder-card" onClick={()=>openDetail(elder)} style={selectedElders.has(elder.id)?{outline:'2px solid #246BEB',outlineOffset:2}:undefined}>
                      <div className="elder-top"><div style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={selectedElders.has(elder.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleElderSel(elder.id)} style={{width:16,height:16,cursor:'pointer'}}/><div className="elder-avatar">{(elder.name||'?')[0]}</div></div><div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}><StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge><div className="risk-badge" style={{background:risk.bg,color:risk.color}}>{risk.label}</div></div></div>
                      <div className="elder-name">{elder.name}</div>
                      <div className="elder-info">{elder.age?`${elder.age}세 · `:''}{elder.title} · {elder.region}</div>
                      {elder.caregiver && <div className="elder-info" style={{color:'#246BEB',fontWeight:600}}>담당: {elder.caregiver}</div>}
                      {noResponseDays >= 1 && <div className={`no-response-tag ${noResponseDays >= 3 ? 'no-response-danger' : 'no-response-warning'}`}>{noResponseDays >= 99 ? '통화이력 없음' : `${noResponseDays}일째 미응답`}</div>}
                      <div className="elder-last">마지막 통화: {renderLastCall(elder)}</div>
                      {elder.keyword && <div className="keyword-tag mt8">"{elder.keyword}" 감지</div>}
                      {elder.visits > 0 && <div className="visit-tag mt8">방문 필요 {elder.visits}회</div>}
                      {!elder.callActive && <div className="paused-tag mt8">전화 중단 중</div>}
                    </div>
                  );
                };
                const renderCompactRow = elder => (
                  <div key={elder.id} onClick={()=>openDetail(elder)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'8px 14px',background:selectedElders.has(elder.id)?'#eff6ff':'#fff',border:'1px solid '+(selectedElders.has(elder.id)?'#93c5fd':'#e2e8f0'),borderRadius:10,marginBottom:6,cursor:'pointer',flexWrap:'wrap'}}>
                    <input type="checkbox" checked={selectedElders.has(elder.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleElderSel(elder.id)} style={{width:15,height:15,cursor:'pointer'}}/>
                    <span style={{fontWeight:700,fontSize:17,minWidth:96}}>{elder.name}{elder.age?` (${elder.age}세)`:''}</span>
                    <span style={{fontSize:16,color:'#64748b',minWidth:80}}>{elder.region}</span>
                    {elder.caregiver && <span style={{fontSize:16,color:'#64748b'}}>담당 {elder.caregiver}</span>}
                    <span style={{fontSize:15}}>{renderLastCall(elder)}</span>
                    <span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
                      {!elder.callActive && <span style={{fontSize:15,fontWeight:700,color:'#dc2626'}}>전화 중단</span>}
                      <StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge>
                      <span style={{color:'#94a3b8',fontSize:15,fontWeight:700}}>상세 ›</span>
                    </span>
                  </div>
                );
                return [['danger','위험'],['warning','주의'],['normal','정상']]
                  .map(([k,l])=>({k,l,list:filteredElders.filter(e=>e.status===k)}))
                  .filter(g=>g.list.length>0)
                  .map(g=>{
                    const open = elderSecOv[g.k] !== undefined ? elderSecOv[g.k] : g.k!=='normal';
                    return (
                      <div key={g.k} style={{marginBottom:14}}>
                        <GroupHeader label={g.l} count={g.list.length} unit="명"
                          chips={g.k==='normal'?[]:[{label:'미응답 3일↑',value:g.list.filter(e=>getNoResponseDays(e.lastCall,e.lastCallAt)>=3).length,color:'#dc2626'}]}
                          flag={g.k==='danger'&&!open?'위험 어르신 확인 필요':null}
                          open={open} onToggle={()=>setElderSecOv(p=>({...p,[g.k]:!open}))}/>
                        {open && g.k==='normal' && (
                          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
                            <button
                              onClick={()=>setNormalCardView(v=>!v)}
                              className="btn-secondary elder-view-icon-btn"
                              aria-label={normalCardView?'목록으로 보기':'카드로 보기'}
                              title={normalCardView?'목록으로 보기':'카드로 보기'}
                            >
                              {normalCardView ? <List size={20} aria-hidden="true"/> : <LayoutGrid size={20} aria-hidden="true"/>}
                            </button>
                          </div>
                        )}
                        {open && (g.k==='normal' && !normalCardView
                          ? <div>{g.list.map(renderCompactRow)}</div>
                          : <div className="elder-grid">{g.list.map(renderCard)}</div>)}
                      </div>
                    );
                  });
              })()}

              {viewMode === 'table' && (
                <table className="table">
                  <thead><tr><th style={{width:40}}><input type="checkbox" checked={filteredElders.length>0&&filteredElders.every(e=>selectedElders.has(e.id))} onChange={()=>toggleAllElders(filteredElders)} className="cb"/></th><th>어르신</th><th>성별/호칭</th><th>나이</th><th>지역</th><th>담당 복지사</th><th>마지막 통화</th><th>미응답</th><th>고독사 위험도</th><th>상태</th><th>키워드</th><th>즉시 전화</th></tr></thead>
                  <tbody>
                    {filteredElders.length === 0 && <tr><td colSpan={12}><EldersEmpty/></td></tr>}
                    {filteredElders.map(elder => {
                      const risk = getSolitudeRisk(elder);
                      const noResponseDays = getNoResponseDays(elder.lastCall, elder.lastCallAt);
                      return (
                        <tr key={elder.id} style={{cursor:'pointer',...(selectedElders.has(elder.id)?{background:'#eff6ff'}:{})}} onClick={()=>openDetail(elder)}>
                          <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedElders.has(elder.id)} onChange={()=>toggleElderSel(elder.id)} className="cb"/></td>
                          <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="table-avatar">{(elder.name||'?')[0]}</div><strong>{elder.name}</strong></div></td>
                          <td><span className="cycle-badge">{elder.title}</span></td>
                          <td>{elder.age?`${elder.age}세`:'—'}</td>
                          <td style={{fontSize:16,color:'#64748b'}}>{elder.region}</td>
                          <td style={{fontSize:16,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                          <td style={{fontSize:16,color:'#64748b'}}>{renderLastCall(elder)}</td>
                          <td>{noResponseDays===0?<span style={{color:'#22c55e',fontWeight:700}}>정상</span>:<span style={{color:noResponseDays>=3?'#ef4444':'#f59e0b',fontWeight:700}}>{noResponseDays>=99?'통화이력 없음':`${noResponseDays}일`}</span>}</td>
                          <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                          <td><StatusBadge tone={elder.status || 'normal'}>{(STATUS_CONFIG[elder.status]||STATUS_CONFIG.normal).label}</StatusBadge></td>
                          <td>{elder.keyword ? <span className="keyword-tag">"{elder.keyword}"</span> : <span style={{color:'#9ca3af',fontSize:15}}>없음</span>}</td>
                          <td onClick={e=>e.stopPropagation()}><button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'발신 중':'앱 전화'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {page==='script' && (
            <div className="fade-in script-page">
              <div className="weather-panel">
                <div className="weather-panel-header">
                  <div><div className="weather-panel-title">기상청 공공데이터 연동</div><div className="weather-panel-sub">5분 주기 자동 갱신 · 관할: {(() => { const sido = (me?.orgRegion || '').split(' ')[0]; const n = Object.keys(weatherData).length; return sido && n > 1 ? `${sido} 전역 ${n}개 지역` : (me?.orgRegion || `${T.elder} 등록 지역 기준`); })()} (기관 주소 자동 매핑){weatherTime && ` · 마지막 갱신 ${weatherTime}`} · 날씨 경보 발령 시 자동으로 멘트에 삽입됩니다{weatherStale && <span style={{marginLeft:8,background:'#fffbeb',border:'1px solid #fde68a',color:'#b45309',padding:'1px 8px',borderRadius:6,fontWeight:700}}>연동 지연 — 마지막 수신 데이터 표시 중</span>}</div></div>
                  <button className={`btn-fetch-weather ${fetchingWeather?'btn-calling':''}`} onClick={fetchWeather} disabled={fetchingWeather}>{fetchingWeather ? '불러오는 중...' : '날씨 데이터 갱신'}</button>
                </div>
                {(() => {
                  // 기관 주소 지역 → 어르신 거주지 지역 순으로 묶어서 보여준다.
                  // (기관 주소를 바꿔도 어르신 거주지 지역이 그대로 섞여 나와 헷갈린다는 문의 대응 — 2026-08-10)
                  const SRC_ORDER = { org: 0, both: 1, elder: 2 };
                  // 전화 멘트 관리는 복지관 주소 기준으로만 노출 — 등록된 어르신이 다른 시/도에 살아도
                  // (예: 대구 소속 어르신 1명 때문에 대구 전역이 같이 뜨던 문제) 이 화면엔 안 섞이게 필터.
                  // 어르신 지역 기반 정보는 다른 화면(대시보드 등)에서 그대로 사용되므로 원본 weatherData는 안 건드림.
                  const entries = Object.entries(weatherData as Record<string, any>)
                    .filter(([, w]: any) => w?.source === 'org' || w?.source === 'both')
                    .sort((a, b) => (SRC_ORDER[a[1]?.source] ?? 1) - (SRC_ORDER[b[1]?.source] ?? 1));
                  if (!entries.length) return <div className="weather-map-empty">표시할 관할 지역 날씨가 없습니다.</div>;
                  return (
                    <div className="weather-compact-grid">
                      {entries.map(([region, weather]) => {
                        const severity = alertSeverity(weather);
                        const condition = weather?.condition || '확인 중';
                        const isHeat = condition.includes('폭염');
                        const Icon = condition.includes('눈') ? Snowflake
                          : condition.includes('비') || condition.includes('소나기') ? CloudRain
                          : condition.includes('구름') || condition.includes('흐림') ? CloudSun
                          : Sun;
                        const fire = (forestFireData as Record<string, any>)[region];
                        // 관심(평상시)은 조용히 회색, 주의부터 강조 — weather-compact-status의 is-warn/is-danger 재사용
                        const fireSeverity = fire?.grade === '심각' || fire?.grade === '경계' ? 'danger'
                          : fire?.grade === '주의' ? 'warn' : 'none';
                        // 기상청 공식 특보 — 단기예보 추정(weather.alertText)과 다른 소스라 별도 표시.
                        // 흔치 않은 이벤트라 발효 중일 때만 줄이 생김(날씨·산불처럼 항상 표시하지 않음).
                        const official = (specialWarningData as Record<string, any>)[region];
                        const officialWarnings = official?.warnings || [];
                        return (
                          <article key={region} className={`weather-compact-card is-${severity}`}>
                            <div className="weather-compact-region">
                              {/* 도 소속 시/군의 읍면동(예: "경북 의성군 의성읍")은 3토큰이라 카드 폭에서 잘림 —
                                  같은 시/군 카드끼리 모여 있어 앞부분은 중복이므로 마지막 토큰(읍면동명)만 표시.
                                  광역시 자치구("대구 남구")는 원래도 2토큰이라 그대로 둠. 전체 이름은 title로 확인 가능 */}
                              <span title={region} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>
                                {region.trim().split(/\s+/).length >= 3 ? region.trim().split(/\s+/).slice(-1)[0] : region}
                              </span>
                              {weather?.source === 'org' && <span className="weather-source-badge weather-source-org" title="기관 주소가 속한 지역">기관</span>}
                              {weather?.source === 'elder' && <span className="weather-source-badge weather-source-elder" title={`${T.elder} 거주지 지역`}>{T.elder}</span>}
                            </div>
                            <div className="weather-compact-main">
                              {isHeat
                                ? <img className="weather-compact-hot" src="/hot-face.png" alt="폭염" />
                                : <Icon className="weather-compact-icon" size={25} strokeWidth={1.7} aria-hidden="true"/>}
                              <div className="weather-compact-reading"><strong>{weather?.temp ?? '-'}°C</strong><span>{condition}</span></div>
                            </div>
                            <div className={`weather-compact-status is-${severity}`}>{weather?.alertText || '특보 없음'}</div>
                            {fire && !fire.noData && (
                              <div className={`weather-compact-fire is-${fireSeverity}`}>
                                <Flame size={12} strokeWidth={2} aria-hidden="true" />
                                {/* 서버는 산림청 공식 4단계(관심·주의·경계·심각) 원문을 그대로 준다 — 최하단계 '관심'만
                                    일반 사용자에게 헷갈려서('관심 있음'처럼 읽힘) 표시용으로 '정상'으로 바꿔 보여준다 */}
                                <span>산불위험 {fire.grade === '관심' ? '정상' : fire.grade}</span>
                              </div>
                            )}
                            {official && !official.noData && (
                              <div className={`weather-compact-official ${officialWarnings.length ? 'is-active' : 'is-none'}`}>
                                <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
                                <span>{officialWarnings.length
                                  ? `기상청 공식 ${officialWarnings.map((w: any) => w.label).join('·')}`
                                  : '공식특보 없음'}</span>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="section alert-ment-section">
                <div className="section-title">경보 멘트 설정</div>
                <div className="alert-ment-intro">경보 유형을 선택하고 안내 문구를 확인한 뒤 발신 대상을 지정하세요.</div>
                <div className="alert-template-grid">
                  {[{id:'none',Icon:CircleCheck,label:'경보 없음'},{id:'heatwave',Icon:Sun,label:'폭염경보'},{id:'cold',Icon:Snowflake,label:'한파경보'},{id:'dust',Icon:Wind,label:'미세먼지 나쁨'},{id:'rain',Icon:CloudRain,label:'호우주의보'},{id:'typhoon',Icon:Wind,label:'태풍경보'},{id:'wildfire',Icon:Flame,label:'산불발생'}].map(t => (
                    <button key={t.id} className={`alert-template-btn ${activeAlert===t.id?'alert-template-active':''}`} onClick={() => { alertUserTouchedRef.current = true; appliedAlertKeyRef.current = t.id; setActiveAlert(t.id); if (t.id==='wildfire') { setWildfireStage('prepare'); setAlertScript(tplText('wildfire_prepare', WILDFIRE_STAGES[0].text)); } else { setAlertScript(tplText(t.id, ALERT_TEMPLATES[t.id])); } }}>
                      <t.Icon size={21}/><span>{t.label}</span>
                    </button>
                  ))}
                </div>
                {activeAlert === 'wildfire' && (
                  <div style={{marginTop:14}}>
                    <div className="var-hint" style={{marginBottom:8,color:'#ea580c',fontWeight:700}}>산불 대피 3단계 — 상황에 맞는 단계를 골라 발신하세요. 어르신이 "괜찮아/도와줘"로 응답하면 자동 처리됩니다.</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                      {WILDFIRE_STAGES.map(s => (
                        <button key={s.id} className={`alert-template-btn ${wildfireStage===s.id?'alert-template-active':''}`}
                          style={{flex:'1 1 30%',minWidth:150,justifyContent:'center',...(wildfireStage===s.id?{background:`${s.color}15`}:{})}}
                          onClick={() => { setWildfireStage(s.id); setAlertScript(tplText('wildfire_'+s.id, s.text)); }}>
                          <span style={{fontWeight:700,fontSize:16,color:wildfireStage===s.id?s.color:'#374151'}}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <label className="form-label">산불 발생 위치 (담당자 입력 · {'{{지역}}'}에 들어감)</label>
                    <input className="form-input" type="text" value={fireLoc} placeholder="예) 봉화군 도개면 야산"
                      onChange={e => setFireLoc(e.target.value)} style={{marginBottom:4}}/>
                    <div className="var-hint" style={{color:'#94a3b8'}}>산불이 난 곳 — 멘트의 {'{{지역}}'} 자리와 어르신이 "어디서 났어?"라고 물을 때의 답변에 쓰입니다. 비워두면 어르신 거주 지역으로 안내됩니다.</div>
                    <label className="form-label" style={{marginTop:10}}>대피소명 (담당자 입력 · {'{{대피소}}'}에 들어감)</label>
                    <input className="form-input" type="text" value={shelterName} placeholder="예) 봉화초등학교 운동장, 북구민운동장"
                      onChange={e => setShelterName(e.target.value)} style={{marginBottom:4}}/>
                    <div className="var-hint" style={{color:'#94a3b8'}}>여기에 입력한 대피소명이 경보 멘트의 {'{{대피소}}'} 자리에 들어갑니다. 비워두면 "가까운 대피소"로 안내됩니다.</div>
                  </div>
                )}
                {activeAlert !== 'none' && (
                  <div className="alert-script-edit">
                    <label className="form-label">경보 멘트 수정{activeAlert==='wildfire'?' (선택한 단계)':''}</label>
                    <textarea className="script-textarea" value={alertScript} onChange={e => { alertUserTouchedRef.current = true; setAlertScript(e.target.value); setAlertTplSaved(false); }} rows={activeAlert==='wildfire'?5:3}/>
                    <div className="var-hint">
                      사용 가능 변수: <code>{'{{지역}}'}</code> <code>{'{{보호자}}'}</code> <code>{'{{기관명}}'}</code>{activeAlert==='wildfire'&&<> <code>{'{{대피소}}'}</code></>}
                      <span style={{display:'block',marginTop:4,color:'#94a3b8'}}>
                        <code>{'{{기관명}}'}</code>은 로그인한 기관 이름({me?.orgName || '미등록'})으로 자동 채워집니다.
                      </span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap'}}>
                      <button className="btn-primary" style={{fontSize:16,padding:'6px 14px'}} disabled={alertTplSaving} onClick={saveAlertTemplate}>
                        {alertTplSaving ? '저장 중…' : '이 멘트 저장'}
                      </button>
                      <button className="btn-secondary" style={{fontSize:15,padding:'6px 10px'}} disabled={alertTplSaving} onClick={resetAlertTemplate}>기본값으로 되돌리기</button>
                      {alertTplSaved && <span style={{fontSize:15,color:'#16a34a',fontWeight:700}}>저장됨 — 같은 기관 모든 담당자에게 즉시 적용됩니다</span>}
                      {savedAlertTpl[curAlertKey()] && !alertTplSaved && <span style={{fontSize:15,color:'#246BEB'}}>· 저장된 맞춤 멘트 사용 중</span>}
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
                        <div className="alert-ment-preview">
                          <div style={{fontWeight:700,fontSize:16,color:'#0369a1',marginBottom:8}}>실제 발송 미리보기 <span style={{fontWeight:500,color:'#64748b'}}>— 어르신마다 자기 지역·보호자{activeAlert==='wildfire'?'·대피소':''} 값으로 채워져 발송됩니다{checked.length?` (선택한 ${checked.length}명 기준)`:''}.</span></div>
                          {shown.map((e, i) => (
                            <div key={i} style={{marginBottom: i < shown.length - 1 ? 10 : 0}}>
                              <div style={{fontSize:15,fontWeight:800,color:'#0369a1',marginBottom:2}}>{e.region} <span style={{fontWeight:500,color:'#94a3b8'}}>({e.name} 어르신 등)</span></div>
                              <div style={{fontSize:17,lineHeight:1.6,color:'#1f2937',whiteSpace:'pre-wrap'}}>{alertMsgFor(e)}</div>
                            </div>
                          ))}
                          {byRegion.length > shown.length && <div style={{fontSize:15,color:'#94a3b8',marginTop:6}}>… 외 {byRegion.length - shown.length}개 지역도 각자 지역명으로 발송됩니다.</div>}
                          {activeAlert === 'wildfire' && !shelterName.trim() && <div style={{fontSize:15,color:'#f59e0b',marginTop:6}}>위 대피소명 칸이 비어 있어 "가까운 대피소"로 나옵니다. 대피소명을 입력해 보세요.</div>}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {activeAlert !== 'none' && (
                  <div className="alert-ment-targets">
                    <div className="alert-ment-target-head">
                      <label className="form-label" style={{margin:0}}>이 경보 멘트로 발신할 어르신 (체크 후 일괄 발신)</label>
                      <div style={{display:'flex',gap:6}}>
                        {(() => {
                          // 자동선택 = "지금 선택한 경보 종류"가 발효 중인 지역만 (예: 폭염 선택 시 비 오는 달서구는 제외 — 호우 멘트를 따로 보내는 설계)
                          const AL = { heatwave:'폭염', cold:'한파', dust:'미세먼지', rain:'호우', typhoon:'태풍', wildfire:'산불' };
                          const label = AL[activeAlert] || '경보';
                          return (
                            <button className="btn-secondary" style={{fontSize:15,padding:'5px 10px'}}
                              title={`지금 선택한 '${label}' 경보가 발효 중인 지역의 어르신만 선택합니다. 다른 경보(예: 호우) 지역은 그 경보를 선택한 뒤 눌러 주세요.`}
                              onClick={()=>setChecked(elders.filter(e=>weatherData[normalizeRegion(e.region)]?.alert===activeAlert).map(e=>e.id))}>{label} 지역 자동선택</button>
                          );
                        })()}
                        <button className="btn-secondary" style={{fontSize:15,padding:'5px 10px'}} onClick={()=>setChecked(elders.map(e=>e.id))}>전체</button>
                        <button className="btn-secondary" style={{fontSize:15,padding:'5px 10px'}} onClick={()=>setChecked([])}>해제</button>
                      </div>
                    </div>
                    <div className="alert-region-filters">
                      {/* 2026-08-27: 어르신 region이 비어있으면(총괄 계정은 여러 기관 전체를 보므로
                          이 케이스를 마주칠 확률이 높다) undefined.replace()에서 그대로 죽어 화면이
                          빈 화면이 되던 버그 수정(실사용 지적) — 빈 지역은 별도 표시로 묶는다.
                          2026-08-31: CSV로 등록된 어르신은 "대구광역시 북구"처럼 정규화 안 된
                          표기가 섞여 있어, 정규화 없이 그대로 묶으면 같은 구가 서로 다른 칩으로
                          갈라져 필터·자동선택에서 빠지는 사고가 있었다(실사용 지적) — 그룹핑·
                          비교 모두 normalizeRegion()으로 통일한다. */}
                      {[...new Set(elders.map(e=>normalizeRegion(e.region)||'(지역 미설정)'))].sort().map(r => {
                        const inR = elders.filter(e=>(normalizeRegion(e.region)||'(지역 미설정)')===r);
                        const allOn = inR.length>0 && inR.every(e=>checked.includes(e.id));
                        const someOn = inR.some(e=>checked.includes(e.id));
                        return (
                          <button key={r} onClick={()=>{ if(allOn) setChecked(prev=>prev.filter(id=>!inR.some(e=>e.id===id))); else setChecked(prev=>[...new Set([...prev,...inR.map(e=>e.id)])]); }} style={{fontSize:16,padding:'6px 12px',borderRadius:20,border:'1px solid '+(allOn?'#246BEB':someOn?'#93c5fd':'#d1d5db'),background:allOn?'#246BEB':someOn?'#eff6ff':'#fff',color:allOn?'#fff':'#374151',fontWeight:600,cursor:'pointer'}}>{r.replace('대구 ','')} ({inR.length})</button>
                        );
                      })}
                    </div>
                    <div className="alert-elder-list">
                      {elders.map(e => {
                        const inZone = weatherData[normalizeRegion(e.region)]?.alert === activeAlert;
                        const on = checked.includes(e.id);
                        return (
                          <label key={e.id} style={{display:'flex',alignItems:'center',gap:8,border:'1px solid '+(on?'#246BEB':'#e5e7eb'),borderRadius:8,padding:'8px 12px',cursor:'pointer',background:on?'#eff6ff':'#fff'}}>
                            <input type="checkbox" checked={on} onChange={()=>toggleCheck(e.id)} />
                            <span style={{fontWeight:600}}>{e.name}</span>
                            <span style={{fontSize:15,color:'#6b7280'}}>{e.region}</span>
                            {inZone && <span style={{fontSize:14,color:'#ef4444',fontWeight:700}}>● 경보지역</span>}
                          </label>
                        );
                      })}
                    </div>
                    {!bulkRunning ? (
                      // 앱 알림 / 일반전화(070) 두 경로를 따로 고른다 — 경보는 앱 미설치 어르신에게도
                      // 닿아야 해서 일반전화 발신이 필수다(2026-08-21).
                      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                        <button className="btn-call" disabled={checked.length===0} style={{opacity:checked.length===0?0.5:1,cursor:checked.length===0?'not-allowed':'pointer'}}
                          onClick={()=>setBulkConfirm({ count: checked.length, queue: null, channel: 'app', isAlert: true, alertLabel: `경보 멘트 — ${activeAlert}${activeAlert==='wildfire' ? ` / ${wildfireStage}` : ''}` })}>
                          선택한 {checked.length}명에게 앱 알림으로 발신
                        </button>
                        <button className="btn-call" disabled={checked.length===0} style={{opacity:checked.length===0?0.5:1,cursor:checked.length===0?'not-allowed':'pointer'}}
                          onClick={()=>setBulkConfirm({ count: checked.length, queue: null, channel: 'pstn', isAlert: true, alertLabel: `경보 멘트 — ${activeAlert}${activeAlert==='wildfire' ? ` / ${wildfireStage}` : ''}` })}>
                          선택한 {checked.length}명에게 일반전화로 발신
                        </button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontWeight:700,color:'#246BEB'}}>발신 중... ({bulkDone.length}/{bulkQueue.length})</span><button className="btn-secondary" onClick={stopBulkCall}>중지</button></div>
                    )}
                  </div>
                )}
              </div>

              <div className="section">
                <div className="section-title">영실이 안부 질문</div>
                <div style={{fontSize:16,color:'#64748b',marginBottom:14,lineHeight:1.6}}>
                  영실이가 통화에서 <b>실제로 하는 질문</b>이에요. 문구를 고치거나 특정 질문을 빼면 <b>다음 통화부터</b> 적용됩니다.
                  질문 순서는 자연스러운 대화를 위해 고정입니다. <b>{'{호칭}'}</b>은 통화 시 "어르신"으로 바뀝니다.
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {questions.map((q)=>(
                    <div key={q.key} className={`script-question-row ${q.enabled?'':'is-disabled'}`}>
                      <span className="script-question-label">{q.label}</span>
                      <textarea
                        value={q.text}
                        onChange={e=>setQuestionField(q.key,'text',e.target.value)}
                        disabled={!q.enabled}
                        rows={2}
                        className="script-question-input"
                      />
                      <div className="script-question-options">
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:15,fontWeight:700,color:'#f59e0b',whiteSpace:'nowrap',cursor:'pointer'}}
                               title="이틀에 한 번만 여쭙니다 — 통화가 길어지지 않게">
                          <input type="checkbox" checked={!q.everyday} onChange={e=>setQuestionField(q.key,'everyday',!e.target.checked)} />격일
                        </label>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:15,fontWeight:700,color:'#334155',whiteSpace:'nowrap',cursor:'pointer'}}
                               title="끄면 통화에서 이 질문을 하지 않습니다">
                          <input type="checkbox" checked={q.enabled} onChange={e=>setQuestionField(q.key,'enabled',e.target.checked)} />사용
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{display:'flex',alignItems:'center',gap:10,marginTop:14,flexWrap:'wrap'}}>
                  <button className="btn-primary" onClick={saveQuestions} disabled={questionsSaving}>
                    {questionsSaving?'저장 중...':'질문 저장'}
                  </button>
                  <button className="btn-secondary" onClick={resetQuestions} disabled={questionsSaving}>기본 질문으로 되돌리기</button>
                  {questionsMsg && <span style={{fontSize:16,fontWeight:600,color:questionsMsg.includes('실패')||questionsMsg.includes('비어')?'#dc2626':'#16a34a'}}>{questionsMsg}</span>}
                </div>

                <div style={{fontSize:16,color:'#334155',marginTop:14,lineHeight:1.6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 14px'}}>
                  <b>격일</b>로 표시한 질문은 이틀에 한 번만 여쭤 통화가 길어지지 않게 합니다. 통화 중 <b>위험·정서·생활 신호</b>를 감지하면 자동으로 보호자·복지사·119 연락을 안내하고, <b>건강 상태</b> 메뉴에 알림이 뜹니다.
                </div>

                {/* ── 070 발신번호 설정 — 일반전화(PSTN) 발신 시 어르신 전화기에 표시되는 번호 ── */}
                <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:6}}>일반전화 발신번호</div>
                  <div style={{fontSize:15,color:'#64748b',marginBottom:10,lineHeight:1.6}}>
                    앱이 없는 {T?.elder || '어르신'}께 일반전화(070)로 전화드릴 때 상대방 화면에 표시되는 번호입니다.
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <input
                      value={pstnCallerId}
                      onChange={e=>setPstnCallerId(e.target.value.replace(/[^0-9]/g,''))}
                      placeholder="예: 07045014906"
                      inputMode="numeric"
                      style={{padding:'10px 14px',border:'1px solid #cbd5e1',borderRadius:10,fontSize:17,fontWeight:700,letterSpacing:1,width:220}}
                    />
                    <button className="btn-primary" onClick={savePstnCallerId} disabled={pstnSaving}>
                      {pstnSaving?'저장 중...':'발신번호 저장'}
                    </button>
                    {pstnMsg && <span style={{fontSize:16,fontWeight:600,color:pstnMsg.includes('실패')||pstnMsg.includes('입력')?'#dc2626':'#16a34a'}}>{pstnMsg}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {page==='calls' && (
            <div className="fade-in calls-page">
              {/* 기간 선택 (일/월별 조회) — 서버 calls 컬렉션 실데이터 */}
              <div className="calls-toolbar">
                <div className="calls-toolbar-main">
                {[['week','최근 7일'],['month','최근 30일'],['custom','직접 선택']].map(([k,label])=>(
                  <button key={k} onClick={()=>setCallsRange(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(callsRange===k?'#246BEB':'#e2e8f0'),background:callsRange===k?'#eff6ff':'#fff',color:callsRange===k?'#246BEB':'#64748b',fontWeight:700,fontSize:16,cursor:'pointer'}}>{label}</button>
                ))}
                {callsRange==='custom' && (<>
                  <input type="date" value={callsFrom} onChange={e=>setCallsFrom(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:16}}/>
                  <span style={{color:'#94a3b8'}}>~</span>
                  <input type="date" value={callsTo} onChange={e=>setCallsTo(e.target.value)} style={{padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:16}}/>
                </>)}
                <button onClick={()=>fetchCalls()} className="btn-download" style={{padding:'6px 12px'}}>{callsLoading?'불러오는 중':'새로고침'}</button>
                <button onClick={()=>{const open=!callsAllOpen; setCallsAllOpen(open); setCallsDayOv(()=>{const o={}; callsHistory.forEach(c=>{o[c.date||(c.at?c.at.slice(0,10):'미상')]=open;}); return o;});}} className="btn-secondary" style={{fontSize:15,padding:'6px 12px',fontWeight:700}}>{callsAllOpen?'전체 접기 ▴':'전체 펼치기 ▾'}</button>
                <span style={{fontSize:15,color:'#94a3b8'}}>15초마다 자동 갱신됩니다</span>
                <input value={callsSearch} onChange={e=>setCallsSearch(e.target.value)} placeholder="이름 검색" style={{padding:'6px 10px',borderRadius:8,border:'1px solid '+(callsSearch?'#246BEB':'#e2e8f0'),fontSize:16,width:120}}/>
                <select value={callsPhone} onChange={e=>setCallsPhone(e.target.value)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid '+(callsPhone?'#246BEB':'#e2e8f0'),fontSize:16,fontWeight:700,color:callsPhone?'#246BEB':'#334155',background:'#fff',cursor:'pointer'}}>
                  <option value="">전체 어르신</option>
                  {elders.map(e=>{const k=String(e.phone||'').replace(/\D/g,'');return <option key={k} value={k}>{e.name}</option>;})}
                </select>
                </div>
                <span className="calls-total">총 {callsHistory.filter(c=>(!callsPhone||String(c.phone||'').replace(/\D/g,'')===callsPhone)&&(!callsSearch||(nameByPhone(c.phone,c.elderName)||'').includes(callsSearch))&&callsRiskMatch(c)).length}건</span>
              </div>
              <div className="calls-risk-filter">
                <span style={{fontSize:16,color:'#64748b',fontWeight:600}}>위험도:</span>
                {[['all','전체','#334155'],['critical','긴급','#dc2626'],['urgent','주의','#f59e0b'],['normal','정상','#16a34a']].map(([k,label,col])=>(
                  <button key={k} onClick={()=>setCallsRisk(k)} style={{padding:'5px 12px',borderRadius:20,border:'1px solid '+(callsRisk===k?col:'#e2e8f0'),background:callsRisk===k?col:'#fff',color:callsRisk===k?'#fff':'#64748b',fontWeight:700,fontSize:15,cursor:'pointer'}}>{label}</button>
                ))}
                {callsRisk!=='all' && <span style={{fontSize:15,color:'#94a3b8'}}>· 대시보드에서 이동됨</span>}
              </div>
              <div className="calls-privacy-note">
                <ShieldCheck size={18} aria-hidden="true"/><span><b>개인정보 보호</b> · 원본 음성은 실시간 텍스트 변환 직후 삭제되며 텍스트 기록만 보관됩니다. 녹음 재생 기능은 제공하지 않습니다.</span>
              </div>
              {callsHistory.length===0 ? (
                <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>{callsLoading?'불러오는 중...':'이 기간 통화 기록이 없습니다.'}</div>
              ) : (()=>{
                const src = callsHistory.filter(c=>(!callsPhone||String(c.phone||'').replace(/\D/g,'')===callsPhone)&&(!callsSearch||(nameByPhone(c.phone,c.elderName)||'').includes(callsSearch))&&callsRiskMatch(c));
                const grouped: Record<string, any[]> = {};
                src.forEach(c=>{ const dk=c.date||(c.at?c.at.slice(0,10):'미상'); (grouped[dk]=grouped[dk]||[]).push(c); });
                // P2-9: 발신 이력과 동일한 일자별 아코디언 — 기본 오늘만 펼침, 필터·검색 사용 시 전체 자동 펼침
                const filterOn = callsRisk!=='all' || !!callsSearch || !!callsPhone;
                return Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,logs])=>{
                  const nCrit=logs.filter(c=>c.riskLevel==='critical').length;
                  const nUrg=logs.filter(c=>c.riskLevel==='urgent').length;
                  const open = filterOn ? true : (callsDayOv[date] !== undefined ? callsDayOv[date] : date===localDayKey());
                  const rowsOpen=expandedCallDays.has(date);
                  const shown=rowsOpen?logs:logs.slice(0,3);
                  const hiddenRisk=logs.slice(3).filter(c=>c.riskLevel==='critical'||c.riskLevel==='urgent').length;
                  return (
                  <div key={date} className="calls-day-group">
                    <GroupHeader label={formatDateHeader(date)} count={logs.length}
                      chips={[{label:'긴급',value:nCrit,color:'#dc2626'},{label:'주의',value:nUrg,color:'#f59e0b'}]}
                      flag={nCrit>0&&!open?'위험 감지 있음':null}
                      open={open} onToggle={()=>setCallsDayOv(p=>({...p,[date]:!open}))}/>
                    {open && shown.map(c=>{
                      const R=RISK_CONFIG[c.riskLevel]||{};
                      const hm=c.at?new Date(c.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                      const dur=c.durationSec||0;
                      const risky=c.riskLevel==='critical'||c.riskLevel==='urgent';
                      const kw=risky?kwFromTranscript(c.transcript):null;
                      return (
                        <div key={c.id} className={`call-row ${c.riskLevel==='critical'?'call-row-danger':c.riskLevel==='urgent'?'call-row-warning':''}`}>
                          <div style={{minWidth:46,color:'#64748b',fontSize:16}}>{hm}</div>
                          <div style={{minWidth:80,fontWeight:700,fontSize:17}}>{nameByPhone(c.phone,c.elderName)}</div>
                          <div style={{minWidth:64,color:'#94a3b8',fontSize:16}}>{Math.floor(dur/60)}분 {dur%60}초</div>
                          <span className={`result-pill ${c.riskLevel==='critical'?'pill-danger':c.riskLevel==='urgent'?'pill-warning':'pill-normal'}`}>{R.label||'정상'}</span>
                          <div style={{minWidth:110,fontWeight:700,fontSize:16,color:R.color||'#cbd5e1'}}>{kw?`“${kw}”`:'—'}</div>
                          {c.transcript && (
                            <button className="btn-secondary" style={{fontSize:15,padding:'4px 10px',marginLeft:'auto'}}
                              disabled={!!draftingCallId} title="통화 내용을 AI가 활동일지 초안으로 요약해 일지 작성 창에 채워줍니다"
                              onClick={()=>openNoteForCall(c)}>
                              {draftingCallId===c.id ? '초안 생성 중…' : '일지 초안'}
                            </button>
                          )}
                          <div style={{flexBasis:'100%'}}><CallTranscript text={c.transcript} /></div>
                        </div>
                      );
                    })}
                    {open && logs.length>3 && (
                      <button onClick={()=>setExpandedCallDays(prev=>{const n=new Set(prev); n.has(date)?n.delete(date):n.add(date); return n;})} style={{marginTop:2,marginLeft:2,background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer',padding:'2px 0'}}>
                        {rowsOpen?'접기 ▴':`+ ${logs.length-3}건 더 보기${hiddenRisk>0?` (긴급·주의 ${hiddenRisk}건 포함)`:''} ▾`}
                      </button>
                    )}
                  </div>
                );});
              })()}
            </div>
          )}

          {page==='report' && (
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
          )}

          {page==='health' && (
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
          )}

          {page==='casenotes' && (
            <div className="fade-in casenotes-page">
              <div className="casenotes-toolbar">
                <div className="casenotes-toolbar-main">
                  <div className="search-box casenotes-search"><Search size={19} aria-hidden="true"/><input className="search-input" placeholder={`${T.elder} 이름으로 검색`} value={caseSearch} onChange={e=>setCaseSearch(e.target.value)}/>{caseSearch&&<button className="search-clear" onClick={()=>setCaseSearch('')} aria-label="검색어 지우기"><X size={16}/></button>}</div>
                  <div className="casenotes-actions">
                    <button className="btn-secondary" onClick={openSchedule} title="이용자별 월 급여제공 일정표 — 날짜별 제공시간 입력·저장 후 공식 달력 양식으로 인쇄(PDF)">급여제공 일정표</button>
                    <button className="btn-secondary" onClick={openWeeklyReport} title="공식 양식(1~5주차·사회/신체/가사/기타)에 이번 달 일지를 자동으로 채워 인쇄(PDF)합니다">주간업무 보고서</button>
                    <button className="btn-secondary" onClick={()=>exportNotesXlsx(caseNotes)} title="일지 전체(최근 90일)를 엑셀로 다운로드 — 기관 보관·결재용">엑셀</button>
                    <button className="btn-primary" onClick={()=>openNewNote()}><PencilLine size={17}/> 새 일지</button>
                  </div>
                </div>
                <div className="casenotes-filter-row">
                  <span className="casenotes-filter-label">상담 유형</span>
                  {[['all','전체'],['visit','방문'],['phone','전화'],['office','내소'],['guardian','보호자'],['etc','기타']].map(([v,l])=>(
                    <button key={v} className={`smart-btn ${caseType===v?'smart-active':''}`} onClick={()=>setCaseType(v)}>{l}</button>
                  ))}
                  <span className="casenotes-filter-divider"/>
                  <button className={`smart-btn casenotes-followup ${caseFollowUpOnly?'is-active':''}`} onClick={()=>setCaseFollowUpOnly(v=>!v)}>후속 필요{caseFollowUpOnly?' · 해제':''}</button>
                  <span className="casenotes-sync">15초마다 자동 갱신</span>
                </div>
              </div>

              <section className="section casenotes-memo">
                <div className="casenotes-memo-heading"><div><div className="section-title">업무 메모</div><p>상담이나 방문 전에 확인할 내용을 간단히 기록하세요.</p></div></div>
                <div className="memo-input-wrap">
                  <input className="memo-input" placeholder="새 메모를 입력하세요" value={memoText} onChange={e=>setMemoText(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&memoText.trim()){const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});setMemos(prev=>[{id:Date.now(),text:memoText.trim(),time:now,done:false},...prev]);setMemoText('');}}}/>
                  <button className="btn-primary" onClick={()=>{if(!memoText.trim())return;const now=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});setMemos(prev=>[{id:Date.now(),text:memoText.trim(),time:now,done:false},...prev]);setMemoText('');}}>메모 추가</button>
                </div>
                {memos.length>0 && <div className="memo-list">
                  {memos.map(memo=><div key={memo.id} className={`memo-item ${memo.done?'memo-done':''}`}>
                    <button className={`todo-check ${memo.done?'todo-check-on':''}`} onClick={()=>setMemos(prev=>prev.map(m=>m.id===memo.id?{...m,done:!m.done}:m))} aria-label="메모 완료">{memo.done&&<CheckCircle2 size={13} color="#fff" strokeWidth={3}/>}</button>
                    <div className="memo-text">{memo.text}</div><div className="memo-time">{memo.time}</div>
                    <button className="memo-del" aria-label="메모 삭제" onClick={()=>setMemos(prev=>prev.filter(m=>m.id!==memo.id))}><X size={15}/></button>
                  </div>)}
                </div>}
              </section>
              {(()=>{
                const ym=new Date().toISOString().slice(0,7);
                const tm=caseNotes.filter(n=>(n.visitedAt||'').slice(0,7)===ym);
                // 실적 집계는 담당자가 확인한 일지만 센다 — 자동기록 초안이 방문·상담 실적으로 잡히면 안 된다
                const done=tm.filter(n=>!isAutoDraft(n));
                const stat=[
                  {label:'이번달 가정방문',value:done.filter(n=>n.type==='visit').length,color:'#246BEB'},
                  {label:'이번달 전화상담',value:done.filter(n=>n.type==='phone').length,color:'#16a34a'},
                  {label:'이번달 전체 상담',value:done.length,color:'#7c3aed'},
                  {label:'미처리 후속',value:caseNotes.filter(n=>n.followUp&&n.followUp.needed&&!n.followUp.done).length,color:'#f59e0b'},
                  {label:'확인 필요(자동기록)',value:caseNotes.filter(isAutoDraft).length,color:'#b45309'},
                ];
                return (
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
                    {stat.map((s,i)=>(
                      <div key={i} style={{flex:'1 1 140px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px'}}>
                        <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
                        <div style={{fontSize:16,color:'#64748b',marginTop:2}}>{s.label}</div>
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
                  const active=[caseFollowUpOnly&&'후속 필요', caseType!=='all'&&`유형: ${(CASE_TYPE_META[caseType]||{}).label||caseType}`, caseSearch&&`검색: "${caseSearch}"`].filter(Boolean);
                  return (
                    <div style={{padding:'30px',textAlign:'center',color:'#64748b'}}>
                      <div style={{fontSize:17,fontWeight:600}}>선택한 필터에 맞는 일지가 없습니다.</div>
                      {active.length>0 && <div style={{fontSize:16,color:'#94a3b8',marginTop:6}}>적용 중인 필터 — {active.join(' · ')}</div>}
                      <div style={{fontSize:16,color:'#94a3b8',marginTop:2}}>전체 {caseNotes.length}건이 있어요. 필터를 끄면 모두 표시됩니다.</div>
                      <button onClick={()=>{setCaseType('all');setCaseSearch('');setCaseFollowUpOnly(false);}} style={{marginTop:14,background:'#246BEB',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:17,fontWeight:700,cursor:'pointer'}}>↺ 필터 초기화</button>
                    </div>
                  );
                }
                const groups: Record<string, any[]>={};
                filtered.forEach(n=>{ const dk=(n.visitedAt||'').slice(0,10)||'미상'; (groups[dk]=groups[dk]||[]).push(n); });
                const allSel=filtered.every(n=>selectedNotes.has(n.id));
                const selectAll=()=>setSelectedNotes(prev=>{const s=new Set(prev); if(allSel) filtered.forEach(n=>s.delete(n.id)); else filtered.forEach(n=>s.add(n.id)); return s;});
                return (<>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                    <label style={{display:'flex',alignItems:'center',gap:6,fontSize:16,fontWeight:600,color:'#334155',cursor:'pointer'}}>
                      <input type="checkbox" checked={allSel} onChange={selectAll}/> 전체 선택
                    </label>
                    {selectedNotes.size>0 && (<>
                      <span style={{fontSize:16,color:'#246BEB',fontWeight:700}}>{selectedNotes.size}건 선택됨</span>
                      <button onClick={deleteSelectedNotes} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:16,fontWeight:700,cursor:'pointer'}}>선택 삭제</button>
                      <button onClick={()=>setSelectedNotes(new Set())} style={{background:'#fff',color:'#64748b',border:'1px solid #d1d5db',borderRadius:8,padding:'6px 12px',fontSize:16,fontWeight:600,cursor:'pointer'}}>선택 해제</button>
                    </>)}
                  </div>
                  {Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,rows])=>{
                  const open=expandedNoteDays.has(date);
                  const shown=open?rows:rows.slice(0,3);
                  return (
                    <div key={date} style={{marginBottom:16}}>
                      <div style={{fontWeight:800,fontSize:17,color:'#334155',marginBottom:8,paddingBottom:6,borderBottom:'2px solid #e2e8f0'}}>{formatDateHeader(date)} <span style={{color:'#94a3b8',fontWeight:600,fontSize:16}}>· {rows.length}건</span></div>
                      {shown.map(n=>{
                        const tmeta=CASE_TYPE_META[n.type]||CASE_TYPE_META.etc;
                        const time=n.visitedAt?new Date(n.visitedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                        const fu=n.followUp&&n.followUp.needed&&!n.followUp.done;
                        const sel=selectedNotes.has(n.id);
                        return (
                          <div key={n.id} style={{border:'1px solid '+(sel?'#93c5fd':'#e2e8f0'),borderRadius:10,padding:'12px 14px',marginBottom:8,background:sel?'#eff6ff':'#fff'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                              <input type="checkbox" checked={sel} onChange={()=>toggleNoteSel(n.id)} style={{width:16,height:16,cursor:'pointer',flexShrink:0}}/>
                              <span style={{minWidth:44,color:'#64748b',fontSize:16,fontWeight:600}}>{time}</span>
                              <span style={{fontSize:15,fontWeight:700,color:tmeta.color,background:tmeta.bg,padding:'2px 8px',borderRadius:20}}>{tmeta.label}</span>
                              <span style={{fontWeight:700,fontSize:17}}>{nameByPhone(n.elderPhone,n.elderName)}</span>
                              <span style={{fontSize:15,color:'#64748b'}}>· {CASE_CAT_META[n.category]||'기타'}</span>
                              {(n.topics||[]).length>0 && <span style={{fontSize:15,fontWeight:700,color:'#7c3aed',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:12,padding:'2px 8px'}}>{(n.topics||[]).map(t=>CASE_TOPIC_META[t]).filter(Boolean).join('·')}</span>}
                              {n.linkedAlertId&&<span style={{fontSize:14,color:'#dc2626',fontWeight:700}}>알림 대응</span>}
                              {isAutoDraft(n)&&<AutoDraftBadge/>}
                              {fu&&<span style={{fontSize:14,color:'#f59e0b',fontWeight:700}}>후속{n.followUp.dueDate?` ~${n.followUp.dueDate}`:''}</span>}
                              <span style={{flex:1}}/>
                              <button onClick={()=>copyNote(n, n.id)} style={{background:'none',border:'none',color:'#16a34a',fontSize:15,fontWeight:700,cursor:'pointer'}} title="붙여넣기용 텍스트 복사">{copiedNoteId===n.id?'복사됨':'복사'}</button>
                              <button onClick={()=>openEditNote(n)} style={{background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer'}}>수정</button>
                              <button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:15,fontWeight:700,cursor:'pointer'}}>삭제</button>
                            </div>
                            {n.content&&<div style={{fontSize:16,color:'#1f2937',marginTop:6,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.content}</div>}
                            {n.action&&<div style={{fontSize:16,color:'#475569',marginTop:5,lineHeight:1.5}}><b style={{color:'#0f766e'}}>조치</b> {n.action}</div>}
                            {n.authorEmail&&<div style={{fontSize:14,color:'#94a3b8',marginTop:6}}>작성: {n.authorEmail}</div>}
                          </div>
                        );
                      })}
                      {rows.length>3 && (
                        <button onClick={()=>setExpandedNoteDays(prev=>{const s=new Set(prev); s.has(date)?s.delete(date):s.add(date); return s;})} style={{background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer',padding:'2px 0'}}>
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
                <div><div className="data-banner-title">{popData?.sidoName || '대구광역시'} 독거노인 현황</div><div className="data-banner-sub">기관 주소 기준 자동 연동 · 출처: {popData?.source || '행정안전부 주민등록인구통계'}{popData && !popData.collecting && ` · ${popData.year}년 ${popData.month}월 기준`}</div></div>
                <button className={`btn-download ${popLoading?'btn-calling':''}`} onClick={() => { fetchPopulation(); fetchWeather(); }} disabled={popLoading}>{popLoading ? '불러오는 중...' : '데이터 갱신'}</button>
              </div>
              {/* 발효 중 특보 배너 — "{특보명} 발효 중 · {지역} 외 N개 지역", 경보급=레드/주의보급=앰버 */}
              {(() => {
                const ALERT_LBL = {heatwave:'폭염경보', cold:'한파경보', dust:'미세먼지 나쁨', rain:'호우주의보', typhoon:'태풍경보', wildfire:'산불발생'};
                const groups: Record<string, any[]> = {};
                Object.entries(weatherData as Record<string, any>).forEach(([region, w]) => { if (w && w.alert && w.alert !== 'none') (groups[w.alert] = groups[w.alert] || []).push({region, sev: alertSeverity(w)}); });
                return Object.entries(groups).map(([key, list]) => {
                  const danger = list.some(x => x.sev === 'danger');
                  const c = danger ? {bg:'#fef2f2', fg:'#b42318'} : {bg:'#fff8e1', fg:'#754d00'};
                  return (
                    <div key={key} className="data-weather-alert" style={{background:c.bg, color:c.fg}}>
                      <span>{ALERT_LBL[key] || '기상특보'} 발효 중 · {list[0].region}{list.length > 1 ? ` 외 ${list.length - 1}개 지역` : ''}</span>
                      <span style={{fontWeight:400, fontSize:15}}>아래 '기상특보 집중 케어 대상'에서 해당 지역 {T.elder}을 확인하세요</span>
                    </div>
                  );
                });
              })()}
              {/* 긴급재난문자 — 기관 관할지역 오늘자. 위급·긴급 단계만 상단에 강조, 안전안내는 목록에만 표시 */}
              {disasterMsgConfigured && disasterMsgs.length > 0 && (() => {
                const urgent = disasterMsgs.filter(m => /위급|긴급/.test(m.step || ''));
                return (
                  <>
                    {urgent.length > 0 && (
                      <div className="data-weather-alert" style={{background:'#fef2f2', color:'#b42318'}}>
                        <span>긴급재난문자 {urgent.length}건 수신 · {urgent[0].regionText}</span>
                        <span style={{fontWeight:400, fontSize:15}}>아래 목록에서 전체 내용을 확인하세요</span>
                      </div>
                    )}
                    <section className="section" style={{marginBottom:20}}>
                      <div className="script-editor-header" style={{marginBottom:10}}>
                        <div className="section-title" style={{marginBottom:0}}>긴급재난문자 (관할지역 오늘자 {disasterMsgs.length}건)</div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:360,overflowY:'auto'}}>
                        {disasterMsgs.map(m => {
                          const danger = /위급/.test(m.step || '');
                          const warn = /긴급/.test(m.step || '');
                          const c = danger ? {bg:'#fef2f2',fg:'#b42318',bd:'#fecaca'} : warn ? {bg:'#fff8e1',fg:'#92400e',bd:'#fde68a'} : {bg:'#f8fafc',fg:'#475569',bd:'#e2e8f0'};
                          return (
                            <div key={m.sn} style={{border:`1px solid ${c.bd}`,borderRadius:10,padding:'10px 12px',background:'#fff'}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                                <span style={{fontSize:14,fontWeight:700,color:c.fg,background:c.bg,padding:'2px 8px',borderRadius:20}}>{m.step || '안내'}</span>
                                <span style={{fontSize:14,color:'#94a3b8'}}>{m.category}</span>
                                <span style={{fontSize:14,color:'#94a3b8'}}>· {m.regionText}</span>
                                <span style={{flex:1}}/>
                                <span style={{fontSize:14,color:'#94a3b8'}}>{m.at}</span>
                              </div>
                              <div style={{fontSize:16,color:'#1f2937',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{m.content}</div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </>
                );
              })()}
              {popError && <div className="call-result-banner error">{popError}</div>}
              {popLoading && <div style={{textAlign:'center',padding:'40px',color:'#64748b',fontSize:18}}>행정안전부 공공데이터 불러오는 중...</div>}
              {popData?.collecting && !popLoading && (
                <div className="data-collecting-notice">
                  {popData.sidoName} 인구 통계를 처음 수집하고 있습니다 — 잠시 후 자동으로 표시됩니다 (수십 초 소요)
                </div>
              )}
              {popData && !popData.collecting && (
                <>
                  <div className="data-total-row">
                    {[{num:popData.total.population.toLocaleString()+'명',label:(popData.sidoName||'대구광역시')+' 전체 인구'},{num:popData.total.elderly.toLocaleString()+'명',label:'65세 이상 노인'},{num:popData.total.solitary.toLocaleString()+'명',label:'추정 독거노인'},{num:elders.length+'명',label:'영실이 현재 관리'},{num:(elders.length/popData.total.solitary*100).toFixed(2)+'%',label:'관리 비율'},{num:popData.total.elderlyRatio+'%',label:'고령화율'}].map((d,i)=>(<div key={i} className="data-total-card"><div className="data-total-num">{d.num}</div><div className="data-total-label">{d.label}</div></div>))}
                  </div>
                  {popData.total.elderlyRatio >= 20 && <div className="data-aging-notice">{popData.sidoName||'대구광역시'} 고령화율 {popData.total.elderlyRatio}% → 초고령사회 진입 (20% 이상)</div>}
                  <div className="section">
                    <div className="section-title">시군구별 독거노인 현황</div>
                    <table className="table">
                      <thead><tr><th>시군구</th><th>전체 인구</th><th>65세 이상</th><th>고령화율</th><th>추정 독거노인</th><th>영실이 관리</th><th>관리 비율</th><th>커버리지</th></tr></thead>
                      <tbody>
                        {popData.regions.sort((a,b)=>b.solitary-a.solitary).map((d,i)=>{
                          const managed=elders.filter(e=>(e.region||'').includes(d.region)).length;
                          const managedRatio=d.solitary>0?(managed/d.solitary*100).toFixed(2):0;
                          const isHighAge=d.elderlyRatio>=20;
                          return (
                            <tr key={i} style={{background:isHighAge?'#fffbeb':'inherit'}}>
                              <td><div style={{display:'flex',alignItems:'center',gap:8}}><strong>{d.region}</strong>{isHighAge&&<span style={{fontSize:14,background:'#f59e0b',color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700}}>초고령</span>}</div></td>
                              <td>{d.total.toLocaleString()}명</td><td>{d.elderly.toLocaleString()}명</td>
                              <td><span style={{color:d.elderlyRatio>=20?'#b42318':'#344054',fontWeight:700}}>{d.elderlyRatio}%</span></td>
                              <td><strong>{d.solitary.toLocaleString()}명</strong></td>
                              <td><span style={{color:'#344054',fontWeight:700}}>{managed}명</span></td>
                              <td><span style={{color:'#344054',fontWeight:700}}>{managedRatio}%</span></td>
                              <td><div className="progress-bar" style={{width:120}}><div className="progress-fill" style={{width:`${Math.min(parseFloat(managedRatio as string)*10,100)}%`}}/></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="section">
                    <div className="section-title">기상특보 집중 케어 대상</div>
                    <div style={{fontSize:15,color:'#64748b',marginBottom:14,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span>기상청 공공데이터 경보가 발령된 지역의 어르신이에요. 오늘 안전 확인이 필요합니다.</span>
                      <span>· 기상청 단기예보 · 5분 주기 자동 갱신 · 관할 {Object.keys(weatherData).length}개 지역 (주소 자동 매핑){weatherTime && ` · 마지막 갱신 ${weatherTime}`}</span>
                      {weatherStale
                        ? <span style={{background:'#fffbeb',border:'1px solid #fde68a',color:'#b45309',padding:'1px 8px',borderRadius:6,fontWeight:700,fontSize:15}}>연동 지연 — 마지막 수신 데이터 표시 중</span>
                        : Object.keys(weatherData).length > 0 && <span style={{color:'#16a34a',fontWeight:700,fontSize:15}}>정상 연동</span>}
                    </div>
                    {(() => {
                      const ALERTS = [
                        {key:'heatwave', icon:'🌡️', label:'폭염경보', color:'#ef4444', tip:'수분 섭취·외출 자제 안내'},
                        {key:'cold', icon:'❄️', label:'한파경보', color:'#3b82f6', tip:'난방·보온 상태 확인'},
                        {key:'dust', icon:'😷', label:'미세먼지 나쁨', color:'#f59e0b', tip:'외출 자제·환기 주의'},
                        {key:'rain', icon:'🌧️', label:'호우주의보', color:'#6366f1', tip:'외출 자제·안부 확인'},
                        {key:'typhoon', icon:'🌀', label:'태풍경보', color:'#7c3aed', tip:'외출 금지·안부 확인'},
                        {key:'wildfire', icon:'🔥', label:'산불발생', color:'#ea580c', tip:'대피 안내 확인·안부 확인'},
                      ];
                      const groups = ALERTS.map(a => ({...a, list: elders.filter(e => weatherData[normalizeRegion(e.region)]?.alert === a.key)})).filter(g => g.list.length > 0);
                      if (groups.length === 0) return <div style={{color:'#16a34a',fontSize:17,padding:'20px 0',textAlign:'center'}}>현재 발령된 기상특보가 없습니다. 모든 어르신이 안전한 날씨입니다.</div>;
                      return groups.map(g => {
                        // P2-9: '확인 필요'만 노출, 오늘 통화 받은(확인 완료) 어르신은 "+N명 더보기 ▾"로 접기
                        const doneList = g.list.filter(e => getNoResponseDays(e.lastCall, e.lastCallAt) === 0);
                        const needList = g.list.filter(e => getNoResponseDays(e.lastCall, e.lastCallAt) !== 0);
                        const doneOpen = !!popDoneOpen[g.key];
                        return (
                        <div key={g.key} style={{marginBottom:16}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,fontWeight:700,color:g.color,flexWrap:'wrap'}}>
                            <span style={{fontSize:18}}>{g.icon}</span> {g.label} · {g.list.length}명 <span style={{fontWeight:400,color:'#6b7280',fontSize:16}}>({g.tip})</span>
                            <span style={{fontSize:16,fontWeight:700,color:needList.length>0?'#dc2626':'#94a3b8'}}>확인 필요 {needList.length}</span>
                            <span style={{fontSize:16,fontWeight:700,color:'#16a34a'}}>확인 완료 {doneList.length}</span>
                          </div>
                          {needList.length===0 && <div style={{fontSize:16,color:'#16a34a',fontWeight:700,marginBottom:8}}>오늘 통화에서 전원 안전 확인 완료</div>}
                          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                            {needList.map(e => (
                              <div key={e.id} style={{border:'1px solid '+g.color+'33',borderRadius:10,padding:'10px 14px',background:'#fff',minWidth:210,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                                <div>
                                  <div style={{fontWeight:700,color:'#0f172a'}}>{e.name} <span style={{fontWeight:400,fontSize:15,color:e.status==='danger'?'#ef4444':e.status==='warning'?'#f59e0b':'#9ca3af'}}>{e.status==='danger'?'· 위험':e.status==='warning'?'· 주의':''}</span></div>
                                  <div style={{fontSize:15,color:'#6b7280'}}>{e.region} · {weatherData[normalizeRegion(e.region)]?.temp}℃ · <span style={{color:'#dc2626',fontWeight:700}}>확인 필요</span></div>
                                </div>
                                <button onClick={()=>e.callActive&&setCallModal(e)} disabled={calling===e.id||!e.callActive} style={{fontSize:16,padding:'6px 12px',borderRadius:8,border:'none',background:e.callActive?g.color:'#d1d5db',color:'#fff',cursor:e.callActive?'pointer':'not-allowed',fontWeight:700,whiteSpace:'nowrap'}}>{calling===e.id?'발신 중':'앱 전화'}</button>
                              </div>
                            ))}
                            {doneOpen && doneList.map(e => (
                              <div key={e.id} style={{border:'1px solid #bbf7d0',borderRadius:10,padding:'10px 14px',background:'#f0fdf4',minWidth:210,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                                <div>
                                  <div style={{fontWeight:700,color:'#0f172a'}}>{e.name}</div>
                                  <div style={{fontSize:15,color:'#6b7280'}}>{e.region}</div>
                                </div>
                                <span style={{fontSize:16,fontWeight:800,color:'#16a34a',whiteSpace:'nowrap'}}>확인 완료{e.lastCallAt?` (${new Date(e.lastCallAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})})`:''}</span>
                              </div>
                            ))}
                          </div>
                          {doneList.length>0 && (
                            <button onClick={()=>setPopDoneOpen(p=>({...p,[g.key]:!doneOpen}))} style={{marginTop:8,background:'none',border:'none',color:'#246BEB',fontSize:16,fontWeight:700,cursor:'pointer',padding:0}}>
                              {doneOpen?'접기 ▴':`+ ${doneList.length}명 더보기 (확인 완료) ▾`}
                            </button>
                          )}
                        </div>
                      );});
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {page==='detail' && selected && (
            <div className="fade-in detail-page">
              <div className="detail-topbar">
                <button className="back-btn" onClick={()=>{setPage('elders');setSelected(null);}}>← 목록으로</button>
                <div className="detail-actions"><button className="btn-secondary" onClick={()=>openEdit(selected)}>정보 수정</button><button className="btn-danger-outline" onClick={()=>deleteElder(selected.id)}>삭제</button></div>
              </div>
              {callResult&&callResult.elderId===selected.id&&<div className={`call-result-banner ${callResult.status}`}>{callResult.message}</div>}
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-profile-summary">
                    <div className="detail-profile-copy">
                      <div className="detail-name">{selected.name}</div>
                      <div className="detail-sub">{selected.age}세 · {selected.region}</div>
                      <StatusBadge tone={selected.status || 'normal'}>{(STATUS_CONFIG[selected.status]||STATUS_CONFIG.normal).label}</StatusBadge>
                    </div>
                  </div>
                  <div className="call-action-box">
                    <button className={`btn-call-lg ${calling===selected.id?'btn-calling':''} ${!selected.callActive?'btn-disabled':''}`} onClick={()=>selected.callActive&&setCallModal(selected)} disabled={calling===selected.id||!selected.callActive}>{calling===selected.id?'발신 중...':'앱 전화 걸기'}</button>
                    {/* 앱 미설치 어르신용 — 앱 푸시를 건너뛰고 070 번호로 바로 전화 */}
                    <button
                      className={`btn-call-lg ${calling===selected.id?'btn-calling':''} ${!selected.callActive?'btn-disabled':''}`}
                      style={{marginTop:8,background:'#e8f3ff',color:'#1b64da'}}
                      onClick={()=>selected.callActive&&makeCall(selected,'pstn')}
                      disabled={calling===selected.id||!selected.callActive}
                      title="어르신 앱이 없어도 일반 전화로 걸립니다"
                    >{calling===selected.id?'발신 중...':'일반 전화 걸기'}</button>
                    <div className="detail-call-status">
                      <div><span className="detail-call-status-label">자동 발신</span><span style={{fontSize:15,fontWeight:700,padding:'4px 10px',borderRadius:6,...(selected.callActive?{background:'#dcfce7',color:'#15803d'}:{background:'#fee2e2',color:'#dc2626'})}}>{selected.callActive?'사용 중':'사용 안 함'}</span></div>
                      <button onClick={()=>toggleCallActive(selected.id)} style={{fontSize:15,fontWeight:700,padding:'7px 12px',borderRadius:7,cursor:'pointer',...(selected.callActive?{background:'#fff',color:'#475467',border:'1px solid #cdd3da'}:{background:'#246BEB',color:'#fff',border:'none'})}}>{selected.callActive?'자동 발신 끄기':'자동 발신 켜기'}</button>
                    </div>
                  </div>
                  <div className="detail-info-grid">
                    {[['성별',selected.gender==='female'?'여성':'남성'],['호칭',selected.title||'어르신'],['돌봄군',(CARE_GROUPS[selected.careGroup]||{}).label||'미지정'],['전화번호',selected.phone],['담당 복지사',selected.caregiver||'미배정'],['주소',`${selected.address||''} ${selected.addressDetail||''}`.trim()],['보호자',selected.guardian],['보호자 연락처',selected.guardianPhone],['지병',selected.disease||'없음'],['복용약',selected.medicine||'없음'],['거동상태',selected.mobility],['전화 주기',cycleLabel(selected.callCycle, selected.callDays)],['전화 시간',selected.callTime],['마지막 통화',selected.lastCall],['방문 필요',selected.visits>0?`${selected.visits}회 권고`:'불필요']].map(([label,value],i)=>(<div key={i} className="detail-info-row"><span className="detail-label">{label}</span><span style={{color:label==='방문 필요'&&selected.visits>0?'#ef4444':'inherit',fontWeight:label==='방문 필요'?700:400}}>{value}</span></div>))}
                  </div>
                </div>
                <div className="detail-right">
                  {selected.keyword&&<div className="alert-box"><div className="alert-box-title">감지된 위험 키워드</div><div className="alert-box-keyword">"{selected.keyword}"</div><div className="alert-box-desc">즉시 방문 또는 가족 연락이 필요합니다.</div></div>}
                  <div className="section">
                    <div className="script-editor-header" style={{marginBottom:12}}>
                      <div className="section-title" style={{marginBottom:0}}>통화 기록</div>
                    </div>
                    {(()=>{
                      // 통화기록 메뉴와 동일한 서버 데이터(callsHistory)에서 이 어르신만 필터 (이름 또는 전화번호 매칭)
                      const mine = callsHistory.filter(c=>c.elderName===selected.name||(c.phone&&selected.phone&&String(c.phone).replace(/\D/g,'')===String(selected.phone).replace(/\D/g,'')));
                      if(mine.length===0) return <div style={{color:'#9ca3af',fontSize:17,padding:'16px 0'}}>통화 기록 없음</div>;
                      return mine.map(c=>{
                        const R=RISK_CONFIG[c.riskLevel]||{};
                        const hm=c.at?new Date(c.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
                        const dur=c.durationSec||0;
                        return (
                          <div key={c.id} className={`call-row ${c.riskLevel==='critical'?'call-row-danger':c.riskLevel==='urgent'?'call-row-warning':''}`}>
                            <div style={{minWidth:96,color:'#64748b',fontSize:16}}>{c.date} {hm}</div>
                            <div style={{minWidth:64,color:'#64748b',fontSize:16}}>{Math.floor(dur/60)}분 {dur%60}초</div>
                            <div style={{minWidth:44,fontWeight:700,fontSize:16,color:R.color||'#16a34a'}}>{R.label||'정상'}</div>
                            <button className="btn-small" disabled={!!draftingCallId||!c.transcript}
                              title={c.transcript?'이 통화 내용을 일지 작성 창에 채워서 엽니다':'통화 내용이 없어 초안을 만들 수 없습니다'}
                              onClick={()=>openNoteForCall(c)}
                              style={{marginLeft:'auto',fontSize:15,fontWeight:700}}>
                              {draftingCallId===c.id?'초안 생성 중…':'일지 작성'}
                            </button>
                            <div style={{flexBasis:'100%'}}><CallTranscript text={c.transcript} /></div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="section">
                    <div className="script-editor-header" style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div className="section-title" style={{marginBottom:0}}>상담·방문 일지</div>
                      <button className="btn-primary" style={{fontSize:16,padding:'6px 12px'}} onClick={()=>openNewNote({elderPhone:selected.phone,elderName:selected.name})}>＋ 일지 작성</button>
                    </div>
                    {(()=>{
                      const mineNotes=caseNotes.filter(n=>String(n.elderPhone||'').replace(/\D/g,'')===String(selected.phone||'').replace(/\D/g,''));
                      if(mineNotes.length===0) return <div style={{color:'#9ca3af',fontSize:17,padding:'8px 0'}}>상담·방문 일지 없음</div>;
                      return mineNotes.map(n=>{
                        const tmeta=CASE_TYPE_META[n.type]||CASE_TYPE_META.etc;
                        const d=n.visitedAt?new Date(n.visitedAt):null;
                        const when=d?`${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}`:'';
                        return (
                          <div key={n.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',marginBottom:8,background:'#fff'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                              <span style={{color:'#64748b',fontSize:15,fontWeight:600}}>{when}</span>
                              <span style={{fontSize:14,fontWeight:700,color:tmeta.color,background:tmeta.bg,padding:'2px 8px',borderRadius:20}}>{tmeta.label}</span>
                              <span style={{fontSize:15,color:'#64748b'}}>{CASE_CAT_META[n.category]||'기타'}</span>
                              {n.linkedAlertId&&<span style={{fontSize:14,color:'#dc2626',fontWeight:700}}>알림 대응</span>}
                              {isAutoDraft(n)&&<AutoDraftBadge/>}
                              <span style={{flex:1}}/>
                              <button onClick={()=>copyNote(n, n.id)} style={{background:'none',border:'none',color:'#16a34a',fontSize:15,fontWeight:700,cursor:'pointer'}} title="붙여넣기용 텍스트 복사">{copiedNoteId===n.id?'복사됨':'복사'}</button>
                              <button onClick={()=>openEditNote(n)} style={{background:'none',border:'none',color:'#246BEB',fontSize:15,fontWeight:700,cursor:'pointer'}}>수정</button>
                              <button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:15,fontWeight:700,cursor:'pointer'}}>삭제</button>
                            </div>
                            {n.content&&<div style={{fontSize:16,color:'#1f2937',marginTop:5,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{n.content}</div>}
                            {n.action&&<div style={{fontSize:15,color:'#475569',marginTop:4}}><b style={{color:'#0f766e'}}>조치</b> {n.action}</div>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 영실이 콘솔(총괄 관리자 전용) — GCP 콘솔 참고: 좌측 카드형 상태 요약 + 초록/빨강 인디케이터 +
              깔끔한 데이터 테이블. 기관 대시보드와 완전히 별개 화면이라 여기서 뭘 해도 기관 데이터엔 영향 없다. */}
          {page==='console' && (
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
          )}

          {page==='consoleSubscriptions' && (
            <div className="fade-in">
              <section className="section">
                <div className="script-editor-header" style={{marginBottom:10}}>
                  <div className="section-title" style={{marginBottom:0}}>
                    정기결제 현황 ({consoleSubs.length}개 기관)
                    <span style={{marginLeft:10, fontSize:12, fontWeight:500, color:'#94a3b8'}}>정액제 자동결제(포트원 빌링키) 등록 여부·다음 청구일 — 조회 전용</span>
                  </div>
                  <button className={`btn-download ${consoleSubsLoading?'btn-calling':''}`} onClick={fetchConsoleSubscriptions} disabled={consoleSubsLoading}>
                    {consoleSubsLoading ? '조회 중...' : '새로고침'}
                  </button>
                </div>
                {consoleSubs.length === 0 ? (
                  <div style={{color:'#5f6368', fontSize:14, padding:'20px 4px'}}>
                    {consoleSubsLoading ? '불러오는 중...' : '기관 데이터가 없습니다'}
                  </div>
                ) : (
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
                      <thead>
                        <tr style={{textAlign:'left', color:'#5f6368', borderBottom:'1px solid #dadce0'}}>
                          <th style={{padding:'8px 10px', fontWeight:500}}>기관명</th>
                          <th style={{padding:'8px 10px', fontWeight:500}}>요금제</th>
                          <th style={{padding:'8px 10px', fontWeight:500}}>대상자</th>
                          <th style={{padding:'8px 10px', fontWeight:500}}>월 청구액</th>
                          <th style={{padding:'8px 10px', fontWeight:500}}>자동결제</th>
                          <th style={{padding:'8px 10px', fontWeight:500}}>다음 청구일</th>
                          <th style={{padding:'8px 10px', fontWeight:500}}>최근 오류</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consoleSubs.map(s => (
                          <tr key={s.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                            <td style={{padding:'10px'}}>{s.orgName || s.orgId}</td>
                            <td style={{padding:'10px'}}>{s.plan || '미설정'}</td>
                            <td style={{padding:'10px'}}>{s.elderCount}명</td>
                            <td style={{padding:'10px'}}>{s.monthlyAmount != null ? `${s.monthlyAmount.toLocaleString()}원` : '-'}</td>
                            <td style={{padding:'10px'}}>
                              <span style={{
                                fontSize:12, fontWeight:600, padding:'2px 10px', borderRadius:12,
                                background: s.autoRenew ? '#e6f4ea' : '#f1f3f4',
                                color: s.autoRenew ? '#1e8e3e' : '#5f6368',
                              }}>{s.autoRenew ? '등록됨' : '미등록'}</span>
                            </td>
                            <td style={{padding:'10px', color:'#5f6368'}}>{s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleDateString('ko-KR') : '-'}</td>
                            <td style={{padding:'10px', color: s.lastChargeError ? '#c5221f' : '#5f6368', fontSize:12}}>{s.lastChargeError || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {page==='help' && <HelpGuide orgCode={me?.orgCode} />}

          {page==='forms' && (
            <div className="fade-in forms-page">
              <div className="data-banner" style={{marginBottom:20}}>
                <div><div className="data-banner-title">보고서·서식</div><div className="data-banner-sub">제출·보관용 서식을 한곳에서 확인하고 내려받으세요 · 월을 바꾸면 현황이 갱신됩니다</div></div>
                <input type="month" className="form-input" style={{width:170,margin:0}} value={formsYm} onChange={e=>{setFormsYm(e.target.value);setReportMonth(e.target.value);}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:14}}>
                {[
                  { icon:'', title:'주간업무 보고서', desc:'지원사가 주차별 작성(음성→텍스트)한 보고서 — 검토·오타 수정 후 출력', badge:`${formsYm.split('-')[1]}월 ${formsCounts.weekly}명 작성`,
                    btns:[ {label:'열람·수정·출력', primary:true, on:()=>openWeeklyReport(formsYm)}, {label:'일괄 출력', on:()=>printWeeklyBatchFor(formsYm)} ] },
                  { icon:'', title:'급여제공 일정표', desc:'일별 제공시간(주말·공휴일 1.5배, 월 120시간 한도) — 공식 달력 양식 출력', badge:`${formsYm.split('-')[1]}월 ${formsCounts.sched}명 작성`,
                    btns:[ {label:'입력·출력', primary:true, on:()=>openSchedule(formsYm)}, {label:'일괄 출력', on:()=>printScheduleBatchFor(formsYm)} ] },
                  { icon:'', title:'상담·방문일지 엑셀', desc:'일지 전체를 엑셀로 — 기관 보관·결재용', badge:`최근 90일 ${caseNotes.length}건`,
                    btns:[ {label:'엑셀 다운로드', primary:true, on:()=>exportNotesXlsx(caseNotes)} ] },
                  { icon:'', title:'월간 실적 보고서', desc:'통화·안전확인·위험감지·일지 실적 종합 — 지자체 보고용 엑셀', badge:`${formsYm.split('-')[1]}월 기준`,
                    btns:[ {label: monthlyBusy?'생성 중…':'엑셀 다운로드', primary:true, on:()=>downloadMonthlyReport(formsYm)} ] },
                ].map(card=>(
                  <div key={card.title} className="section" style={{display:'flex',flexDirection:'column',gap:10,margin:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                                            <div style={{flex:1}}>
                        <div style={{fontSize:18,fontWeight:900,color:'#1e3a6e'}}>{card.title}</div>
                        <div style={{fontSize:15,color:'#64748b',marginTop:2}}>{card.desc}</div>
                      </div>
                    </div>
                    <div><span style={{fontSize:15,fontWeight:800,color:'#246BEB',background:'#eff6ff',border:'1px solid #bfdbfe',padding:'3px 10px',borderRadius:20}}>{card.badge}</span></div>
                    <div style={{display:'flex',gap:8,marginTop:'auto',flexWrap:'wrap'}}>
                      {card.btns.map(b=>(
                        <button key={b.label} className={b.primary?'btn-primary':'btn-secondary'} style={{padding:'9px 16px',fontSize:16}} onClick={b.on}>{b.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:15,color:'#94a3b8',marginTop:14}}>주간업무 보고서·급여제공 일정표의 '저장'은 로컬 파일(엑셀)로 저장됩니다. 인쇄(PDF)는 각 화면의 양식 인쇄 버튼을 사용하세요.</div>
            </div>
          )}

          {page==='admin' && (
            <div className="fade-in">
              {!isStaffUp ? (
                <div className="section" style={{textAlign:'center',color:'#94a3b8',padding:40}}>접근 권한이 없습니다.</div>
              ) : (
              <>
                {adminMsg && <div className="success-banner" style={{marginBottom:16}}>{adminMsg}</div>}

                {/* 기관 정보 — 주소·관할 지역 (기상 공공데이터 연동 기준, R1·R5) */}
                {!isSuper && (
                  <div className="section" style={{marginBottom:16}}>
                    <div className="section-title">기관 정보</div>
                    <div style={{display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'}}>
                      <div><div style={{fontSize:15,color:'#94a3b8',marginBottom:2}}>기관명</div><div style={{fontWeight:800}}>{me?.orgName||'-'}{me?.orgCode?` (${me.orgCode})`:''}</div></div>
                      <div><div style={{fontSize:15,color:'#94a3b8',marginBottom:2}}>관할 지역</div><div style={{fontWeight:800,color:me?.orgRegion?'#16a34a':'#dc2626'}}>{me?.orgRegion||'미설정'}</div></div>
                      <div style={{flex:1,minWidth:200}}><div style={{fontSize:15,color:'#94a3b8',marginBottom:2}}>주소</div><div style={{fontSize:17}}>{me?.orgAddress||'미입력 — 주소를 등록하면 관할 지역 기상특보가 자동 연동됩니다'}</div></div>
                      <button className="btn-secondary" onClick={saveOrgAddress}>{me?.orgAddress?'주소 변경':'주소 등록'}</button>
                    </div>
                  </div>
                )}

                {/* 경보 자동 안부콜 — 기본은 수동(대시보드 알림만), 켜면 감지 시 자동 발신 */}
                {!isSuper && (
                  <div className="section" style={{marginBottom:16}}>
                    <div className="section-title">경보 자동 안부콜 설정</div>
                    <div style={{fontSize:15,color:'#64748b',marginBottom:14}}>
                      꺼두면(기본) 감지 시 대시보드 알림만 오고, 전화멘트 페이지에서 직접 발송을 눌러야 합니다.
                      켜면 감지 즉시 서버가 자동으로 안부콜을 발신합니다.
                    </div>
                    {[
                      { key: 'autoForestFireCall' as const, label: '산불위험 자동 안부콜',
                        desc: '산불위험지수 경계·심각 감지 시, 해당 지역 어르신에게만 자동 대피 안내 통화' },
                      { key: 'autoWeatherAlertCall' as const, label: '기상경보 자동 안부콜',
                        desc: '폭염·한파·호우 등 감지 시 어르신 전원에게 자동 안부 통화' },
                      { key: 'autoDisasterCall' as const, label: '긴급재난문자 자동 안부콜',
                        desc: '위급·긴급 재난문자 수신 시, 해당 지역 어르신에게만 자동 안내 통화 (야간 07~21시 외 발신 안 함)' },
                    ].map(row => (
                      <label key={row.key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:'1px solid #f1f5f9',cursor:'pointer'}}>
                        <input
                          type="checkbox"
                          checked={!!me?.[row.key]}
                          disabled={alertSettingSaving === row.key}
                          onChange={e => updateAlertSetting(row.key, e.target.checked)}
                          style={{width:20,height:20,flexShrink:0}}
                        />
                        <div style={{flex:1}}>
                          <div style={{fontWeight:800,fontSize:16}}>{row.label}{alertSettingSaving===row.key?' (저장 중…)':''}</div>
                          <div style={{fontSize:14,color:'#94a3b8'}}>{row.desc}</div>
                        </div>
                        <span style={{fontSize:14,fontWeight:800,color:me?.[row.key]?'#16a34a':'#94a3b8'}}>{me?.[row.key]?'켜짐':'꺼짐'}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* 구성원 초대 링크 — 센터장: 센터장·전담직원·지원사 / 전담직원: 지원사만 */}
                <div className="section admin-invite-section">
                  <div className="admin-invite-heading">
                    <div><div className="section-title">구성원 초대</div><p>역할을 선택해 전용 가입 링크를 발급하세요. 링크는 7일 동안 한 번만 사용할 수 있습니다.</p></div>
                  </div>
                  <div className="admin-invite-create">
                    <label htmlFor="invite-role">초대할 역할</label>
                    <select id="invite-role" className="form-input" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                      {grantableRoles.map(r=>(<option key={r} value={r}>{ROLE_KO[r]}</option>))}
                    </select>
                    <button className="btn-primary" onClick={createInvite}><Plus size={17}/> 초대 링크 만들기</button>
                  </div>
                  {invites.length>0 && (
                    <div className="admin-invite-list"><div className="admin-invite-list-title">사용 가능한 초대 링크 <span>{invites.length}</span></div><table className="table">
                      <thead><tr><th>역할</th><th>초대 링크</th><th>만든 사람</th><th>유효기간</th><th>관리</th></tr></thead>
                      <tbody>
                        {invites.map(v=>(
                          <tr key={v.code}>
                            <td><StatusBadge tone="normal">{ROLE_KO[v.role]||v.role}</StatusBadge></td>
                            <td><span className="admin-invite-link" title={inviteLink(v.code)}>{inviteLink(v.code)}</span></td>
                            <td style={{fontSize:16,color:'#64748b'}}>{(v.createdBy||'').split('@')[0]}</td>
                            <td style={{fontSize:16,color:'#64748b'}}>{v.expiresAt?new Date(v.expiresAt).toLocaleDateString('ko-KR'):'-'}</td>
                            <td><div className="admin-invite-actions">
                              <button className="btn-small" onClick={()=>copyInvite(v.code)}><Copy size={15}/>{copiedInvite===v.code?'복사됨':'복사'}</button>
                              <button className="btn-danger-outline" onClick={()=>deleteInvite(v.code)}>초대 취소</button>
                            </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}
                  {invites.length===0 && <div className="admin-invite-empty">현재 사용 가능한 초대 링크가 없습니다.</div>}
                </div>

                {isSuper && (<>
                {/* 새 기관 만들기 */}
                <div className="section" style={{marginBottom:16}}>
                  <div className="section-title">새 기관(복지관) 만들기</div>
                  <div style={{fontSize:16,color:'#64748b',marginBottom:10}}>기관을 만들면 <b>기관코드</b>가 자동 발급됩니다. 이 코드를 복지사에게 전달하면, 복지사가 어르신 폰 앱에 입력해 해당 기관으로 등록됩니다.</div>
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
                  <div className="section-title">기관 목록 ({orgs.length})</div>
                  <table className="table">
                    <thead><tr><th>기관명</th><th>유형</th><th>기관코드</th><th>대상자</th><th>계정</th></tr></thead>
                    <tbody>
                      {orgs.length===0 && <tr><td colSpan={5} style={{textAlign:'center',color:'#94a3b8',padding:24}}>기관이 없습니다</td></tr>}
                      {orgs.map(o=>(
                        <tr key={o.orgId}>
                          <td><strong>{o.name}</strong></td>
                          <td><StatusBadge tone="normal">{ORG_TYPE_KO[o.orgType]||'노인맞춤돌봄'}</StatusBadge></td>
                          <td><span className="cycle-badge" style={{fontFamily:'monospace',fontWeight:800,letterSpacing:1,color:'#246BEB',background:'#eff6ff'}}>{o.code}</span></td>
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
                  <div className="section-title">새 구성원 계정 만들기</div>
                  <div style={{fontSize:16,color:'#64748b',marginBottom:10}}>구성원의 로그인 계정을 직접 만듭니다. <b>지원사</b> 계정은 배정된 이용자만 볼 수 있습니다.</div>
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
                      <div className="form-field"><label className="form-label">소속 기관</label><div style={{fontSize:17,fontWeight:700,color:'#1e3a6e',padding:'8px 0'}}>{me?.orgName||'우리 기관'}{me?.orgCode?` (${me.orgCode})`:''}</div></div>
                    </>)}
                  </div>
                  <button className="btn-primary" style={{marginTop:12,padding:'10px 20px'}} onClick={createAccount}>+ 계정 생성</button>
                </div>

                {/* 계정 목록 */}
                <div className="section">
                  <div className="section-title">대시보드 계정 ({accounts.length})</div>
                  <table className="table">
                    <thead><tr><th>이름</th><th>전화번호</th><th>이메일</th><th>소속 기관</th><th>역할</th><th>관리</th></tr></thead>
                    <tbody>
                      {accounts.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#94a3b8',padding:24}}>계정이 없습니다</td></tr>}
                      {accounts.map(u=>{
                        const org = orgs.find(o=>o.orgId===u.orgId);
                        return (
                          <tr key={u.uid}>
                            <td><strong>{u.name||'—'}</strong>{u.uid===me?.uid&&<span style={{fontSize:14,color:'#16a34a',marginLeft:6}}>(나)</span>}</td>
                            <td style={{fontSize:16,color:'#64748b'}}>{u.phone||'—'}</td>
                            <td style={{fontSize:16,color:'#64748b'}}>{u.email}</td>
                            <td style={{fontSize:16,color:'#64748b'}}>{org?org.name:(me?.orgName||u.orgId)}</td>
                            <td>{u.role==='superadmin'?<StatusBadge tone="warning">운영자</StatusBadge>:<StatusBadge tone="normal">{ROLE_KO[u.role]||'센터장(관리자)'}</StatusBadge>}</td>
                            <td>{(u.role!=='superadmin'&&u.uid!==me?.uid&&isAdmin)?<button className="btn-danger-outline" style={{fontSize:15,padding:'4px 10px'}} onClick={()=>deleteAccount(u.uid,u.email)}>삭제</button>:<span style={{color:'#cbd5e1',fontSize:15}}>—</span>}</td>
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
            <div className="fade-in register-page">
              <button className="back-btn" onClick={()=>setPage(editMode?'detail':'elders')}><ArrowLeft size={18}/> 돌아가기</button>
              {saveSuccess&&<div className="success-banner">{editMode?'수정이 완료되었습니다!':'어르신 등록이 완료되었습니다!'}</div>}
              <div className="step-bar">
                {[{n:1,label:'기본 정보'},{n:2,label:'보호자 정보'},{n:3,label:'AI 전화 설정'}].map(step=>(<div key={step.n} className={`step-item ${formStep===step.n?'step-active':formStep>step.n?'step-done':''}`}><div className="step-circle">{formStep>step.n?<CheckCircle2 size={18}/>:step.n}</div><div className="step-label">{step.label}</div>{step.n<3&&<div className="step-line"/>}</div>))}
              </div>
              <div className="form-card">
                {formStep===1&&(<div className="fade-in"><div className="form-section-title">기본 정보</div><div className="form-grid">
                  <div className="form-field full-width"><label className="form-label">성별 <span className="required">*</span></label><div className="gender-group">{[{value:'female',Icon:UserRoundCheck,label:'여성'},{value:'male',Icon:UserRound,label:'남성'}].map(g=>(<label key={g.value} className={`gender-option ${form.gender===g.value?'gender-selected':''}`} onClick={()=>setForm(f=>({...f,gender:g.value,title:TITLE_OPTIONS[g.value][0]}))}><g.Icon size={26} color={form.gender===g.value?'#164fba':'#6d7882'}/><span style={{fontWeight:700}}>{g.label}</span></label>))}</div></div>
                  <div className="form-field full-width"><label className="form-label">호칭 (전화 시 사용)</label><div className="radio-group">{(TITLE_OPTIONS[form.gender]||[]).map(t=>(<label key={t} className={`radio-option ${form.title===t?'radio-selected':''}`}><input type="radio" name="title" value={t} checked={form.title===t} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{display:'none'}}/>{t}</label>))}</div><div style={{fontSize:15,color:'#94a3b8',marginTop:6}}>전화 시 "{form.title}, 안녕하세요. 저 영실이인데요~" 라고 시작합니다</div></div>
                  <div className="form-field"><label className="form-label">이름 <span className="required">*</span></label><input {...inp('name')} placeholder="예: 김순자"/>{formErrors.name&&<div className="error-msg">{formErrors.name}</div>}</div>
                  <div className="form-field"><label className="form-label">나이 <span className="required">*</span></label><input {...inp('age')} type="number" placeholder="예: 78"/>{formErrors.age&&<div className="error-msg">{formErrors.age}</div>}</div>
                  <div className="form-field"><label className="form-label">전화번호 <span className="required">*</span></label><input {...inp('phone')} placeholder="예: 010-1234-5678"/>{formErrors.phone&&<div className="error-msg">{formErrors.phone}</div>}</div>
                  <div className="form-field"><label className="form-label">주민등록번호 <span style={{fontSize:14,color:'#94a3b8'}}>(급여제공 일정표의 생년월일에 사용)</span></label><input className="form-input" value={form.jumin||''} inputMode="numeric" maxLength={14} placeholder="000000-0000000" onChange={e=>{const d=e.target.value.replace(/[^0-9]/g,'').slice(0,13);setForm(f=>({...f,jumin:d.length>6?`${d.slice(0,6)}-${d.slice(6)}`:d}));}}/></div>
                  <div className="form-field"><label className="form-label">관할 구역 <span style={{fontSize:14,color:'#94a3b8'}}>(주소에서 자동)</span></label><input className="form-input" value={form.region||''} readOnly placeholder="주소 검색 시 자동 입력" style={{background:'#f8fafc'}}/></div>
                  <div className="form-field full-width"><label className="form-label">주소 <span className="required">*</span></label><div className="form-inline-control"><input {...inp('address')} placeholder="주소 검색을 눌러 선택"/><button type="button" className="btn-secondary" onClick={openAddressSearch}>주소 검색</button></div>{formErrors.address&&<div className="error-msg">{formErrors.address}</div>}</div>
                  <div className="form-field full-width"><label className="form-label">상세 주소 <span style={{fontSize:14,color:'#94a3b8'}}>(아파트 동/호수 등)</span></label><input {...inp('addressDetail')} placeholder="예: 101동 1202호"/></div>
                  <div className="form-field"><label className="form-label">지병</label><input {...inp('disease')} placeholder="예: 고혈압, 당뇨"/></div>
                  <div className="form-field"><label className="form-label">복용 중인 약</label><input {...inp('medicine')} placeholder="예: 혈압약"/></div>
                  <div className="form-field full-width"><label className="form-label">거동 상태</label><div className="radio-group">{['독립보행 가능','보조기구 필요','거동 불가'].map(opt=><label key={opt} className={`radio-option ${form.mobility===opt?'radio-selected':''}`}><input type="radio" name="mobility" value={opt} checked={form.mobility===opt} onChange={e=>setForm(f=>({...f,mobility:e.target.value}))} style={{display:'none'}}/>{opt}</label>)}</div></div>
                  <div className="form-field full-width"><label className="form-label">담당 복지사</label><div className="form-inline-control"><select {...inp('caregiver')}><option value="">선택 안 함</option>{[...new Set([...caregivers, ...elders.map(e=>e.caregiver).filter(Boolean)])].map(c=><option key={c} value={c}>{c}</option>)}</select><button type="button" className="btn-secondary" onClick={addCaregiver}><Plus size={17}/> 추가</button></div></div>
                  <div className="form-field full-width"><label className="form-label">복지사 전화번호</label><input {...inp('caregiverPhone')} placeholder="010-0000-0000" /></div>
                  <div className="form-field full-width"><label className="form-label">담당 지원사 배정 <span style={{fontSize:14,color:'#94a3b8'}}>(지원사 계정 — 배정하면 그 지원사에게 이 어르신이 보입니다)</span></label>
                    <select className="form-input" value={form.assignedTo||''} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>
                      <option value="">배정 안 함</option>
                      {accounts.filter(u=>u.role==='worker'||u.role==='staff').map(u=>(<option key={u.uid} value={u.email}>{u.name||u.email.split('@')[0]} ({ROLE_KO[u.role]})</option>))}
                    </select>
                  </div>
                </div><div className="form-footer"><button className="btn-primary btn-lg" onClick={nextStep}>다음 단계 →</button></div></div>)}
                {formStep===2&&(<div className="fade-in"><div className="form-section-title">보호자 정보</div><div className="form-grid"><div className="form-field"><label className="form-label">보호자 이름 <span className="required">*</span></label><input {...inp('guardian')} placeholder="예: 김민준"/>{formErrors.guardian&&<div className="error-msg">{formErrors.guardian}</div>}</div><div className="form-field"><label className="form-label">보호자 연락처 <span className="required">*</span></label><input {...inp('guardianPhone')} placeholder="예: 010-9876-5432"/>{formErrors.guardianPhone&&<div className="error-msg">{formErrors.guardianPhone}</div>}</div></div><div className="form-info-box">위험 키워드 감지 시 보호자에게 즉시 알림이 발송됩니다.</div><div className="form-footer"><button className="btn-secondary btn-lg" onClick={()=>setFormStep(1)}>← 이전</button><button className="btn-primary btn-lg" onClick={nextStep}>다음 단계 →</button></div></div>)}
                {formStep===3&&(<div className="fade-in"><div className="form-section-title">AI 전화 설정</div><div className="form-grid">{!isDisability&&<div className="form-field full-width"><label className="form-label">돌봄군 (노인맞춤돌봄서비스)</label><div className="radio-group">{[{value:'',label:'미지정'},{value:'general',label:'일반돌봄군'},{value:'intensive',label:'중점돌봄군'}].map(opt=><label key={opt.value} className={`radio-option ${form.careGroup===opt.value?'radio-selected':''}`}><input type="radio" name="careGroup" value={opt.value} checked={(form.careGroup||'')===opt.value} onChange={()=>{const g=CARE_GROUPS[opt.value];setForm(f=>({...f,careGroup:opt.value,...(g?{callCycle:'custom',callDays:[...g.days]}:{})}));}} style={{display:'none'}}/>{opt.label}</label>)}</div><div style={{fontSize:15,color:'#94a3b8',marginTop:6}}>선택하면 전화 안전확인 권장 주기가 자동 적용됩니다 (일반 주 2회 · 중점 주 1회, 아래에서 수정 가능). 미지정은 기존 주기 그대로.</div></div>}<div className="form-field full-width"><label className="form-label">전화 주기</label><div className="radio-group">{[{value:'daily',label:'매일'},{value:'custom',label:'요일 지정'}].map(opt=><label key={opt.value} className={`radio-option ${form.callCycle===opt.value?'radio-selected':''}`}><input type="radio" name="callCycle" value={opt.value} checked={form.callCycle===opt.value} onChange={e=>setForm(f=>({...f,callCycle:e.target.value}))} style={{display:'none'}}/>{opt.label}</label>)}</div>{form.callCycle==='custom'&&<div style={{marginTop:10}}><div style={{fontSize:16,color:'#64748b',marginBottom:6}}>요일 선택 (여러 개 가능)</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{['월','화','수','목','금','토','일'].map(d=>{const sel=(form.callDays||[]).includes(d);return <button type="button" key={d} onClick={()=>setForm(f=>{const days=f.callDays||[];return{...f,callDays:sel?days.filter(x=>x!==d):[...days,d]};})} style={{padding:'8px 16px',borderRadius:8,border:sel?'2px solid #246BEB':'1px solid #d1d5db',background:sel?'#eff6ff':'#fff',color:sel?'#246BEB':'#374151',fontWeight:700,fontSize:17,cursor:'pointer'}}>{d}</button>;})}</div></div>}</div><div className="form-field full-width"><label className="form-label">전화 시간</label>{(()=>{const [hh,mm]=(form.callTime||'09:00').split(':').map(Number);const ampm=hh<12?'오전':'오후';const h12=(hh%12)||12;const set=(a,h,m)=>{let H=h%12;if(a==='오후')H+=12;setForm(f=>({...f,callTime:`${String(H).padStart(2,'0')}:${String(m).padStart(2,'0')}`}));};return(<div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginTop:4}}><select className="form-input" style={{width:100,fontSize:18,fontWeight:700}} value={ampm} onChange={e=>set(e.target.value,h12,mm)}><option value="오전">오전</option><option value="오후">오후</option></select><select className="form-input" style={{width:90,fontSize:18,fontWeight:700}} value={h12} onChange={e=>set(ampm,Number(e.target.value),mm)}>{Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h}>{h}시</option>)}</select><select className="form-input" style={{width:90,fontSize:18,fontWeight:700}} value={mm} onChange={e=>set(ampm,h12,Number(e.target.value))}>{[0,10,20,30,40,50].map(m=><option key={m} value={m}>{String(m).padStart(2,'0')}분</option>)}</select></div>);})()}</div></div><div className="summary-box"><div className="summary-title">등록 정보 확인</div><div className="summary-grid">{[['이름',form.name],['나이',`${form.age}세`],['전화번호',form.phone],['지역',form.region],['담당 복지사',form.caregiver||'미배정'],['담당 지원사',(accounts.find(u=>u.email===form.assignedTo)||{}).name||form.assignedTo||'미배정'],['보호자',form.guardian],['보호자 연락처',form.guardianPhone],['전화 주기',cycleLabel(form.callCycle, form.callDays)],['전화 시간',form.callTime]].map(([label,value])=><div key={label} className="summary-row"><span className="summary-label">{label}</span><span className="summary-value">{value}</span></div>)}</div></div><div className="form-footer"><button className="btn-secondary btn-lg" onClick={()=>setFormStep(2)}>← 이전</button><button className="btn-success btn-lg" onClick={saveElder}>{editMode?'수정 완료':'등록 완료'}</button></div></div>)}
              </div>
            </div>
          )}

          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
