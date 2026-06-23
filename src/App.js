import { useState, useEffect, useRef } from 'react';
import './App.css';

const SERVER_URL = 'https://youngsili-server-production.up.railway.app';
const CAREGIVERS = ['신주환', '이정훈', '박미경'];
const INIT_ELDERS = [
  { id: 1, name: '김순자', age: 78, gender:'female', title:'할머니', region: '대구 북구',   address: '대구 북구 침산동 123',   phone: '010-1234-5678', caregiver: '신주환', guardian: '김민준', guardianPhone: '010-9876-5432', disease: '고혈압, 당뇨',  medicine: '혈압약',  mobility: '보조기구 필요',   status: 'danger',  lastCall: '오늘 09:12', keyword: '가슴이 아파', visits: 2, callCycle: 'daily',      callTime: '09:00', callActive: true  },
  { id: 2, name: '이철수', age: 82, gender:'male',   title:'할아버지', region: '대구 달서구', address: '대구 달서구 월성동 456', phone: '010-2345-6789', caregiver: '신주환', guardian: '이영희', guardianPhone: '010-8765-4321', disease: '관절염',       medicine: '진통제',  mobility: '독립보행 가능',   status: 'warning', lastCall: '오늘 10:45', keyword: '어지러워',  visits: 1, callCycle: 'daily',      callTime: '10:00', callActive: true  },
  { id: 3, name: '박영희', age: 75, gender:'female', title:'할머니', region: '대구 수성구', address: '대구 수성구 범어동 789', phone: '010-3456-7890', caregiver: '이정훈', guardian: '박철호', guardianPhone: '010-7654-3210', disease: '없음',          medicine: '없음',    mobility: '독립보행 가능',   status: 'normal',  lastCall: '오늘 11:20', keyword: null,        visits: 0, callCycle: 'every2days', callTime: '11:00', callActive: true  },
  { id: 4, name: '최동수', age: 80, gender:'male',   title:'할아버지', region: '대구 중구',   address: '대구 중구 대봉동 321',   phone: '010-4567-8901', caregiver: '이정훈', guardian: '최지영', guardianPhone: '010-6543-2109', disease: '심장병',       medicine: '심장약',  mobility: '보조기구 필요',   status: 'normal',  lastCall: '어제 15:30', keyword: null,        visits: 0, callCycle: 'weekly',     callTime: '15:00', callActive: false },
  { id: 5, name: '정말순', age: 71, gender:'female', title:'어머니', region: '대구 동구',   address: '대구 동구 신천동 654',   phone: '010-5678-9012', caregiver: '박미경', guardian: '정대호', guardianPhone: '010-5432-1098', disease: '골다공증',     medicine: '칼슘제',  mobility: '독립보행 가능',   status: 'warning', lastCall: '오늘 08:55', keyword: '넘어졌어',  visits: 1, callCycle: 'daily',      callTime: '09:00', callActive: true  },
  { id: 6, name: '한복남', age: 85, gender:'male',   title:'아버지', region: '대구 서구',   address: '대구 서구 평리동 987',   phone: '010-6789-0123', caregiver: '박미경', guardian: '한미래', guardianPhone: '010-4321-0987', disease: '치매 초기',    medicine: '치매약',  mobility: '보조기구 필요',   status: 'normal',  lastCall: '오늘 13:10', keyword: null,        visits: 0, callCycle: 'daily',      callTime: '13:00', callActive: true  },
];

const PUBLIC_DATA = [
  { region: '북구',   total: 4820, managed: 312, ratio: 6.5 },
  { region: '달서구', total: 6210, managed: 418, ratio: 6.7 },
  { region: '수성구', total: 3940, managed: 267, ratio: 6.8 },
  { region: '중구',   total: 2180, managed: 156, ratio: 7.2 },
  { region: '동구',   total: 5130, managed: 341, ratio: 6.6 },
  { region: '서구',   total: 3760, managed: 249, ratio: 6.6 },
];

const INIT_CALL_LOGS = [
  { id: 1, elderId: 1, date: '오늘', time: '09:12', duration: '4분 32초', keywords: ['가슴이 아파', '119'], risk: 'critical', type: 'auto' },
  { id: 2, elderId: 2, date: '오늘', time: '10:45', duration: '3분 18초', keywords: ['어지러워'],            risk: 'urgent',   type: 'auto' },
  { id: 3, elderId: 3, date: '오늘', time: '11:20', duration: '5분 02초', keywords: [],                     risk: 'normal',   type: 'auto' },
  { id: 4, elderId: 5, date: '오늘', time: '08:55', duration: '2분 47초', keywords: ['넘어졌어'],            risk: 'urgent',   type: 'auto' },
];

const WEEKLY_DATA = [
  { day: '월', calls: 5, danger: 1, warning: 2 },
  { day: '화', calls: 6, danger: 0, warning: 1 },
  { day: '수', calls: 4, danger: 2, warning: 1 },
  { day: '목', calls: 7, danger: 1, warning: 3 },
  { day: '금', calls: 5, danger: 0, warning: 2 },
  { day: '토', calls: 3, danger: 1, warning: 0 },
  { day: '일', calls: 4, danger: 0, warning: 1 },
];

const STATUS_CONFIG = {
  danger:  { label: '위험', color: '#ef4444', bg: '#fef2f2' },
  warning: { label: '주의', color: '#f59e0b', bg: '#fffbeb' },
  normal:  { label: '정상', color: '#22c55e', bg: '#f0fdf4' },
};
const RISK_CONFIG = {
  critical: { label: '긴급', color: '#ef4444' },
  urgent:   { label: '주의', color: '#f59e0b' },
  normal:   { label: '정상', color: '#22c55e' },
};
const EMPTY_FORM = { name:'', age:'', gender:'female', title:'할머니', region:'대구 북구', address:'', phone:'', caregiver:'', guardian:'', guardianPhone:'', disease:'', medicine:'', mobility:'독립보행 가능', callCycle:'daily', callTime:'09:00', callActive:true };

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
  typhoon:  `{{지역}} 태풍 영향권에 들어있어요. 외출을 삼가시고 안전한 실내에 계세요.`,
  wildfire: `오늘 {{지역}} 인근에 산불이 발생했어요. 안내 방송에 귀 기울이시고, 대피 안내가 있으면 꼭 따르세요. 위급하면 119로 연락하세요.`,
  none:     ``,
};

