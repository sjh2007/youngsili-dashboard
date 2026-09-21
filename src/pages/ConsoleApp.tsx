// AI영실이 운영 콘솔 — 기관 대시보드와 완전히 분리된 별도 빌드 타겟(superadmin 전용).
// 같은 레포·같은 authFetch/SERVER_URL/Firebase 로그인을 재사용하되, 진입점만 다르다
// (src/index.tsx가 REACT_APP_TARGET=console일 때 App 대신 이 컴포넌트를 렌더).
// 권한 판정은 별도 API 없이 GET /console/health 호출 결과(403이면 비superadmin)로 대신한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import 'apexcharts/dist/apexcharts.css';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  Activity, BarChart3, Phone, CreditCard, Receipt, RotateCcw, Building2,
  Users as UsersIcon, HeartHandshake, Megaphone, FileClock, FlaskConical, LogOut, UserCog, BookOpen,
  CalendarDays, ChevronLeft, ChevronRight,
  AlertTriangle, LifeBuoy, Search, ShieldCheck, Terminal,
} from 'lucide-react';
import { auth, authEnabled } from '../firebase';
import { SERVER_URL, authFetch, errMsg } from '../utils/api';
import { CallEngineProviderSchema, HostResourcesSchema, OpsMetricsSchema, PilotDailyEvidenceListSchema, PilotMetricsSchema, parseOr } from '../schemas';
// App.css는 src/index.tsx에서 정적으로 이미 import됨(동적 import로 인한 FOUC 방지 목적) —
// 이 콘솔은 별도 빌드 타겟(build-console)이라, 아래 <GcpStyle>은 App.css를 건드리지 않고
// 이 페이지 안에서만 스코프된 스타일을 얹는다(기관 대시보드 쪽엔 영향 없음).

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

