// DashboardApplication.tsx의 page==='calls'(통화 기록) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { ShieldCheck } from 'lucide-react';
import { CallTranscript, GroupHeader } from '../../components/common';
import { localDayKey } from '../../utils/date';
import { RISK_CONFIG } from '../../constants/app';

export default function CallsPage(props: any) {
  const {
    callsHistory, callsPhone, callsSearch, callsRiskMatch, nameByPhone, callsRange, setCallsRange,
    callsFrom, setCallsFrom, callsTo, setCallsTo, fetchCalls, callsLoading, callsAllOpen,
    setCallsAllOpen, setCallsDayOv, callsRisk, setCallsRisk, elders, setCallsSearch, setCallsPhone,
    callsDayOv, expandedCallDays, setExpandedCallDays, formatDateHeader, kwFromTranscript,
    draftingCallId, openNoteForCall,
  } = props;

  // 뱃지 카운트(총 N건)와 아래 목록이 같은 필터 조건을 각자 다시 계산하고 있었다 —
  // 렌더 1회당 한 번만 계산해서 재사용(callsHistory가 몇 백 건이면 검색창 타이핑마다
  // 두 번씩 도는 게 체감된다).
  const filteredCalls = callsHistory.filter(c=>(!callsPhone||String(c.phone||'').replace(/\D/g,'')===callsPhone)&&(!callsSearch||(nameByPhone(c.phone,c.elderName)||'').includes(callsSearch))&&callsRiskMatch(c));

  return (
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
        <span className="calls-total">총 {filteredCalls.length}건</span>
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
        const src = filteredCalls;
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
  );
}