const WEATHER_DATA = {
  '대구 북구':   { temp: 36, condition: '폭염', alert: 'heatwave', alertText: '폭염경보' },
  '대구 달서구': { temp: 35, condition: '폭염', alert: 'heatwave', alertText: '폭염경보' },
  '대구 수성구': { temp: 28, condition: '맑음', alert: 'none',     alertText: '' },
  '대구 중구':   { temp: 34, condition: '폭염', alert: 'heatwave', alertText: '폭염경보' },
  '대구 동구':   { temp: 18, condition: '비',   alert: 'rain',     alertText: '호우주의보' },
  '대구 서구':   { temp: 29, condition: '흐림', alert: 'none',     alertText: '' },
};

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
  const [page, setPage]         = useState('dashboard');
  const [elders, setElders] = useState(() => {
    try {
      const saved = localStorage.getItem('youngsili_elders');
      return saved ? JSON.parse(saved) : INIT_ELDERS;
    } catch { return INIT_ELDERS; }
  });
  const [callLogs, setCallLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('youngsili_callLogs');
      return saved ? JSON.parse(saved) : INIT_CALL_LOGS;
    } catch { return INIT_CALL_LOGS; }
  });
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState('all');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [formStep, setFormStep] = useState(1);
  const [searchName, setSearchName]   = useState('');
  const [regionFilter, setRegionFilter] = useState('전체');
  const [sortBy, setSortBy]           = useState('status');
  const [viewMode, setViewMode]       = useState('card');
  const [todoChecked, setTodoChecked] = useState([]);
  const [memoText, setMemoText]       = useState('');
  const [memos, setMemos]             = useState([
    { id: 1, text: '김순자 할머니 딸 연락 옴 - 다음주 방문 예정', time: '09:30', done: false },
    { id: 2, text: '오후 2시 팀 회의 있음', time: '08:00', done: false },
  ]);
  const [healthData, setHealthData]     = useState([]);
  const [alertsData, setAlertsData]     = useState([]);
  const [alertCount, setAlertCount]     = useState(0);
  const [healthLoading, setHealthLoading] = useState(false);

  // ── 통계(리포트) 상태 ──
  const [statsRange, setStatsRange]       = useState('month'); // week | month | 3month | custom
  const [statsFrom, setStatsFrom]         = useState('');
  const [statsTo, setStatsTo]             = useState('');
  const [statsData, setStatsData]         = useState(null);    // 현재 기간 /stats
  const [statsPrev, setStatsPrev]         = useState(null);    // 직전 기간(추이 비교용)
  const [statsLoading, setStatsLoading]   = useState(false);

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
      const [cur, prev] = await Promise.all([
        fetch(`${SERVER_URL}/stats?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
        fetch(`${SERVER_URL}/stats?from=${prevFrom.toISOString()}&to=${prevTo.toISOString()}`).then(r => r.json()),
      ]);
      setStatsData(cur); setStatsPrev(prev);
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

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const [hRes, aRes] = await Promise.all([
        fetch(`${SERVER_URL}/health/all`),
        fetch(`${SERVER_URL}/alerts`),
      ]);
      const hData = await hRes.json();
      const aData = await aRes.json();
      setHealthData(hData);
      setAlertsData(aData);
      setAlertCount(aData.filter(a => !a.read).length);
    } catch (err) {
      console.error('건강 데이터 오류:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => { if (page === 'health') fetchHealth(); }, [page]); // eslint-disable-line
  useEffect(() => { if (page === 'report') fetchStats(); }, [page, statsRange, statsFrom, statsTo]); // eslint-disable-line
  // 통화 시각 ISO → "오늘 14:23" / "어제 09:10" / "6/14 15:30"
  const formatCallTime = (iso) => {
    if (!iso) return '아직 없음';
    const d = new Date(iso), now = new Date();
    const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `오늘 ${hm}`;
    if (d.toDateString() === yest.toDateString()) return `어제 ${hm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  };

  useEffect(() => {
  const t = setInterval(() => {
    fetch(`${SERVER_URL}/alerts`).then(r=>r.json()).then(data => {
      setAlertsData(data);
      const unread = data.filter(a=>!a.read);
      setAlertCount(unread.length);
      // 어르신별 "가장 최근" 위험 알림만 반영 (data는 최신순 → 이름별 첫 항목이 최신)
      const latestByName = {};
      unread.forEach(a => {
        if ((a.level === 'critical' || a.level === 'urgent') && !latestByName[a.name]) {
          latestByName[a.name] = a;
        }
      });
      setElders(prev => prev.map(e => {
        const a = latestByName[e.name];
        if (!a) return e;
        // keyword 필드 없으면(구버전 서버) message의 "감지: 뒤"를 파싱
        const kw = a.keyword || (a.message ? a.message.split('감지:').pop().trim() : '') || a.message;
        return {
          ...e,
          status: a.level === 'critical' ? 'danger' : 'warning',
          keyword: kw,
          keywordAt: a.timestamp,
        };
      }));
    }).catch(()=>{});
    // 최근 통화 → 마지막 통화 시각/상태 실시간 갱신 (위험 없어도 항상)
    fetch(`${SERVER_URL}/calls/recent`).then(r=>r.json()).then(calls => {
      setElders(prev => prev.map(e => {
        const c = calls[e.name];
        if (!c) return e;
        return { ...e, lastCall: formatCallTime(c.timestamp), lastCallRisk: c.riskLevel, lastTranscript: c.transcript };
      }));
    }).catch(()=>{});
  }, 5000);
  return () => clearInterval(t);
}, []); // eslint-disable-line

  const [popData, setPopData]       = useState(null);
  const [popLoading, setPopLoading] = useState(false);
  const [popError, setPopError]     = useState(null);

  const fetchPopulation = async () => {
    setPopLoading(true); setPopError(null);
    try {
      const res = await fetch(`${SERVER_URL}/population`);
      const data = await res.json();
      setPopData(data);
    } catch { setPopError('데이터를 불러오지 못했습니다.'); }
    finally { setPopLoading(false); }
  };

  useEffect(() => { if (page === 'data' && !popData) fetchPopulation(); }, [page]); // eslint-disable-line
  useEffect(() => { localStorage.setItem('youngsili_elders', JSON.stringify(elders)); }, [elders]);
  useEffect(() => { localStorage.setItem('youngsili_callLogs', JSON.stringify(callLogs)); }, [callLogs]);
  useEffect(() => {
    setCallLogs(prev => prev.map(log => {
      if (log.duration === '연결 중...' || log.duration?.includes('재발신') || log.duration?.includes('발신 중')) {
        return { ...log, duration: '❌ 연결 실패 (미응답)', callStatus: 'failed', risk: 'urgent' };
      }
      return log;
    }));
  }, []); // eslint-disable-line

  const [mainScript, setMainScript]     = useState(DEFAULT_SCRIPT);
  const [editScript, setEditScript]     = useState(DEFAULT_SCRIPT);
  const [activeAlert, setActiveAlert]   = useState('none');
  const [alertScript, setAlertScript]   = useState(ALERT_TEMPLATES.none);
  const [previewElder, setPreviewElder] = useState(null);
  const [scriptSaved, setScriptSaved]   = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherTime, setWeatherTime] = useState('');
  const [weatherData, setWeatherData]   = useState(WEATHER_DATA);
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
  const bulkRef = useRef(false);

  const danger  = elders.filter(e => e.status==='danger').length;
  const warning = elders.filter(e => e.status==='warning').length;
  const normal  = elders.filter(e => e.status==='normal').length;
  const filtered = filter==='all' ? elders : elders.filter(e => e.status===filter); // eslint-disable-line
  const cycleLabel = c => c==='daily'?'매일':c==='every2days'?'격일':'주 1회';

  const getNoResponseDays = (lastCall) => {
    if (!lastCall || lastCall === '아직 없음') return 99;
    if (lastCall.includes('오늘')) return 0;
    if (lastCall.includes('어제')) return 1;
    if (lastCall.includes('2일')) return 2;
    if (lastCall.includes('3일')) return 3;
    return 99;
  };

  const getSolitudeRisk = (elder) => {
    let score = 0;
    const days = getNoResponseDays(elder.lastCall);
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
    .filter(e => filter === 'all' || e.status === filter)
    .filter(e => regionFilter === '전체' || e.region === regionFilter)
    .filter(e => searchName === '' || e.name.includes(searchName))
    .sort((a, b) => {
      if (sortBy === 'status') { const order = { danger: 0, warning: 1, normal: 2 }; return order[a.status] - order[b.status]; }
      if (sortBy === 'risk') { const riskOrder = { high: 0, medium: 1, low: 2 }; return riskOrder[getSolitudeRisk(a).level] - riskOrder[getSolitudeRisk(b).level]; }
      if (sortBy === 'noResponse') return getNoResponseDays(b.lastCall) - getNoResponseDays(a.lastCall);
      if (sortBy === 'age') return b.age - a.age;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const buildPreview = (elder) => {
    const alertMsg = activeAlert !== 'none' ? alertScript.replace(/{{지역}}/g, elder?.region || '') : '';
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
      const res = await fetch(`${SERVER_URL}/weather`);
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
  const openDetail = elder => { setSelected(elder); setCallResult(null); setPage('detail'); };
  const openRegister = () => { setForm(EMPTY_FORM); setFormStep(1); setFormErrors({}); setSaveSuccess(false); setEditMode(false); setPage('register'); };
  const openEdit = elder => { setForm({...elder}); setFormStep(1); setFormErrors({}); setSaveSuccess(false); setEditMode(true); setPage('register'); };

  const smartElders = (() => {
    if (smartFilter==='danger')  return elders.filter(e=>e.status==='danger'||e.status==='warning');
    if (smartFilter==='noCall')  return elders.filter(e=>e.lastCall==='아직 없음'||e.lastCall.includes('어제')||e.lastCall.includes('2일'));
    if (smartFilter==='active')  return elders.filter(e=>e.callActive);
    return elders;
  })();

  const toggleCheck = id => setChecked(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const checkAll    = () => setChecked(smartElders.map(e=>e.id));
  const uncheckAll  = () => setChecked([]);
  const applySmartFilter = f => { setSmartFilter(f); setChecked([]); };

  // ── 일괄 발신 (FCM 앱 푸시) ──
  const startBulkCall = async () => {
    if (checked.length === 0) return;
    const queue = elders.filter(e => checked.includes(e.id));
    setBulkQueue(queue); setBulkDone([]); setBulkRunning(true); bulkRef.current = true;
    for (const elder of queue) {
      if (!bulkRef.current) break;
      setBulkCurrent(elder.id);
      try {
        const res = await fetch(`${SERVER_URL}/call/app`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            elderName:    elder.name,
            elderTitle:   elder.title || '어르신',
            region:       elder.region,
            script:       mainScript,
            alertMessage: activeAlert !== 'none' ? alertScript.replace(/{{지역}}/g, elder.region) : '',
          }),
        });
        const data = await res.json();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
        setBulkDone(prev => [...prev, { id: elder.id, success: data.success }]);
        if (data.success) {
          setCallLogs(prev => [{ id: Date.now(), elderId: elder.id, date:'오늘', time:timeStr, duration:'📱 앱 수신 대기', keywords:[], risk:'normal', type:'manual', callStatus:'ringing' }, ...prev]);
          setElders(prev => prev.map(e => e.id===elder.id ? {...e, lastCall:`오늘 ${timeStr}`} : e));
        }
      } catch {
        setBulkDone(prev => [...prev, { id: elder.id, success: false }]);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    setBulkCurrent(null); setBulkRunning(false); bulkRef.current = false;
  };

  const stopBulkCall = () => { bulkRef.current = false; setBulkRunning(false); setBulkCurrent(null); };

  // ── 단건 전화 (FCM 앱 푸시) ──
  const makeCall = async elder => {
    setCallModal(null); setCalling(elder.id); setCallResult(null);
    const logId = Date.now();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    try {
      const res = await fetch(`${SERVER_URL}/call/app`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          elderName:    elder.name,
          elderTitle:   elder.title || '어르신',
          region:       elder.region,
          script:       mainScript,
          alertMessage: activeAlert !== 'none' ? alertScript.replace(/{{지역}}/g, elder.region) : '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCallLogs(prev => [{id:logId, elderId:elder.id, date:'오늘', time:timeStr, duration:'📱 앱 수신 대기', keywords:[], risk:'normal', type:'manual', callStatus:'ringing'},...prev]);
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
    setElders(prev=>prev.map(e=>e.id===id?{...e,callActive:!e.callActive}:e));
    if (selected?.id===id) setSelected(prev=>({...prev,callActive:!prev.callActive}));
  };

  const validateStep = step => {
    const errors = {};
    if (step===1) { if(!form.name.trim()) errors.name='이름을 입력하세요'; if(!form.age) errors.age='나이를 입력하세요'; if(!form.phone.trim()) errors.phone='전화번호를 입력하세요'; if(!form.address.trim()) errors.address='주소를 입력하세요'; }
    if (step===2) { if(!form.guardian.trim()) errors.guardian='보호자 이름을 입력하세요'; if(!form.guardianPhone.trim()) errors.guardianPhone='보호자 연락처를 입력하세요'; }
    setFormErrors(errors); return Object.keys(errors).length===0;
  };
  const nextStep = () => { if(validateStep(formStep)) setFormStep(s=>s+1); };
  const saveElder = () => {
    if (editMode) { setElders(prev=>prev.map(e=>e.id===form.id?{...e,...form}:e)); setSelected(prev=>({...prev,...form})); }
    else setElders(prev=>[...prev,{...form,id:Date.now(),status:'normal',lastCall:'아직 없음',keyword:null,visits:0,age:parseInt(form.age),callActive:true}]);
    setSaveSuccess(true);
    setTimeout(()=>{setSaveSuccess(false);setPage(editMode?'detail':'elders');},1800);
  };
  const deleteElder = id => { if(window.confirm('정말 삭제하시겠습니까?')){setElders(prev=>prev.filter(e=>e.id!==id));setPage('elders');setSelected(null);} };
  const inp = field => ({ value:form[field]??'', onChange:e=>setForm(f=>({...f,[field]:e.target.value})), className:`form-input ${formErrors[field]?'input-error':''}` });

  const totalCalls = callLogs.length;
  const criticalCount = callLogs.filter(c=>c.risk==='critical').length;
  const urgentCount   = callLogs.filter(c=>c.risk==='urgent').length;
  const manualCount   = callLogs.filter(c=>c.type==='manual').length;

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

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">영</div>
          <div><div className="logo-title">영실이</div><div className="logo-sub">복지사 관리 시스템</div></div>
        </div>
        <nav className="nav">
          {[
            {id:'dashboard', icon:'⊞', label:'대시보드'},
            {id:'elders',    icon:'👥', label:'어르신 관리'},
            {id:'schedule',  icon:'📅', label:'전화 발신 관리'},
            {id:'script',    icon:'✍️', label:'전화 멘트 관리'},
            {id:'calls',     icon:'📞', label:'통화 기록'},
            {id:'health', icon:'💊', label: alertCount > 0 ? `💊 건강 상태 🔴${alertCount}` : '💊 건강 상태'},
            {id:'report',    icon:'📊', label:'리포트 / 통계'},
            {id:'data',      icon:'🗺️', label:'공공데이터 현황'},
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
            <div><div className="worker-name">김복지 사회복지사</div><div className="worker-region">대구광역시</div></div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div className="header-title">
            {page==='dashboard'&&'대시보드'}{page==='elders'&&'어르신 관리'}{page==='schedule'&&'전화 발신 관리'}
            {page==='calls'&&'통화 기록'}{page==='script'&&'전화 멘트 관리'}{page==='report'&&'리포트 / 통계'}{page==='data'&&'공공데이터 현황'}{page==='health'&&'💊 건강 상태 현황'}
            {page==='detail'&&'어르신 상세 정보'}{page==='register'&&(editMode?'어르신 정보 수정':'어르신 신규 등록')}
          </div>
          <div className="header-date">{new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</div>
        </header>

        <div className="content">

          {page==='dashboard' && (
            <div className="fade-in">
              {(() => {
                const alerts = [];
                // 1) 통화 중 위험 키워드 감지 — 서버 알림(alertsData) 직접 표시 (키워드+시각, localStorage 매칭 무관)
                //    keyword 필드가 비어도(구버전 서버) message에서 "감지: 뒤"를 파싱해 키워드만 깔끔히.
                alertsData
                  .filter(a => !a.read && (a.level === 'critical' || a.level === 'urgent'))
                  .slice(0, 10)
                  .forEach(a => {
                    const kw = a.keyword || (a.message ? a.message.split('감지:').pop().trim() : '') || a.message;
                    const el = elders.find(e => e.name === a.name);
                    alerts.push({ elder: el, name: a.name, msg: `"${kw}" 위험 키워드 감지`, time: a.timestamp, color: a.level === 'critical' ? '#ef4444' : '#f59e0b', bg: a.level === 'critical' ? '#fef2f2' : '#fffbeb', icon: '🚨' });
                  });
                // 2) 미응답 (어르신 데이터 기반)
                elders.forEach(e => {
                  const days = getNoResponseDays(e.lastCall);
                  if (days >= 3) alerts.push({ elder: e, type: 'noResponse', msg: `${days}일째 미응답 → 즉시 확인 필요`, color: '#ef4444', bg: '#fef2f2', icon: '📵' });
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
                    <div className="section-title">✅ 오늘 할 일</div>
                    <div className="todo-list">
                      {[
                        { id:'noResponse', icon:'📵', label:`미응답 어르신 확인`, count: elders.filter(e=>getNoResponseDays(e.lastCall)>=1).length, color:'#ef4444' },
                        { id:'callToday',  icon:'📱', label:`오늘 앱 알림 예정`,  count: elders.filter(e=>e.callActive).length, color:'#1d4ed8' },
                        { id:'visit',      icon:'🏠', label:`방문 필요`,          count: elders.filter(e=>e.visits>0).length, color:'#16a34a' },
                        { id:'heatwave',   icon:'🌡️', label:`폭염경보 안전 확인`, count: elders.filter(e=>weatherData[e.region]?.alert==='heatwave').length, color:'#f59e0b' },
                      ].map(item => (
                        <div key={item.id} className={`todo-item ${todoChecked.includes(item.id)?'todo-done':''}`}
                          onClick={()=>setTodoChecked(prev=>prev.includes(item.id)?prev.filter(x=>x!==item.id):[...prev,item.id])}>
                          <div className="todo-check">{todoChecked.includes(item.id)?'✅':'⬜'}</div>
                          <div className="todo-icon">{item.icon}</div>
                          <div className="todo-label">{item.label}</div>
                          {item.count > 0 && <div className="todo-count" style={{background:item.color}}>{item.count}명</div>}
                        </div>
                      ))}
                    </div>
                    <div className="todo-progress"><div className="todo-progress-bar" style={{width:`${todoChecked.length/4*100}%`}}/></div>
                    <div className="todo-progress-label">{todoChecked.length}/4 완료</div>
                  </div>

                  <div className="section">
                    <div className="section-title">📞 오늘 통화 현황</div>
                    <div className="call-summary">
                      <div className="call-stat"><div className="call-num">{totalCalls}건</div><div className="call-label">총 통화</div></div>
                      <div className="call-stat"><div className="call-num" style={{color:'#ef4444'}}>{criticalCount}건</div><div className="call-label">긴급 키워드</div></div>
                      <div className="call-stat"><div className="call-num" style={{color:'#f59e0b'}}>{urgentCount}건</div><div className="call-label">주의 키워드</div></div>
                      <div className="call-stat"><div className="call-num" style={{color:'#3b82f6'}}>{manualCount}건</div><div className="call-label">수동 전화</div></div>
                    </div>
                    <div style={{marginTop:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                        <span style={{color:'#64748b',fontWeight:600}}>오늘 통화 완료율</span>
                        <span style={{fontWeight:800,color:'#1d4ed8'}}>{Math.round(totalCalls/elders.length*100)}%</span>
                      </div>
                      <div className="todo-progress"><div className="todo-progress-bar" style={{width:`${totalCalls/elders.length*100}%`}}/></div>
                    </div>
                  </div>

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
                    <div className="section-title">🗺️ 지역별 현황</div>
                    <div className="region-map">
                      {['대구 북구','대구 달서구','대구 수성구','대구 중구','대구 동구','대구 서구'].map(region => {
                        const regionElders = elders.filter(e => e.region === region);
                        const regionDanger = regionElders.filter(e => e.status==='danger').length;
                        const regionWarning = regionElders.filter(e => e.status==='warning').length;
                        const weather = weatherData[region];
                        const riskLevel = regionDanger > 0 ? 'danger' : regionWarning > 0 ? 'warning' : 'normal';
                        return (
                          <div key={region} className={`region-card region-${riskLevel}`} onClick={()=>{setRegionFilter(region);goPage('elders');}}>
                            <div className="region-name">{region.replace('대구 ','')}</div>
                            <div className="region-count">{regionElders.length}명</div>
                            <div className="region-status">
                              {regionDanger > 0 && <span className="region-dot-danger">{regionDanger}위험</span>}
                              {regionWarning > 0 && <span className="region-dot-warning">{regionWarning}주의</span>}
                              {regionDanger===0 && regionWarning===0 && <span className="region-dot-normal">정상</span>}
                            </div>
                            {weather?.alertText && <div className="region-alert">{weather.alertText}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

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

                  <div className="section">
                    <div className="section-title">🚨 즉시 확인 필요</div>
                    <div className="alert-list">
                      {elders.filter(e=>e.status!=='normal').length === 0
                        ? <div style={{color:'#22c55e',fontWeight:700,padding:'12px 0'}}>✅ 위험 어르신 없음</div>
                        : elders.filter(e=>e.status!=='normal').map(elder=>(
                          <div key={elder.id} className={`alert-card alert-${elder.status}`}>
                            <div className="alert-left" onClick={()=>openDetail(elder)} style={{cursor:'pointer',flex:1}}>
                              <div className={`status-dot dot-${elder.status}`}/>
                              <div>
                                <div className="alert-name">{elder.gender==='female'?'👵':'👴'} {elder.name} ({elder.age}세)</div>
                                <div className="alert-region">{elder.region}</div>
                              </div>
                              {elder.keyword&&<div className="keyword-tag">"{elder.keyword}"</div>}
                            </div>
                            <div className="alert-right">
                              <div className={`status-badge badge-${elder.status}`}>{STATUS_CONFIG[elder.status].label}</div>
                              <button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'발신 중':'📱 앱 전화'}</button>
                            </div>
                          </div>
                        ))
                      }
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
                      const days = getNoResponseDays(elder.lastCall);
                      return (
                        <tr key={elder.id} style={{cursor:'pointer'}} onClick={()=>openDetail(elder)}>
                          <td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:18}}>{elder.gender==='female'?'👵':'👴'}</span><span style={{fontWeight:700}}>{elder.name}</span>{elder.keyword&&<span className="keyword-tag">"{elder.keyword}"</span>}</div></td>
                          <td>{elder.age}세</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.region}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.lastCall}</td>
                          <td>{days===0?<span style={{color:'#22c55e',fontWeight:700,fontSize:12}}>정상</span>:<span style={{color:days>=3?'#ef4444':'#f59e0b',fontWeight:700,fontSize:12}}>{days>=99?'미통화':`${days}일`}</span>}</td>
                          <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                          <td><div className={`status-badge badge-${elder.status}`}>{STATUS_CONFIG[elder.status].label}</div></td>
                          <td onClick={e=>e.stopPropagation()}><button className={`btn-call-sm ${calling===elder.id?'btn-calling':''}`} onClick={()=>setCallModal(elder)} disabled={calling===elder.id}>{calling===elder.id?'⏳':'📱 전화'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page==='schedule' && (
            <div className="fade-in">
              <div className="bulk-toolbar">
                <div className="bulk-left">
                  <div className="bulk-title">스마트 선택</div>
                  <div className="smart-filters">
                    {[{id:'all',label:'전체',count:elders.length},{id:'danger',label:'⚠️ 위험/주의만',count:elders.filter(e=>e.status!=='normal').length},{id:'noCall',label:'📵 미통화',count:elders.filter(e=>e.lastCall==='아직 없음'||e.lastCall.includes('어제')).length},{id:'active',label:'✅ 활성만',count:elders.filter(e=>e.callActive).length}].map(f=>(
                      <button key={f.id} className={`smart-btn ${smartFilter===f.id?'smart-active':''}`} onClick={()=>applySmartFilter(f.id)}>{f.label} <span className="filter-count">{f.count}</span></button>
                    ))}
                  </div>
                </div>
                <div className="bulk-right">
                  <span className="check-count">{checked.length}명 선택됨</span>
                  <button className="btn-secondary" onClick={checkAll}>전체선택</button>
                  <button className="btn-secondary" onClick={uncheckAll}>선택해제</button>
                  {!bulkRunning
                    ? <button className={`btn-bulk-call ${checked.length===0?'btn-disabled':''}`} onClick={startBulkCall} disabled={checked.length===0}>📱 앱 알림 발신 ({checked.length}명)</button>
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
                  <div className="bulk-result-list">
                    {bulkQueue.map(elder=>{
                      const done = bulkDone.find(d=>d.id===elder.id);
                      const isCurrent = bulkCurrent===elder.id;
                      return (
                        <div key={elder.id} className={`bulk-result-item ${isCurrent?'bulk-current':done?done.success?'bulk-success':'bulk-fail':''}`}>
                          <div className="table-avatar">{elder.name[0]}</div>
                          <span className="bulk-name">{elder.name}</span>
                          <span className="bulk-phone">{elder.phone}</span>
                          <span className="bulk-status-icon">{isCurrent?'⏳ 발신 중':done?done.success?'✅ 성공':'❌ 실패':'⏸ 대기'}</span>
                        </div>
                      );
                    })}
                  </div>
                  {!bulkRunning && bulkDone.length>0 && (
                    <div className="bulk-summary">
                      <span className="bulk-success-count">✅ 성공 {bulkDone.filter(d=>d.success).length}건</span>
                      <span className="bulk-fail-count">❌ 실패 {bulkDone.filter(d=>!d.success).length}건</span>
                      <button className="btn-secondary" onClick={()=>{setBulkDone([]);setBulkQueue([]);setChecked([]);}}>닫기</button>
                    </div>
                  )}
                </div>
              )}

              <table className="table">
                <thead><tr><th style={{width:40}}><input type="checkbox" checked={checked.length===smartElders.length&&smartElders.length>0} onChange={e=>e.target.checked?checkAll():uncheckAll()} className="cb"/></th><th>어르신</th><th>전화번호</th><th>담당 복지사</th><th>전화 주기</th><th>전화 시간</th><th>마지막 통화</th><th>상태</th><th>중단/재개</th></tr></thead>
                <tbody>
                  {smartElders.map(elder=>{
                    const done = bulkDone.find(d=>d.id===elder.id);
                    return (
                      <tr key={elder.id} className={`${checked.includes(elder.id)?'row-checked':''} ${done?done.success?'row-success':'row-fail':''}`}>
                        <td><input type="checkbox" checked={checked.includes(elder.id)} onChange={()=>toggleCheck(elder.id)} className="cb"/></td>
                        <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="table-avatar">{elder.name[0]}</div><div><div style={{fontWeight:700}}>{elder.name}</div><div style={{fontSize:12,color:'#94a3b8'}}>{elder.age}세</div></div>{done&&<span className={`inline-result ${done.success?'success':'error'}`}>{done.success?'✅':'❌'}</span>}</div></td>
                        <td style={{fontSize:13}}>{elder.phone}</td>
                        <td style={{fontSize:13,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                        <td><span className="cycle-badge">{cycleLabel(elder.callCycle)}</span></td>
                        <td><span className="time-badge">{elder.callTime}</span></td>
                        <td style={{fontSize:13,color:'#64748b'}}>{elder.lastCall}</td>
                        <td><div className={`status-badge badge-${elder.status}`}>{STATUS_CONFIG[elder.status].label}</div></td>
                        <td><button className={`toggle-btn ${elder.callActive?'toggle-active':'toggle-paused'}`} onClick={()=>toggleCallActive(elder.id)}>{elder.callActive?'⏸ 중단':'▶ 재개'}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {page==='elders' && (
            <div className="fade-in">
              <div className="elder-toolbar">
                <div className="search-box"><span className="search-icon">🔍</span><input className="search-input" placeholder="어르신 이름 검색..." value={searchName} onChange={e => setSearchName(e.target.value)}/>{searchName && <button className="search-clear" onClick={() => setSearchName('')}>✕</button>}</div>
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
                  <button className="btn-primary" onClick={openRegister}>+ 신규 등록</button>
                </div>
              </div>
              <div className="search-result-count">총 <strong>{filteredElders.length}명</strong>{searchName && <span> · "{searchName}" 검색결과</span>}{regionFilter !== '전체' && <span> · {regionFilter}</span>}</div>

              {viewMode === 'card' && (
                <div className="elder-grid">
                  {filteredElders.length === 0 && <div className="empty-result">검색 결과가 없습니다 🔍</div>}
                  {filteredElders.map(elder => {
                    const risk = getSolitudeRisk(elder);
                    const noResponseDays = getNoResponseDays(elder.lastCall);
                    return (
                      <div key={elder.id} className="elder-card" onClick={()=>openDetail(elder)}>
                        <div className="elder-top"><div className="elder-avatar">{elder.gender==='female'?'👵':'👴'}</div><div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}><div className={`status-badge badge-${elder.status}`}>{STATUS_CONFIG[elder.status].label}</div><div className="risk-badge" style={{background:risk.bg,color:risk.color}}>{risk.label}</div></div></div>
                        <div className="elder-name">{elder.name}</div>
                        <div className="elder-info">{elder.age}세 · {elder.title} · {elder.region}</div>
                        {elder.caregiver && <div className="elder-info" style={{color:'#1d4ed8',fontWeight:600}}>👤 담당: {elder.caregiver}</div>}
                        {noResponseDays >= 1 && <div className={`no-response-tag ${noResponseDays >= 3 ? 'no-response-danger' : 'no-response-warning'}`}>📵 {noResponseDays >= 99 ? '미통화' : `${noResponseDays}일째 미응답`}</div>}
                        <div className="elder-last">📞 마지막 통화: {elder.lastCall}</div>
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
                  <thead><tr><th>어르신</th><th>성별/호칭</th><th>나이</th><th>지역</th><th>담당 복지사</th><th>마지막 통화</th><th>미응답</th><th>고독사 위험도</th><th>상태</th><th>키워드</th><th>즉시 전화</th></tr></thead>
                  <tbody>
                    {filteredElders.length === 0 && <tr><td colSpan={11} style={{textAlign:'center',color:'#94a3b8',padding:32}}>검색 결과가 없습니다 🔍</td></tr>}
                    {filteredElders.map(elder => {
                      const risk = getSolitudeRisk(elder);
                      const noResponseDays = getNoResponseDays(elder.lastCall);
                      return (
                        <tr key={elder.id} style={{cursor:'pointer'}} onClick={()=>openDetail(elder)}>
                          <td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:20}}>{elder.gender==='female'?'👵':'👴'}</span><strong>{elder.name}</strong></div></td>
                          <td><span className="cycle-badge">{elder.title}</span></td>
                          <td>{elder.age}세</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.region}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.caregiver||'-'}</td>
                          <td style={{fontSize:13,color:'#64748b'}}>{elder.lastCall}</td>
                          <td>{noResponseDays===0?<span style={{color:'#22c55e',fontWeight:700}}>정상</span>:<span style={{color:noResponseDays>=3?'#ef4444':'#f59e0b',fontWeight:700}}>{noResponseDays>=99?'미통화':`${noResponseDays}일`}</span>}</td>
                          <td><span className="risk-badge-sm" style={{background:risk.bg,color:risk.color}}>{risk.label}</span></td>
                          <td><div className={`status-badge badge-${elder.status}`}>{STATUS_CONFIG[elder.status].label}</div></td>
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
                    <button key={t.id} className={`alert-template-btn ${activeAlert===t.id?'alert-template-active':''}`} style={activeAlert===t.id?{borderColor:t.color,background:`${t.color}15`}:{}} onClick={() => { setActiveAlert(t.id); setAlertScript(ALERT_TEMPLATES[t.id]); }}>
                      <span style={{fontSize:20}}>{t.icon}</span><span style={{fontWeight:700,color:activeAlert===t.id?t.color:'#374151'}}>{t.label}</span>
                    </button>
                  ))}
                </div>
                {activeAlert !== 'none' && (<div className="alert-script-edit"><label className="form-label">경보 멘트 수정</label><textarea className="script-textarea" value={alertScript} onChange={e => setAlertScript(e.target.value)} rows={3}/><div className="var-hint">사용 가능 변수: <code>{'{{지역}}'}</code></div></div>)}
                {activeAlert !== 'none' && (
                  <div style={{marginTop:18,borderTop:'1px solid #e5e7eb',paddingTop:16}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:10}}>
                      <label className="form-label" style={{margin:0}}>📋 이 경보 멘트로 발신할 어르신 (체크 후 일괄 발신)</label>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn-secondary" style={{fontSize:12,padding:'5px 10px'}} onClick={()=>setChecked(elders.filter(e=>weatherData[e.region]?.alert===activeAlert).map(e=>e.id))}>🎯 경보지역 자동선택</button>
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
                <div className="script-editor-header">
                  <div className="section-title">✍️ 기본 전화 멘트 편집</div>
                  <div style={{display:'flex',gap:8}}><button className="btn-secondary" onClick={resetScript}>↩ 초기화</button><button className="btn-success" onClick={saveScript}>💾 저장</button></div>
                </div>
                {scriptSaved && <div className="success-banner">✅ 멘트가 저장되었습니다!</div>}
                <div className="var-hint" style={{marginBottom:12}}>사용 가능 변수: <code>{'{{호칭}}'}</code> 할머니/할아버지 &nbsp;<code>{'{{이름}}'}</code> 어르신 이름 &nbsp;<code>{'{{지역}}'}</code> 담당 지역 &nbsp;<code>{'{{경보멘트}}'}</code> 날씨 경보</div>
                <textarea className="script-textarea script-textarea-lg" value={editScript} onChange={e => setEditScript(e.target.value)} rows={10}/>
              </div>

              <div className="section">
                <div className="script-editor-header">
                  <div className="section-title">👁️ 멘트 미리보기</div>
                  <select className="form-input" style={{width:'auto',padding:'8px 16px'}} value={previewElder?.id || ''} onChange={e => setPreviewElder(elders.find(el => el.id === parseInt(e.target.value)) || null)}>
                    <option value="">어르신 선택...</option>
                    {elders.map(el => <option key={el.id} value={el.id}>{el.name} ({el.region})</option>)}
                  </select>
                </div>
                <div className="script-preview">
                  {previewElder ? (
                    <div>
                      <div className="preview-header"><div className="preview-avatar">{previewElder.name[0]}</div><div><div className="preview-name">{previewElder.name} 어르신</div><div className="preview-region">{previewElder.region} · {previewElder.phone}</div></div>{weatherData[previewElder.region]?.alertText && <div className="weather-badge">{weatherData[previewElder.region].alertText}</div>}</div>
                      <div className="preview-divider"/>
                      <div className="preview-script">{buildPreview(previewElder).split('\n').map((line, i) => (<div key={i} className="preview-line"><span className="preview-dot">🔊</span><span>{line}</span></div>))}</div>
                    </div>
                  ) : <div className="preview-empty">어르신을 선택하면 실제 전화 멘트를 미리볼 수 있습니다</div>}
                </div>
              </div>
            </div>
          )}

          {page==='calls' && (
            <div className="fade-in">
              <table className="table">
                <thead><tr><th>어르신</th><th>유형</th><th>날짜</th><th>시간</th><th>통화 결과</th><th>감지 키워드</th><th>위험도</th></tr></thead>
                <tbody>
                  {callLogs.map(log=>{
                    const elder = elders.find(e=>e.id===log.elderId);
                    const statusConfig = {ringing:{label:'📱 앱 수신 대기',color:'#3b82f6'},completed:{label:'✅ 통화 완료',color:'#22c55e'},failed:{label:'❌ 연결 실패',color:'#ef4444'},unknown:{label:'❓ 상태 불명',color:'#94a3b8'}};
                    const sc = statusConfig[log.callStatus] || null;
                    return (
                      <tr key={log.id} style={{background:log.callStatus==='failed'?'#fef2f2':log.callStatus==='completed'?'#f0fdf4':'inherit'}}>
                        <td><strong>{elder?.name}</strong></td>
                        <td><span className={`type-badge ${log.type==='manual'?'type-manual':'type-auto'}`}>{log.type==='manual'?'수동':'자동'}</span></td>
                        <td>{log.date}</td><td>{log.time}</td>
                        <td>{sc?<span style={{color:sc.color,fontWeight:700,fontSize:13}}>{sc.label}</span>:<span style={{fontSize:13,color:'#64748b'}}>{log.duration}</span>}</td>
                        <td>{log.keywords.length>0?log.keywords.map((kw,i)=><span key={i} className="keyword-tag">{kw}</span>):<span style={{color:'#9ca3af'}}>없음</span>}</td>
                        <td><span style={{color:RISK_CONFIG[log.risk]?.color||'#64748b',fontWeight:700}}>{RISK_CONFIG[log.risk]?.label||'-'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {page==='report' && (
            <div className="fade-in">
              <div className="report-banner"><div className="report-banner-title">📊 {new Date().getFullYear()}년 {new Date().getMonth()+1}월 월간 리포트</div><div className="report-banner-sub">대구광역시 AI 영실이 복지 서비스</div><div style={{display:'flex',gap:8}}><button className="btn-download" onClick={exportStatsCSV}>📊 엑셀 다운로드</button><button className="btn-download" onClick={()=>window.print()}>⬇️ PDF 다운로드</button></div></div>
              <div className="report-stat-grid">
                {[{label:'총 통화',value:'34건',icon:'📞',color:'#1d4ed8'},{label:'긴급 감지',value:'3건',icon:'🚨',color:'#ef4444'},{label:'주의 감지',value:'8건',icon:'⚠️',color:'#f59e0b'},{label:'방문 연결',value:'5건',icon:'🏠',color:'#16a34a'},{label:'총 통화 시간',value:'142분',icon:'⏱️',color:'#7c3aed'},{label:'관리 어르신',value:`${elders.length}명`,icon:'👥',color:'#0891b2'}].map((s,i)=>(
                  <div key={i} className="report-stat-card"><div className="report-stat-icon">{s.icon}</div><div className="report-stat-value" style={{color:s.color}}>{s.value}</div><div className="report-stat-label">{s.label}</div></div>
                ))}
              </div>
              <div className="section">
                <div className="section-title">📈 주간 통화 현황</div>
                <div className="chart-wrap">
                  {WEEKLY_DATA.map((d,i)=>{const maxCalls=Math.max(...WEEKLY_DATA.map(x=>x.calls));return(<div key={i} className="chart-col"><div className="chart-bar-wrap"><div className="chart-bar-total" style={{height:`${d.calls/maxCalls*100}%`}}><div className="chart-bar-danger" style={{height:`${d.danger/d.calls*100}%`}}/><div className="chart-bar-warning" style={{height:`${d.warning/d.calls*100}%`}}/></div></div><div className="chart-val">{d.calls}</div><div className="chart-day">{d.day}</div></div>);})}
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

                {(!statsData || statsData.available===false) ? (
                  <div style={{padding:30,textAlign:'center',color:'#94a3b8'}}>{statsLoading?'불러오는 중...':'아직 통계 데이터가 없습니다. 통화 중 위험 키워드가 감지되면 자동으로 쌓입니다.'}</div>
                ) : (()=>{
                  const elderEntries = Object.entries(statsData.elders||{})
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
                <div className="section-title">🎯 위험도 분포</div>
                <div className="donut-wrap">
                  <div className="donut-chart">
                    <svg viewBox="0 0 120 120" width="160" height="160">
                      <circle cx="60" cy="60" r="45" fill="none" stroke="#fef2f2" strokeWidth="18"/>
                      <circle cx="60" cy="60" r="45" fill="none" stroke="#ef4444" strokeWidth="18" strokeDasharray={`${danger/elders.length*283} 283`} strokeDashoffset="0" transform="rotate(-90 60 60)"/>
                      <circle cx="60" cy="60" r="45" fill="none" stroke="#f59e0b" strokeWidth="18" strokeDasharray={`${warning/elders.length*283} 283`} strokeDashoffset={`-${danger/elders.length*283}`} transform="rotate(-90 60 60)"/>
                      <circle cx="60" cy="60" r="45" fill="none" stroke="#22c55e" strokeWidth="18" strokeDasharray={`${normal/elders.length*283} 283`} strokeDashoffset={`-${(danger+warning)/elders.length*283}`} transform="rotate(-90 60 60)"/>
                      <text x="60" y="55" textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{elders.length}</text>
                      <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#94a3b8">전체</text>
                    </svg>
                  </div>
                  <div className="donut-legend">
                    {[{label:'위험',count:danger,color:'#ef4444'},{label:'주의',count:warning,color:'#f59e0b'},{label:'정상',count:normal,color:'#22c55e'}].map(item=>(<div key={item.label} className="donut-legend-item"><div className="donut-dot" style={{background:item.color}}/><div><div className="donut-label">{item.label}</div><div className="donut-count" style={{color:item.color}}>{item.count}명 ({Math.round(item.count/elders.length*100)}%)</div></div></div>))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {page==='health' && (
            <div className="fade-in">
              <div className="data-banner" style={{marginBottom:20}}>
                <div><div className="data-banner-title">💊 어르신 건강 상태 현황</div><div className="data-banner-sub">영실이 앱에서 어르신이 직접 체크한 건강 상태</div></div>
                <button className={`btn-download ${healthLoading?'btn-calling':''}`} onClick={fetchHealth} disabled={healthLoading}>{healthLoading ? '⏳ 불러오는 중...' : '🔄 갱신'}</button>
              </div>
              <div className="report-stat-grid" style={{marginBottom:20}}>
                <div className="report-stat-card"><div className="report-stat-icon">😊</div><div className="report-stat-value" style={{color:'#16a34a'}}>{healthData.filter(h=>h.status==='good').length}명</div><div className="report-stat-label">좋아요</div></div>
                <div className="report-stat-card"><div className="report-stat-icon">😐</div><div className="report-stat-value" style={{color:'#f59e0b'}}>{healthData.filter(h=>h.status==='okay').length}명</div><div className="report-stat-label">그럭저럭</div></div>
                <div className="report-stat-card"><div className="report-stat-icon">😔</div><div className="report-stat-value" style={{color:'#ef4444'}}>{healthData.filter(h=>h.status==='bad').length}명</div><div className="report-stat-label">안 좋아요</div></div>
                <div className="report-stat-card"><div className="report-stat-icon">📱</div><div className="report-stat-value" style={{color:'#6b7280'}}>{elders.length - healthData.length}명</div><div className="report-stat-label">미체크</div></div>
              </div>
              {alertsData.filter(a=>!a.read).length > 0 && (
                <div className="section" style={{marginBottom:20}}>
                  <div className="section-title">🚨 미확인 알림 ({alertsData.filter(a=>!a.read).length}건)</div>
                  {alertsData.filter(a=>!a.read).map((alert,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:14,background:'#fef2f2',border:'2px solid #fecaca',borderRadius:12,padding:'14px 18px',marginBottom:10}}>
                      <span style={{fontSize:24}}>⚠️</span>
                      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:'#dc2626'}}>{alert.name} · 🚨 "{alert.keyword || (alert.message ? alert.message.split('감지:').pop().trim() : alert.message)}"</div><div style={{fontSize:12,color:'#ef4444',marginTop:2}}>{new Date(alert.timestamp).toLocaleString('ko-KR')}</div></div>
                      <button className="btn-small" onClick={async()=>{await fetch(`${SERVER_URL}/alerts/${alert.id}/read`,{method:'POST'});fetchHealth();}}>확인</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="section">
                <div className="section-title">📋 어르신별 건강 상태</div>
                {healthData.length === 0 ? (
                  <div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:48}}>📭</div><div style={{marginTop:12}}>아직 건강 체크 데이터가 없습니다</div><div style={{fontSize:13,marginTop:6}}>어르신이 앱에서 건강 체크를 하면 여기에 표시됩니다</div></div>
                ) : (
                  <table className="table">
                    <thead><tr><th>어르신</th><th>건강 상태</th><th>체크 시간</th><th>담당 복지사</th><th>조치</th></tr></thead>
                    <tbody>
                      {healthData.sort((a,b)=>{const order={bad:0,okay:1,good:2};return order[a.status]-order[b.status];}).map((h,i)=>{
                        const elder=elders.find(e=>e.name===h.name);
                        const statusColor={good:'#16a34a',okay:'#f59e0b',bad:'#ef4444'}[h.status];
                        const statusLabel={good:'😊 좋아요',okay:'😐 그럭저럭',bad:'😔 안 좋아요'}[h.status];
                        return (
                          <tr key={i} style={{background:h.status==='bad'?'#fff5f5':'inherit'}}>
                            <td><strong>{h.name}</strong></td>
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
                          const managed=elders.filter(e=>e.region===d.region).length;
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
              {callResult?.elderId===selected.id&&<div className={`call-result-banner ${callResult.status}`}>{callResult.status==='success'?'✅':'❌'} {callResult.message}</div>}
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-avatar">{selected.name[0]}</div>
                  <div className="detail-name">{selected.name}</div>
                  <div className="detail-sub">{selected.age}세 · {selected.region}</div>
                  <div className={`status-badge badge-${selected.status} mt16`}>{STATUS_CONFIG[selected.status].label}</div>
                  <div className="call-action-box">
                    <button className={`btn-call-lg ${calling===selected.id?'btn-calling':''} ${!selected.callActive?'btn-disabled':''}`} onClick={()=>selected.callActive&&setCallModal(selected)} disabled={calling===selected.id||!selected.callActive}>{calling===selected.id?'⏳ 발신 중...':'📱 앱으로 전화하기'}</button>
                    <button className={`toggle-btn-lg ${selected.callActive?'toggle-active':'toggle-paused'}`} onClick={()=>toggleCallActive(selected.id)}>{selected.callActive?'⏸ 자동전화 중단':'▶ 자동전화 재개'}</button>
                  </div>
                  {[['성별',selected.gender==='female'?'👵 여성':'👴 남성'],['호칭',selected.title||'어르신'],['전화번호',selected.phone],['담당 복지사',selected.caregiver||'미배정'],['주소',selected.address],['보호자',selected.guardian],['보호자 연락처',selected.guardianPhone],['지병',selected.disease||'없음'],['복용약',selected.medicine||'없음'],['거동상태',selected.mobility],['전화 주기',cycleLabel(selected.callCycle)],['전화 시간',selected.callTime],['마지막 통화',selected.lastCall],['방문 필요',selected.visits>0?`${selected.visits}회 권고`:'불필요']].map(([label,value],i)=>(<div key={i} className="detail-info-row"><span className="detail-label">{label}</span><span style={{color:label==='방문 필요'&&selected.visits>0?'#ef4444':'inherit',fontWeight:label==='방문 필요'?700:400}}>{value}</span></div>))}
                </div>
                <div className="detail-right">
                  {selected.keyword&&<div className="alert-box"><div className="alert-box-title">🚨 감지된 위험 키워드</div><div className="alert-box-keyword">"{selected.keyword}"</div><div className="alert-box-desc">즉시 방문 또는 가족 연락이 필요합니다.</div></div>}
                  <div className="section">
                    <div className="script-editor-header" style={{marginBottom:12}}>
                      <div className="section-title" style={{marginBottom:0}}>📞 통화 기록</div>
                      <button className="btn-secondary" style={{fontSize:12,padding:'5px 10px'}} onClick={()=>{ if(window.confirm('이 어르신의 통화 기록을 모두 삭제할까요?\n(되돌릴 수 없습니다)')) setCallLogs(prev=>prev.filter(l=>l.elderId!==selected.id)); }}>🗑️ 이전 기록 정리</button>
                    </div>
                    {callLogs.filter(c=>c.elderId===selected.id).map(log=>{
                      const callStatusConfig={ringing:{label:'📱 앱 수신 대기',color:'#3b82f6',bg:'#eff6ff'},completed:{label:'✅ 통화 완료',color:'#22c55e',bg:'#f0fdf4'},failed:{label:'❌ 연결 실패',color:'#ef4444',bg:'#fef2f2'},unknown:{label:'❓ 상태 불명',color:'#94a3b8',bg:'#f8fafc'}};
                      const sc=callStatusConfig[log.callStatus];
                      return (
                        <div key={log.id} className={`call-log-item ${log.callStatus==='failed'?'risk-critical':log.callStatus==='completed'?'risk-normal':'risk-'+log.risk}`}>
                          <span className={`type-badge ${log.type==='manual'?'type-manual':'type-auto'}`}>{log.type==='manual'?'수동':'자동'}</span>
                          <div className="call-log-time">{log.time}</div>
                          <div className="call-log-duration">{sc?<span style={{color:sc.color,fontWeight:800,fontSize:13,background:sc.bg,padding:'3px 8px',borderRadius:6}}>{sc.label}</span>:<span>{log.duration}</span>}</div>
                          <div>{log.keywords.length>0?log.keywords.map((kw,i)=><span key={i} className="keyword-tag">{kw}</span>):<span style={{color:'#9ca3af',fontSize:13}}>이상 없음</span>}</div>
                        </div>
                      );
                    })}
                    {callLogs.filter(c=>c.elderId===selected.id).length===0&&<div style={{color:'#9ca3af',fontSize:14,padding:'16px 0'}}>통화 기록 없음</div>}
                  </div>
                </div>
              </div>
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
                  <div className="form-field"><label className="form-label">관할 구역</label><select {...inp('region')} className="form-input">{['대구 북구','대구 달서구','대구 수성구','대구 중구','대구 동구','대구 서구','대구 남구','대구 달성군'].map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                  <div className="form-field full-width"><label className="form-label">주소 <span className="required">*</span></label><input {...inp('address')} placeholder="예: 대구 북구 침산동 123"/>{formErrors.address&&<div className="error-msg">{formErrors.address}</div>}</div>
                  <div className="form-field"><label className="form-label">지병</label><input {...inp('disease')} placeholder="예: 고혈압, 당뇨"/></div>
                  <div className="form-field"><label className="form-label">복용 중인 약</label><input {...inp('medicine')} placeholder="예: 혈압약"/></div>
                  <div className="form-field full-width"><label className="form-label">거동 상태</label><div className="radio-group">{['독립보행 가능','보조기구 필요','거동 불가'].map(opt=><label key={opt} className={`radio-option ${form.mobility===opt?'radio-selected':''}`}><input type="radio" name="mobility" value={opt} checked={form.mobility===opt} onChange={e=>setForm(f=>({...f,mobility:e.target.value}))} style={{display:'none'}}/>{opt}</label>)}</div></div>
                  <div className="form-field full-width"><label className="form-label">담당 복지사</label><select {...inp('caregiver')}><option value="">선택 안 함</option>{CAREGIVERS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                </div><div className="form-footer"><button className="btn-primary btn-lg" onClick={nextStep}>다음 단계 →</button></div></div>)}
                {formStep===2&&(<div className="fade-in"><div className="form-section-title">👨‍👩‍👧 보호자 정보</div><div className="form-grid"><div className="form-field"><label className="form-label">보호자 이름 <span className="required">*</span></label><input {...inp('guardian')} placeholder="예: 김민준"/>{formErrors.guardian&&<div className="error-msg">{formErrors.guardian}</div>}</div><div className="form-field"><label className="form-label">보호자 연락처 <span className="required">*</span></label><input {...inp('guardianPhone')} placeholder="예: 010-9876-5432"/>{formErrors.guardianPhone&&<div className="error-msg">{formErrors.guardianPhone}</div>}</div></div><div className="form-info-box">💡 위험 키워드 감지 시 보호자에게 즉시 알림이 발송됩니다.</div><div className="form-footer"><button className="btn-secondary btn-lg" onClick={()=>setFormStep(1)}>← 이전</button><button className="btn-primary btn-lg" onClick={nextStep}>다음 단계 →</button></div></div>)}
                {formStep===3&&(<div className="fade-in"><div className="form-section-title">📞 AI 전화 설정</div><div className="form-grid"><div className="form-field full-width"><label className="form-label">전화 주기</label><div className="radio-group">{[{value:'daily',label:'매일'},{value:'every2days',label:'격일'},{value:'weekly',label:'주 1회'}].map(opt=><label key={opt.value} className={`radio-option ${form.callCycle===opt.value?'radio-selected':''}`}><input type="radio" name="callCycle" value={opt.value} checked={form.callCycle===opt.value} onChange={e=>setForm(f=>({...f,callCycle:e.target.value}))} style={{display:'none'}}/>{opt.label}</label>)}</div></div><div className="form-field"><label className="form-label">전화 시간</label><input {...inp('callTime')} type="time"/></div></div><div className="summary-box"><div className="summary-title">📋 등록 정보 확인</div><div className="summary-grid">{[['이름',form.name],['나이',`${form.age}세`],['전화번호',form.phone],['지역',form.region],['담당 복지사',form.caregiver||'미배정'],['보호자',form.guardian],['보호자 연락처',form.guardianPhone],['전화 주기',cycleLabel(form.callCycle)],['전화 시간',form.callTime]].map(([label,value])=><div key={label} className="summary-row"><span className="summary-label">{label}</span><span className="summary-value">{value}</span></div>)}</div></div><div className="form-footer"><button className="btn-secondary btn-lg" onClick={()=>setFormStep(2)}>← 이전</button><button className="btn-success btn-lg" onClick={saveElder}>{editMode?'✅ 수정 완료':'✅ 등록 완료'}</button></div></div>)}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
