// DashboardApplication.tsx의 page==='data'(공공데이터 현황) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-07).
import { normalizeRegion } from '../dashboardConstants';

export default function DataPage(props: any) {
  const {
    popData, weatherData, disasterMsgConfigured, disasterMsgs, popError, popLoading,
    elders, alertSeverity, calling, setCallModal, popDoneOpen, setPopDoneOpen,
    fetchPopulation, fetchWeather, getNoResponseDays, weatherStale, weatherTime, T,
  } = props;

  return (
    <div className="fade-in">
      <div className="data-banner">
        <div><div className="data-banner-title">{popData?.sidoName || '대구광역시'} 독거노인 현황</div><div className="data-banner-sub">기관 주소 기준 자동 연동 · 출처: {popData?.source || '행정안전부 주민등록인구통계'}{popData && !popData.collecting && popData.year && popData.month && ` · ${popData.year}년 ${popData.month}월 기준`}</div></div>
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
      {popData && !popData.collecting && popData.total && (
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
  );
}
