// DashboardApplication.tsx에서 분리한 순수 상수·헬퍼 — 컴포넌트 state에 의존하지 않는 값들이라
// 안전하게 별도 파일로 뺄 수 있다(6000줄짜리 단일 파일을 줄이는 첫 단계, 2026-09-04).
import {
  LayoutGrid, Activity, Users, ShieldCheck, Phone, CalendarDays, MessageSquare,
  PencilLine, FileText, BarChart3, Database, Building2, BookOpen, RotateCw,
  CreditCard, Landmark, Banknote, Terminal,
} from 'lucide-react';
import { PAGES } from '../constants/app';

export const EMPTY_FORM = { name:'', age:'', gender:'female', title:'할머니', region:'', address:'', addressDetail:'', phone:'', jumin:'', caregiver:'', caregiverPhone:'', assignedTo:'', guardian:'', guardianPhone:'', disease:'', medicine:'', mobility:'독립보행 가능', careGroup:'', callCycle:'daily', callDays:[], callTime:'09:00', callActive:true };

// 지역명 정규화 — 주소검색(Daum Postcode)으로 등록하면 "대구 북구"처럼 시·도가 축약형으로
// 통일되는데, CSV 일괄등록은 셀 값을 그대로 저장해 "대구광역시 북구"처럼 다른 표기가 섞였다.
// 그 결과 경보 대상 화면의 지역 필터·자동선택이 같은 구를 서로 다른 그룹으로 갈라 보여주는
// 사고가 있었다(실사용 지적). 시·도 전체 이름은 축약형으로, 그 외(로마자 지명 등 오기입)는
// 그대로 통과시킨다 — 자동 번역/추정은 하지 않는다.
const SIDO_FULL_TO_SHORT: Record<string,string> = {'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','강원도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
export const normalizeRegion = (region: any) => {
  const s = String(region||'').trim().replace(/\s+/g,' ');
  if (!s) return s;
  const tokens = s.split(' ');
  return [SIDO_FULL_TO_SHORT[tokens[0]] || tokens[0], ...tokens.slice(1)].join(' ');
};

// 콘솔 통화 이력은 최대 500건까지 한 번에 내려오므로 테이블 페이지네이션 기준 페이지당 건수
export const HISTORY_PAGE_SIZE = 25;

// 포트원 Bank 코드 → 한글 은행명(주요 시중은행만, 나머지는 코드 그대로 표시)
export const REFUND_REASON_PRESETS = ['단순 변심', '중복 결제', '서비스 이용 안 함', '결제 오류(금액·수단 착오)', '요금제 변경으로 인한 환불', '직접 입력'];
export const PAY_METHOD_OPTIONS = [
  { key:'CARD', label:'카드', desc:'신용·체크카드', icon: CreditCard },
  { key:'TRANSFER', label:'실시간 계좌이체', desc:'즉시 출금·완료', icon: Landmark },
  { key:'VIRTUAL_ACCOUNT', label:'무통장입금', desc:'계좌 발급 후 입금', icon: Banknote },
];
export const BANK_LABELS: Record<string,string> = {
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
export const UPGRADE_PLANS = [
  { key:'trial',    name:'시범사업', price:'무료',      unit:'30일',    features:['관리자 대시보드','전화 발신 관리','3단계 위험 감지','119·보호자 자동연결','통화 기록'] },
  { key:'basic',     name:'베이직',   price:'11,000원', unit:'인·월',   features:['시범사업 전체 포함','건강 상태 추적','전화멘트 관리'] },
  { key:'standard',  name:'스탠다드', price:'13,000원', unit:'인·월',   features:['베이직 전체 포함','리포트 / 통계','공공데이터 연동(산불·폭염·재난)'], recommended:true },
  { key:'premium',   name:'프리미엄', price:'19,000원', unit:'인·월',   features:['스탠다드 전체 포함','방문 필요·현장출동 연계','IoT 연동'] },
];
// 같은 문서 §3 "충전 단위별 도달 통화 수(3분 무선 기준)" — 정량제(선불 충전식, 지금 쓰는 방식) 충전 단위.
// 정액제와 달리 매월 고정 요금이 아니라 발신한 만큼만 차감되므로 "플랜"이 아니라 "충전 금액"을 고른다.
export const CHARGE_TIERS = [
  { key:'c30',  amount:300000,  calls:'약 350통',   usage:'주 1회 50명 1.6개월 · 특보 발신 300명 1회' },
  { key:'c50',  amount:500000,  calls:'약 585통',   usage:'주 1회 50명 2.7개월 · 특보 발신 300명 2회', recommended:true },
  { key:'c100', amount:1000000, calls:'약 1,170통', usage:'주 1회 100명 2.7개월 · 특보 발신 300명 4회' },
];

// 주민등록번호 앞 6자리 → 생년월일 (7번째 자리로 세기 판정: 1·2=1900년대, 3·4=2000년대)
export const juminToBirth = (jumin: any) => {
  const d = String(jumin||'').replace(/[^0-9]/g,'');
  if (d.length < 7) return '';
  const century = ['1','2','5','6'].includes(d[6]) ? '19' : '20';
  return `${century}${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4,6)}`;
};

// 노인맞춤돌봄서비스 돌봄군 — 전화 안전확인 권장 주기(제도 기준): 일반돌봄군 주 2회, 중점돌봄군 주 1회(방문이 주 2회라 전화는 1회)
export const CARE_GROUPS = {
  general:   { label: '일반돌봄군', weeklyCalls: 2, days: ['월','목'], color: '#246BEB' },
  intensive: { label: '중점돌봄군', weeklyCalls: 1, days: ['수'],     color: '#7c3aed' },
};

export const TITLE_OPTIONS = {
  female: ['할머니', '어머니', '여사님'],
  male:   ['할아버지', '아버지', '어르신'],
};

export const DEFAULT_SCRIPT = `{{호칭}}, 안녕하세요. 저 영실이인데요~
오늘 하루 어떻게 보내고 계세요?
식사는 하셨나요? 꼭 챙겨 드셔야 해요.
{{경보멘트}}
혹시 몸이 불편하신 곳은 없으세요?
무슨 일 있으시면 언제든지 말씀해 주세요.
그럼 저 영실이가 또 연락드릴게요. 건강하게 지내세요.`;

export const ALERT_TEMPLATES: Record<string,string> = {
  heatwave: `{{기관명}}에서 전해드려요. 오늘 {{지역}}에 폭염경보가 발령되었어요. 한낮에는 밖에 나가지 마시고 시원한 곳에서 쉬세요. 목이 마르지 않아도 물을 자주 드시고, 선풍기나 에어컨을 켜 두세요. 어지럽거나 기운이 없으시면 바로 시원한 곳에 누워 쉬시고, {{보호자}}나 저희에게 꼭 알려주세요. 몸이 불편하시면 언제든 말씀해 주세요.`,
  cold:     `{{기관명}}에서 전해드려요. 오늘 {{지역}}에 한파경보가 발령되었어요. 오늘은 되도록 밖에 나가지 마시고 따뜻한 실내에 계세요. 꼭 나가셔야 하면 모자와 장갑, 두꺼운 옷을 챙겨 입으세요. 보일러는 아끼지 마시고 따뜻하게 켜 두시고, 수도가 얼지 않게 물을 조금 틀어 두시면 좋아요. 미끄러운 길 조심하시고, 몸이 안 좋으시면 {{보호자}}나 저희에게 바로 알려주세요.`,
  dust:     `{{기관명}}에서 전해드려요. 오늘 {{지역}} 미세먼지가 매우 나쁨이에요. 오늘은 되도록 밖에 나가지 마시고, 창문도 닫아 두세요. 꼭 나가셔야 하면 마스크를 꼭 쓰시고, 다녀오신 뒤에는 손과 얼굴을 씻으세요. 물을 자주 드시면 목이 덜 칼칼해요. 숨이 차거나 기침이 심해지면 {{보호자}}나 저희에게 꼭 알려주세요.`,
  rain:     `{{기관명}}에서 전해드려요. 오늘 {{지역}}에 호우주의보가 내렸어요. 비가 많이 오니 오늘은 되도록 외출하지 마세요. 꼭 나가셔야 하면 우산을 챙기시고, 미끄러운 길과 물이 고인 곳을 조심하세요. 집 안에 물이 새거나 잠기면 무리해서 치우지 마시고 {{보호자}}나 저희에게 바로 알려주세요. 천둥 번개가 칠 때는 전기 제품을 잠시 꺼 두시는 게 안전해요.`,
  typhoon:  `{{기관명}}에서 전해드려요. 지금 {{지역}}이 태풍 영향권에 들었어요. 오늘은 절대 밖에 나가지 마시고 안전한 실내에 계세요. 창문은 꼭 닫아 잠그시고, 창문에서 떨어진 곳에 계세요. 정전이 될 수 있으니 손전등과 휴대폰을 가까이 두시고, 휴대폰은 미리 충전해 두세요. 무섭거나 걱정되는 일이 있으면 {{보호자}}나 저희에게 언제든 연락하세요. 위급할 때는 119예요.`,
  wildfire: `{{기관명}}에서 전해드려요. 오늘 {{지역}} 인근에 산불이 발생했어요. 창문을 닫아 연기가 들어오지 않게 하시고, 마을 안내 방송에 귀 기울여 주세요. 대피 안내가 있으면 신발과 겉옷, 휴대폰만 챙겨 바로 따라 나서세요. 혼자 움직이기 힘드시면 {{보호자}}나 저희에게 바로 연락 주시고, 위급하면 119에 전화하세요. 놀라지 마시고, 안내대로 하시면 안전해요.`,
  none:     ``,
};

// 산불 3단계 대본 (발생 초기 → 긴급 대피 → 안전 확인). 각 단계는 응답 분기(괜찮아/도와줘)로 마무리.
export const WILDFIRE_STAGES = [
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
export const DEFAULT_QUESTIONS = [
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
export function fillAlertVars(text: any, elder: any, shelter: any, fireLoc: any, orgName: any) {
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
export const NAV_LUCIDE: Record<string, any> = {
  dashboard: LayoutGrid, health: Activity, elders: Users, safety: ShieldCheck,
  calls: Phone, report: BarChart3, schedule: CalendarDays, script: MessageSquare,
  casenotes: PencilLine, forms: FileText, data: Database, admin: Building2, help: BookOpen,
  console: Terminal,
};
export const NavIcon = ({ name }: { name: string }) => {
  const I = NAV_LUCIDE[name] || LayoutGrid;
  return <I size={18} strokeWidth={1.75} aria-hidden="true" />;
};

// 새로고침 아이콘 (헤더)
export const RefreshIcon = () => <RotateCw size={13} strokeWidth={2} aria-hidden="true" />;
export const RESTORABLE_PAGES = [...PAGES, 'detail'];
// 엑셀 기능은 실제 다운로드 시점에만 로드한다. 초기 화면에서 약 300KB 라이브러리를 메모리에 올리지 않는다.
export const loadXLSX = () => import('xlsx');
// 백그라운드 탭에서는 화면 갱신용 폴링을 멈춰 네트워크·메모리 churn을 줄인다.
export const whileVisible = (fn: () => void) => () => { if (!document.hidden) fn(); };
