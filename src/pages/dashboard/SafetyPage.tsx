// DashboardApplication.tsx의 page==='safety'(안전확인 관리) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-07).
import { Button, PageIntro } from '../../components/ui';
import { CARE_GROUPS } from '../dashboardConstants';

export default function SafetyPage(props: any) {
  const { refreshPage, safetyToday, callsHistory, elders, calling, makeCall, openEditSchedule } = props;

  return (
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
  );
}
