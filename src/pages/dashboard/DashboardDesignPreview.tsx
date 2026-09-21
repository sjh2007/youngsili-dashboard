import { useState } from 'react';
import { LayoutDashboard, HeartPulse, Users, ShieldCheck, Phone, FileText, BarChart3, CalendarDays, Settings, X } from 'lucide-react';
import DashboardHomePage from './DashboardHomePage';

// 개발 모드·localhost에서만 렌더링하는 독립 화면. API와 Firebase를 호출하지 않는다.
const elders = Array.from({ length: 12 }, (_, i) => ({
  id: `design-${i}`, name: `예시 어르신 ${i + 1}`, age: 72 + i, region: '서울 마포구',
  caregiver: '예시 담당자', status: i === 0 ? 'danger' : i < 3 ? 'warning' : 'normal',
  phone: `sample-${i}`, lastCall: i === 1 ? '3' : '0', callActive: true, visits: i < 2 ? 1 : 0,
}));
const nav = [
  [LayoutDashboard, '대시보드'], [HeartPulse, '건강 상태'], [Users, '어르신 관리'],
  [ShieldCheck, '안전확인 관리'], [Phone, '통화 기록'], [FileText, '상담·방문 일지'],
  [BarChart3, '리포트 / 통계'], [CalendarDays, '전화 발신 관리'], [Settings, '기관 관리'],
] as const;
export default function DashboardDesignPreview() {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [noRespOpen, setNoRespOpen] = useState(false);
  const [todoDone, setTodoDone] = useState({});
  const [notice, setNotice] = useState('');
  const [empty, setEmpty] = useState(false);
  const explain = (label: string) => setNotice(`${label} · 디자인 미리보기입니다. 실제 작업은 일반 대시보드에서 진행해 주세요.`);
  const list = empty ? [] : elders;
  return <div className="app dashboard-design-preview">
    <aside className="sidebar" aria-label="메뉴 미리보기">
      <div className="logo"><img src="/youngsili.png" alt="" width="38" height="44" /><div><div className="logo-title">영실이</div><div className="logo-sub">어르신 관리 시스템</div></div></div>
      <div style={{ padding: '16px 12px' }}><button className="nav-cta" onClick={() => explain('전화 발신 관리')}>오늘 전화 관리</button></div>
      <nav className="nav">{nav.map(([Icon, name], i) => <button key={name} className={`nav-item ${i === 0 ? 'active' : ''}`} aria-current={i === 0 ? 'page' : undefined} onClick={() => explain(name)}><Icon size={19} /><span>{name}</span></button>)}</nav>
      <div className="sidebar-footer"><div><strong className="worker-name">디자인 검토용 기관</strong><p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>모든 이름과 수치는 예시입니다</p></div></div>
    </aside>
    <main className="main">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: '#eaf2ff', color: '#295795', padding: '14px 28px', fontSize: 14 }}>
        <span><strong>로컬 디자인 미리보기</strong> · 예시 데이터 / 실제 발신 없음</span>
        <button className="btn-secondary" onClick={() => { setEmpty(v => !v); setTodoDone({}); }}>{empty ? '예시 데이터 보기' : '빈 화면 확인'}</button>
      </div>
      <div className="content">
        <DashboardHomePage me={{ orgName: '영실이 테스트복지센터' }} elders={list}
          openRegister={() => explain('신규 등록')} goPage={(page: string) => explain(page)}
          alertsData={empty ? [] : [{ name: elders[0].name, level: 'critical', read: false, timestamp: new Date().toISOString() }]}
          alertIsReal={() => true} alertEnCode={() => ''} alertKw={() => '식사 어려움'}
          getNoResponseDays={(value: string) => Number(value) || 0} weatherData={{}}
          alertsOpen={alertsOpen} setAlertsOpen={setAlertsOpen} openDetail={(elder: any) => explain(`${elder.name} 상세`)}
          setCallModal={() => explain('전화 연결')} T={{ elder: '어르신' }} isDisability={false} setSortBy={() => {}}
          noRespOpen={noRespOpen} setNoRespOpen={setNoRespOpen} danger={empty ? 0 : 1} warning={empty ? 0 : 2} normal={empty ? 0 : 9}
          todoDone={todoDone} setTodoDone={setTodoDone} todayCalls={empty ? [] : elders.slice(0, 8)}
          drillDispatch={() => explain('발신 이력')} dispatchTotal={empty ? 0 : 10} answeredCount={empty ? 0 : 8} missedCount={empty ? 0 : 2}
          drillCalls={() => explain('통화 기록')} totalCalls={empty ? 0 : 8} criticalCount={empty ? 0 : 1} urgentCount={empty ? 0 : 1} normalCount={empty ? 0 : 6}
          safetyToday={() => ({ unchecked: [], undialed: 0 })} calling={null} makeCall={() => explain('전화 발신')}
          alertCount={empty ? 0 : 2} getSolitudeRisk={() => ({ bg: '#f0f5fb', color: '#65758b', label: '관찰' })} renderLastCall={() => '오늘 09:30'} />
      </div>
    </main>
    {notice && <div role="status" style={{ position: 'fixed', right: 24, bottom: 24, maxWidth: 420, padding: 20, background: '#203451', color: 'white', borderRadius: 14, zIndex: 2000, boxShadow: '0 8px 32px #20345133', display: 'flex', gap: 16 }}><span>{notice}</span><button aria-label="안내 닫기" onClick={() => setNotice('')} style={{ background: 'none', border: 0, color: 'white', cursor: 'pointer' }}><X size={18}/></button></div>}
  </div>;
}
