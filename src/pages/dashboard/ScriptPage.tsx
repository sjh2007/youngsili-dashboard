// DashboardApplication.tsx의 page==='script'(전화 멘트 관리) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-04).
import { Snowflake, CloudRain, CloudSun, Sun, Flame, ShieldCheck, CircleCheck, Wind } from 'lucide-react';
import { ALERT_TEMPLATES, WILDFIRE_STAGES, normalizeRegion } from '../dashboardConstants';

export default function ScriptPage(props: any) {
  const {
    me, weatherData, weatherTime, weatherStale, fetchingWeather, fetchWeather,
    forestFireData, specialWarningData, alertSeverity,
    activeAlert, setActiveAlert, alertUserTouchedRef, appliedAlertKeyRef,
    wildfireStage, setWildfireStage, setAlertScript, tplText,
    fireLoc, setFireLoc, shelterName, setShelterName,
    alertScript, setAlertTplSaved,
    saveAlertTemplate, resetAlertTemplate, alertTplSaving, alertTplSaved, savedAlertTpl, curAlertKey,
    checked, elders, alertMsgFor, setChecked, toggleCheck,
    bulkRunning, setBulkConfirm, bulkDone, bulkQueue, stopBulkCall,
    questions, setQuestionField, saveQuestions, resetQuestions, questionsSaving, questionsMsg,
    T, pstnCallerId, setPstnCallerId, savePstnCallerId, pstnSaving, pstnMsg,
  } = props;

  return (
    <div className="fade-in script-page">
      <div className="weather-panel">
        <div className="weather-panel-header">
          <div><div className="weather-panel-title">기상청 공공데이터 연동</div><div className="weather-panel-sub">5분 주기 자동 갱신 · 관할: {(() => { const sido = (me?.orgRegion || '').split(' ')[0]; const n = Object.keys(weatherData).length; return sido && n > 1 ? `${sido} 전역 ${n}개 지역` : (me?.orgRegion || `${T.elder} 등록 지역 기준`); })()} (기관 주소 자동 매핑){weatherTime && ` · 마지막 갱신 ${weatherTime}`} · 날씨 경보 발령 시 자동으로 멘트에 삽입됩니다{weatherStale && <span style={{marginLeft:8,background:'#fffbeb',border:'1px solid #fde68a',color:'#b45309',padding:'1px 8px',borderRadius:6,fontWeight:700}}>연동 지연 — 마지막 수신 데이터 표시 중</span>}</div></div>
          <button className={`btn-fetch-weather ${fetchingWeather?'btn-calling':''}`} onClick={fetchWeather} disabled={fetchingWeather}>{fetchingWeather ? '불러오는 중...' : '날씨 데이터 갱신'}</button>
        </div>
        {(() => {
          // 기관 주소 지역 → 어르신 거주지 지역 순으로 묶어서 보여준다.
          // (기관 주소를 바꿔도 어르신 거주지 지역이 그대로 섞여 나와 헷갈린다는 문의 대응 — 2026-08-10)
          const SRC_ORDER: Record<string, number> = { org: 0, both: 1, elder: 2 };
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
            <button key={t.id} className={`alert-template-btn ${activeAlert===t.id?'alert-template-active':''}`} onClick={() => { alertUserTouchedRef.current = true; appliedAlertKeyRef.current = t.id; setActiveAlert(t.id); if (t.id==='wildfire') { setWildfireStage('prepare'); setAlertScript(tplText('wildfire_prepare', WILDFIRE_STAGES[0].text)); } else { setAlertScript(tplText(t.id, (ALERT_TEMPLATES as any)[t.id])); } }}>
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
              const pool = (checked.length ? elders.filter((e: any) => checked.includes(e.id)) : elders).filter((e: any) => e.region);
              const byRegion: any[] = [];
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
                  const AL: Record<string,string> = { heatwave:'폭염', cold:'한파', dust:'미세먼지', rain:'호우', typhoon:'태풍', wildfire:'산불' };
                  const label = AL[activeAlert] || '경보';
                  return (
                    <button className="btn-secondary" style={{fontSize:15,padding:'5px 10px'}}
                      title={`지금 선택한 '${label}' 경보가 발효 중인 지역의 어르신만 선택합니다. 다른 경보(예: 호우) 지역은 그 경보를 선택한 뒤 눌러 주세요.`}
                      onClick={()=>setChecked(elders.filter((e: any)=>weatherData[normalizeRegion(e.region)]?.alert===activeAlert).map((e: any)=>e.id))}>{label} 지역 자동선택</button>
                  );
                })()}
                <button className="btn-secondary" style={{fontSize:15,padding:'5px 10px'}} onClick={()=>setChecked(elders.map((e: any)=>e.id))}>전체</button>
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
              {[...new Set(elders.map((e: any)=>normalizeRegion(e.region)||'(지역 미설정)'))].sort().map((r: any) => {
                const inR = elders.filter((e: any)=>(normalizeRegion(e.region)||'(지역 미설정)')===r);
                const allOn = inR.length>0 && inR.every((e: any)=>checked.includes(e.id));
                const someOn = inR.some((e: any)=>checked.includes(e.id));
                return (
                  <button key={r} onClick={()=>{ if(allOn) setChecked((prev: any[])=>prev.filter(id=>!inR.some((e: any)=>e.id===id))); else setChecked((prev: any[])=>[...new Set([...prev,...inR.map((e: any)=>e.id)])]); }} style={{fontSize:16,padding:'6px 12px',borderRadius:20,border:'1px solid '+(allOn?'#246BEB':someOn?'#93c5fd':'#d1d5db'),background:allOn?'#246BEB':someOn?'#eff6ff':'#fff',color:allOn?'#fff':'#374151',fontWeight:600,cursor:'pointer'}}>{r.replace('대구 ','')} ({inR.length})</button>
                );
              })}
            </div>
            <div className="alert-elder-list">
              {elders.map((e: any) => {
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
          {questions.map((q: any)=>(
            <div key={q.key} className={`script-question-row ${q.enabled?'':'is-disabled'}`}>
              <span className="script-question-label">{q.label}</span>
              <textarea
                value={q.text}
                onChange={(e: any)=>setQuestionField(q.key,'text',e.target.value)}
                disabled={!q.enabled}
                rows={2}
                className="script-question-input"
              />
              <div className="script-question-options">
                <label style={{display:'flex',alignItems:'center',gap:5,fontSize:15,fontWeight:700,color:'#f59e0b',whiteSpace:'nowrap',cursor:'pointer'}}
                       title="이틀에 한 번만 여쭙니다 — 통화가 길어지지 않게">
                  <input type="checkbox" checked={!q.everyday} onChange={(e: any)=>setQuestionField(q.key,'everyday',!e.target.checked)} />격일
                </label>
                <label style={{display:'flex',alignItems:'center',gap:5,fontSize:15,fontWeight:700,color:'#334155',whiteSpace:'nowrap',cursor:'pointer'}}
                       title="끄면 통화에서 이 질문을 하지 않습니다">
                  <input type="checkbox" checked={q.enabled} onChange={(e: any)=>setQuestionField(q.key,'enabled',e.target.checked)} />사용
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
              onChange={(e: any)=>setPstnCallerId(e.target.value.replace(/[^0-9]/g,''))}
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
  );
}
