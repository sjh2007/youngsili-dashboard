// DashboardApplication.tsx의 schedModal(급여제공 일정표) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
export default function ScheduleModal(props: any) {
  const {
    schedModal, setSchedModal, elders, loadSchedule, winWide, isStaffUp, printScheduleBatch,
    printSchedule, saveSchedule, SCHED_CAP, SCHED_RATE,
  } = props;

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
}
