// DashboardApplication.tsx의 page==='forms'(보고서·서식) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
export default function FormsPage(props: any) {
  const {
    formsYm, setFormsYm, setReportMonth, formsCounts, openWeeklyReport, printWeeklyBatchFor,
    openSchedule, printScheduleBatchFor, caseNotes, exportNotesXlsx, monthlyBusy, downloadMonthlyReport,
  } = props;

  return (
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
  );
}
