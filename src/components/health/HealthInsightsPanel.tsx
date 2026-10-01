import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { SERVER_URL, authFetch, errMsg } from '../../utils/api';
import {
  HealthInsightCaseSchema, HealthInsightDetailSchema, HealthInsightListSchema, HealthInsightTrendSchema,
  type Elder, type HealthInsightCase, type HealthInsightDetail, type HealthInsightTrendPoint,
} from '../../schemas';

const topicLabel: Record<string,string> = { meal:'식사', sleep:'수면', activity:'활동', discomfort:'불편 사항' };
const signalLabel: Record<string,string> = { new_statement:'새 불편 확인', repeated_statement:'같은 불편 반복', changed_response:'최근 응답과 달라짐', insufficient_data:'자료 부족' };
const stateLabel: Record<string,string> = { unreviewed:'미확인', reviewing:'확인 중', resolved:'처리됨', corrected:'정정됨', dismissed:'제외됨' };

export default function HealthInsightsPanel({ elders, notify, onOpenCallRecords }: { elders:Elder[]; notify?:(m:string,t?:string)=>void; onOpenCallRecords?:(elderId:string)=>void }) {
  const elderKey=(elder:Elder)=>String(elder.phone||elder.id||'');
  const [elderId,setElderId]=useState('');
  const [items,setItems]=useState<HealthInsightCase[]>([]);
  const [points,setPoints]=useState<HealthInsightTrendPoint[]>([]);
  const [details,setDetails]=useState<Record<string,HealthInsightDetail>>({});
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [busyCaseId,setBusyCaseId]=useState('');
  const [disabled,setDisabled]=useState(false);
  const [loading,setLoading]=useState(false);
  const [showCompleted,setShowCompleted]=useState(false);
  const [rangeDays,setRangeDays]=useState<7|30|90>(30);

  useEffect(()=>{ if(!elderId&&elders?.length) setElderId(elderKey(elders[0])); },[elders,elderId]);

  const load=async()=>{
    if(!elderId)return;
    setLoading(true);
    try{
      const now=new Date(),from=new Date(now.getTime()-rangeDays*86400000);
      const q=`elderId=${encodeURIComponent(elderId)}&from=${from.toISOString().slice(0,10)}&to=${now.toISOString().slice(0,10)}`;
      const [a,b]=await Promise.all([
        authFetch(`${SERVER_URL}/health/insights?elderId=${encodeURIComponent(elderId)}&limit=100`),
        authFetch(`${SERVER_URL}/health/insights/trend?${q}`),
      ]);
      if(a.status===501||b.status===501){setDisabled(true);setItems([]);setPoints([]);return}
      const ad:unknown=await a.json(),bd:unknown=await b.json();
      if(!a.ok||!b.ok)throw new Error(errMsg(!a.ok?ad:bd));
      const parsedList=HealthInsightListSchema.safeParse(ad),parsedTrend=HealthInsightTrendSchema.safeParse(bd);
      if(!parsedList.success||!parsedTrend.success)throw new Error('건강 변화 API 응답 형식이 올바르지 않습니다');
      setDisabled(false);setItems(parsedList.data.items);setPoints(parsedTrend.data.points);
    }catch(error:unknown){notify?.(error instanceof Error?error.message:'건강 변화 정보를 불러오지 못했습니다')}
    finally{setLoading(false)}
  };
  useEffect(()=>{setDetails({});setExpanded({});setShowCompleted(false);load()},[elderId,rangeDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected=elders.find(e=>elderKey(e)===elderId);
  const activeItems=items.filter(item=>item.state==='unreviewed'||item.state==='reviewing');
  const completedItems=items.filter(item=>['resolved','corrected','dismissed'].includes(item.state));
  const options:ApexOptions=useMemo(()=>({chart:{type:'area',toolbar:{show:false},fontFamily:'Pretendard, sans-serif',animations:{enabled:true,speed:380}},colors:['#ef3f4a'],dataLabels:{enabled:false},markers:{size:4,strokeWidth:3,strokeColors:'#fff',hover:{size:6}},grid:{borderColor:'#e8edf5',strokeDashArray:4},stroke:{curve:'smooth',width:3},fill:{type:'gradient',gradient:{opacityFrom:.28,opacityTo:.02,stops:[0,90,100]}},xaxis:{categories:points.map(p=>new Date(p.observedAt).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})),labels:{style:{colors:'#8290a6',fontSize:'12px'}},axisBorder:{show:false},axisTicks:{show:false}},yaxis:{min:0,forceNiceScale:true,labels:{style:{colors:'#8290a6'}}},tooltip:{y:{formatter:v=>`${v}개`}}}),[points]);

  const topicCounts=activeItems.reduce<Record<string,number>>((acc,item)=>({...acc,[item.topic]:(acc[item.topic]||0)+1}),{});
  const topTopic=Object.entries(topicCounts).sort((a,b)=>b[1]-a[1])[0];
  const latestPoint=points.at(-1);
  const maxPoint=points.reduce((max,point)=>Math.max(max,point.needsReviewCount),0);

  const showDetail=async(item:HealthInsightCase)=>{
    if(expanded[item.caseId]){setExpanded(v=>({...v,[item.caseId]:false}));return}
    if(details[item.caseId]){setExpanded(v=>({...v,[item.caseId]:true}));return}
    setBusyCaseId(item.caseId);
    try{
      const response=await authFetch(`${SERVER_URL}/health/insights/${item.caseId}`);
      const data:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(errMsg(data,'근거 내용을 불러오지 못했습니다'));
      const parsed=HealthInsightDetailSchema.safeParse(data);
      if(!parsed.success)throw new Error('건강 변화 상세 응답 형식이 올바르지 않습니다');
      setDetails(v=>({...v,[item.caseId]:parsed.data}));setExpanded(v=>({...v,[item.caseId]:true}));
    }catch(error:unknown){notify?.(error instanceof Error?error.message:'근거 내용을 불러오지 못했습니다')}
    finally{setBusyCaseId('')}
  };

  const update=async(item:HealthInsightCase,state:'reviewing'|'resolved')=>{
    const reviewNote=state==='resolved' ? window.prompt('실제 조치 내용을 입력하세요. (예: 전화 확인 — 현재 이상 없음, 보호자 연락 예정)') : '';
    if(state==='resolved'&&reviewNote===null)return;
    if(state==='resolved'&&!reviewNote.trim()){notify?.('조치 완료 내용을 입력해 주세요');return}
    setBusyCaseId(item.caseId);
    try{
      const response=await authFetch(`${SERVER_URL}/health/insights/${item.caseId}/review`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision:item.revision,requestId:crypto.randomUUID(),reviewNote})});
      const data:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(errMsg(data,'상태를 저장하지 못했습니다'));
      const parsedCase=HealthInsightCaseSchema.safeParse(data),parsedDetail=HealthInsightDetailSchema.safeParse(data);
      if(!parsedCase.success)throw new Error('건강 변화 저장 응답 형식이 올바르지 않습니다');
      if(parsedDetail.success){setDetails(v=>({...v,[item.caseId]:parsedDetail.data}));setExpanded(v=>({...v,[item.caseId]:true}))}
      notify?.(state==='reviewing'?'확인을 시작했습니다. 아래에서 근거 내용을 확인해 주세요.':'조치 완료 상태로 저장했습니다.','success');
      await load();
    }catch(error:unknown){notify?.(error instanceof Error?error.message:'상태를 저장하지 못했습니다')}
    finally{setBusyCaseId('')}
  };

  if(disabled)return null;
  const renderEvidence=(detail:HealthInsightDetail,tone:'active'|'done')=><div className="health-insight-evidence">
    <strong>통화 원문 근거</strong>
    {detail.evidence.length?detail.evidence.map((e,index)=><blockquote key={`${e.sourceId}-${e.line}-${index}`} className={tone==='active'?'is-active':''}><div>&ldquo;{e.excerpt}&rdquo;</div><small>{new Date(e.observedAt).toLocaleString('ko-KR')} · 원문 {e.line}번째 줄</small></blockquote>):<p>표시할 원문 근거가 없습니다.</p>}
  </div>;

  return <section className="health-insights-board" aria-labelledby="health-insights-title">
    <header className="health-insights-head">
      <div><span className="health-insights-eyebrow">통화 기반 건강 관찰</span><h2 id="health-insights-title">건강 변화 확인</h2><p>의료 진단이 아닌, 담당자가 통화 근거를 확인하고 조치하는 화면입니다.</p></div>
      <div className="health-insights-controls">
        <label>어르신 선택<select value={elderId} onChange={e=>setElderId(e.target.value)}>{elders.map(e=><option key={elderKey(e)} value={elderKey(e)}>{e.name||'이름 없음'}</option>)}</select></label>
        <div className="health-range-tabs" role="group" aria-label="조회 기간">{([[7,'이번 주'],[30,'이번 달'],[90,'최근 3개월']] as const).map(([days,label])=><button key={days} type="button" className={rangeDays===days?'is-active':''} aria-pressed={rangeDays===days} onClick={()=>setRangeDays(days)}>{label}</button>)}</div>
      </div>
    </header>

    {loading?<div className="health-board-loading" role="status">건강 변화 정보를 불러오는 중입니다…</div>:<>
      <div className="health-summary-grid" aria-label={`${selected?.name||'선택한 어르신'} 건강 변화 요약`}>
        <div className="health-summary-card"><span>확인 필요</span><strong>{activeItems.length}<small>건</small></strong><p>현재 열린 건강 변화</p></div>
        <div className="health-summary-card is-amber"><span>가장 많은 항목</span><strong>{topTopic?topicLabel[topTopic[0]]:'없음'}{topTopic&&<small> {topTopic[1]}건</small>}</strong><p>{rangeDays}일 동안 확인된 항목</p></div>
        <div className="health-summary-card is-red"><span>최근 통화 변화</span><strong>{latestPoint?.needsReviewCount||0}<small>개</small></strong><p>기간 내 최고 {maxPoint}개</p></div>
      </div>

      <div className="health-trend-card">
        <div className="health-card-heading"><div><span>변화 추이</span><h3>{selected?.name||'선택한 어르신'} · 통화별 확인 필요 항목</h3></div>{latestPoint&&<span className="health-trend-pill">최근 {latestPoint.needsReviewCount}개</span>}</div>
        {points.length?<Chart options={options} series={[{name:'확인 필요 항목',data:points.map(p=>p.needsReviewCount)}]} type="area" height={280}/>:<div className="health-empty">선택한 기간에 그래프 자료가 없습니다.</div>}
      </div>

      <div className="health-review-heading"><div><span className="health-insights-eyebrow">담당자 확인 목록</span><h3>현재 확인할 변화</h3></div><span>{activeItems.length}건</span></div>
      <div className="health-review-grid">{activeItems.length?activeItems.map(item=>{
        const detail=details[item.caseId],open=!!expanded[item.caseId],busy=busyCaseId===item.caseId;
        return <article key={item.caseId} className={`health-review-card ${item.signal==='repeated_statement'?'is-critical':'is-warning'}`}>
          <div className="health-review-card-top"><div><h4>{topicLabel[item.topic]||item.topic}</h4><span className="health-signal-badge">{signalLabel[item.signal]||item.signal}</span></div><span className="health-state-badge">{stateLabel[item.state]||item.state}</span></div>
          <p>최근 통화에서 확인이 필요한 변화가 있습니다. 원문 근거 <b>{item.evidenceCount}건</b>을 확인해 주세요.</p>
          <div className="health-review-actions">{item.state==='unreviewed'&&<button className="btn-primary" disabled={busy} onClick={()=>update(item,'reviewing')}>{busy?'처리 중…':'확인 시작'}</button>}<button className="btn-secondary" disabled={busy} aria-expanded={open} onClick={()=>showDetail(item)}>{busy?'불러오는 중…':open?'근거 닫기':'근거 보기'}</button>{onOpenCallRecords&&<button className="btn-secondary" onClick={()=>onOpenCallRecords(item.elderId)}>전체 통화 기록 보기</button>}<button className="btn-secondary" disabled={busy} onClick={()=>update(item,'resolved')}>조치 완료</button></div>
          {open&&detail&&renderEvidence(detail,'active')}
        </article>;
      }):<div className="health-empty health-empty-success"><b>현재 확인할 변화가 없습니다.</b><span>새 통화에서 변화가 확인되면 이곳에 표시됩니다.</span></div>}</div>

      <div className="health-completed-wrap"><button className="btn-secondary" aria-expanded={showCompleted} onClick={()=>setShowCompleted(value=>!value)}>{showCompleted?'완료 이력 닫기':`완료 이력 보기 (${completedItems.length})`}</button>
        {showCompleted&&<div className="health-completed-list">{completedItems.length?completedItems.map(item=>{const detail=details[item.caseId],open=!!expanded[item.caseId],busy=busyCaseId===item.caseId;return <article key={item.caseId} className="health-completed-card"><div><b>{topicLabel[item.topic]||item.topic}</b><span>{stateLabel[item.state]||item.state}</span><time>{new Date(item.latestObservedAt).toLocaleString('ko-KR')}</time></div><button className="btn-secondary" disabled={busy} aria-expanded={open} onClick={()=>showDetail(item)}>{busy?'불러오는 중…':open?'상세 닫기':'완료 상세'}</button>{open&&detail&&<><dl><dt>조치 내용</dt><dd>{detail.reviewNote||'기록 없음'}</dd><dt>담당자</dt><dd>{detail.reviewedBy||'확인할 수 없음'}</dd><dt>처리 시각</dt><dd>{detail.updatedAt?new Date(detail.updatedAt).toLocaleString('ko-KR'):'기록 없음'}</dd></dl>{renderEvidence(detail,'done')}</>}</article>}):<div className="health-empty">완료된 조치 이력이 없습니다.</div>}</div>}
      </div>
    </>}
  </section>;
}