function needsPaymentAttention(payment: any): boolean {
  if (['verification_pending', 'review_required', 'refund_processing', 'refund_credit_pending'].includes(payment?.status)) return true;
  if (payment?.status !== 'failed' || !payment?.createdAt) return false;
  const created = new Date(payment.createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created <= 24 * 60 * 60 * 1000;
}

function localDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function RecoveryScheduleInput({ onChange }: { onChange: (value: string) => void }) {
  const [parts, setParts] = useState({ year: '', month: '', day: '', hour: '', minute: '' });
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
  const dayCount = parts.year && parts.month ? new Date(Number(parts.year), Number(parts.month), 0).getDate() : 31;
  const update = (key: keyof typeof parts, value: string) => {
    const next = { ...parts, [key]: value };
    if (next.day && next.year && next.month && Number(next.day) > new Date(Number(next.year), Number(next.month), 0).getDate()) next.day = '';
    setParts(next);
    onChange(Object.values(next).every(Boolean)
      ? `${next.year}-${next.month}-${next.day}T${next.hour}:${next.minute}`
      : '');
  };
  const field = (key: keyof typeof parts, label: string, values: Array<string | number>) => (
    <select aria-label={`예정 ${label}`} className="form-input" style={{ width: '100%', minWidth: 0, padding: '8px 4px', fontSize: 13 }} value={parts[key]} onChange={event => update(key, event.target.value)}>
      <option value="">{label}</option>
      {values.map(value => <option key={value} value={String(value).padStart(2, '0')}>{String(value).padStart(2, '0')}</option>)}
    </select>
  );
  return <div style={{ display: 'grid', gap: 6 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 4 }}>
      {field('year', '연도', years)}{field('month', '월', Array.from({ length: 12 }, (_, index) => index + 1))}{field('day', '일', Array.from({ length: dayCount }, (_, index) => index + 1))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
      {field('hour', '시', Array.from({ length: 24 }, (_, index) => index))}{field('minute', '분', Array.from({ length: 60 }, (_, index) => index))}
    </div>
  </div>;
}

function PaymentCalendar({ month, payments, subscriptions, loading, onMonthChange, onRefresh }: any) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset);
  const todayKey = localDateKey(new Date());
  const orgNames = new Map(subscriptions.map((s:any) => [s.orgId, s.orgName || s.orgId]));
  const events = new Map<string, any[]>();
  const addEvent = (key:string|null, event:any) => {
    if (!key) return;
    events.set(key, [...(events.get(key) || []), event]);
  };

  payments.forEach((p:any) => {
    const eventAt = p.status === 'paid' && p.paidAt ? p.paidAt : p.createdAt;
    addEvent(localDateKey(eventAt), {
      id: `payment-${p.id}`,
      tone: p.status === 'paid' ? 'paid' : needsPaymentAttention(p) || p.status === 'failed' ? 'error' : 'pending',
      title: `${orgNames.get(p.orgId) || p.orgId || '기관 미확인'} · ${Number(p.amount || 0).toLocaleString()}원`,
      detail: p.status === 'paid' ? (p.type === 'subscription' ? `정기결제 완료${p.renewal ? ' · 자동갱신' : ''}` : '크레딧 충전 완료') : `결제 ${p.status || '상태 미확인'}`,
    });
  });
  subscriptions.filter((s:any) => s.autoRenew && s.nextChargeAt).forEach((s:any) => {
    addEvent(localDateKey(s.nextChargeAt), {
      id: `due-${s.orgId}-${s.track || 'legacy'}`,
      tone: s.lastChargeError ? 'error' : 'due',
      title: `${s.orgName || s.orgId} · ${s.monthlyAmount != null ? `${Number(s.monthlyAmount).toLocaleString()}원` : '금액 확인 필요'}`,
      detail: `${s.track === 'app' ? '앱 전화' : s.track === 'pstn' ? '일반 전화' : '기존'} · ${s.lastChargeError ? '정기결제 오류 확인 필요' : '정기결제 예정'}`,
    });
  });

  const days = Array.from({length: 42}, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const moveMonth = (delta:number) => onMonthChange(new Date(year, monthIndex + delta, 1));

  return (
    <section className="section fade-in">
      <div className="payment-calendar-toolbar">
        <div>
          <div className="section-title">결제 일정</div>
          <div className="payment-calendar-caption">완료된 결제와 자동결제 예정일이 운영 데이터에서 자동으로 표시됩니다.</div>
        </div>
        <div className="payment-calendar-actions">
          <button type="button" className="btn-secondary payment-calendar-icon" aria-label="이전 달" onClick={()=>moveMonth(-1)}><ChevronLeft size={17}/></button>
          <button type="button" className="btn-secondary" onClick={()=>onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>오늘</button>
          <button type="button" className="btn-secondary payment-calendar-icon" aria-label="다음 달" onClick={()=>moveMonth(1)}><ChevronRight size={17}/></button>
          <button type="button" className={`btn-download ${loading?'btn-calling':''}`} onClick={onRefresh} disabled={loading}>{loading?'불러오는 중...':'새로고침'}</button>
        </div>
      </div>
      <div className="payment-calendar-month" aria-live="polite">{year}년 {monthIndex + 1}월</div>
      <div className="payment-calendar-legend" aria-label="일정 종류">
        <span><i className="is-paid" aria-hidden="true"/>결제 완료</span><span><i className="is-due" aria-hidden="true"/>정기결제 예정</span><span><i className="is-error" aria-hidden="true"/>확인 필요</span>
      </div>
      <div className="payment-calendar-scroll" role="region" aria-label={`${year}년 ${monthIndex + 1}월 결제 달력`} tabIndex={0}>
        <div className="payment-calendar-grid payment-calendar-weekdays">
          {['월','화','수','목','금','토','일'].map(day=><div key={day}>{day}</div>)}
        </div>
        <div className="payment-calendar-grid payment-calendar-days">
          {days.map(date => {
            const key = localDateKey(date)!;
            const dayEvents = events.get(key) || [];
            const expanded = expandedDays.has(key);
            const visibleEvents = expanded ? dayEvents : dayEvents.slice(0, 1);
            const hiddenCount = dayEvents.length - visibleEvents.length;
            const toggleExpanded = () => setExpandedDays(previous => {
              const next = new Set(previous);
              if (next.has(key)) next.delete(key); else next.add(key);
              return next;
            });
            return <div key={key} aria-label={`${date.getFullYear()}년 ${date.getMonth()+1}월 ${date.getDate()}일, 일정 ${dayEvents.length}건`} className={`payment-calendar-day ${date.getMonth()!==monthIndex?'is-outside':''} ${key===todayKey?'is-today':''}`}>
              <div className="payment-calendar-date">{date.getDate()}</div>
              <div className="payment-calendar-events">
                {visibleEvents.map(event=><div key={event.id} className={`payment-calendar-event is-${event.tone}`} title={`${event.title} · ${event.detail}`}>
                  <strong>{event.title}</strong><span>{event.detail}</span>
                </div>)}
                {hiddenCount > 0 && <button type="button" className="payment-calendar-expand" aria-expanded="false" onClick={toggleExpanded}>외 {hiddenCount}건 펼치기</button>}
                {expanded && dayEvents.length > 1 && <button type="button" className="payment-calendar-expand" aria-expanded="true" onClick={toggleExpanded}>일정 접기</button>}
              </div>
            </div>;
          })}
        </div>
      </div>
      {!loading && payments.length === 0 && subscriptions.filter((s:any)=>s.autoRenew).length === 0 && <div className="payment-calendar-empty">표시할 결제 또는 정기결제 예정 일정이 없습니다.</div>}
    </section>
  );
}

async function requireJson(response: Response, fallback: string): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errMsg(data, fallback));
  return data;
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
        .gcp-console .gcp-nav-item:focus-visible { outline:3px solid rgba(26,115,232,.35); outline-offset:1px; }
        .gcp-console .gcp-nav-item.is-active { background: #e8f0fe; color: #1a73e8; }
        .gcp-console .gcp-nav-item.is-active svg { color: #1a73e8; }
        .gcp-console .gcp-topbar { background: #fff; border-bottom: 1px solid #dadce0; }
        .gcp-console .toast-viewport .toast { font-family: 'Roboto', sans-serif; }
        .gcp-console .pilot-workspace { padding:0; overflow:hidden; border-radius:14px; }
        .gcp-console .pilot-workflow-head { padding:24px 26px 20px; background:linear-gradient(135deg,#0b3558 0%,#0f5b74 62%,#1b7f78 100%); color:#fff; }
        .gcp-console .pilot-workflow-kicker { display:inline-flex; align-items:center; gap:7px; padding:5px 10px; border:1px solid rgba(255,255,255,.28); border-radius:999px; background:rgba(255,255,255,.1); font-size:11px; font-weight:700; letter-spacing:.08em; }
        .gcp-console .pilot-workflow-head h2 { margin:12px 0 5px; font-size:23px; font-weight:700; letter-spacing:-.02em; }
        .gcp-console .pilot-workflow-head p { margin:0; color:rgba(255,255,255,.78); font-size:13px; line-height:1.6; }
        .gcp-console .pilot-workflow-steps { display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid rgba(255,255,255,.16); margin-top:18px; padding-top:15px; gap:12px; }
        .gcp-console .pilot-workflow-step { display:flex; gap:9px; align-items:center; color:rgba(255,255,255,.84); font-size:12px; }
        .gcp-console .pilot-workflow-step b { display:grid; place-items:center; width:25px; height:25px; border-radius:8px; background:#fff; color:#0f5b74; font-size:12px; }
        .gcp-console .pilot-workspace-body { padding:22px 24px 26px; }
        .gcp-console .pilot-step-card { border:1px solid #dce5e8; border-radius:12px; padding:18px; margin-bottom:14px; background:#fff; box-shadow:0 1px 2px rgba(15,54,74,.04); }
        .gcp-console .pilot-step-card.is-soft { background:#f6faf9; border-color:#d7e8e3; }
        .gcp-console .pilot-section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:14px; }
        .gcp-console .pilot-section-heading h3 { margin:0; font-size:15px; color:#12364a; }
        .gcp-console .pilot-section-heading p { margin:5px 0 0; color:#637780; font-size:12px; line-height:1.55; }
        .gcp-console .pilot-step-number { display:inline-grid; place-items:center; min-width:27px; height:27px; border-radius:9px; background:#dff2ec; color:#126e62; font-weight:700; margin-right:9px; }
        .gcp-console .pilot-form-grid { display:grid; grid-template-columns:repeat(3,minmax(150px,1fr)); gap:10px; }
        .gcp-console .pilot-privacy-note { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; margin-bottom:12px; border-radius:9px; background:#eef6ff; color:#35536c; font-size:12px; line-height:1.5; }
        .gcp-console .pilot-evidence-table { border:1px solid #e2e8ea; border-radius:10px; overflow:hidden; }
        .gcp-console .pilot-danger-options { display:flex; gap:8px; flex-wrap:wrap; margin-top:11px; }
        .gcp-console .pilot-danger-options label { display:flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid #e3e8ea; border-radius:8px; background:#fafcfc; font-size:12px; }
        @media (max-width:900px) { .gcp-console .pilot-workflow-steps,.gcp-console .pilot-form-grid { grid-template-columns:1fr; } .gcp-console .pilot-workspace-body { padding:16px; } }
        .gcp-console .skip-link { position:fixed; z-index:10000; top:8px; left:8px; padding:10px 14px; border-radius:6px; background:#202124; color:#fff; transform:translateY(-160%); }
        .gcp-console .skip-link:focus { transform:translateY(0); }
        .gcp-console .payment-calendar-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
        .gcp-console .payment-calendar-caption { margin-top:5px; color:#5f6368; font-size:12.5px; }
        .gcp-console .payment-calendar-actions { display:flex; align-items:center; gap:7px; flex-wrap:wrap; justify-content:flex-end; }
        .gcp-console .payment-calendar-actions .payment-calendar-icon { display:inline-flex; align-items:center; justify-content:center; min-width:40px; min-height:40px; padding:7px 9px; }
        .gcp-console .payment-calendar-month { margin-top:14px; font-size:17px; font-weight:500; color:#202124; }
        .gcp-console .payment-calendar-legend { display:flex; gap:16px; flex-wrap:wrap; margin:7px 0 10px; color:#5f6368; font-size:11.5px; }
        .gcp-console .payment-calendar-legend span { display:inline-flex; align-items:center; gap:6px; }
        .gcp-console .payment-calendar-legend i { width:8px; height:8px; border-radius:50%; background:#9aa0a6; }
        .gcp-console .payment-calendar-legend i.is-paid { background:#1e8e3e; }
        .gcp-console .payment-calendar-legend i.is-due { background:#1a73e8; }
        .gcp-console .payment-calendar-legend i.is-error { background:#c5221f; }
        .gcp-console .payment-calendar-scroll { overflow-x:auto; border:1px solid #dadce0; border-radius:8px; }
        .gcp-console .payment-calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(110px,1fr)); min-width:770px; }
        .gcp-console .payment-calendar-weekdays { background:#f8f9fa; color:#5f6368; font-size:12px; font-weight:500; text-align:center; border-bottom:1px solid #dadce0; }
        .gcp-console .payment-calendar-weekdays > div { padding:6px; border-right:1px solid #e8eaed; }
        .gcp-console .payment-calendar-weekdays > div:last-child { border-right:0; }
        .gcp-console .payment-calendar-day { min-height:82px; padding:5px 6px; box-sizing:border-box; border-right:1px solid #e8eaed; border-bottom:1px solid #e8eaed; background:#fff; }
        .gcp-console .payment-calendar-day:nth-child(7n) { border-right:0; }
        .gcp-console .payment-calendar-day:nth-last-child(-n+7) { border-bottom:0; }
        .gcp-console .payment-calendar-day.is-outside { background:#fafafa; color:#9aa0a6; }
        .gcp-console .payment-calendar-date { width:21px; height:21px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:11px; font-weight:500; }
        .gcp-console .payment-calendar-day.is-today .payment-calendar-date { background:#1a73e8; color:#fff; }
        .gcp-console .payment-calendar-events { display:grid; gap:3px; margin-top:3px; }
        .gcp-console .payment-calendar-event { min-width:0; padding:3px 5px; border-radius:4px; border-left:2px solid #9aa0a6; background:#f1f3f4; color:#3c4043; }
        .gcp-console .payment-calendar-event strong, .gcp-console .payment-calendar-event span { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .gcp-console .payment-calendar-event strong { font-size:10.5px; font-weight:500; }
        .gcp-console .payment-calendar-event span { margin-top:1px; font-size:9.5px; color:#5f6368; }
        .gcp-console .payment-calendar-event.is-paid { border-left-color:#1e8e3e; background:#e6f4ea; }
        .gcp-console .payment-calendar-event.is-due { border-left-color:#1a73e8; background:#e8f0fe; }
        .gcp-console .payment-calendar-event.is-error { border-left-color:#c5221f; background:#fce8e6; }
        .gcp-console .payment-calendar-event.is-pending { border-left-color:#f9ab00; background:#fef7e0; }
        .gcp-console .payment-calendar-expand { width:100%; padding:2px 3px; border:0; border-radius:3px; background:transparent; color:#1a73e8; font-size:10px; font-weight:500; text-align:left; cursor:pointer; }
        .gcp-console .payment-calendar-expand:hover, .gcp-console .payment-calendar-expand:focus-visible { background:#e8f0fe; outline:none; }
        .gcp-console .payment-calendar-empty { margin-top:12px; color:#5f6368; font-size:13px; }
        .gcp-console .ops-chart { width:100%; min-width:0; }
        .gcp-console .ops-chart .apexcharts-tooltip { border:1px solid #dadce0 !important; box-shadow:0 4px 14px rgba(60,64,67,.16) !important; }
        .gcp-console .ops-chart-zero { min-height:150px; display:flex; align-items:center; justify-content:center; gap:16px; border:1px dashed #ceead6; border-radius:8px; background:#f6fbf7; color:#137333; }
        .gcp-console .ops-chart-zero > span { width:54px; height:54px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:#e6f4ea; font-size:25px; font-weight:700; }
        .gcp-console .ops-chart-zero strong, .gcp-console .ops-chart-zero small { display:block; }
        .gcp-console .ops-chart-zero strong { font-size:14px; font-weight:500; }
        .gcp-console .ops-chart-zero small { margin-top:4px; color:#5f6368; font-size:11.5px; }
        @media (max-width: 760px) {
          .gcp-console .payment-calendar-toolbar { align-items:stretch; flex-direction:column; }
          .gcp-console .payment-calendar-actions { justify-content:flex-start; }
        }
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
        <label htmlFor="console-login-email" style={{display:'block',fontSize:12.5,fontWeight:500,color:'#5f6368',margin:'14px 0 6px'}}>이메일</label>
        <input className="form-input" style={{width:'100%',height:44,padding:'0 14px',boxSizing:'border-box',fontSize:14.5,margin:0}}
          id="console-login-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" />
        <label htmlFor="console-login-password" style={{display:'block',fontSize:12.5,fontWeight:500,color:'#5f6368',margin:'16px 0 6px'}}>비밀번호</label>
        <input className="form-input" style={{width:'100%',height:44,padding:'0 14px',boxSizing:'border-box',fontSize:14.5,margin:0}}
          id="console-login-password" type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter' && doLogin()} autoComplete="current-password" aria-describedby={err?'console-login-error':undefined} />
        {err && <div id="console-login-error" role="alert" style={{color:'#c5221f',fontSize:13,marginTop:12,background:'#fce8e6',padding:'10px 12px',borderRadius:4}}>{err}</div>}
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

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  // 스프레드시트 수식 주입을 막으면서 쉼표·줄바꿈·따옴표를 보존한다.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

type MonthlyRow = { month: string; total: number; completed: number; missed: number; failed: number; riskCritical: number; riskUrgent: number; riskWarning: number };

const CHART_FONT = "Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const CHART_ANIMATIONS_ENABLED = typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 월별 통화 스택바(연결/미연결/실패) + 위험알림 추이 라인 */
function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  if (!data.length) return null;
  const options: ApexOptions = {
    chart: { type:'line', stacked:true, toolbar:{show:false}, fontFamily:CHART_FONT, animations:{enabled:CHART_ANIMATIONS_ENABLED,speed:350} },
    colors:['#34a853','#f9ab00','#d93025','#7b1fa2'],
    dataLabels:{enabled:false}, stroke:{width:[0,0,0,3],curve:'smooth'},
    plotOptions:{bar:{columnWidth:'48%',borderRadius:3}},
    grid:{borderColor:'#e8eaed',strokeDashArray:3,padding:{left:4,right:4}},
    xaxis:{categories:data.map(d=>d.month.slice(2).replace('-','.')),axisBorder:{color:'#dadce0'},axisTicks:{show:false},labels:{style:{colors:'#5f6368',fontSize:'11px'}}},
    // 모든 시리즈가 건수 단위이므로 하나의 축을 공유한다. ApexCharts 7은 혼합
    // 시리즈 수와 yaxis 배열 수가 다르면 setSeriesYAxisMappings에서 예외가 난다.
    yaxis:{
      min:0,
      forceNiceScale:true,
      title:{text:'건수',style:{color:'#5f6368',fontSize:'11px',fontWeight:500}},
      labels:{formatter:v=>Math.round(v).toLocaleString(),style:{colors:'#5f6368'}},
    },
    legend:{position:'top',horizontalAlign:'left',fontSize:'12px',labels:{colors:'#5f6368'},markers:{size:6}},
    tooltip:{shared:true,intersect:false,y:{formatter:v=>`${Math.round(v).toLocaleString()}건`}},
  };
  const series:any = [
    {name:'연결',type:'column',data:data.map(d=>d.completed)},
    {name:'미연결',type:'column',data:data.map(d=>d.missed)},
    {name:'실패',type:'column',data:data.map(d=>d.failed)},
    {name:'위험알림',type:'line',data:data.map(d=>d.riskCritical+d.riskUrgent+d.riskWarning)},
  ];
  return <div className="ops-chart" role="img" aria-label="월별 연결, 미연결, 실패 통화와 위험알림 추이 차트"><Chart options={options} series={series} type="line" height={330}/></div>;
}

function SafetyIncidentChart({ metrics }: { metrics: any }) {
  const incidents = metrics?.incidents;
  if (!incidents) return null;
  const rows = [
    ['예약 누락', incidents.missingScheduledToday || 0], ['알림 전달 보류', incidents.alertPersistenceFailures || 0],
    ['발신 준비 고착', incidents.stuckDispatching || 0], ['링 상태 고착', metrics.stuckRinging || 0],
    ['미확인', incidents.unacknowledged || 0], ['확인 지연', incidents.overdueUnacknowledged || 0],
    ['조치중', incidents.inProgress || 0], ['조치 지연', incidents.overdueInProgress || 0],
  ] as [string, number][];
  const total = rows.reduce((sum,row)=>sum+row[1],0);
  if (total === 0) return <div className="ops-chart-zero"><span>0</span><div><strong>현재 미해결 안전 운영 사건 없음</strong><small>최근 조회 시점 기준입니다.</small></div></div>;
  const options:ApexOptions = {
    chart:{type:'bar',toolbar:{show:false},fontFamily:CHART_FONT,animations:{enabled:CHART_ANIMATIONS_ENABLED,speed:350}}, colors:['#c5221f'], dataLabels:{enabled:false},
    plotOptions:{bar:{horizontal:true,borderRadius:3,barHeight:'56%',distributed:true}},
    xaxis:{categories:rows.map(r=>r[0]),labels:{formatter:v=>Math.round(Number(v)).toString(),style:{colors:'#5f6368'}}},
    yaxis:{labels:{style:{colors:'#3c4043',fontSize:'11px'}}}, grid:{borderColor:'#e8eaed',strokeDashArray:3},
    legend:{show:false}, tooltip:{y:{formatter:v=>`${Math.round(v)}건`}},
  };
  return <div className="ops-chart" role="img" aria-label={`안전 운영 사건 유형별 현황, 총 ${total}건`}><Chart options={options} series={[{name:'사건',data:rows.map(r=>r[1])}]} type="bar" height={270}/></div>;
}

function OrganizationUsageChart({ data, orgName }: { data:any[]; orgName:(orgId:string)=>string }) {
  if (!data.length) return null;
  const top = data.slice().sort((a,b)=>Number(b.total||0)-Number(a.total||0)).slice(0,10);
  const options:ApexOptions = {
    chart:{type:'bar',toolbar:{show:false},fontFamily:CHART_FONT,animations:{enabled:CHART_ANIMATIONS_ENABLED,speed:350}}, colors:['#1a73e8','#34a853'], dataLabels:{enabled:false},
    plotOptions:{bar:{horizontal:true,borderRadius:3,barHeight:'62%'}},
    xaxis:{categories:top.map(o=>orgName(o.orgId)),labels:{formatter:v=>Math.round(Number(v)).toLocaleString(),style:{colors:'#5f6368'}}},
    yaxis:{labels:{maxWidth:190,style:{colors:'#3c4043',fontSize:'11px'}}},
    grid:{borderColor:'#e8eaed',strokeDashArray:3}, legend:{position:'top',horizontalAlign:'left',fontSize:'12px'},
    tooltip:{shared:true,intersect:false,y:{formatter:v=>`${Math.round(v).toLocaleString()}건`}},
  };
  return <div className="ops-chart" role="img" aria-label="기관별 전체 발신과 연결 통화 상위 10개 기관 비교 차트"><Chart options={options} series={[{name:'전체 발신',data:top.map(o=>o.total||0)},{name:'연결',data:top.map(o=>o.completed||0)}]} type="bar" height={Math.max(300,top.length*42)}/></div>;
}

const NAV = [
  { id: 'incidents', label: '장애·사고 센터', icon: AlertTriangle },
  { id: 'recovery', label: '복구 훈련', icon: ShieldCheck },
  { id: 'commands', label: '운영 명령 센터', icon: Terminal },
  { id: 'support', label: '기관 고객지원', icon: LifeBuoy },
  { id: 'approvals', label: '승인·운영 통제', icon: FileClock },
  { id: 'health', label: '시스템 모니터링', icon: Activity },
  { id: 'stats', label: '통계', icon: BarChart3 },
  { id: 'calls', label: '통화 이력', icon: Phone },
  { id: 'subscriptions', label: '정기결제 현황', icon: CreditCard },
  { id: 'payment-calendar', label: '결제 달력', icon: CalendarDays },
  { id: 'payments', label: '결제 내역', icon: Receipt },
  { id: 'refunds', label: '환불', icon: RotateCcw },
  { id: 'orgs', label: '기관 관리', icon: Building2 },
  { id: 'users', label: '사용자', icon: UsersIcon },
  { id: 'elders', label: '어르신', icon: HeartHandshake },
  { id: 'notices', label: '공지', icon: Megaphone },
  { id: 'audit', label: '감사 로그', icon: FileClock },
  { id: 'test', label: '기능 테스트', icon: FlaskConical },
  { id: 'staff', label: '콘솔 계정', icon: UserCog },
  { id: 'help', label: '도움말 보기', icon: BookOpen },
] as const;
type PageId = typeof NAV[number]['id'];

/** CS 담당자(role:'cs')에게 보이는 사이드바 범위 — 백엔드 @AllowCs() 라우트와 1:1로 맞춘다 */
const CS_ALLOWED_PAGES: PageId[] = ['support', 'stats', 'calls', 'payments', 'refunds', 'users', 'elders', 'notices'];

export default function ConsoleApp() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null); // null=확인 중, true/false=결과
  const [consoleRole, setConsoleRole] = useState<string | null>(null); // 'superadmin' | 'cs' — 사이드바 범위 결정용
  const [page, setPage] = useState<PageId>('health');
  // 운영 nginx는 클릭재킹 방지를 위해 모든 HTML 응답에 X-Frame-Options: DENY를 적용한다.
  // 같은 origin의 정적 도움말을 fetch한 뒤 srcDoc으로 표시해 보안 헤더를 완화하지 않는다.
  const [helpContent, setHelpContent] = useState('');
  const [helpError, setHelpError] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpRetry, setHelpRetry] = useState(0);
  const [helpHeight, setHelpHeight] = useState(600);
  const onHelpLoad = useCallback((e: any) => {
    const iframe = e.target;
    const doc = iframe.contentDocument;
    if (!doc) return;
    const sync = () => setHelpHeight(doc.documentElement.scrollHeight);
    sync();
    const ResizeObserverCtor = iframe.contentWindow?.ResizeObserver;
    if (ResizeObserverCtor && doc.body) {
      const ro = new ResizeObserverCtor(sync);
      ro.observe(doc.body);
    }
  }, []);
  const [toast, setToast] = useState<{message:string; tone:'info'|'success'|'error'}|null>(null);
  const notify = (message: unknown, tone: 'info'|'success'|'error' = 'error') => {
    setToast({ message: String(message), tone });
    setTimeout(() => setToast(null), 3200);
  };

  const [health, setHealth] = useState<any>(null);
  const [hostResources, setHostResources] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [incidentsPage, setIncidentsPage] = useState(1);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentBusy, setIncidentBusy] = useState('');
  const [incidentStatus, setIncidentStatus] = useState('');
  const [incidentCategory, setIncidentCategory] = useState('');
  const [recoveryDrills, setRecoveryDrills] = useState<any[]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState('');
  const [recoveryForm, setRecoveryForm] = useState({component:'api',environment:'non_production',orgId:'',owner:'',plannedAt:'',scenario:'',rollbackPlan:''});
  const [operatorCommands, setOperatorCommands] = useState<any[]>([]);
  const [operatorCommandBusy, setOperatorCommandBusy] = useState('');
  const [operatorCommandReason, setOperatorCommandReason] = useState('');
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportPage, setSupportPage] = useState(1);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportBusy, setSupportBusy] = useState('');
  const [diagnosticCallId, setDiagnosticCallId] = useState('');
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState('');
  const [privacySummary, setPrivacySummary] = useState<any>(null);
  const [notificationDeliveries, setNotificationDeliveries] = useState<any[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [activeCallsPage, setActiveCallsPage] = useState(1);
  const [opsMetrics, setOpsMetrics] = useState<any>(null);
  const [callEngineProvider, setCallEngineProvider] = useState<any>(null);
  const [callEngineHistory, setCallEngineHistory] = useState<any[]>([]);
  const [callEngineHistoryPage, setCallEngineHistoryPage] = useState(1);
  const [nextCallEngineProvider, setNextCallEngineProvider] = useState<'gemini'|'openai'>('gemini');
  const [callEngineReason, setCallEngineReason] = useState('');
  const [callEngineBusy, setCallEngineBusy] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [privacyPurgeJobs, setPrivacyPurgeJobs] = useState<any[]>([]);
  const [privacyPurgePage, setPrivacyPurgePage] = useState(1);
  const [privacyRetryBusy, setPrivacyRetryBusy] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyOrg, setHistoryOrg] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [subs, setSubs] = useState<any[]>([]);
  const [subsPage, setSubsPage] = useState(1);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subscriptionRetryBusy, setSubscriptionRetryBusy] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarPayments, setCalendarPayments] = useState<any[]>([]);
  const [calendarSubs, setCalendarSubs] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [orgsPage, setOrgsPage] = useState(1);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgBusy, setOrgBusy] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsOrg, setPaymentsOrg] = useState('');
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentReconcileBusy, setPaymentReconcileBusy] = useState('');
  const [refundable, setRefundable] = useState<any[]>([]);
  const [refundPage, setRefundPage] = useState(1);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundBusy, setRefundBusy] = useState('');
  const [testOrgId, setTestOrgId] = useState('');
  const [testLog, setTestLog] = useState<string[]>([]);
  const [testAmount, setTestAmount] = useState('300000');
  const [testPayMethod, setTestPayMethod] = useState('CARD');
  const [testPlanKey, setTestPlanKey] = useState('basic');
  const [testCardBin, setTestCardBin] = useState('');
  const [testRefundPaymentId, setTestRefundPaymentId] = useState('');
  const [testRefundReason, setTestRefundReason] = useState('테스트 환불 요청');
  const [testBusy, setTestBusy] = useState('');
  const [testCallTarget, setTestCallTarget] = useState<any>(null); // {configured, phone, name, orgId}
  const [testCallTargetInput, setTestCallTargetInput] = useState('');
  const [testPublicData, setTestPublicData] = useState<any[]>([]); // ComponentHealth[]
  const [auditLoading, setAuditLoading] = useState(false);
  const [authCheckError, setAuthCheckError] = useState('');   // 네트워크/CORS 등 판정 자체가 실패한 경우 — "권한 없음"과 구분해야 함
  const [authCheckRetry, setAuthCheckRetry] = useState(0);
  const [operationDialog, setOperationDialog] = useState<{kind:'retry'|'refund'|'suspend';target:any}|null>(null);
  const [operationReason, setOperationReason] = useState('');
  const [operationConfirmId, setOperationConfirmId] = useState('');
  const [operationBusy, setOperationBusy] = useState(false);
  const operationDialogRef = useRef<HTMLDivElement|null>(null);
  const operationFirstRef = useRef<HTMLInputElement|HTMLTextAreaElement|null>(null);
  const operationReturnFocus = useRef<HTMLElement|null>(null);

  // ── 통계 ──
  const [statsData, setStatsData] = useState<any>(null); // { monthly, byOrg }
  const [statsOrgPage, setStatsOrgPage] = useState(1);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsMonths, setStatsMonths] = useState(6);
  const [statsOrg, setStatsOrg] = useState('');
  const [pilotData, setPilotData] = useState<any>(null);
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotFrom, setPilotFrom] = useState(() => localDateKey(new Date(Date.now() - 13 * 86400_000)) || '');
  const [pilotTo, setPilotTo] = useState(() => localDateKey(new Date()) || '');
  const [pilotPrograms, setPilotPrograms] = useState<any[]>([]);
  const [pilotOwner, setPilotOwner] = useState('');
  const [pilotSubjectCount, setPilotSubjectCount] = useState('10');
  const [pilotParticipantPhones, setPilotParticipantPhones] = useState('');
  const [pilotReportId, setPilotReportId] = useState('');
  const [pilotProgramBusy, setPilotProgramBusy] = useState(false);
  const [pilotStatusDialog, setPilotStatusDialog] = useState<{program:any;status:'active'|'completed'|'stopped'}|null>(null);
  const [pilotStatusReason, setPilotStatusReason] = useState('');
  const [pilotReadinessConfirmed, setPilotReadinessConfirmed] = useState(false);
  const [pilotReadinessChecks, setPilotReadinessChecks] = useState({consentConfirmed:false,emergencyContactsConfirmed:false,scheduleConfirmed:false,callEngineHealthy:false,approvedImageDigestConfirmed:false});
  const [pilotEvidence, setPilotEvidence] = useState<any[]>([]);
  const [pilotEvidenceProgramId, setPilotEvidenceProgramId] = useState('');
  const [pilotEvidenceForm, setPilotEvidenceForm] = useState({date:localDateKey(new Date())||'',sampleCallIds:'',voiceQualityScore:'4',operatorMinutes:'0',urgentAckMinutes:'',resolutionMinutes:'',issueFlags:[] as string[],incidentNote:'',actionNote:''});
  const [pilotEvidenceBusy, setPilotEvidenceBusy] = useState(false);
  const pilotDialogReturnFocus = useRef<HTMLElement|null>(null);
  const pilotDialogRef = useRef<HTMLDivElement|null>(null);
  const pilotReasonRef = useRef<HTMLTextAreaElement|null>(null);

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
  // 홈페이지 체험 전화 '번호당 1회' 해제 — superadmin 전용
  const [demoResetPhone, setDemoResetPhone] = useState('');
  const [demoResetReason, setDemoResetReason] = useState('');
  const [demoResetBusy, setDemoResetBusy] = useState(false);

  // ── 공지 ──
  const [notices, setNotices] = useState<any[]>([]);
  const [noticesPage, setNoticesPage] = useState(1);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeTargetOrgs, setNoticeTargetOrgs] = useState(''); // 콤마 구분 orgId, 빈 값=전체
  const [noticeBusy, setNoticeBusy] = useState(false);

  // ── 콘솔 CS 계정 관리(superadmin 전용) ──
  const [csAccounts, setCsAccounts] = useState<any[]>([]);
  const [csAccountsPage, setCsAccountsPage] = useState(1);
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
      const [hRes, cRes, mRes, providerRes, providerHistoryRes, privacyRes, resourcesRes] = await Promise.all([
        authFetch(`${SERVER_URL}/console/health`),
        authFetch(`${SERVER_URL}/console/calls/active`),
        authFetch(`${SERVER_URL}/admin/metrics?hours=24`),
        authFetch(`${SERVER_URL}/admin/call-engine/provider`),
        authFetch(`${SERVER_URL}/admin/call-engine/provider-history`),
        authFetch(`${SERVER_URL}/console/privacy-purge-jobs`),
        consoleRole === 'superadmin' ? authFetch(`${SERVER_URL}/console/host-resources`) : Promise.resolve(null),
      ]);
      const hData = await requireJson(hRes, '시스템 상태 조회 실패');
      const cData = await requireJson(cRes, '진행 중 통화 조회 실패');
      if (hData && Array.isArray(hData.components)) setHealth(hData);
      if (resourcesRes) {
        try {
          const resources = parseOr(HostResourcesSchema, await requireJson(resourcesRes, '서버 자원 조회 실패'), null);
          setHostResources(Array.isArray(resources?.hosts) ? resources.hosts : []);
        } catch { setHostResources([]); }
      }
      if (Array.isArray(cData)) { setActiveCalls(cData); setActiveCallsPage(1); }
      try {
        const privacyData = await requireJson(privacyRes, '개인정보 파기 작업 조회 실패');
        setPrivacyPurgeJobs(Array.isArray(privacyData?.jobs) ? privacyData.jobs : []);
        setPrivacyPurgePage(1);
      } catch (privacyError: any) {
        setPrivacyPurgeJobs([]);
        notify(privacyError?.message || '개인정보 파기 작업 조회 실패');
      }
      try {
        const mData = await requireJson(mRes, '안전 운영 지표 조회 실패');
        setOpsMetrics(parseOr(OpsMetricsSchema, mData, null));
      } catch (metricsError: any) {
        setOpsMetrics(null);
        notify(metricsError?.message || '안전 운영 지표 조회 실패');
      }
      try {
        const providerData = parseOr(CallEngineProviderSchema, await requireJson(providerRes, 'AI 엔진 설정 조회 실패'), null);
        setCallEngineProvider(providerData);
        if (providerData?.provider) setNextCallEngineProvider(providerData.provider);
      } catch (providerError: any) {
        setCallEngineProvider(null);
        notify(providerError?.message || 'AI 엔진 설정 조회 실패');
      }
      try {
        const historyData = await requireJson(providerHistoryRes, 'AI 엔진 전환 이력 조회 실패');
        setCallEngineHistory(Array.isArray(historyData?.changes) ? historyData.changes : []);
        setCallEngineHistoryPage(1);
      } catch (historyError: any) {
        setCallEngineHistory([]);
        notify(historyError?.message || 'AI 엔진 전환 이력 조회 실패');
      }
    } catch (e:any) { notify(e?.message || '시스템 상태 조회 실패'); }
    finally { setLoadingHealth(false); }
  };

  const fetchIncidents = async () => {
    setIncidentLoading(true);
    try {
      const query = new URLSearchParams();
      if (incidentStatus) query.set('status', incidentStatus);
      if (incidentCategory) query.set('category', incidentCategory);
      const response = await authFetch(`${SERVER_URL}/console/incidents?${query.toString()}`);
      const data = await requireJson(response, '장애·사고 조회 실패');
      setIncidents(Array.isArray(data?.incidents) ? data.incidents : []);
      setIncidentsPage(1);
    } catch (error: any) {
      notify(error?.message || '장애·사고 조회 실패');
    } finally {
      setIncidentLoading(false);
    }
  };

  const updateIncident = async (incident: any, status: string) => {
    const assignee = window.prompt('담당자 이름 또는 팀을 입력하세요.', incident.assignee || '') ?? undefined;
    if (assignee === undefined) return;
    const actionNote = window.prompt(status === 'resolved' ? '해결 조치 기록을 입력하세요. (필수)' : '현재 조치 기록을 입력하세요.', incident.actionNote || '') ?? undefined;
    if (actionNote === undefined || (status === 'resolved' && !actionNote.trim())) {
      if (status === 'resolved') notify('해결 처리에는 조치 기록이 필요합니다.');
      return;
    }
    const preventionNote = status === 'resolved'
      ? window.prompt('재발 방지 메모를 입력하세요.', incident.preventionNote || '') ?? undefined
      : incident.preventionNote || undefined;
    if (status === 'resolved' && preventionNote === undefined) return;
    setIncidentBusy(incident.id);
    try {
      const response = await authFetch(`${SERVER_URL}/console/incidents/${encodeURIComponent(incident.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, assignee: assignee.trim() || null, actionNote: actionNote.trim(), preventionNote: preventionNote?.trim() }),
      });
      await requireJson(response, '사건 처리 상태 변경 실패');
      notify('사건 처리 기록을 저장했습니다.', 'success');
      await fetchIncidents();
    } catch (error: any) {
      notify(error?.message || '사건 처리 상태 변경 실패');
    } finally {
      setIncidentBusy('');
    }
  };

  const fetchRecoveryDrills = async () => {
    setRecoveryLoading(true);
    try {
      const response = await authFetch(`${SERVER_URL}/console/recovery-drills`);
      const data = await requireJson(response, '복구 훈련 조회 실패');
      setRecoveryDrills(Array.isArray(data?.drills) ? data.drills : []);
    } catch (error:any) { notify(error?.message || '복구 훈련 조회 실패'); }
    finally { setRecoveryLoading(false); }
  };

  const createRecoveryDrill = async () => {
    if (!recoveryForm.owner.trim() || !recoveryForm.plannedAt || recoveryForm.scenario.trim().length < 5 || recoveryForm.rollbackPlan.trim().length < 5) {
      notify('담당자, 예정 시각, 장애 시나리오와 롤백 계획을 입력하세요.'); return;
    }
    setRecoveryBusy('create');
    try {
      const response = await authFetch(`${SERVER_URL}/console/recovery-drills`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...recoveryForm,orgId:recoveryForm.orgId||null,plannedAt:new Date(recoveryForm.plannedAt).toISOString()}),
      });
      await requireJson(response, '복구 훈련 등록 실패');
      notify('복구 훈련 계획을 등록했습니다.','success');
      setRecoveryForm(v=>({...v,scenario:'',rollbackPlan:''}));
      await fetchRecoveryDrills();
    } catch(error:any) { notify(error?.message || '복구 훈련 등록 실패'); }
    finally { setRecoveryBusy(''); }
  };

  const updateRecoveryDrill = async (drill:any, status:'running'|'passed'|'failed'|'aborted') => {
    const body:any={status};
    if (status !== 'running') {
      const actionNote=window.prompt(status==='passed'?'복구 조치와 확인 결과를 입력하세요.':'중단·실패 원인과 조치를 입력하세요.',drill.actionNote||'');
      if (!actionNote?.trim()) return;
      body.actionNote=actionNote.trim();
      body.preventionNote=(window.prompt('재발 방지 메모를 입력하세요.',drill.preventionNote||'')||'').trim();
      if (status==='passed') {
        const occurred=window.prompt('실제 장애 발생 시각(ISO)을 입력하세요. 예: 2026-09-21T09:00:00+09:00');
        const detected=window.prompt('실제 탐지 시각(ISO)을 입력하세요.');
        const recovered=window.prompt('실제 복구 시각(ISO)을 입력하세요.');
        if (!occurred||!detected||!recovered) return;
        const occurredDate=new Date(occurred),detectedDate=new Date(detected),recoveredDate=new Date(recovered);
        if ([occurredDate,detectedDate,recoveredDate].some(date=>!Number.isFinite(date.getTime())) || occurredDate>detectedDate || detectedDate>recoveredDate) { notify('장애 발생·탐지·복구 시각과 순서를 확인하세요.'); return; }
        const checks:[string,string][]=[
          ['imageDigestVerified','승인 이미지 digest를 실제로 대조했습니까?'],
          ['freeswitchConnected','FreeSWITCH 연결을 실제로 확인했습니까?'],
          ['audioPlaybackVerified','음성 재생을 실제로 확인했습니까?'],
          ['noDuplicateDispatch','예약 중복 발신이 없음을 확인했습니까?'],
          ['noMissingDispatch','예약 누락이 없음을 확인했습니까?'],
          ['resultStorageVerified','통화 결과 저장을 실제로 확인했습니까?'],
        ];
        for (const [key,question] of checks) {
          if (!window.confirm(question)) { notify('확인하지 못한 점검이 있어 통과 처리하지 않았습니다.'); return; }
          body[key]=true;
        }
        Object.assign(body,{occurredAt:occurredDate.toISOString(),detectedAt:detectedDate.toISOString(),recoveredAt:recoveredDate.toISOString()});
      }
    }
    setRecoveryBusy(drill.id);
    try {
      const response=await authFetch(`${SERVER_URL}/console/recovery-drills/${encodeURIComponent(drill.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      await requireJson(response,'복구 훈련 상태 변경 실패');
      notify('복구 훈련 기록을 저장했습니다.','success');
      await fetchRecoveryDrills();
    } catch(error:any){notify(error?.message||'복구 훈련 상태 변경 실패');}
    finally{setRecoveryBusy('');}
  };

  const fetchOperatorCommands = async () => {
    try {
      const response=await authFetch(`${SERVER_URL}/console/operator-commands`);
      const data=await requireJson(response,'운영 명령 이력 조회 실패');
      setOperatorCommands(Array.isArray(data?.commands)?data.commands:[]);
    } catch(error:any){notify(error?.message||'운영 명령 이력 조회 실패');}
  };

  const runOperatorCommand = async (command:string) => {
    if (operatorCommandReason.trim().length<5){notify('실행 사유를 5자 이상 입력하세요.');return;}
    setOperatorCommandBusy(command);
    try{
      const response=await authFetch(`${SERVER_URL}/console/operator-commands`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,reason:operatorCommandReason.trim()})});
      const result=await requireJson(response,'운영 점검 실행 실패');
      notify(result.status==='succeeded'?'운영 점검을 완료했습니다.':'운영 점검이 실패했습니다.',result.status==='succeeded'?'success':'error');
      await fetchOperatorCommands();
    }catch(error:any){notify(error?.message||'운영 점검 실행 실패');}
    finally{setOperatorCommandBusy('');}
  };

  const fetchSupportTickets = async () => {
    setSupportLoading(true);
    try {
      const response = await authFetch(`${SERVER_URL}/console/support-tickets`);
      const data = await requireJson(response, '고객지원 티켓 조회 실패');
      setSupportTickets(Array.isArray(data) ? data : []);
      setSupportPage(1);
    } catch (error: any) {
      notify(error?.message || '고객지원 티켓 조회 실패');
    } finally {
      setSupportLoading(false);
    }
  };

  const createSupportTicket = async () => {
    const orgId = window.prompt('기관 ID를 입력하세요.');
    if (!orgId?.trim()) return;
    const title = window.prompt('문의 제목을 입력하세요.');
    if (!title?.trim()) return;
    const description = window.prompt('문의 내용과 확인한 증상을 입력하세요.');
    if (!description?.trim()) return;
    const severityInput = window.prompt('심각도: low / medium / high / critical', 'medium');
    if (!severityInput) return;
    const severity = severityInput.trim().toLowerCase();
    if (!['low','medium','high','critical'].includes(severity)) { notify('심각도 값을 확인해 주세요.'); return; }
    const callId = window.prompt('관련 통화 ID가 있으면 입력하세요. (선택)', '') ?? '';
    setSupportBusy('create');
    try {
      const response = await authFetch(`${SERVER_URL}/console/support-tickets`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ orgId:orgId.trim(), title:title.trim(), description:description.trim(), severity, ...(callId.trim()?{callId:callId.trim()}:{}) }),
      });
      await requireJson(response, '고객지원 티켓 생성 실패');
      notify('고객지원 티켓을 생성했습니다.', 'success');
      await fetchSupportTickets();
    } catch (error:any) { notify(error?.message || '고객지원 티켓 생성 실패'); }
    finally { setSupportBusy(''); }
  };

  const updateSupportTicket = async (ticket:any, status:string) => {
    const assignee = window.prompt('담당자 이름 또는 팀을 입력하세요.', ticket.assignee || '') ?? undefined;
    if (assignee === undefined) return;
    const operatorNote = window.prompt('조치 내용 또는 기관 안내 내용을 입력하세요.', ticket.operatorNote || '') ?? undefined;
    if (!operatorNote?.trim()) { notify('조치 기록을 입력해 주세요.'); return; }
    setSupportBusy(ticket.id);
    try {
      const response = await authFetch(`${SERVER_URL}/console/support-tickets/${encodeURIComponent(ticket.id)}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status,assignee:assignee.trim(),operatorNote:operatorNote.trim()}),
      });
      await requireJson(response, '티켓 상태 변경 실패');
      notify('티켓 처리 기록을 저장했습니다.', 'success');
      await fetchSupportTickets();
    } catch(error:any) { notify(error?.message || '티켓 상태 변경 실패'); }
    finally { setSupportBusy(''); }
  };

  const fetchCallDiagnostic = async (rawId?:string) => {
    const callId=(rawId ?? diagnosticCallId).trim();
    if(!callId){ notify('통화 ID를 입력해 주세요.'); return; }
    setDiagnosticLoading(true); setDiagnostic(null);
    try {
      const response=await authFetch(`${SERVER_URL}/console/call-diagnostics/${encodeURIComponent(callId)}`);
      setDiagnostic(await requireJson(response,'통화 진단 조회 실패'));
    } catch(error:any){ notify(error?.message || '통화 진단 조회 실패'); }
    finally{ setDiagnosticLoading(false); }
  };

  const retryPrivacyPurge = async (job: any) => {
    if (!window.confirm(`${job.orgId || '기관 미확인'} · ${job.maskedPhone || '번호 비공개'} 파기 작업을 재시도할까요?`)) return;
    setPrivacyRetryBusy(job.id);
    try {
      const response = await authFetch(`${SERVER_URL}/console/approvals`, { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'privacy_purge_retry', targetId:job.id, reason:'개인정보 파기 실패 확인 후 재시도 요청', payload:{} }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { notify(errMsg(data, '개인정보 파기 재시도 실패')); return; }
      notify('개인정보 파기 재시도 승인 요청을 등록했습니다.', 'success');
      await fetchHealth();
    } catch (e: any) {
      notify(e?.message || '개인정보 파기 재시도 실패');
    } finally {
      setPrivacyRetryBusy('');
    }
  };

  const updateCallEngineProvider = async () => {
    const reason = callEngineReason.trim();
    if (reason.length < 3) { notify('전환 사유를 3자 이상 입력해 주세요.'); return; }
    if (nextCallEngineProvider === 'openai' && callEngineProvider?.runtime?.openaiReady !== true) {
      notify('OpenAI Live가 통화 가능한 상태가 아니어서 전환할 수 없습니다.'); return;
    }
    const confirmation = window.prompt(`신규 070 통화의 AI 엔진을 ${nextCallEngineProvider === 'gemini' ? 'Gemini Live' : 'OpenAI Live'}로 전환합니다.\n계속하려면 ENGINE CHANGE를 입력하세요.`);
    if (confirmation !== 'ENGINE CHANGE') {
      if (confirmation !== null) notify('확인 문구가 일치하지 않아 전환하지 않았습니다.');
      return;
    }
    setCallEngineBusy(true);
    try {
      const response = await authFetch(`${SERVER_URL}/admin/call-engine/provider`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ provider:nextCallEngineProvider, reason }),
      });
      const updated = await requireJson(response, 'AI 엔진 전환 실패');
      setCallEngineProvider(updated);
      setNextCallEngineProvider(updated.provider);
      setCallEngineReason('');
      notify('신규 070 통화의 AI 엔진을 전환했습니다.', 'success');
      await fetchHealth();
    } catch (error:any) { notify(error?.message || 'AI 엔진 전환 실패'); }
    finally { setCallEngineBusy(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyOrg) params.set('org', historyOrg);
      const r = await authFetch(`${SERVER_URL}/console/calls/history?${params.toString()}`);
      const d = await requireJson(r, '통화 이력 조회 실패');
      setHistory(Array.isArray(d?.calls) ? d.calls : []);
      setHistoryPage(1);
    } catch (e:any) { notify(e?.message || '통화 이력 조회 실패'); }
    finally { setHistoryLoading(false); }
  };

  const fetchSubs = async () => {
    setSubsLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/subscriptions`);
      const d = await requireJson(r, '정기결제 현황 조회 실패');
      setSubs(Array.isArray(d?.orgs) ? d.orgs : []);
      setSubsPage(1);
    } catch (e:any) { notify(e?.message || '정기결제 현황 조회 실패'); }
    finally { setSubsLoading(false); }
  };

  const openOperationDialog = (kind:'retry'|'refund'|'suspend', target:any, reason='') => {
    operationReturnFocus.current=document.activeElement as HTMLElement;
    setOperationDialog({kind,target}); setOperationReason(reason); setOperationConfirmId('');
    window.setTimeout(()=>operationFirstRef.current?.focus(),0);
  };
  const closeOperationDialog = () => {
    if(operationBusy)return;
    setOperationDialog(null); setOperationReason(''); setOperationConfirmId('');
    window.setTimeout(()=>operationReturnFocus.current?.focus(),0);
  };
  const handleOperationDialogKeyDown = (event:any) => {
    if(event.key==='Escape'&&!operationBusy){event.preventDefault();closeOperationDialog();return;}
    if(event.key!=='Tab')return;
    const items=Array.from(operationDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')||[]);
    if(!items.length){event.preventDefault();operationDialogRef.current?.focus();return;}
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  const submitOperationDialog = async () => {
    if(!operationDialog)return;
    const {kind,target}=operationDialog;
    const reason=operationReason.trim();
    if((kind==='retry'||kind==='refund')&&reason.length<5){notify('사유를 5자 이상 입력하세요');operationFirstRef.current?.focus();return;}
    const expectedConfirmId=kind==='refund'?target.id:target.orgId;
    if(operationConfirmId!==expectedConfirmId){notify(`${kind==='refund'?'결제':'기관'} ID가 일치하지 않습니다`);return;}
    setOperationBusy(true);
    try{
      if(kind==='retry'){
        const track=target.track as 'app'|'pstn'; const busyKey=`${target.orgId}:${track}`; setSubscriptionRetryBusy(busyKey);
        const response=await authFetch(`${SERVER_URL}/console/approvals`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'subscription_retry',targetId:target.orgId,reason,payload:{track,confirmOrgId:operationConfirmId}})});
        const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(errMsg(data,'수동 재청구 실패'));
        notify('수동 재청구 승인 요청을 등록했습니다.','success'); await fetchSubs(); setSubscriptionRetryBusy('');
      }else if(kind==='refund'){
        setRefundBusy(target.id);
        const response=await authFetch(`${SERVER_URL}/console/payments/${target.id}/refund`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});
        const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(errMsg(data,'환불 실패'));
        notify(`환불 완료: ${Number(data.amount||0).toLocaleString()}원`,'success'); await fetchRefundable(); setRefundBusy('');
      }else{
        const verb=target.nextSuspended?'정지':'재개'; setOrgBusy(target.orgId);
        const response=await authFetch(`${SERVER_URL}/console/orgs/${target.orgId}/suspend`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({suspended:target.nextSuspended})});
        const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(errMsg(data,`${verb} 실패`));
        notify(`"${target.name}" 기관을 ${verb}했습니다.`,'success'); await fetchOrgs(); setOrgBusy('');
      }
      setOperationDialog(null); setOperationReason(''); setOperationConfirmId('');
      window.setTimeout(()=>operationReturnFocus.current?.focus(),0);
    }catch(error:any){notify(error?.message||'작업 처리 실패');}
    finally{setOperationBusy(false);setSubscriptionRetryBusy('');setRefundBusy('');setOrgBusy('');}
  };

  const retryFailedSubscription = async (subscription: any) => {
    const track = subscription.track as 'app'|'pstn';
    if (!track || !subscription.lastChargeError) { notify('재청구 가능한 실패 구독이 아닙니다'); return; }
    openOperationDialog('retry', subscription, '자동결제 실패 확인 후 수동 재시도');
  };

  const fetchPaymentCalendar = async () => {
    setCalendarLoading(true);
    try {
      const [paymentsResponse, subscriptionsResponse] = await Promise.all([
        authFetch(`${SERVER_URL}/console/payments?limit=500`),
        authFetch(`${SERVER_URL}/console/subscriptions`),
      ]);
      const [paymentData, subscriptionData] = await Promise.all([
        requireJson(paymentsResponse, '결제 일정 조회 실패'),
        requireJson(subscriptionsResponse, '정기결제 일정 조회 실패'),
      ]);
      setCalendarPayments(Array.isArray(paymentData?.payments) ? paymentData.payments : []);
      setCalendarSubs(Array.isArray(subscriptionData?.orgs) ? subscriptionData.orgs : []);
    } catch (e:any) { notify(e?.message || '결제 달력 조회 실패'); }
    finally { setCalendarLoading(false); }
  };

  const fetchOrgs = async () => {
    try {
      const r = await authFetch(`${SERVER_URL}/admin/orgs`);
      const d = await requireJson(r, '기관 목록 조회 실패');
      setOrgs(Array.isArray(d) ? d : []); setOrgsPage(1);
    } catch (e:any) { notify(e?.message || '기관 목록 조회 실패'); }
  };
  const toggleOrgSuspend = async (org: any, nextSuspended: boolean) => {
    openOperationDialog('suspend', {...org,nextSuspended}, '');
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
  const editOrgLifecycle = async (org:any) => {
    const contractStatus = window.prompt('계약 상태: prospect / contracted / expired / terminated', org.contractStatus || 'prospect');
    if (!contractStatus || !['prospect','contracted','expired','terminated'].includes(contractStatus)) { if(contractStatus!==null) notify('계약 상태 값이 올바르지 않습니다'); return; }
    const rolloutStage = window.prompt('도입 단계: preparing / testing / operating / paused / terminated', org.rolloutStage || 'preparing');
    if (!rolloutStage || !['preparing','testing','operating','paused','terminated'].includes(rolloutStage)) { if(rolloutStage!==null) notify('도입 단계 값이 올바르지 않습니다'); return; }
    const contractStartAt = window.prompt('계약 시작일 YYYY-MM-DD (없으면 비움)', org.contractStartAt || ''); if(contractStartAt===null)return;
    const contractEndAt = window.prompt('계약 종료일 YYYY-MM-DD (없으면 비움)', org.contractEndAt || ''); if(contractEndAt===null)return;
    const primaryContactName = window.prompt('기관 담당자 이름', org.primaryContactName || ''); if(primaryContactName===null)return;
    const emergencyContactName = window.prompt('비상 연락 담당자 이름', org.emergencyContactName || ''); if(emergencyContactName===null)return;
    const callMode = window.prompt('통화 방식: app / pstn / both', org.callMode || 'both');
    if (!callMode || !['app','pstn','both'].includes(callMode)) { if(callMode!==null) notify('통화 방식이 올바르지 않습니다'); return; }
    const terminated = rolloutStage==='terminated';
    const terminationDataExported = terminated ? window.confirm('해지 전 기관 데이터 내보내기를 완료했습니까?') : !!org.terminationDataExported;
    const terminationPurgeConfirmed = terminated ? window.confirm('보존기간과 파기 대상을 확인했습니까?') : !!org.terminationPurgeConfirmed;
    setOrgBusy(org.orgId);
    try {
      const r=await authFetch(`${SERVER_URL}/console/orgs/${encodeURIComponent(org.orgId)}/lifecycle`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractStatus,rolloutStage,contractStartAt:contractStartAt||null,contractEndAt:contractEndAt||null,primaryContactName,primaryContactPhone:'',emergencyContactName,emergencyContactPhone:'',callMode,featureFlags:org.featureFlags||{},terminationDataExported,terminationPurgeConfirmed})});
      await requireJson(r,'기관 운영정보 저장 실패'); notify('기관 계약·도입 정보를 저장했습니다.','success'); await fetchOrgs();
    } catch(e:any){notify(e?.message||'기관 운영정보 저장 실패');} finally{setOrgBusy('');}
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/audit-logs`);
      const d = await requireJson(r, '감사 로그 조회 실패');
      setAuditLogs(Array.isArray(d?.logs) ? d.logs : []);
      setAuditPage(1);
    } catch (e:any) { notify(e?.message || '감사 로그 조회 실패'); }
    finally { setAuditLoading(false); }
  };

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (paymentsOrg) params.set('org', paymentsOrg);
      const r = await authFetch(`${SERVER_URL}/console/payments?${params.toString()}`);
      const d = await requireJson(r, '결제 내역 조회 실패');
      setPayments(Array.isArray(d?.payments) ? d.payments : []);
      setPaymentsPage(1);
    } catch (e:any) { notify(e?.message || '결제 내역 조회 실패'); }
    finally { setPaymentsLoading(false); }
  };

  const fetchRefundable = async () => {
    setRefundLoading(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/payments?status=paid`);
      const d = await requireJson(r, '환불 대상 조회 실패');
      setRefundable(Array.isArray(d?.payments) ? d.payments.filter((p:any)=>p.type === 'topup' || p.type === 'subscription') : []);
      setRefundPage(1);
    } catch (e:any) { notify(e?.message || '환불 대상 조회 실패'); }
    finally { setRefundLoading(false); }
  };
  const reconcilePayment = async (payment: any) => {
    if (!window.confirm(`결제 ${payment.id}를 PortOne 원본 거래와 대조합니다.\n확인 가능한 누락 처리만 자동 복구하고, 불일치는 수동 검토로 남깁니다. 계속할까요?`)) return;
    setPaymentReconcileBusy(payment.id);
    try {
      const r = await authFetch(`${SERVER_URL}/console/payments/${payment.id}/reconcile`, { method:'POST' });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { notify(errMsg(d, '결제 대조 실패')); return; }
      notify(d.message || '결제 대조를 완료했습니다.', d.action === 'recovered' || d.action === 'already_complete' ? 'success' : 'info');
      await fetchPayments();
    } catch { notify('네트워크 오류 — 결제 대조 실패'); }
    finally { setPaymentReconcileBusy(''); }
  };
  const doRefund = async (payment: any) => {
    openOperationDialog('refund', payment, '');
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
      const regRes = await authFetch(`${SERVER_URL}/console/test/subscribe/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId: testOrgId, planKey: testPlanKey, billingKeyMethod: 'CARD' }) });
      const reg = await regRes.json().catch(()=>({}));
      if (!regRes.ok) { logTest(`❌ 빌링키 발급 요청 실패: ${errMsg(reg,'실패')}`); return; }
      logTest(`✅ 빌링키 발급 요청 생성됨(issueId=${reg.issueId}, ${reg.amount.toLocaleString()}원) — 카드 등록창 호출...`);

      const { requestIssueBillingKey } = await import('@portone/browser-sdk/v2');
      const response = await requestIssueBillingKey({
        storeId: reg.storeId, channelKey: reg.channelKey, billingKeyMethod: reg.billingKeyMethod,
        issueId: reg.issueId, issueName: reg.issueName,
        customer: { customerId: reg.customerId, email: authUser.email, fullName: '테스트', phoneNumber: '01000000000' },
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

  const testSubscribeDirectFlow = async () => {
    if (!testOrgId) { notify('먼저 대상 기관을 선택하세요'); return; }
    if (!/^\d{6}$/.test(testCardBin)) { notify('카드 BIN 앞 6자리를 입력하세요'); return; }
    setTestBusy('subscribe-direct');
    logTest(`샌드박스 API 정액제 테스트 시작 — ${testOrgId}, ${testPlanKey}`);
    try {
      const r = await authFetch(`${SERVER_URL}/console/test/subscribe/direct`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orgId: testOrgId, planKey: testPlanKey, cardBin: testCardBin }),
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { logTest(`❌ 샌드박스 자동결제 실패: ${errMsg(d,'실패')}`); return; }
      logTest(`✅ 빌링키 발급 및 첫 결제 승인 완료(${d.amount?.toLocaleString()}원) — 자동결제 등록됨`);
      notify('샌드박스 정액제 테스트 완료', 'success');
      setTestCardBin('');
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
      setStatsOrgPage(1);
    } catch { notify('통계 조회 실패'); }
    finally { setStatsLoading(false); }
  };
  const orgName = (orgId: string) => orgs.find((o: any) => o.orgId === orgId)?.name || orgId;
  const fetchPilotMetrics = async () => {
    if (!statsOrg) { notify('파일럿 기관을 먼저 선택하세요'); return; }
    if (!pilotReportId) { notify('대상자가 지정된 파일럿을 선택하세요'); return; }
    setPilotLoading(true);
    try {
      const params = new URLSearchParams({ org: statsOrg, from: pilotFrom, to: pilotTo });
      params.set('pilotId', pilotReportId);
      const r = await authFetch(`${SERVER_URL}/console/pilot-metrics?${params.toString()}`);
      const raw = await requireJson(r, '파일럿 지표 조회 실패');
      setPilotData(parseOr(PilotMetricsSchema, raw, null));
    } catch (e:any) { notify(e?.message || '파일럿 지표 조회 실패'); }
    finally { setPilotLoading(false); }
  };
  const fetchPilotPrograms = async () => {
    try {
      const r = await authFetch(`${SERVER_URL}/console/pilot-programs`);
      setPilotPrograms(await requireJson(r, '파일럿 운영 목록 조회 실패'));
    } catch (e:any) { notify(e?.message || '파일럿 운영 목록 조회 실패'); }
  };
  const createPilotProgram = async () => {
    if (!statsOrg || !pilotOwner.trim()) { notify('기관과 운영 담당자를 입력하세요'); return; }
    const participantPhones = pilotParticipantPhones.split(/[\s,]+/).map(v=>v.replace(/-/g,'')).filter(Boolean);
    if (participantPhones.length !== Number(pilotSubjectCount)) { notify('대상자 번호를 대상자 수만큼 입력하세요'); return; }
    setPilotProgramBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/pilot-programs`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orgId:statsOrg,startDate:pilotFrom,endDate:pilotTo,subjectCount:Number(pilotSubjectCount),participantPhones,ownerName:pilotOwner.trim(),callMode:'pstn070'})});
      await requireJson(r, '파일럿 운영 등록 실패');
      notify('14일 파일럿 계획을 등록했습니다');
      setPilotParticipantPhones('');
      await fetchPilotPrograms();
    } catch (e:any) { notify(e?.message || '파일럿 운영 등록 실패'); }
    finally { setPilotProgramBusy(false); }
  };
  const openPilotStatusDialog = (program:any, status:'active'|'completed'|'stopped') => {
    pilotDialogReturnFocus.current = document.activeElement as HTMLElement;
    setPilotStatusDialog({program,status}); setPilotStatusReason(''); setPilotReadinessConfirmed(status!=='active');
    setPilotReadinessChecks({consentConfirmed:false,emergencyContactsConfirmed:false,scheduleConfirmed:false,callEngineHealthy:false,approvedImageDigestConfirmed:false});
    window.setTimeout(()=>pilotReasonRef.current?.focus(), 0);
  };
  const closePilotStatusDialog = () => {
    setPilotStatusDialog(null); setPilotStatusReason(''); setPilotReadinessConfirmed(false);
    window.setTimeout(()=>pilotDialogReturnFocus.current?.focus(), 0);
  };
  const handlePilotDialogKeyDown = (event:any) => {
    if (event.key==='Escape'&&!pilotProgramBusy) { event.preventDefault(); closePilotStatusDialog(); return; }
    if (event.key!=='Tab') return;
    const items=Array.from(pilotDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]')||[]);
    if (!items.length) { event.preventDefault(); pilotDialogRef.current?.focus(); return; }
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  const changePilotStatus = async () => {
    if (!pilotStatusDialog) return;
    const {program:p,status} = pilotStatusDialog;
    const label = status==='active'?'시작':status==='completed'?'완료':'중단';
    const reason = pilotStatusReason.trim();
    if (reason.length<5) { notify(`${label} 사유를 5자 이상 입력하세요`); pilotReasonRef.current?.focus(); return; }
    if (status==='active' && (!pilotReadinessConfirmed || Object.values(pilotReadinessChecks).some(value=>!value))) { notify('시작 전 필수 조건을 모두 확인해야 합니다'); return; }
    setPilotProgramBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/pilot-programs/${encodeURIComponent(p.id)}/status`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,reason,readinessConfirmed:pilotReadinessConfirmed,readinessChecks:status==='active'?pilotReadinessChecks:undefined})});
      await requireJson(r, `파일럿 ${label} 실패`); notify(`파일럿을 ${label} 처리했습니다`); closePilotStatusDialog(); await fetchPilotPrograms();
    } catch(e:any) { notify(e?.message || `파일럿 ${label} 실패`); }
    finally { setPilotProgramBusy(false); }
  };

  const fetchPilotEvidence = async (pilotId=pilotEvidenceProgramId) => {
    if (!pilotId) { setPilotEvidence([]); return; }
    setPilotEvidenceBusy(true);
    try {
      const r=await authFetch(`${SERVER_URL}/console/pilot-programs/${encodeURIComponent(pilotId)}/daily-evidence`);
      const raw=await requireJson(r,'파일럿 일일 증거 조회 실패');
      setPilotEvidence(parseOr(PilotDailyEvidenceListSchema,raw,{evidence:[]}).evidence);
    } catch(e:any) { notify(e?.message||'파일럿 일일 증거 조회 실패'); }
    finally { setPilotEvidenceBusy(false); }
  };
  const savePilotEvidence = async () => {
    if (!pilotEvidenceProgramId || !pilotEvidenceForm.date) { notify('파일럿과 날짜를 선택하세요'); return; }
    const sampleCallIds=pilotEvidenceForm.sampleCallIds.split(/[\s,]+/).map(v=>v.trim()).filter(Boolean);
    setPilotEvidenceBusy(true);
    try {
      const body={
        sampleCallIds,voiceQualityScore:Number(pilotEvidenceForm.voiceQualityScore),operatorMinutes:Number(pilotEvidenceForm.operatorMinutes),
        urgentAckMinutes:pilotEvidenceForm.urgentAckMinutes===''?null:Number(pilotEvidenceForm.urgentAckMinutes),
        resolutionMinutes:pilotEvidenceForm.resolutionMinutes===''?null:Number(pilotEvidenceForm.resolutionMinutes),
        issueFlags:pilotEvidenceForm.issueFlags,incidentNote:pilotEvidenceForm.incidentNote||undefined,actionNote:pilotEvidenceForm.actionNote||undefined,
      };
      const r=await authFetch(`${SERVER_URL}/console/pilot-programs/${encodeURIComponent(pilotEvidenceProgramId)}/daily-evidence/${pilotEvidenceForm.date}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const saved=await requireJson(r,'파일럿 일일 증거 저장 실패');
      notify(saved.pilotStopped?'중단 조건이 감지되어 파일럿을 중단했습니다':'파일럿 일일 증거를 저장했습니다',saved.pilotStopped?'error':'success');
      await Promise.all([fetchPilotEvidence(pilotEvidenceProgramId),fetchPilotPrograms()]);
    } catch(e:any) { notify(e?.message||'파일럿 일일 증거 저장 실패'); setPilotEvidenceBusy(false); }
  };

  const downloadPilotSlaCsv = () => {
    if (!pilotData || !statsOrg) { notify('먼저 기관 SLA 지표를 조회하세요'); return; }
    const evidence=pilotEvidence.filter((e:any)=>e.pilotId===pilotReportId&&e.date>=pilotFrom&&e.date<=pilotTo);
    const terminal = pilotData.completed + pilotData.missed + pilotData.failed;
    const answeredBase = pilotData.completed + pilotData.missed;
    const connectionRate = answeredBase ? pilotData.completed / answeredBase : null;
    const targets = [
      { metric:'예약 발신률', value:pilotData.attemptRate, target:0.99, pass:pilotData.attemptRate != null && pilotData.attemptRate >= 0.99, unit:'%' },
      { metric:'연결률', value:connectionRate, target:0.8, pass:connectionRate != null && connectionRate >= 0.8, unit:'%' },
      { metric:'기술 실패율', value:pilotData.technicalFailureRate, target:0.01, pass:pilotData.technicalFailureRate != null && pilotData.technicalFailureRate < 0.01, unit:'%' },
      { metric:'결과 저장률', value:pilotData.resultCompletenessRate, target:1, pass:pilotData.resultCompletenessRate != null && pilotData.resultCompletenessRate >= 1, unit:'%' },
    ];
    const ack = evidence.map((e:any)=>e.urgentAckMinutes).filter((v:any)=>v!=null);
    const resolution = evidence.map((e:any)=>e.resolutionMinutes).filter((v:any)=>v!=null);
    const voiceAverage = evidence.length ? evidence.reduce((sum:number,e:any)=>sum+Number(e.voiceQualityScore||0),0)/evidence.length : null;
    const ackRate = ack.length ? ack.filter((v:number)=>v<=15).length/ack.length : null;
    const resolutionRate = resolution.length ? resolution.filter((v:number)=>v<=60).length/resolution.length : null;
    const rows = [
      ['기관', orgName(statsOrg), '조회 기간', `${pilotFrom} ~ ${pilotTo}`],
      ['예정 발신', pilotData.scheduledExpected, '발신 시도', pilotData.scheduledAttempts],
      ['완료', pilotData.completed, '미응답', pilotData.missed],
      ['기술 실패', pilotData.failed, '집계 완료 건', terminal],
      [],
      ['지표', '측정값', '운영 목표', '판정'],
      ...targets.map(item => [item.metric, item.value == null ? '측정 전' : `${(item.value*100).toFixed(1)}${item.unit}`, `${(item.target*100).toFixed(1)}${item.unit}`, item.value == null ? '측정 전' : item.pass ? '충족' : '위반']),
      ['긴급 알림 15분 내 확인율', ackRate==null?'측정 전':`${(ackRate*100).toFixed(1)}%`, '95% 이상', ackRate==null?'측정 전':ackRate>=.95?'충족':'위반'],
      ['60분 내 조치 완료율', resolutionRate==null?'측정 전':`${(resolutionRate*100).toFixed(1)}%`, '95% 이상', resolutionRate==null?'측정 전':resolutionRate>=.95?'충족':'위반'],
      ['음성 품질 평가', voiceAverage==null?'측정 전':voiceAverage.toFixed(2), '평균 4.0 이상·2점 이하 없음', voiceAverage==null?'측정 전':voiceAverage>=4&&!evidence.some((e:any)=>e.voiceQualityScore<=2)?'충족':'위반'],
      ['요금제 초과량', '측정 전', '', '구독 사용량 연동 필요'],
      ['담당자 처리 시간', evidence.length?`${evidence.reduce((sum:number,e:any)=>sum+Number(e.operatorMinutes||0),0)}분`:'측정 전', '', evidence.length?'기록':'측정 전'],
      [],
      ['일일 증거 날짜','표본 통화 ID','음성 품질','운영자 처리시간(분)','중단 조건'],
      ...evidence.map((e:any)=>[e.date,e.sampleCallIds.join(' '),e.voiceQualityScore,e.operatorMinutes,e.issueFlags.join(' ')||'없음']),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `영실이_SLA_${statsOrg}_${pilotFrom}_${pilotTo}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printPilotSlaPdf = () => {
    if (!pilotData || !statsOrg) { notify('먼저 기관 SLA 지표를 조회하세요'); return; }
    const evidence=pilotEvidence.filter((e:any)=>e.pilotId===pilotReportId&&e.date>=pilotFrom&&e.date<=pilotTo);
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) { notify('PDF 출력을 위해 팝업을 허용해 주세요'); return; }
    const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] || c));
    const rows = [
      ['예약 발신률', pilotData.attemptRate],
      ['기술 실패율', pilotData.technicalFailureRate],
      ['결과 저장률', pilotData.resultCompletenessRate],
    ];
    const voiceAverage=evidence.length?evidence.reduce((sum:number,e:any)=>sum+Number(e.voiceQualityScore||0),0)/evidence.length:null;
    popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>영실이 SLA 보고서</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#202124}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #dadce0;padding:10px;text-align:left}@media print{button{display:none}}</style></head><body><h1>기관별 SLA 보고서</h1><p>기관: ${esc(orgName(statsOrg))}</p><p>기간: ${esc(pilotFrom)} ~ ${esc(pilotTo)}</p><table><thead><tr><th>지표</th><th>측정값</th></tr></thead><tbody>${rows.map(([label,value])=>`<tr><td>${esc(label)}</td><td>${value==null?'측정 전':`${(Number(value)*100).toFixed(1)}%`}</td></tr>`).join('')}<tr><td>완료 / 미응답 / 기술 실패</td><td>${esc(pilotData.completed)} / ${esc(pilotData.missed)} / ${esc(pilotData.failed)}</td></tr><tr><td>음성 품질 평균</td><td>${voiceAverage==null?'측정 전':esc(voiceAverage.toFixed(2))}</td></tr><tr><td>일일 증거</td><td>${esc(evidence.length)}일</td></tr></tbody></table><p style="margin-top:18px;color:#5f6368">측정되지 않은 지표는 정상으로 간주하지 않습니다. 전화번호와 대화 원문은 보고서에 포함하지 않습니다.</p><button onclick="window.print()">PDF로 저장 / 인쇄</button></body></html>`);
    popup.document.close();
  };

  const fetchApprovals = async () => {
    setApprovalLoading(true);
    try {
      const [a,p,n] = await Promise.all([authFetch(`${SERVER_URL}/console/approvals`),authFetch(`${SERVER_URL}/console/privacy-summary`),authFetch(`${SERVER_URL}/console/notification-deliveries`)]);
      const [ad,pd,nd] = await Promise.all([requireJson(a,'승인 목록 조회 실패'),requireJson(p,'개인정보 현황 조회 실패'),requireJson(n,'알림 전달 내역 조회 실패')]);
      setApprovals(Array.isArray(ad?.approvals)?ad.approvals:[]); setApprovalsPage(1); setPrivacySummary(pd); setNotificationDeliveries(Array.isArray(nd?.deliveries)?nd.deliveries:[]);
    } catch(e:any) { notify(e?.message || '운영 통제 현황 조회 실패'); } finally { setApprovalLoading(false); }
  };
  const decideApproval = async (item:any, approve:boolean) => {
    const note = window.prompt(approve?'승인 사유를 입력하세요.':'반려 사유를 입력하세요.','검토 결과 이상 없음');
    if (!note || note.trim().length < 3) return;
    setApprovalBusy(item.id);
    try { const r=await authFetch(`${SERVER_URL}/console/approvals/${encodeURIComponent(item.id)}/${approve?'approve':'reject'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note:note.trim()})}); await requireJson(r,approve?'승인 실행 실패':'반려 실패'); notify(approve?'승인 작업을 실행했습니다.':'요청을 반려했습니다.','success'); await fetchApprovals(); }
    catch(e:any){notify(e?.message||'승인 처리 실패');} finally{setApprovalBusy('');}
  };

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
  /**
   * 체험 전화 '번호당 1회' 해제. 인증 없이 열린 발신 경로(POST /demo/call)의 방어를
   * 한 칸 여는 동작이라 사유를 반드시 받고, 서버가 신청 이력을 보관한 뒤 지운다.
   */
  const resetDemoCall = async () => {
    const phone = demoResetPhone.replace(/\D/g, '');
    const reason = demoResetReason.trim();
    if (!/^01[016789]\d{7,8}$/.test(phone)) { notify('휴대폰 번호 형식이 올바르지 않습니다'); return; }
    if (!reason) { notify('해제 사유를 입력하세요'); return; }
    if (!window.confirm(`${demoResetPhone}\n\n이 번호의 체험 전화 1회 제한을 해제합니다.\n해제하면 이 번호로 체험 전화를 다시 신청할 수 있습니다. 계속할까요?`)) return;
    setDemoResetBusy(true);
    try {
      const r = await authFetch(`${SERVER_URL}/console/demo-calls/${encodeURIComponent(phone)}/reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(errMsg(d, '체험 제한 해제 실패')); return; }
      notify('체험 전화 제한을 해제했습니다.', 'success');
      setDemoResetPhone(''); setDemoResetReason('');
    } catch { notify('네트워크 오류 — 체험 제한 해제 실패'); }
    finally { setDemoResetBusy(false); }
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
      // 콘솔 전용 이관 액션(orgId만 변경) — CS 담당자도 이걸로만 이관 가능(범용 upsert는 차단됨)
      const r = await authFetch(`${SERVER_URL}/console/elders/${encodeURIComponent(elder.phone)}/transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: targetOrgId.trim() }),
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
      setNoticesPage(1);
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
      setCsAccountsPage(1);
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
    if (page === 'incidents') fetchIncidents();
    if (page === 'recovery') { fetchRecoveryDrills(); if (orgs.length === 0) fetchOrgs(); }
    if (page === 'commands') fetchOperatorCommands();
    if (page === 'support') fetchSupportTickets();
    if (page === 'approvals') fetchApprovals();
    if (page === 'health') fetchHealth();
    if (page === 'calls') fetchHistory();
    if (page === 'subscriptions') fetchSubs();
    if (page === 'payment-calendar') fetchPaymentCalendar();
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

  useEffect(() => {
    if (page !== 'help' || helpContent) return;
    let cancelled = false;
    setHelpLoading(true);
    setHelpError('');
    fetch('/help/console-guide.html', { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error(`도움말 응답 오류(${response.status})`);
        return response.text();
      })
      .then(html => { if (!cancelled) setHelpContent(html); })
      .catch(error => { if (!cancelled) setHelpError(error?.message || '도움말을 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setHelpLoading(false); });
    return () => { cancelled = true; };
  }, [page, helpContent, helpRetry]);

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
      <a className="skip-link" href="#console-main">주요 콘텐츠로 바로가기</a>
      {toast && (
        <div className="toast-viewport">
          <div className={`toast toast--${toast.tone}`} role={toast.tone==='error'?'alert':'status'} aria-live={toast.tone==='error'?'assertive':'polite'} aria-atomic="true">{toast.message}</div>
        </div>
      )}
      {pilotStatusDialog && (()=>{
        const label=pilotStatusDialog.status==='active'?'시작':pilotStatusDialog.status==='completed'?'완료':'중단';
        return <div className="modal-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)closePilotStatusDialog();}}>
          <div ref={pilotDialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="pilot-status-title" aria-describedby="pilot-status-description" onKeyDown={handlePilotDialogKeyDown} tabIndex={-1} style={{maxWidth:520}}>
            <h2 id="pilot-status-title" style={{marginTop:0}}>14일 파일럿 {label}</h2>
            <p id="pilot-status-description" style={{color:'#5f6368',fontSize:13}}>{orgName(pilotStatusDialog.program.orgId)} · {pilotStatusDialog.program.startDate} ~ {pilotStatusDialog.program.endDate}</p>
            <label htmlFor="pilot-status-reason" style={{display:'block',fontSize:13,fontWeight:600,marginTop:16}}>사유</label>
            <textarea ref={pilotReasonRef} id="pilot-status-reason" className="form-input" rows={4} maxLength={500} value={pilotStatusReason} onChange={e=>setPilotStatusReason(e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:6}} placeholder={`${label} 사유를 5자 이상 입력하세요`}/>
            {pilotStatusDialog.status==='active'&&<div style={{display:'grid',gap:7,marginTop:14,fontSize:13}}>{[
              ['consentConfirmed','대상자 동의'],['emergencyContactsConfirmed','비상 연락망'],['scheduleConfirmed','예약 일정'],['callEngineHealthy','콜엔진 정상'],['approvedImageDigestConfirmed','승인 이미지 digest'],
            ].map(([key,text])=><label key={key} style={{display:'flex',gap:8}}><input type="checkbox" checked={(pilotReadinessChecks as any)[key]} onChange={e=>setPilotReadinessChecks(v=>({...v,[key]:e.target.checked}))}/>{text} 확인</label>)}<label style={{display:'flex',gap:9,alignItems:'flex-start',marginTop:5,lineHeight:1.55}}><input type="checkbox" checked={pilotReadinessConfirmed} onChange={e=>setPilotReadinessConfirmed(e.target.checked)} style={{marginTop:3}}/><span>위 확인 결과를 근거로 070 파일럿 시작을 승인합니다.</span></label></div>}
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}><button className="btn-secondary" disabled={pilotProgramBusy} onClick={closePilotStatusDialog}>취소</button><button className="btn-primary" disabled={pilotProgramBusy||pilotStatusReason.trim().length<5||(pilotStatusDialog.status==='active'&&(!pilotReadinessConfirmed||Object.values(pilotReadinessChecks).some(value=>!value)))} onClick={changePilotStatus}>{pilotProgramBusy?'처리 중...':`${label} 확정`}</button></div>
          </div>
        </div>;
      })()}
      {operationDialog&&(()=>{
        const {kind,target}=operationDialog;
        const isRetry=kind==='retry',isRefund=kind==='refund';
        const title=isRetry?'수동 재청구 승인 요청':isRefund?'결제 환불':'기관 이용 상태 변경';
        const expectedId=isRefund?target.id:target.orgId;
        const impact=isRetry
          ? `${target.track==='app'?'앱 전화':'일반 전화'} ${Number(target.monthlyAmount||0).toLocaleString()}원 재청구를 승인 대기열에 등록합니다. 승인 전에는 청구되지 않습니다.`
          : isRefund
            ? (target.type==='subscription'?`${Number(target.amount||0).toLocaleString()}원을 전액 환불하고 현재 구독과 다음 자동결제를 종료합니다.`:'결제 원장을 확인해 남은 미사용 유상 크레딧만 환불하고 회수합니다.')
            : target.nextSuspended?'소속 직원의 로그인과 기관 기능 이용이 차단됩니다.':'소속 직원의 기관 기능 이용을 다시 허용합니다.';
        return <div className="modal-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)closeOperationDialog();}}>
          <div ref={operationDialogRef} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="operation-title" aria-describedby="operation-impact" tabIndex={-1} onKeyDown={handleOperationDialogKeyDown} style={{maxWidth:540}}>
            <h2 id="operation-title" style={{marginTop:0}}>{title}</h2>
            <div style={{background:'#f8fafc',border:'1px solid #dadce0',borderRadius:8,padding:12,fontSize:13,lineHeight:1.65}}>
              <div><strong>기관:</strong> {target.orgName||target.name||target.orgId}</div>
              {isRefund&&<div><strong>결제:</strong> {target.id} · {Number(target.amount||0).toLocaleString()}원</div>}
              <div id="operation-impact" style={{color:isRefund||target.nextSuspended?'#b3261e':'#5f6368',marginTop:5}}>{impact}</div>
            </div>
            {(isRetry||isRefund)&&<><label htmlFor="operation-reason" style={{display:'block',fontSize:13,fontWeight:600,marginTop:15}}>처리 사유</label><textarea ref={operationFirstRef as any} id="operation-reason" className="form-input" rows={3} maxLength={500} value={operationReason} onChange={e=>setOperationReason(e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:6}}/></>}
            <label htmlFor="operation-confirm-id" style={{display:'block',fontSize:13,fontWeight:600,marginTop:15}}>{isRefund?'결제':'기관'} ID 재입력</label>
            <input ref={(!isRetry&&!isRefund?operationFirstRef:undefined) as any} id="operation-confirm-id" className="form-input" autoComplete="off" value={operationConfirmId} onChange={e=>setOperationConfirmId(e.target.value)} placeholder={expectedId} style={{width:'100%',boxSizing:'border-box',marginTop:6}}/>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}><button className="btn-secondary" disabled={operationBusy} onClick={closeOperationDialog}>취소</button><button className="btn-primary" disabled={operationBusy||operationConfirmId!==expectedId||((isRetry||isRefund)&&operationReason.trim().length<5)} onClick={submitOperationDialog}>{operationBusy?'처리 중...':isRetry?'승인 요청 등록':isRefund?'환불 실행':target.nextSuspended?'기관 정지':'기관 재개'}</button></div>
          </div>
        </div>;
      })()}
      <nav className="gcp-sidebar" aria-label="운영 콘솔 메뉴" style={{width:232,padding:'16px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <button type="button" onClick={()=>setPage('stats')} aria-label="운영 콘솔 메인 통계로 이동" style={{display:'flex',alignItems:'center',gap:9,padding:'6px 20px 18px',border:0,background:'transparent',width:'100%',textAlign:'left',cursor:'pointer'}}>
          <div style={{width:28,height:28,borderRadius:7,background:'#1a73e8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>영</div>
          <div>
            <div style={{fontSize:14.5,fontWeight:500,color:'#202124',lineHeight:1.2}}>AI영실이</div>
            <div style={{fontSize:11,color:'#5f6368',lineHeight:1.2}}>운영 콘솔</div>
          </div>
        </button>
        {(consoleRole==='cs' ? NAV.filter(n=>CS_ALLOWED_PAGES.includes(n.id)) : NAV).map(item => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button key={item.id} onClick={()=>setPage(item.id)} aria-current={active?'page':undefined} className={`gcp-nav-item ${active?'is-active':''}`}>
              <Icon aria-hidden="true" size={18} strokeWidth={active?2.25:1.75} style={{flexShrink:0,color: active?'#1a73e8':'#5f6368'}} />
              {item.label}
            </button>
          );
        })}
        <div style={{marginTop:'auto',paddingTop:14,borderTop:'1px solid #dadce0',margin:'14px 16px 0'}}>
          <div style={{fontSize:12,color:'#5f6368',padding:'0 4px 10px',wordBreak:'break-all'}}>{authUser.email}</div>
          <button className="btn-secondary" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:7}} onClick={()=>signOut(auth as any)}><LogOut size={14}/> 로그아웃</button>
        </div>
      </nav>
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        <div className="gcp-topbar" style={{padding:'18px 32px',flexShrink:0}}>
          <div style={{fontSize:11.5,color:'#5f6368',fontWeight:500,letterSpacing:'.02em',marginBottom:2}}>AI영실이 운영 콘솔</div>
          <h1 id="console-page-title" style={{fontSize:21,fontWeight:500,color:'#202124',margin:0}}>{NAV.find(n=>n.id===page)?.label}</h1>
        </div>
        <main id="console-main" aria-labelledby="console-page-title" tabIndex={-1} style={{flex:1,padding:'24px 32px',overflowY:'auto'}}>

        {page === 'support' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:16}}>
              <div className="script-editor-header" style={{marginBottom:14,alignItems:'flex-end'}}>
                <div><div className="section-title" style={{marginBottom:4}}>통화 ID 진단</div><div style={{fontSize:12,color:'#5f6368'}}>대화 원문과 전체 전화번호를 노출하지 않고 발신·결과·위험 상태를 확인합니다. 조회 이력은 감사 로그에 남습니다.</div></div>
              </div>
              <div style={{display:'flex',gap:8,maxWidth:720}}>
                <input className="form-input" value={diagnosticCallId} onChange={e=>setDiagnosticCallId(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')fetchCallDiagnostic();}} placeholder="통화 ID" aria-label="진단할 통화 ID" />
                <button className="btn-primary" onClick={()=>fetchCallDiagnostic()} disabled={diagnosticLoading}><Search size={15}/> {diagnosticLoading?'조회 중':'진단'}</button>
              </div>
              {diagnostic && <div style={{marginTop:14,padding:16,border:'1px solid #dadce0',borderRadius:10,background:'#f8fafd'}}>
                <div style={{fontWeight:700,marginBottom:10}}>통화 {diagnostic.callId}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
                  {[['발신 요청',diagnostic.dispatch?[diagnostic.dispatch]:[]],['통화 결과',diagnostic.calls||[]],['위험 감지',diagnostic.risks||[]]].map(([label,items]:any)=><div key={label}><div style={{fontSize:12,fontWeight:700,color:'#5f6368',marginBottom:6}}>{label}</div>{items.length?items.map((item:any,index:number)=><div key={index} style={{fontSize:12,background:'#fff',border:'1px solid #e8eaed',borderRadius:8,padding:10,marginBottom:6,wordBreak:'break-word'}}>{Object.entries(item).filter(([,v])=>v!==null&&v!==''&&v!==0).map(([k,v])=><div key={k}><strong>{k}</strong>: {String(v)}</div>)}</div>):<div style={{fontSize:12,color:'#9aa0a6'}}>기록 없음</div>}</div>)}
                </div>
              </div>}
            </section>
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:10}}><div><div className="section-title" style={{marginBottom:4}}>기관 문의 티켓 ({supportTickets.length}건)</div><div style={{fontSize:12,color:'#5f6368'}}>담당자, SLA 기한, 기관 안내와 조치 상태를 관리합니다.</div></div><div style={{display:'flex',gap:8}}><button className="btn-secondary" onClick={fetchSupportTickets} disabled={supportLoading}>{supportLoading?'조회 중':'새로고침'}</button><button className="btn-primary" onClick={createSupportTicket} disabled={supportBusy==='create'}>새 티켓</button></div></div>
              <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:1100}}><thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:8}}>등록</th><th style={{padding:8}}>기관</th><th style={{padding:8}}>심각도</th><th style={{padding:8}}>문의</th><th style={{padding:8}}>통화 ID</th><th style={{padding:8}}>담당자</th><th style={{padding:8}}>SLA</th><th style={{padding:8}}>상태</th><th style={{padding:8}}>처리</th></tr></thead><tbody>{supportTickets.slice((supportPage-1)*PAGE_SIZE,supportPage*PAGE_SIZE).map((ticket:any)=>{
                const overdue=ticket.slaDueAt&&new Date(ticket.slaDueAt).getTime()<Date.now()&&!['resolved','closed'].includes(ticket.status);
                return <tr key={ticket.id} style={{borderBottom:'1px solid #f1f3f4',verticalAlign:'top',background:overdue?'#fff8f7':'#fff'}}><td style={{padding:8,whiteSpace:'nowrap'}}>{ticket.createdAt?new Date(ticket.createdAt).toLocaleString():'-'}</td><td style={{padding:8}}>{ticket.orgId}</td><td style={{padding:8,fontWeight:700,color:ticket.severity==='critical'?'#c5221f':ticket.severity==='high'?'#e37400':'#5f6368'}}>{ticket.severity}</td><td style={{padding:8,minWidth:260}}><strong>{ticket.title}</strong><div style={{marginTop:4,color:'#5f6368',whiteSpace:'pre-wrap'}}>{ticket.description}</div>{ticket.operatorNote&&<div style={{marginTop:6,color:'#1a73e8'}}>조치: {ticket.operatorNote}</div>}</td><td style={{padding:8}}>{ticket.callId?<button className="btn-secondary" style={{fontSize:11}} onClick={()=>{setDiagnosticCallId(ticket.callId);fetchCallDiagnostic(ticket.callId);}}>{ticket.callId}</button>:'-'}</td><td style={{padding:8}}>{ticket.assignee||'미지정'}</td><td style={{padding:8,color:overdue?'#c5221f':'inherit',fontWeight:overdue?700:400}}>{ticket.slaDueAt?new Date(ticket.slaDueAt).toLocaleString():'-'}{overdue?' · 초과':''}</td><td style={{padding:8,fontWeight:600}}>{ticket.status}</td><td style={{padding:8}}><div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button className="btn-secondary" disabled={supportBusy===ticket.id} onClick={()=>updateSupportTicket(ticket,'in_progress')}>처리 중</button><button className="btn-secondary" disabled={supportBusy===ticket.id} onClick={()=>updateSupportTicket(ticket,'waiting_org')}>기관 회신 대기</button><button className="btn-primary" disabled={supportBusy===ticket.id} onClick={()=>updateSupportTicket(ticket,'resolved')}>해결</button></div></td></tr>})}</tbody></table><Pager page={supportPage} setPage={setSupportPage} total={supportTickets.length}/>{!supportTickets.length&&!supportLoading&&<div style={{padding:24,textAlign:'center',color:'#5f6368'}}>등록된 기관 문의가 없습니다.</div>}</div>
            </section>
          </div>
        )}

        {page === 'commands' && (
          <div className="fade-in">
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:14}}><div><div className="section-title" style={{marginBottom:4}}>운영 명령 센터</div><div style={{fontSize:12,color:'#5f6368'}}>등록된 읽기 전용 점검만 실행합니다. 임의 셸, sudo, 파일 변경과 비밀키 조회는 지원하지 않습니다.</div></div><button className="btn-download" onClick={fetchOperatorCommands}>이력 새로고침</button></div>
              <div style={{background:'#fef7e0',border:'1px solid #f9ab00',borderRadius:9,padding:'10px 12px',fontSize:12,color:'#754d00',marginBottom:14}}>실행 사유와 결과는 감사 로그에 남습니다. 서비스 재시작은 제한형 호스트 관리 에이전트가 구축되기 전까지 사용할 수 없습니다.</div>
              <label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:14}}>실행 사유<input className="form-input" style={{marginTop:5,width:'100%',boxSizing:'border-box'}} maxLength={300} value={operatorCommandReason} onChange={e=>setOperatorCommandReason(e.target.value)} placeholder="예: 파일럿 시작 전 시스템 준비상태 확인"/></label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>{[
                ['api_readiness','API 준비상태','Firestore 연결과 예약 작업 주기를 확인합니다.'],
                ['service_health','전체 서비스 상태','API·AI·070 콜엔진·개인정보 파기 상태를 확인합니다.'],
                ['call_engine_status','콜엔진·FreeSWITCH','AI 엔진, 연결 상태, 승인 이미지와 모듈 상태를 확인합니다.'],
                ['scheduler_status','예약 작업 상태','링 스윕과 자동발신 스캔의 최근 실행 시각을 확인합니다.'],
              ].map(([command,label,description])=><div key={command} style={{border:'1px solid #dadce0',borderRadius:10,padding:14,background:'#fff'}}><div style={{fontWeight:800,fontSize:14}}>{label}</div><div style={{fontSize:12,color:'#64748b',lineHeight:1.55,minHeight:38,margin:'6px 0 12px'}}>{description}</div><button className="btn-primary" style={{width:'100%'}} disabled={!!operatorCommandBusy||operatorCommandReason.trim().length<5} onClick={()=>runOperatorCommand(command)}>{operatorCommandBusy===command?'실행 중...':'점검 실행'}</button></div>)}</div>
            </section>
            <section className="section" style={{marginTop:16}}>
              <div className="section-title">최근 실행 이력</div>
              <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:940}}><thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:9}}>실행 시각</th><th>점검</th><th>실행자</th><th>사유</th><th>상태</th><th>결과</th></tr></thead><tbody>{operatorCommands.map((run:any)=><tr key={run.id} style={{borderBottom:'1px solid #f1f3f4',verticalAlign:'top'}}><td style={{padding:10,whiteSpace:'nowrap'}}>{run.startedAt?new Date(run.startedAt).toLocaleString():'-'}</td><td style={{fontWeight:700}}>{run.command}</td><td>{run.actorEmail}</td><td>{run.reason}</td><td style={{fontWeight:700,color:run.status==='succeeded'?'#188038':run.status==='failed'?'#c5221f':'#b06000'}}>{run.status}</td><td style={{maxWidth:420}}>{run.error?<span style={{color:'#c5221f'}}>{run.error}</span>:<pre style={{margin:0,whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:11,color:'#475569'}}>{run.result?JSON.stringify(run.result,null,2):'-'}</pre>}</td></tr>)}</tbody></table>{!operatorCommands.length&&<div style={{padding:28,textAlign:'center',color:'#5f6368'}}>실행 이력이 없습니다.</div>}</div>
            </section>
          </div>
        )}

        {page === 'recovery' && (
          <div className="fade-in">
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:14}}><div><div className="section-title" style={{marginBottom:4}}>장애 대응·복구 훈련</div><div style={{fontSize:12,color:'#5f6368'}}>비운영 환경에서 먼저 검증하고, 실제 고객·결제 없이 탐지부터 복구까지 걸린 시간과 사후 점검을 증거로 남깁니다.</div></div><button className="btn-download" onClick={fetchRecoveryDrills} disabled={recoveryLoading}>{recoveryLoading?'조회 중...':'새로고침'}</button></div>
              <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:14,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
                <label style={{fontSize:12}}>대상<select className="form-input" value={recoveryForm.component} onChange={e=>setRecoveryForm(v=>({...v,component:e.target.value}))}><option value="api">API · 10분</option><option value="firestore">Firestore · 10분</option><option value="scheduler">예약 작업 · 5분</option><option value="ai">AI 서버 · 10분</option><option value="call_engine">콜엔진 · 15분</option><option value="freeswitch">FreeSWITCH · 15분</option><option value="billing">결제 작업 · 30분</option></select></label>
                <label style={{fontSize:12}}>환경<select className="form-input" value={recoveryForm.environment} onChange={e=>setRecoveryForm(v=>({...v,environment:e.target.value}))}><option value="non_production">비운영 검증</option><option value="production_maintenance">운영 유지보수</option></select></label>
                <label style={{fontSize:12}}>기관(선택)<select className="form-input" value={recoveryForm.orgId} onChange={e=>setRecoveryForm(v=>({...v,orgId:e.target.value}))}><option value="">전체 시스템</option>{orgs.map((o:any)=><option key={o.orgId} value={o.orgId}>{o.name||o.orgId}</option>)}</select></label>
                <label style={{fontSize:12}}>담당자<input className="form-input" maxLength={100} value={recoveryForm.owner} onChange={e=>setRecoveryForm(v=>({...v,owner:e.target.value}))}/></label>
                <div style={{fontSize:12}}>예정 시각<RecoveryScheduleInput onChange={value=>setRecoveryForm(v=>({...v,plannedAt:value}))}/></div>
                <label style={{fontSize:12}}>장애 시나리오<input className="form-input" maxLength={1000} value={recoveryForm.scenario} onChange={e=>setRecoveryForm(v=>({...v,scenario:e.target.value}))} placeholder="예: 콜엔진 연결 실패 주입"/></label>
                <label style={{fontSize:12}}>롤백 계획<input className="form-input" maxLength={1000} value={recoveryForm.rollbackPlan} onChange={e=>setRecoveryForm(v=>({...v,rollbackPlan:e.target.value}))} placeholder="예: 승인 이미지로 즉시 복귀"/></label>
                <div style={{display:'flex',alignItems:'flex-end'}}><button className="btn-primary" style={{width:'100%'}} disabled={recoveryBusy==='create'} onClick={createRecoveryDrill}>{recoveryBusy==='create'?'등록 중...':'훈련 계획 등록'}</button></div>
              </div>
            </section>
            <section className="section" style={{marginTop:16}}>
              <div className="section-title">훈련 이력</div>
              <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:1080}}><thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:9}}>예정</th><th>대상·환경</th><th>담당자</th><th>시나리오</th><th>RTO</th><th>상태</th><th>조치·재발 방지</th><th>처리</th></tr></thead><tbody>{recoveryDrills.map((drill:any)=>{
                const labels:any={api:'API',firestore:'Firestore',scheduler:'예약 작업',ai:'AI 서버',call_engine:'콜엔진',freeswitch:'FreeSWITCH',billing:'결제 작업'};
                const statuses:any={planned:'계획',running:'진행 중',passed:'통과',failed:'실패',aborted:'중단'};
                return <tr key={drill.id} style={{borderBottom:'1px solid #f1f3f4',verticalAlign:'top'}}><td style={{padding:10,whiteSpace:'nowrap'}}>{drill.plannedAt?new Date(drill.plannedAt).toLocaleString():'-'}</td><td><strong>{labels[drill.component]||drill.component}</strong><div style={{color:'#64748b'}}>{drill.environment==='non_production'?'비운영':'운영 유지보수'}</div></td><td>{drill.owner}</td><td style={{maxWidth:240}}>{drill.scenario}<div style={{color:'#64748b',marginTop:3}}>롤백: {drill.rollbackPlan}</div></td><td>{drill.recoveryMinutes==null?`목표 ${drill.rtoTargetMinutes}분`:`${Math.round(drill.recoveryMinutes)}분 / ${drill.rtoTargetMinutes}분`} {drill.rtoPassed===true&&<span style={{color:'#188038'}}>통과</span>}</td><td style={{fontWeight:700,color:drill.status==='failed'?'#c5221f':drill.status==='passed'?'#188038':'#3c4043'}}>{statuses[drill.status]||drill.status}</td><td style={{maxWidth:220,whiteSpace:'pre-wrap'}}>{drill.actionNote||'-'}{drill.preventionNote&&<div style={{color:'#64748b',marginTop:3}}>예방: {drill.preventionNote}</div>}</td><td style={{padding:8}}>{drill.status==='planned'?<div style={{display:'flex',gap:5}}><button className="btn-primary" disabled={recoveryBusy===drill.id} onClick={()=>updateRecoveryDrill(drill,'running')}>시작</button><button className="btn-secondary" disabled={recoveryBusy===drill.id} onClick={()=>updateRecoveryDrill(drill,'aborted')}>중단</button></div>:drill.status==='running'?<div style={{display:'flex',gap:5}}><button className="btn-primary" disabled={recoveryBusy===drill.id} onClick={()=>updateRecoveryDrill(drill,'passed')}>복구 통과</button><button className="btn-secondary" disabled={recoveryBusy===drill.id} onClick={()=>updateRecoveryDrill(drill,'failed')}>실패</button></div>:'-'}</td></tr>;
              })}</tbody></table>{!recoveryDrills.length&&!recoveryLoading&&<div style={{padding:28,textAlign:'center',color:'#5f6368'}}>등록된 복구 훈련이 없습니다.</div>}</div>
            </section>
          </div>
        )}

        {page === 'incidents' && (
          <div className="fade-in">
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:14,alignItems:'flex-end'}}>
                <div>
                  <div className="section-title" style={{marginBottom:4}}>장애·사고 통합 센터</div>
                  <div style={{fontSize:12,color:'#5f6368'}}>통화·예약·위험 알림·결제·크론 장애를 모아 보고, 원본 상태와 분리해 운영 조치 기록을 남깁니다.</div>
                </div>
                <button className={`btn-download ${incidentLoading?'btn-calling':''}`} onClick={fetchIncidents} disabled={incidentLoading}>{incidentLoading?'조회 중...':'새로고침'}</button>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
                <select className="form-input" style={{width:180}} value={incidentStatus} onChange={e=>setIncidentStatus(e.target.value)} aria-label="처리 상태 필터">
                  <option value="">전체 처리 상태</option><option value="open">미처리</option><option value="acknowledged">확인</option><option value="in_progress">조치 중</option><option value="resolved">해결</option><option value="deferred">보류</option>
                </select>
                <select className="form-input" style={{width:190}} value={incidentCategory} onChange={e=>setIncidentCategory(e.target.value)} aria-label="사건 유형 필터">
                  <option value="">전체 사건 유형</option><option value="call">통화 발신</option><option value="voice_engine">음성 엔진</option><option value="silence">무음 통화</option><option value="schedule">예약 누락</option><option value="risk">위험 알림</option><option value="billing">결제·환불</option><option value="scheduler">크론 작업</option><option value="infrastructure">인프라</option>
                </select>
                <button className="btn-secondary" onClick={fetchIncidents}>필터 적용</button>
                <div style={{marginLeft:'auto',fontSize:13,color:'#5f6368',alignSelf:'center'}}>현재 {incidents.length}건</div>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:1240}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'9px 10px'}}>심각도</th><th style={{padding:'9px 10px'}}>발생 시각</th><th style={{padding:'9px 10px'}}>기관</th><th style={{padding:'9px 10px'}}>유형·내용</th><th style={{padding:'9px 10px'}}>담당자</th><th style={{padding:'9px 10px'}}>처리 상태</th><th style={{padding:'9px 10px'}}>조치 기록</th><th style={{padding:'9px 10px'}}>재발 방지</th><th style={{padding:'9px 10px'}}>처리</th>
                  </tr></thead>
                  <tbody>{incidents.slice((incidentsPage-1)*PAGE_SIZE, incidentsPage*PAGE_SIZE).map((incident:any) => {
                    const severityLabel:Record<string,string> = {critical:'긴급',high:'높음',medium:'중간',low:'낮음'};
                    const severityColor:Record<string,string> = {critical:'#b3261e',high:'#c5221f',medium:'#b06000',low:'#5f6368'};
                    const statusLabel:Record<string,string> = {open:'미처리',acknowledged:'확인',in_progress:'조치 중',resolved:'해결',deferred:'보류'};
                    return <tr key={incident.id} style={{borderBottom:'1px solid #f1f3f4',verticalAlign:'top',background:incident.severity==='critical'&&incident.status!=='resolved'?'#fff8f7':'#fff'}}>
                      <td style={{padding:'12px 10px',fontWeight:700,color:severityColor[incident.severity]||'#5f6368'}}>{severityLabel[incident.severity]||incident.severity}</td>
                      <td style={{padding:'12px 10px',whiteSpace:'nowrap'}}>{incident.occurredAt?new Date(incident.occurredAt).toLocaleString():'-'}</td>
                      <td style={{padding:'12px 10px'}}>{incident.orgName||'전체 시스템'}<div style={{fontSize:11,color:'#9aa0a6'}}>{incident.orgId||'-'}</div></td>
                      <td style={{padding:'12px 10px',minWidth:220}}><strong>{incident.title}</strong><div style={{color:'#5f6368',marginTop:4,wordBreak:'break-word'}}>{incident.detail}</div></td>
                      <td style={{padding:'12px 10px'}}>{incident.assignee||'미지정'}</td>
                      <td style={{padding:'12px 10px',fontWeight:600}}>{statusLabel[incident.status]||incident.status}</td>
                      <td style={{padding:'12px 10px',maxWidth:220,whiteSpace:'pre-wrap'}}>{incident.actionNote||'-'}</td>
                      <td style={{padding:'12px 10px',maxWidth:220,whiteSpace:'pre-wrap'}}>{incident.preventionNote||'-'}</td>
                      <td style={{padding:'10px',whiteSpace:'nowrap'}}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <button className="btn-secondary" disabled={incidentBusy===incident.id} onClick={()=>updateIncident(incident,'acknowledged')}>확인</button>
                        <button className="btn-secondary" disabled={incidentBusy===incident.id} onClick={()=>updateIncident(incident,'in_progress')}>조치 중</button>
                        <button className="btn-secondary" disabled={incidentBusy===incident.id} onClick={()=>updateIncident(incident,'resolved')}>해결</button>
                      </div></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <Pager page={incidentsPage} setPage={setIncidentsPage} total={incidents.length} />
              {!incidentLoading && incidents.length===0 && <div style={{padding:'28px 0',textAlign:'center',color:'#5f6368'}}>조건에 맞는 열린 사건이 없습니다.</div>}
            </section>
          </div>
        )}

        {page === 'approvals' && (
          <div className="fade-in">
            <section className="section">
              <div className="script-editor-header" style={{marginBottom:12}}><div><div className="section-title" style={{marginBottom:3}}>승인 대기열</div><div style={{fontSize:12,color:'#5f6368'}}>요청자와 승인자를 분리해 재청구·환불·크레딧·기관 정지·파기 재시도를 실행합니다.</div></div><button className={`btn-download ${approvalLoading?'btn-calling':''}`} onClick={fetchApprovals} disabled={approvalLoading}>{approvalLoading?'조회 중...':'새로고침'}</button></div>
              <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:900}}><thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:8}}>요청 시각</th><th style={{padding:8}}>작업</th><th style={{padding:8}}>대상</th><th style={{padding:8}}>사유</th><th style={{padding:8}}>요청자</th><th style={{padding:8}}>상태</th><th style={{padding:8}}>처리</th></tr></thead><tbody>{approvals.slice((approvalsPage-1)*PAGE_SIZE,approvalsPage*PAGE_SIZE).map((item:any)=>{const ownRequest=String(item.requesterEmail||'').toLowerCase()===String(authUser?.email||'').toLowerCase();const legacyEngineRequest=item.action==='engine_change';return <tr key={item.id} style={{borderBottom:'1px solid #f1f3f4'}}><td style={{padding:8,whiteSpace:'nowrap'}}>{item.requestedAt?new Date(item.requestedAt).toLocaleString():'-'}</td><td style={{padding:8,fontWeight:700}}>{item.action}</td><td style={{padding:8}}>{item.targetId}</td><td style={{padding:8}}>{item.reason}</td><td style={{padding:8}}>{item.requesterEmail||'-'}</td><td style={{padding:8}}>{item.status}</td><td style={{padding:8}}>{item.status==='pending'?(legacyEngineRequest?<span style={{fontSize:12,color:'#64748b',fontWeight:700}}>이전 방식 요청 · 실행 불필요</span>:ownRequest?<span style={{fontSize:12,color:'#b45309',fontWeight:700}}>다른 총괄 관리자의 승인 필요</span>:<div style={{display:'flex',gap:6}}><button className="btn-primary" disabled={approvalBusy===item.id} onClick={()=>decideApproval(item,true)}>승인</button><button className="btn-secondary" disabled={approvalBusy===item.id} onClick={()=>decideApproval(item,false)}>반려</button></div>):'-'}</td></tr>})}</tbody></table><Pager page={approvalsPage} setPage={setApprovalsPage} total={approvals.length}/>{!approvals.length&&!approvalLoading&&<div style={{padding:20,color:'#5f6368'}}>승인 요청이 없습니다.</div>}</div>
            </section>
            <section className="section" style={{marginTop:16}}><div className="section-title">개인정보 보존·파기 현황</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>{[['보존기간',`${privacySummary?.retentionMonths??'-'}개월`],['파기 예정',`${privacySummary?.preview?.total??0}건`],['대기',`${privacySummary?.counts?.pending??0}건`],['진행 중',`${privacySummary?.counts?.running??0}건`],['실패',`${privacySummary?.counts?.failed??0}건`]].map(([label,value])=><div key={label} style={{border:'1px solid #dadce0',borderRadius:8,padding:14}}><div style={{fontSize:12,color:'#5f6368'}}>{label}</div><div style={{fontSize:22,fontWeight:700,marginTop:4}}>{value}</div></div>)}</div></section>
            <section className="section" style={{marginTop:16}}><div className="section-title">외부 운영 알림 전달 내역</div><div style={{fontSize:12,color:'#5f6368',marginBottom:10}}>웹훅에는 심각도·제목·기관 ID만 전송하며 전화번호와 대화 원문은 포함하지 않습니다.</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:8}}>시각</th><th style={{padding:8}}>심각도</th><th style={{padding:8}}>내용</th><th style={{padding:8}}>기관</th><th style={{padding:8}}>상태</th></tr></thead><tbody>{notificationDeliveries.slice(0,50).map((item:any)=><tr key={item.id} style={{borderBottom:'1px solid #f1f3f4'}}><td style={{padding:8}}>{item.createdAt?new Date(item.createdAt).toLocaleString():'-'}</td><td style={{padding:8}}>{item.severity}</td><td style={{padding:8}}>{item.title}</td><td style={{padding:8}}>{item.orgId||'전체'}</td><td style={{padding:8}}>{item.status}</td></tr>)}</tbody></table>{!notificationDeliveries.length&&<div style={{padding:20,color:'#5f6368'}}>전달 기록이 없습니다.</div>}</div></section>
          </div>
        )}

        {page === 'health' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:20}}>
              <div className="section-title" style={{marginBottom:4}}>일반전화 AI 엔진</div>
              <div style={{fontSize:12,color:'#5f6368',marginBottom:14}}>변경 사항은 진행 중인 통화에 영향을 주지 않고, 저장 이후 시작하는 신규 070 통화부터 적용됩니다.</div>
              {!callEngineProvider ? <div style={{color:'#c5221f',fontSize:14}}>엔진 설정을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</div> : <>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
                  {(['gemini','openai'] as const).map(provider => {
                    const selected = nextCallEngineProvider === provider;
                    const unavailable = provider === 'openai' && callEngineProvider.runtime?.openaiReady !== true;
                    return <button key={provider} type="button" disabled={callEngineBusy || unavailable} onClick={()=>setNextCallEngineProvider(provider)} style={{textAlign:'left',minWidth:230,flex:'1 1 230px',padding:'14px 16px',borderRadius:10,border:`2px solid ${selected?'#246beb':'#e2e8f0'}`,background:selected?'#f4f7ff':'#fff',cursor:unavailable?'not-allowed':'pointer',opacity:unavailable ? .55 : 1}}>
                      <div style={{fontSize:15,fontWeight:800,color:'#0f172a'}}>{provider === 'gemini' ? 'Gemini Live' : 'OpenAI Live'}</div>
                      <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{provider === callEngineProvider.provider ? '현재 신규 통화에 적용 중' : unavailable ? '사용 준비 필요' : '선택 가능'}</div>
                    </button>;
                  })}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'minmax(220px,1fr) auto',gap:10,alignItems:'center'}}>
                  <input className="form-input" value={callEngineReason} onChange={e=>setCallEngineReason(e.target.value)} maxLength={300} placeholder="전환 사유를 입력하세요 (필수)" aria-label="AI 엔진 전환 사유"/>
                  <button className={`btn-download ${callEngineBusy?'btn-calling':''}`} disabled={callEngineBusy || nextCallEngineProvider===callEngineProvider.provider} onClick={updateCallEngineProvider}>{callEngineBusy?'변경 중...':'선택한 엔진 적용'}</button>
                </div>
                <div style={{fontSize:12,color:callEngineProvider.runtime?.reachable?'#188038':'#c5221f',marginTop:10}}>
                  콜엔진 {callEngineProvider.runtime?.reachable?'연결됨':'상태 확인 실패'} · OpenAI Live {callEngineProvider.runtime?.openaiReady===true?'통화 가능':callEngineProvider.runtime?.openaiConfigured===true?'사용 불가':'키 미설정 또는 확인 불가'}
                  {callEngineProvider.changedAt && ` · 마지막 변경 ${new Date(callEngineProvider.changedAt).toLocaleString()} ${callEngineProvider.changedByEmail || ''}`}
                </div>
                {callEngineProvider.runtime?.openaiConfigured===true && callEngineProvider.runtime?.openaiReady!==true && <div style={{fontSize:12,color:'#b45309',marginTop:6}}>OpenAI 계정의 API 크레딧과 Live 사용 권한을 확인해 주세요.</div>}
                <div style={{marginTop:16,borderTop:'1px solid #e8eaed',paddingTop:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:10}}>
                    <strong style={{fontSize:13}}>070 런타임 무결성·음성 품질</strong>
                    {callEngineProvider.runtime?.imageApproved===false || callEngineProvider.runtime?.moduleApproved===false
                      ? <span className="gcp-chip" style={{background:'#fce8e6',color:'#c5221f'}}>승인값 불일치 · 즉시 확인</span>
                      : callEngineProvider.runtime?.telemetryAvailable
                        ? <span className="gcp-chip" style={{background:'#e6f4ea',color:'#188038'}}>상태 수집 중</span>
                        : <span className="gcp-chip" style={{background:'#fef7e0',color:'#b06000'}}>상세 상태 확인 불가</span>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:8}}>
                    {[
                      ['콜엔진 연결', callEngineProvider.runtime?.engineConnected==null?'확인 불가':callEngineProvider.runtime.engineConnected?'정상':'오류'],
                      ['FreeSWITCH 연결', callEngineProvider.runtime?.freeSwitchConnected==null?'확인 불가':callEngineProvider.runtime.freeSwitchConnected?'정상':'오류'],
                      ['FreeSWITCH 이미지', callEngineProvider.runtime?.freeSwitchImage||'확인 불가'],
                      ['이미지 digest', callEngineProvider.runtime?.freeSwitchImageDigest||'확인 불가'],
                      ['mod_audio_stream hash', callEngineProvider.runtime?.modAudioStreamHash||'확인 불가'],
                      ['마지막 재시작', callEngineProvider.runtime?.restartedAt?new Date(callEngineProvider.runtime.restartedAt).toLocaleString():'확인 불가'],
                      ['최근 음성 재생 성공률', callEngineProvider.runtime?.audioPlaybackSuccessRate==null?'확인 불가':`${Math.round(callEngineProvider.runtime.audioPlaybackSuccessRate*100)}%`],
                      ['최근 24시간 무음 통화', callEngineProvider.runtime?.silentCallCount24h==null?'확인 불가':`${callEngineProvider.runtime.silentCallCount24h}건`],
                      ['마지막 정상 통화', callEngineProvider.runtime?.lastHealthyCallAt?new Date(callEngineProvider.runtime.lastHealthyCallAt).toLocaleString():'확인 불가'],
                    ].map(([label,value])=><div key={label} style={{border:'1px solid #e8eaed',borderRadius:8,padding:'10px 12px',minWidth:0}}>
                      <div style={{fontSize:11.5,color:'#5f6368'}}>{label}</div>
                      <div title={String(value)} style={{fontSize:12.5,fontWeight:600,color:'#202124',marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</div>
                    </div>)}
                  </div>
                  {!callEngineProvider.runtime?.telemetryAvailable && <div style={{fontSize:12,color:'#b06000',marginTop:9}}>콜엔진이 아직 이미지·FreeSWITCH·음성 품질 상태를 제공하지 않습니다. 값이 없다는 이유로 정상 판정하지 않습니다.</div>}
                </div>
                <div style={{marginTop:16,borderTop:'1px solid #e8eaed',paddingTop:14}}>
                  <strong style={{fontSize:13}}>AI 엔진 전환 이력</strong>
                  <div style={{overflowX:'auto',marginTop:8}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:760}}>
                      <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:8}}>시각</th><th style={{padding:8}}>전환</th><th style={{padding:8}}>사유</th><th style={{padding:8}}>적용 통화</th><th style={{padding:8}}>방식</th><th style={{padding:8}}>운영자</th><th style={{padding:8}}>결과</th></tr></thead>
                      <tbody>{callEngineHistory.slice((callEngineHistoryPage-1)*PAGE_SIZE, callEngineHistoryPage*PAGE_SIZE).map((change:any)=><tr key={change.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:8,whiteSpace:'nowrap'}}>{change.changedAt?new Date(change.changedAt).toLocaleString():'-'}</td>
                        <td style={{padding:8,fontWeight:600}}>{change.from} → {change.to}</td>
                        <td style={{padding:8}}>{change.reason||'-'}</td><td style={{padding:8}}>{change.callId||'신규 통화 전체'}</td>
                        <td style={{padding:8}}>{change.automatic?'자동':'수동'}{change.autoRevert?' · 자동 복귀':''}</td><td style={{padding:8}}>{change.operatorEmail||'-'}</td>
                        <td style={{padding:8,color:change.success?'#188038':'#c5221f',fontWeight:600}}>{change.success?'성공':'실패'}</td>
                      </tr>)}</tbody>
                    </table>
                    <Pager page={callEngineHistoryPage} setPage={setCallEngineHistoryPage} total={callEngineHistory.length} />
                    {!callEngineHistory.length && <div style={{padding:'12px 4px',color:'#5f6368'}}>저장된 전환 이력이 없습니다.</div>}
                  </div>
                </div>
              </>}
            </section>
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
            {consoleRole === 'superadmin' && <section className="section" style={{marginTop:20}}>
              <div className="section-title" style={{marginBottom:4}}>서버 자원 현황</div>
              <div style={{fontSize:12,color:'#64748b',marginBottom:14}}>호스트 CPU 사용률, 사용 가능한 메모리를 제외한 메모리 사용량, 루트 볼륨 사용량입니다. 새로고침 시 측정합니다.</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:12}}>
                {hostResources.map((host:any) => {
                  const metric=host.metrics;
                  const gb=(bytes:number)=>`${(bytes/1024/1024/1024).toFixed(1)} GB`;
                  return <div key={host.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:16}}>
                    <div style={{fontWeight:800,marginBottom:5}}>{host.name}</div>
                    {!metric ? <div style={{color:'#c5221f',fontSize:13}}>{host.error||'측정값 없음'}</div> : <>
                      <div style={{fontSize:13,lineHeight:2}}>CPU <strong>{metric.cpuPercent}%</strong></div>
                      <div style={{fontSize:13,lineHeight:2}}>RAM <strong>{gb(metric.memoryUsedBytes)} / {gb(metric.memoryTotalBytes)}</strong></div>
                      <div style={{fontSize:13,lineHeight:2}}>디스크 <strong>{gb(metric.diskUsedBytes)} / {gb(metric.diskTotalBytes)}</strong></div>
                      <div style={{fontSize:11,color:'#64748b',marginTop:8}}>측정 {new Date(metric.sampledAt).toLocaleString()}</div>
                    </>}
                  </div>;
                })}
                {!hostResources.length && <div style={{color:'#64748b',fontSize:13}}>서버 자원 정보를 조회하지 못했습니다.</div>}
              </div>
            </section>}
            {!!privacyPurgeJobs.length && (
              <section className="section" style={{marginTop:20,borderColor:'#f6aea9'}}>
                <div className="section-title" style={{marginBottom:4,color:'#c5221f'}}>개인정보 파기 확인 필요</div>
                <div style={{fontSize:12,color:'#5f6368',marginBottom:12}}>파기 실패 또는 중단 작업입니다. 처리 건수와 오류를 확인한 뒤 실패 작업만 재시도할 수 있습니다.</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                      <th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>대상</th><th style={{padding:'8px 10px'}}>상태</th><th style={{padding:'8px 10px'}}>진행</th><th style={{padding:'8px 10px'}}>오류</th><th style={{padding:'8px 10px'}}>처리</th>
                    </tr></thead>
                    <tbody>{privacyPurgeJobs.slice((privacyPurgePage-1)*PAGE_SIZE, privacyPurgePage*PAGE_SIZE).map((job:any) => (
                      <tr key={job.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px'}}>{job.orgId || '-'}</td>
                        <td style={{padding:'10px'}}>{job.type==='retention'?'보관기간 자동 파기':(job.maskedPhone || '번호 비공개')}</td>
                        <td style={{padding:'10px',fontWeight:700,color:job.status==='failed'?'#c5221f':'#b45309'}}>{job.status==='failed'?'실패':job.status==='running'?'처리 중':'대기'}</td>
                        <td style={{padding:'10px'}}>{(Object.values(job.progress || {}) as any[]).reduce((sum:number, value:any)=>sum+Number(value || 0),0)}건</td>
                        <td style={{padding:'10px',maxWidth:320,wordBreak:'break-word'}}>{job.error || '-'}</td>
                        <td style={{padding:'10px'}}><button className="btn-secondary" disabled={!job.retryable || privacyRetryBusy===job.id} onClick={()=>retryPrivacyPurge(job)}>{privacyRetryBusy===job.id?'재시도 중...':job.retryable?'재시도':'다음 배치 재처리'}</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <Pager page={privacyPurgePage} setPage={setPrivacyPurgePage} total={privacyPurgeJobs.length} />
                </div>
              </section>
            )}
            <section className="section" style={{marginTop:20}}>
              <div className="section-title" style={{marginBottom:4}}>안전 운영 사건</div>
              <div style={{fontSize:12,color:'#5f6368',marginBottom:12}}>전체 미완료 사건 · 미확인 15분, 조치중 60분 초과 시 지연으로 표시</div>
              {!opsMetrics ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>지표를 불러오지 못했습니다</div> : (
                <>
                  <SafetyIncidentChart metrics={opsMetrics}/>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:12}}>
                    {[
                      {label:'오늘 예약 누락',value:opsMetrics.incidents?.missingScheduledToday||0,danger:true},
                      {label:'알림 전달 보류',value:opsMetrics.incidents?.alertPersistenceFailures||0,danger:true},
                      {label:'발신 준비 고착',value:opsMetrics.incidents?.stuckDispatching||0,danger:true},
                      {label:'링 상태 고착',value:opsMetrics.stuckRinging||0,danger:true},
                      {label:'미확인 알림',value:opsMetrics.incidents?.unacknowledged||0,danger:false},
                      {label:'확인 지연',value:opsMetrics.incidents?.overdueUnacknowledged||0,danger:true},
                      {label:'조치중',value:opsMetrics.incidents?.inProgress||0,danger:false},
                      {label:'조치 지연',value:opsMetrics.incidents?.overdueInProgress||0,danger:true},
                    ].map((item:any) => {
                      const warning = item.danger && item.value > 0;
                      return <div key={item.label} style={{border:`1px solid ${warning?'#f6aea9':'#dadce0'}`,borderRadius:8,padding:'12px 14px',background:warning?'#fce8e6':'#fff'}}>
                        <div style={{fontSize:12,color:'#5f6368'}}>{item.label}</div>
                        <div style={{fontSize:24,fontWeight:700,color:warning?'#c5221f':'#202124',marginTop:3}}>{item.value}<span style={{fontSize:12,fontWeight:500,marginLeft:3}}>건</span></div>
                      </div>;
                    })}
                  </div>
                </>
              )}
              {!!opsMetrics?.incidents?.missingScheduledTargets?.length && (
                <details style={{marginTop:12,border:'1px solid #f6aea9',borderRadius:8,background:'#fff'}}>
                  <summary style={{cursor:'pointer',padding:'12px 14px',fontWeight:600,color:'#c5221f'}}>
                    오늘 예약 누락 대상 {opsMetrics.incidents.missingScheduledTargets.length}명 보기
                  </summary>
                  <div style={{borderTop:'1px solid #f1d3d1',padding:'4px 14px 10px'}}>
                    {opsMetrics.incidents.missingScheduledTargets.map((target:any, index:number) => (
                      <div key={`${target.orgId}-${target.phoneMasked}-${index}`} style={{display:'grid',gridTemplateColumns:'minmax(120px,1fr) minmax(90px,1fr) 110px 70px',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f3f4',fontSize:13}}>
                        <span>{target.orgId}</span><strong>{target.name}</strong><span>{target.phoneMasked}</span><span>{target.callTime}</span>
                      </div>
                    ))}
                  </div>
                </details>
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
                    <tbody>{activeCalls.slice((activeCallsPage-1)*PAGE_SIZE, activeCallsPage*PAGE_SIZE).map((c:any) => (
                      <tr key={c.callId} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px'}}>{c.name}</td><td style={{padding:'10px'}}>{c.phone}</td><td style={{padding:'10px'}}>{c.orgId}</td>
                        <td style={{padding:'10px'}}>{c.status}</td><td style={{padding:'10px'}}>{c.elapsedSec}초</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <Pager page={activeCallsPage} setPage={setActiveCallsPage} total={activeCalls.length} />
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
                <select aria-label="통계 조회 기간" className="form-input" style={{width:140,margin:0}} value={statsMonths} onChange={e=>setStatsMonths(Number(e.target.value))}>
                  <option value={3}>최근 3개월</option>
                  <option value={6}>최근 6개월</option>
                  <option value={12}>최근 12개월</option>
                </select>
                <select aria-label="통계 조회 기관" className="form-input" style={{width:220,margin:0}} value={statsOrg} onChange={e=>setStatsOrg(e.target.value)}>
                  <option value="">전체 기관</option>
                  {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
                </select>
              </div>
              {!statsData ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{statsLoading?'불러오는 중...':'데이터 없음 — 조회 버튼을 눌러주세요'}</div> : (
                <>
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
                <OrganizationUsageChart data={statsData.byOrg} orgName={orgName}/>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                    <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                      <th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>전체 발신</th><th style={{padding:'8px 10px'}}>연결</th><th style={{padding:'8px 10px'}}>연결률</th>
                    </tr></thead>
                    <tbody>{(() => {
                      const maxOrgTotal = Math.max(1, ...statsData.byOrg.map((o:any)=>o.total));
                      return statsData.byOrg.slice((statsOrgPage-1)*PAGE_SIZE, statsOrgPage*PAGE_SIZE).map((o:any) => (
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
                  <Pager page={statsOrgPage} setPage={setStatsOrgPage} total={statsData.byOrg.length} />
                </div>
              </section>
            )}
            <section className="section pilot-workspace" style={{marginTop:16}}>
              <div className="pilot-workflow-head">
                <span className="pilot-workflow-kicker">기관 파일럿 운영</span>
                <h2>14일 운영 검증</h2>
                <p>기관 담당자가 시작 조건부터 매일의 통화 품질, 대응 기록, 최종 운영 기준까지 한 흐름으로 확인할 수 있습니다.</p>
                <div className="pilot-workflow-steps" aria-label="파일럿 운영 절차">
                  <div className="pilot-workflow-step"><b>1</b><span>기관·기간 설정</span></div>
                  <div className="pilot-workflow-step"><b>2</b><span>일일 증거 기록</span></div>
                  <div className="pilot-workflow-step"><b>3</b><span>운영 기준 판정</span></div>
                </div>
              </div>
              <div className="pilot-workspace-body">
              <div className="script-editor-header" style={{marginBottom:10}}>
                <div>
                  <div className="section-title" style={{marginBottom:3}}>운영 품질 보고서 <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>SLA</span></div>
                  <div style={{fontSize:12,color:'#5f6368'}}>예약 안부전화만 집계합니다. 수동·경보·기능 테스트 발신은 제외되며 결과는 PDF와 CSV로 내려받을 수 있습니다.</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn-download" onClick={printPilotSlaPdf} disabled={!pilotData || pilotLoading}>PDF 출력</button>
                  <button className="btn-download" onClick={downloadPilotSlaCsv} disabled={!pilotData || pilotLoading}>CSV 다운로드</button>
                  <button className={`btn-download ${pilotLoading?'btn-calling':''}`} onClick={fetchPilotMetrics} disabled={pilotLoading || !statsOrg || !pilotReportId}>
                    {pilotLoading?'조회 중...':'SLA 조회'}
                  </button>
                </div>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
                <select aria-label="파일럿 보고서 기관" className="form-input" style={{width:240,margin:0}} value={statsOrg} onChange={e=>{setStatsOrg(e.target.value);setPilotReportId('');setPilotData(null);setPilotEvidence([]);}}>
                  <option value="">보고서 기관 선택</option>
                  {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
                </select>
                <label style={{fontSize:12,color:'#5f6368'}}>시작일 <input type="date" className="form-input" style={{width:150,margin:'4px 0 0'}} value={pilotFrom} onChange={e=>{setPilotFrom(e.target.value);setPilotData(null);}} /></label>
                <label style={{fontSize:12,color:'#5f6368'}}>종료일 <input type="date" className="form-input" style={{width:150,margin:'4px 0 0'}} value={pilotTo} onChange={e=>{setPilotTo(e.target.value);setPilotData(null);}} /></label>
                <select aria-label="파일럿 대상 보고서" className="form-input" style={{width:260,margin:0}} value={pilotReportId} onChange={e=>{const id=e.target.value;const selected=pilotPrograms.find((p:any)=>p.id===id);setPilotReportId(id);setPilotData(null);if(selected){setPilotFrom(selected.startDate);setPilotTo(selected.endDate);}fetchPilotEvidence(id);}}>
                  <option value="">대상자가 지정된 파일럿 선택</option>
                  {pilotPrograms.filter((p:any)=>p.orgId===statsOrg&&p.participantCount>0).map((p:any)=><option key={p.id} value={p.id}>{p.startDate} · {p.participantCount}명</option>)}
                </select>
              </div>
              <div className="pilot-step-card is-soft">
                <div className="pilot-section-heading">
                  <div>
                    <h3><span className="pilot-step-number">1</span>파일럿 기본 설정</h3>
                    <p>검증할 기관과 14일 운영 기간, 대상자와 담당자를 등록합니다.</p>
                  </div>
                  <button className="btn-download" onClick={fetchPilotPrograms}>운영 목록 새로고침</button>
                </div>
                <div style={{fontSize:12,color:'#5f6368',marginBottom:10}}>위에서 선택한 기관과 기간을 사용합니다. 종료일은 시작일을 포함해 정확히 14일이어야 합니다.</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
                  <label style={{fontSize:12,color:'#5f6368'}}>대상자 수<input className="form-input" type="number" min="1" max="100" style={{width:110,margin:'4px 0 0'}} value={pilotSubjectCount} onChange={e=>setPilotSubjectCount(e.target.value)}/></label>
                  <label style={{fontSize:12,color:'#5f6368'}}>대상자 번호<input className="form-input" type="text" inputMode="tel" autoComplete="off" style={{width:230,margin:'4px 0 0'}} value={pilotParticipantPhones} onChange={e=>setPilotParticipantPhones(e.target.value)} placeholder="쉼표로 구분"/></label>
                  <label style={{fontSize:12,color:'#5f6368'}}>운영 담당자<input className="form-input" style={{width:190,margin:'4px 0 0'}} value={pilotOwner} onChange={e=>setPilotOwner(e.target.value)} placeholder="기관 담당자 이름"/></label>
                  <button className="btn-primary" disabled={pilotProgramBusy||!statsOrg} onClick={createPilotProgram}>{pilotProgramBusy?'등록 중...':'계획 등록'}</button>
                </div>
                {pilotPrograms.length>0 && <div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{textAlign:'left',borderBottom:'1px solid #dadce0'}}><th style={{padding:7}}>기관</th><th>기간</th><th>대상</th><th>담당자</th><th>상태</th><th>조치</th></tr></thead><tbody>{pilotPrograms.map((p:any)=><tr key={p.id} style={{borderBottom:'1px solid #e2e8f0'}}><td style={{padding:7}}>{orgName(p.orgId)}</td><td>{p.startDate} ~ {p.endDate}</td><td>{p.subjectCount}명</td><td>{p.ownerName}</td><td>{({planned:'준비',active:'운영 중',completed:'완료',stopped:'중단'} as any)[p.status]||p.status}</td><td style={{display:'flex',gap:5,padding:'5px 0'}}>{p.status==='planned'&&<button className="btn-download" onClick={()=>openPilotStatusDialog(p,'active')}>시작</button>}{p.status==='active'&&<><button className="btn-download" onClick={()=>openPilotStatusDialog(p,'completed')}>완료</button><button className="btn-download" onClick={()=>openPilotStatusDialog(p,'stopped')}>중단</button></>}</td></tr>)}</tbody></table></div>}
              </div>
              <div className="pilot-step-card">
                <div className="pilot-section-heading">
                  <div>
                    <h3><span className="pilot-step-number">2</span>일일 운영 증거</h3>
                    <p>표본 통화와 음성 품질, 담당자 대응 시간을 날짜별로 기록합니다.</p>
                  </div>
                </div>
                <div className="pilot-privacy-note"><AlertTriangle size={15}/>전화번호와 대화 원문은 입력하지 마세요. 중단 조건이 기록되면 운영 중인 파일럿은 즉시 중단됩니다.</div>
                <div className="pilot-form-grid">
                  <label style={{fontSize:12}}>파일럿<select className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceProgramId} onChange={e=>{setPilotEvidenceProgramId(e.target.value);fetchPilotEvidence(e.target.value);}}><option value="">선택</option>{pilotPrograms.map((p:any)=><option key={p.id} value={p.id}>{orgName(p.orgId)} · {p.startDate}</option>)}</select></label>
                  <label style={{fontSize:12}}>측정일<input type="date" className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceForm.date} onChange={e=>setPilotEvidenceForm(v=>({...v,date:e.target.value}))}/></label>
                  <label style={{fontSize:12}}>음성 품질 1~5<input type="number" min="1" max="5" step="0.1" className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceForm.voiceQualityScore} onChange={e=>setPilotEvidenceForm(v=>({...v,voiceQualityScore:e.target.value}))}/></label>
                  <label style={{fontSize:12}}>운영자 처리시간(분)<input type="number" min="0" className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceForm.operatorMinutes} onChange={e=>setPilotEvidenceForm(v=>({...v,operatorMinutes:e.target.value}))}/></label>
                  <label style={{fontSize:12}}>긴급 확인시간(분)<input type="number" min="0" className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceForm.urgentAckMinutes} onChange={e=>setPilotEvidenceForm(v=>({...v,urgentAckMinutes:e.target.value}))} placeholder="해당 없음"/></label>
                  <label style={{fontSize:12}}>조치 완료시간(분)<input type="number" min="0" className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceForm.resolutionMinutes} onChange={e=>setPilotEvidenceForm(v=>({...v,resolutionMinutes:e.target.value}))} placeholder="해당 없음"/></label>
                </div>
                <label style={{display:'block',fontSize:12,marginTop:9}}>표본 통화 ID(쉼표 또는 공백 구분)<input className="form-input" style={{margin:'4px 0 0'}} value={pilotEvidenceForm.sampleCallIds} onChange={e=>setPilotEvidenceForm(v=>({...v,sampleCallIds:e.target.value}))} placeholder="call-id-1, call-id-2"/></label>
                <div className="pilot-danger-options">{[['long_silence','장시간 무음'],['missing_dispatch','예약 누락'],['missing_result','결과 미저장'],['unacknowledged_risk','위험 알림 미확인']].map(([value,label])=><label key={value}><input type="checkbox" checked={pilotEvidenceForm.issueFlags.includes(value)} onChange={e=>setPilotEvidenceForm(v=>({...v,issueFlags:e.target.checked?[...v.issueFlags,value]:v.issueFlags.filter(x=>x!==value)}))}/>{label}</label>)}</div>
                <div className="pilot-form-grid" style={{marginTop:9}}><label style={{fontSize:12}}>장애 메모<textarea className="form-input" style={{margin:'4px 0 0',minHeight:66}} maxLength={500} value={pilotEvidenceForm.incidentNote} onChange={e=>setPilotEvidenceForm(v=>({...v,incidentNote:e.target.value}))}/></label><label style={{fontSize:12}}>조치 메모<textarea className="form-input" style={{margin:'4px 0 0',minHeight:66}} maxLength={500} value={pilotEvidenceForm.actionNote} onChange={e=>setPilotEvidenceForm(v=>({...v,actionNote:e.target.value}))}/></label></div>
                <button className="btn-primary" style={{marginTop:10}} disabled={pilotEvidenceBusy||!pilotEvidenceProgramId} onClick={savePilotEvidence}>{pilotEvidenceBusy?'저장 중...':'일일 증거 저장'}</button>
                {pilotEvidence.length>0&&<div className="pilot-evidence-table" style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{textAlign:'left',borderBottom:'1px solid #dadce0'}}><th style={{padding:7}}>날짜</th><th>통화 ID</th><th>음성</th><th>처리</th><th>긴급 확인/완료</th><th>중단 조건</th><th>수정자</th></tr></thead><tbody>{pilotEvidence.map((e:any)=><tr key={e.id} style={{borderBottom:'1px solid #e2e8f0'}}><td style={{padding:7}}>{e.date}</td><td>{e.sampleCallIds.join(', ')||'-'}</td><td>{e.voiceQualityScore.toFixed(1)}</td><td>{e.operatorMinutes}분</td><td>{e.urgentAckMinutes??'-'} / {e.resolutionMinutes??'-'}</td><td style={{color:e.issueFlags.length?'#c5221f':'#188038'}}>{e.issueFlags.join(', ')||'없음'}</td><td>{e.updatedBy}</td></tr>)}</tbody></table></div>}
              </div>
              <div className="pilot-step-card">
                <div className="pilot-section-heading">
                  <div>
                    <h3><span className="pilot-step-number">3</span>운영 기준 판정</h3>
                    <p>등록한 일일 증거와 예약 발신 결과를 합쳐 납품 기준 충족 여부를 확인합니다.</p>
                  </div>
                </div>
              {!pilotData ? (
                <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{statsOrg?'기간을 확인하고 파일럿 조회를 누르세요.':'기관을 선택해야 파일럿 지표를 조회할 수 있습니다.'}</div>
              ) : (
                (() => {
                  const answeredBase = pilotData.completed + pilotData.missed;
                  const connectionRate = answeredBase ? pilotData.completed / answeredBase : null;
                  const evidence=pilotEvidence.filter((e:any)=>e.pilotId===pilotReportId&&e.date>=pilotFrom&&e.date<=pilotTo);
                  const voiceAverage=evidence.length?evidence.reduce((sum:number,e:any)=>sum+Number(e.voiceQualityScore||0),0)/evidence.length:null;
                  const ackValues=evidence.map((e:any)=>e.urgentAckMinutes).filter((v:any)=>v!=null);
                  const resolutionValues=evidence.map((e:any)=>e.resolutionMinutes).filter((v:any)=>v!=null);
                  const ackRate=ackValues.length?ackValues.filter((v:number)=>v<=15).length/ackValues.length:null;
                  const resolutionRate=resolutionValues.length?resolutionValues.filter((v:number)=>v<=60).length/resolutionValues.length:null;
                  const slaRows = [
                    {label:'예약 발신률',value:pilotData.attemptRate,target:'99% 이상',pass:pilotData.attemptRate!=null&&pilotData.attemptRate>=.99,invert:false},
                    {label:'연결률',value:connectionRate,target:'80% 이상',pass:connectionRate!=null&&connectionRate>=.8,invert:false},
                    {label:'기술 실패율',value:pilotData.technicalFailureRate,target:'1% 미만',pass:pilotData.technicalFailureRate!=null&&pilotData.technicalFailureRate<.01,invert:true},
                    {label:'결과 저장률',value:pilotData.resultCompletenessRate,target:'100%',pass:pilotData.resultCompletenessRate!=null&&pilotData.resultCompletenessRate>=1,invert:false},
                    {label:'긴급 알림 15분 내 확인율',value:ackRate,target:'95% 이상',pass:ackRate!=null&&ackRate>=.95,invert:false},
                    {label:'60분 내 조치 완료율',value:resolutionRate,target:'95% 이상',pass:resolutionRate!=null&&resolutionRate>=.95,invert:false},
                  ];
                  const violations = slaRows.filter(row=>row.value!=null&&!row.pass).length;
                  return <>
                  {pilotData.note && <div style={{background:'#fef7e0',color:'#754d00',border:'1px solid #f9ab00',borderRadius:6,padding:'10px 12px',fontSize:13,marginBottom:12}}>{pilotData.note}</div>}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:10}}>
                    <div>
                      <strong style={{fontSize:14}}>기관별 SLA 운영 지표</strong>
                      <div style={{fontSize:11.5,color:'#64748b',marginTop:3}}>현재 기준은 계약상 보장 수치가 아닌 내부 운영 목표입니다.</div>
                    </div>
                    <span className="gcp-chip" style={{background:violations?'#fce8e6':'#e6f4ea',color:violations?'#c5221f':'#188038'}}>{violations ? `운영 목표 위반 ${violations}건` : '운영 목표 충족'}</span>
                  </div>
                  <div style={{overflowX:'auto',marginBottom:14}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}><th style={{padding:8}}>지표</th><th style={{padding:8}}>측정값</th><th style={{padding:8}}>운영 목표</th><th style={{padding:8}}>판정</th></tr></thead>
                      <tbody>{slaRows.map(row=><tr key={row.label} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:8,fontWeight:600}}>{row.label}</td>
                        <td style={{padding:8}}>{row.value==null?'측정 전':`${(row.value*100).toFixed(1)}%`}</td>
                        <td style={{padding:8}}>{row.target}</td>
                        <td style={{padding:8,fontWeight:700,color:row.value==null?'#5f6368':row.pass?'#188038':'#c5221f'}}>{row.value==null?'측정 전':row.pass?'충족':'위반'}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
                    {[
                      ['예정',pilotData.scheduledExpected,'건',false],
                      ['발신 시도',pilotData.scheduledAttempts,'건',pilotData.missingExpected>0],
                      ['시도율',pilotData.attemptRate==null?'-':Math.round(pilotData.attemptRate*100),'%',pilotData.attemptRate!=null&&pilotData.attemptRate<.99],
                      ['완료',pilotData.completed,'건',false],
                      ['미응답',pilotData.missed,'건',false],
                      ['기술 실패',pilotData.failed,'건',pilotData.failed>0],
                      ['예약 누락',pilotData.missingExpected,'건',pilotData.missingExpected>0],
                      ['중복 발신',pilotData.duplicateDispatches,'건',pilotData.duplicateDispatches>0],
                      ['결과 저장 누락',pilotData.completedWithoutCallResult,'건',pilotData.completedWithoutCallResult>0],
                    ].map(([label,value,unit,danger]:any)=><div key={label} style={{border:`1px solid ${danger?'#f6aea9':'#dadce0'}`,borderRadius:8,padding:'12px 14px',background:danger?'#fce8e6':'#fff'}}>
                      <div style={{fontSize:12,color:'#5f6368'}}>{label}</div>
                      <div style={{fontSize:23,fontWeight:700,color:danger?'#c5221f':'#202124',marginTop:3}}>{value}{value!=='-'&&<span style={{fontSize:12,fontWeight:500,marginLeft:3}}>{unit}</span>}</div>
                    </div>)}
                  </div>
                  <div style={{marginTop:14,padding:'12px 14px',border:'1px solid #e2e8f0',borderRadius:8,background:'#f8fafc',fontSize:12,color:'#64748b',lineHeight:1.7}}>
                    음성 품질: {voiceAverage==null?'측정 전':`${voiceAverage.toFixed(2)}점 (${evidence.length}일)`} · 2점 이하: {evidence.filter((e:any)=>e.voiceQualityScore<=2).length}건 · 운영자 처리시간: {evidence.length?`${evidence.reduce((sum:number,e:any)=>sum+Number(e.operatorMinutes||0),0)}분`:'측정 전'}<br/>요금제 초과량은 아직 자동 연동되지 않아 `측정 전`으로 내보냅니다. 임의 수치로 정상 판정하지 않습니다.
                  </div>
                </>;
                })()
              )}
              </div>
              </div>
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
              <input aria-label="통화 이력 기관코드 필터" className="form-input" style={{width:200,margin:0}} placeholder="기관코드 필터(선택)" value={historyOrg} onChange={e=>setHistoryOrg(e.target.value)} />
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
              <div className="section-title" style={{marginBottom:0}}>정기결제 현황 ({subs.length}개 구독)</div>
              <button className={`btn-download ${subsLoading?'btn-calling':''}`} onClick={fetchSubs} disabled={subsLoading}>{subsLoading?'조회 중...':'새로고침'}</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginBottom:12}}>
              {[
                ['결제 실패',subs.filter((s:any)=>s.lastChargeError).length,'#c5221f'],
                ['7일 내 결제 예정',subs.filter((s:any)=>s.autoRenew&&s.nextChargeAt&&Date.parse(s.nextChargeAt)>=Date.now()&&Date.parse(s.nextChargeAt)<=Date.now()+7*86400_000).length,'#1a73e8'],
                ['청구일 경과',subs.filter((s:any)=>s.autoRenew&&s.nextChargeAt&&Date.parse(s.nextChargeAt)<Date.now()).length,'#b06000'],
                ['자동결제 활성',subs.filter((s:any)=>s.autoRenew).length,'#188038'],
              ].map(([label,value,color]:any)=><div key={label} style={{border:'1px solid #dadce0',borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:11.5,color:'#5f6368'}}>{label}</div><div style={{fontSize:22,fontWeight:700,color,marginTop:2}}>{value}<span style={{fontSize:12,fontWeight:500,marginLeft:3}}>건</span></div></div>)}
            </div>
            {subs.some((s:any)=>s.lastChargeError) && <div role="alert" style={{padding:'10px 12px',marginBottom:12,borderRadius:8,background:'#fce8e6',color:'#b3261e',fontSize:13,fontWeight:700}}>자동결제 오류 {subs.filter((s:any)=>s.lastChargeError).length}개 기관 · 최근 오류 열을 확인해 주세요.</div>}
            {subs.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{subsLoading?'불러오는 중...':'기관 데이터가 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>기관명</th><th style={{padding:'8px 10px'}}>통화 방식</th><th style={{padding:'8px 10px'}}>요금제</th><th style={{padding:'8px 10px'}}>대상자</th>
                    <th style={{padding:'8px 10px'}}>월 청구액</th><th style={{padding:'8px 10px'}}>자동결제</th><th style={{padding:'8px 10px'}}>다음 청구일</th><th style={{padding:'8px 10px'}}>최근 오류</th><th style={{padding:'8px 10px'}}>재청구</th>
                  </tr></thead>
                  <tbody>{subs.slice((subsPage-1)*PAGE_SIZE, subsPage*PAGE_SIZE).map((s:any) => (
                    <tr key={`${s.orgId}-${s.track || 'legacy'}`} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{s.orgName || s.orgId}</td><td style={{padding:'10px'}}>{s.track==='app'?'앱 전화':s.track==='pstn'?'일반 전화':'기존 구독'}</td><td style={{padding:'10px'}}>{s.plan || '미설정'}</td><td style={{padding:'10px'}}>{s.elderCount}명</td>
                      <td style={{padding:'10px'}}>{s.monthlyAmount != null ? `${s.monthlyAmount.toLocaleString()}원` : '-'}</td>
                      <td style={{padding:'10px'}}><span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:s.autoRenew?'#e6f4ea':'#f1f3f4',color:s.autoRenew?'#1e8e3e':'#5f6368'}}>{s.autoRenew?'등록됨':'미등록'}</span></td>
                      <td style={{padding:'10px',color:'#5f6368'}}>{s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleDateString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px',color:s.lastChargeError?'#c5221f':'#5f6368',fontSize:12}}>{s.lastChargeError || '-'}</td>
                      <td style={{padding:'10px'}}>{s.lastChargeError && s.track && s.nextChargeAt && Date.parse(s.nextChargeAt)<=Date.now()
                        ? <button className="btn-secondary" disabled={subscriptionRetryBusy===`${s.orgId}:${s.track}`} onClick={()=>retryFailedSubscription(s)}>{subscriptionRetryBusy===`${s.orgId}:${s.track}`?'처리 중...':'수동 재청구'}</button>
                        : <span style={{fontSize:12,color:'#94a3b8'}}>{s.lastChargeError?'예정일 전':'-'}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pager page={subsPage} setPage={setSubsPage} total={subs.length} />
              </div>
            )}
          </section>
        )}

        {page === 'payment-calendar' && (
          <PaymentCalendar
            month={calendarMonth}
            payments={calendarPayments}
            subscriptions={calendarSubs}
            loading={calendarLoading}
            onMonthChange={setCalendarMonth}
            onRefresh={fetchPaymentCalendar}
          />
        )}

        {page === 'payments' && (
          <section className="section fade-in">
            <div className="script-editor-header" style={{marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>결제 내역 ({payments.length}건)</div>
              <button className={`btn-download ${paymentsLoading?'btn-calling':''}`} onClick={fetchPayments} disabled={paymentsLoading}>{paymentsLoading?'조회 중...':'조회'}</button>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <input aria-label="결제 내역 기관코드 필터" className="form-input" style={{width:200,margin:0}} placeholder="기관코드 필터(선택)" value={paymentsOrg} onChange={e=>setPaymentsOrg(e.target.value)} />
            </div>
            {payments.some(needsPaymentAttention) && <div role="alert" style={{padding:'10px 12px',marginBottom:12,borderRadius:8,background:'#fff4e5',color:'#8a4b00',fontSize:13,fontWeight:700}}>확인 필요한 결제 {payments.filter(needsPaymentAttention).length}건 · 최근 24시간 실패와 완료되지 않은 결제·환불 상태를 점검해 주세요.</div>}
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:10}}>PortOne 원본 거래와 금액·상태가 일치할 때만 중간 상태를 복구합니다. 수동 검토 상태는 자동 변경하지 않습니다.</div>
            {payments.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{paymentsLoading?'불러오는 중...':'조회된 결제 내역이 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>시각</th><th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>종류</th>
                    <th style={{padding:'8px 10px'}}>금액</th><th style={{padding:'8px 10px'}}>상태</th><th style={{padding:'8px 10px'}}>요청자</th><th style={{padding:'8px 10px'}}>조치</th>
                  </tr></thead>
                  <tbody>{payments.slice((paymentsPage-1)*PAGE_SIZE, paymentsPage*PAGE_SIZE).map((p:any) => (
                    <tr key={p.id} title={p.error || p.reviewReason || ''} style={{borderBottom:'1px solid #f1f3f4',background:['verification_pending','review_required','refund_processing','refund_credit_pending'].includes(p.status)?'#fffaf0':'transparent'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{p.orgId}</td>
                      <td style={{padding:'10px'}}>{p.type==='subscription' ? `정액제${p.planKey?`(${p.planKey})`:''}${p.renewal?' · 자동갱신':''}` : '크레딧 충전'}</td>
                      <td style={{padding:'10px',fontWeight:700}}>{p.amount.toLocaleString()}원</td>
                      <td style={{padding:'10px'}}>
                        <span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,
                          background: p.status==='paid'?'#e6f4ea':p.status==='failed'?'#fce8e6':(p.status==='cancelled'||p.status==='partially_refunded')?'#f1f3f4':'#fff8e1',
                          color: p.status==='paid'?'#1e8e3e':p.status==='failed'?'#c5221f':(p.status==='cancelled'||p.status==='partially_refunded')?'#5f6368':'#754d00'}}>
                          {p.status==='paid'?'완료':p.status==='failed'?'실패':p.status==='verification_pending'?'결과 확인 필요':p.status==='review_required'?'수동 검토 필요':p.status==='refund_processing'?'카드 취소 처리 중':p.status==='refund_credit_pending'?'크레딧 회수 필요':p.status==='cancelled'?'전액 환불됨':p.status==='partially_refunded'?'부분 환불됨':'대기'}
                        </span>
                        {p.lastPortoneStatus && <div style={{marginTop:5,fontSize:11,color:'#64748b'}}>
                          PortOne {p.lastPortoneStatus} · {Number(p.lastPortoneAmount || 0).toLocaleString()}원
                        </div>}
                      </td>
                      <td style={{padding:'10px',color:'#5f6368',fontSize:12}}>{p.requestedBy}</td>
                      <td style={{padding:'10px'}}>
                        {consoleRole !== 'cs' && ['verification_pending','review_required','refund_processing','refund_credit_pending'].includes(p.status) ? (
                          <button className="btn-secondary" style={{fontSize:12,padding:'4px 9px'}} disabled={paymentReconcileBusy===p.id} onClick={()=>reconcilePayment(p)}>
                            {paymentReconcileBusy===p.id ? '대조 중...' : '대조·복구'}
                          </button>
                        ) : <span style={{color:'#94a3b8'}}>—</span>}
                      </td>
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
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:14}}>완료된 크레딧 충전과 현재 활성 정기결제가 대상입니다. 충전은 사용·만료분을 제외한 미사용액만 취소합니다. 정기결제는 전액 취소하며 현재 구독과 다음 자동결제가 즉시 종료됩니다. 최신 활성 결제임을 확인할 수 없으면 자동 환불하지 않습니다.</div>
            {refundable.length === 0 ? <div style={{color:'#5f6368',fontSize:14,padding:'12px 4px'}}>{refundLoading?'불러오는 중...':'환불 가능한 결제가 없습니다'}</div> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr style={{textAlign:'left',color:'#5f6368',borderBottom:'1px solid #dadce0'}}>
                    <th style={{padding:'8px 10px'}}>시각</th><th style={{padding:'8px 10px'}}>기관</th><th style={{padding:'8px 10px'}}>종류</th><th style={{padding:'8px 10px'}}>금액</th>
                    <th style={{padding:'8px 10px'}}>요청 상태</th><th style={{padding:'8px 10px'}}>사유</th><th style={{padding:'8px 10px'}}></th>
                  </tr></thead>
                  <tbody>{[...refundable].sort((a:any,b:any)=>(b.refundRequestStatus==='pending'?1:0)-(a.refundRequestStatus==='pending'?1:0))
                    .slice((refundPage-1)*PAGE_SIZE, refundPage*PAGE_SIZE).map((p:any) => (
                    <tr key={p.id} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px',color:'#5f6368'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                      <td style={{padding:'10px'}}>{p.orgId}</td>
                      <td style={{padding:'10px'}}>{p.type==='subscription' ? `정기결제${p.planKey?` (${p.planKey})`:''}` : '크레딧 충전'}</td>
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
                    <th style={{padding:'8px 10px'}}>계약·도입</th><th style={{padding:'8px 10px'}}>통화</th><th style={{padding:'8px 10px'}}>크레딧 잔액</th><th style={{padding:'8px 10px'}}>대상자</th><th style={{padding:'8px 10px'}}>상태</th><th style={{padding:'8px 10px'}}></th>
                  </tr></thead>
                  <tbody>{orgs.slice((orgsPage-1)*PAGE_SIZE, orgsPage*PAGE_SIZE).map((o:any) => {
                    const suspended = o.suspended === true;
                    return (
                    <tr key={o.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                      <td style={{padding:'10px'}}>{o.name}</td><td style={{padding:'10px',fontFamily:'monospace',color:'#5f6368'}}>{o.code}</td><td style={{padding:'10px'}}>{o.plan || '미설정'}</td><td style={{padding:'10px',fontSize:12}}>{o.contractStatus||'prospect'}<div style={{color:'#5f6368'}}>{o.rolloutStage||'preparing'} · {o.contractEndAt||'종료일 미정'}</div></td><td style={{padding:'10px'}}>{o.callMode||'both'}</td>
                      <td style={{padding:'10px'}}>{o.creditExpiryUnreconciledBalance != null && Number(o.creditExpiryUnreconciledBalance) !== 0
                        ? <span title="원장과 저장 잔액이 일치하지 않습니다" style={{fontWeight:800,color:'#c5221f'}}>원장 확인 필요 ({Number(o.creditExpiryUnreconciledBalance).toLocaleString()}원)</span>
                        : o.creditBalance == null ? <span style={{color:'#94a3b8'}}>무제한(구기관)</span> : <span style={{fontWeight:700,color:o.creditBalance<=0?'#c5221f':'#0f172a'}}>{Number(o.creditBalance).toLocaleString()}원</span>}</td>
                      <td style={{padding:'10px'}}>{o.elderCount}명</td>
                      <td style={{padding:'10px'}}><span style={{fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:12,background:suspended?'#fce8e6':'#e6f4ea',color:suspended?'#c5221f':'#1e8e3e'}}>{suspended?'정지됨':'정상'}</span></td>
                      <td style={{padding:'10px',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px'}} disabled={orgBusy===o.orgId} onClick={()=>editOrgLifecycle(o)}>운영정보</button>
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
              <select aria-label="사용자 소속 기관 필터" className="form-input" style={{width:220,margin:0}} value={usersOrgFilter} onChange={e=>setUsersOrgFilter(e.target.value)}>
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
              <select aria-label="어르신 소속 기관 필터" className="form-input" style={{width:220,margin:0}} value={eldersOrgFilter} onChange={e=>setEldersOrgFilter(e.target.value)}>
                <option value="">전체 기관</option>
                {orgs.map((o:any)=>(<option key={o.orgId} value={o.orgId}>{o.name} ({o.code})</option>))}
              </select>
              <input aria-label="어르신 이름 또는 전화번호 검색" className="form-input" style={{width:220,margin:0}} placeholder="이름·전화번호 검색" value={eldersSearch} onChange={e=>setEldersSearch(e.target.value)} />
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

        {page === 'elders' && consoleRole !== 'cs' && (
          <section className="section fade-in" style={{marginTop:16}}>
            <div className="section-title" style={{marginBottom:10}}>홈페이지 체험 전화 제한 해제</div>
            <div style={{fontSize:13,color:'#5f6368',marginBottom:12,lineHeight:1.6}}>
              체험 전화는 번호당 1회만 받을 수 있습니다. 도입 검토 중 재시연 요청처럼 다시 걸어야 하는 경우에만 해제하세요.
              해제하면 신청 이력은 보관되고 제한만 풀립니다. IP 일 3회·전체 일 30통·평일 09~18시 상한은 그대로 적용됩니다.
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
              <input className="form-input" style={{width:200,margin:0}} placeholder="010-0000-0000"
                value={demoResetPhone} onChange={e=>setDemoResetPhone(e.target.value)} />
              <input className="form-input" style={{width:300,margin:0}} placeholder="해제 사유 (감사 로그에 남습니다)"
                maxLength={200} value={demoResetReason} onChange={e=>setDemoResetReason(e.target.value)} />
              <button className="btn-primary" disabled={demoResetBusy} onClick={resetDemoCall}>
                {demoResetBusy ? '해제 중...' : '제한 해제'}
              </button>
            </div>
          </section>
        )}

        {page === 'notices' && (
          <div className="fade-in">
            <section className="section" style={{marginBottom:16}}>
              <div className="section-title" style={{marginBottom:10}}>새 공지 게시</div>
              <input aria-label="공지 제목" className="form-input" placeholder="제목" value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} style={{marginBottom:8}} />
              <textarea className="form-input" placeholder="내용" value={noticeBody} onChange={e=>setNoticeBody(e.target.value)} rows={4} style={{marginBottom:8,width:'100%',boxSizing:'border-box',resize:'vertical'}} />
              <input aria-label="공지 대상 기관 ID" className="form-input" placeholder="대상 기관 orgId(콤마 구분, 비우면 전체 기관)" value={noticeTargetOrgs} onChange={e=>setNoticeTargetOrgs(e.target.value)} style={{marginBottom:8}} />
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
                  {notices.slice((noticesPage-1)*PAGE_SIZE, noticesPage*PAGE_SIZE).map((n:any) => (
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
                          {consoleRole!=='cs' && (
                            <button className="btn-secondary" style={{fontSize:12,padding:'4px 8px',color:'#c5221f'}} onClick={()=>deleteNoticeAction(n)}>삭제</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Pager page={noticesPage} setPage={setNoticesPage} total={notices.length} />
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
                    <tbody>{csAccounts.slice((csAccountsPage-1)*PAGE_SIZE, csAccountsPage*PAGE_SIZE).map((u:any) => (
                      <tr key={u.uid} style={{borderBottom:'1px solid #f1f3f4'}}>
                        <td style={{padding:'10px'}}>{u.email}</td>
                        <td style={{padding:'10px'}}>{u.name || '-'}</td>
                        <td style={{padding:'10px'}}><button className="btn-secondary" style={{fontSize:12,padding:'4px 8px',color:'#c5221f'}} onClick={()=>deleteCsAccountAction(u)}>삭제</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <Pager page={csAccountsPage} setPage={setCsAccountsPage} total={csAccounts.length} />
                </div>
              )}
            </section>
          </div>
        )}

        {page === 'help' && (
          <section className="section fade-in" style={{padding:0,overflow:'hidden'}}>
            {helpLoading && <div style={{padding:28,color:'#5f6368'}}>도움말을 불러오는 중입니다.</div>}
            {helpError && <div style={{padding:28,color:'#c5221f'}}>{helpError} <button className="btn-secondary" onClick={()=>{setHelpError('');setHelpRetry(value=>value+1);}}>다시 시도</button></div>}
            {helpContent && <iframe
              title="영실이 콘솔 도움말"
              srcDoc={helpContent}
              onLoad={onHelpLoad}
              scrolling="no"
              style={{width:'100%',height:helpHeight,border:0,display:'block'}}
            />}
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
                <div className="form-input" style={{width:200,margin:0}}>신용·체크카드</div>
                <button className="btn-primary" disabled={testBusy==='subscribe'} onClick={testSubscribeFlow}>{testBusy==='subscribe'?'진행 중...':'테스트 등록'}</button>
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:8}}>선택한 기관에 등록된 어르신 수가 있어야 금액 계산이 됩니다.</div>
              <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid #e2e8f0'}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>토스 샌드박스 API 테스트</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                  <input
                    className="form-input"
                    style={{width:220,margin:0}}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    value={testCardBin}
                    onChange={e=>setTestCardBin(e.target.value.replace(/\D/g,'').slice(0,6))}
                    placeholder="카드 BIN 앞 6자리"
                  />
                  <button className="btn-secondary" disabled={!!testBusy} onClick={testSubscribeDirectFlow}>
                    {testBusy==='subscribe-direct'?'검증 중...':'API로 빌링·1,000원 테스트'}
                  </button>
                </div>
                <div style={{fontSize:12,color:'#64748b',marginTop:8}}>전체 카드번호·생년월일·비밀번호는 입력받지 않습니다. BIN은 요청 처리 중에만 사용하며 저장하거나 로그에 남기지 않습니다.</div>
              </div>
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
        </main>
      </div>
    </div>
  );
}
