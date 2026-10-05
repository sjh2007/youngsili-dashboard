import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { SERVER_URL, authFetch, errMsg } from '../../utils/api';
import {
  HealthInsightCaseSchema, HealthInsightDetailSchema, HealthInsightListSchema, HealthInsightRankingsSchema, HealthInsightTrendSchema, HealthInsightReportSchema,
  type Elder, type HealthInsightCase, type HealthInsightDetail, type HealthInsightRankings, type HealthInsightTrendPoint,
} from '../../schemas';
import HealthSyntheticTestPanel from './HealthSyntheticTestPanel';
import HealthEvidenceCorrection from './HealthEvidenceCorrection';
import HealthFollowUpControls from './HealthFollowUpControls';
import HealthCaseNoteLink from './HealthCaseNoteLink';
import { exportHealthReport } from '../../utils/healthReportExport';
import { healthPeriod, customHealthPeriod, validateHealthDates, koreanDate, displayHealthDate, type HealthPeriod } from '../../utils/healthPeriod';

const topicLabel: Record<string,string> = { meal:'식사', sleep:'수면', activity:'활동', discomfort:'불편 사항' };
const signalLabel: Record<string,string> = { new_statement:'새 불편 확인', repeated_statement:'같은 불편 반복', changed_response:'최근 응답과 달라짐', insufficient_data:'자료 부족' };
const stateLabel: Record<string,string> = { unreviewed:'미확인', reviewing:'확인 중', resolved:'처리됨', corrected:'정정됨', dismissed:'제외됨' };
const ALL_ELDERS = '__all__';

export default function HealthInsightsPanel({ elders, notify, onOpenCallRecords, onOpenNote, onCasesChange, onCaseReviewed, canRunTests=false, canManageFollowUp=false }: { elders:Elder[]; notify?:(m:string,t?:string)=>void; onOpenCallRecords?:(elderId:string)=>void;onOpenNote?:(note:{id:string})=>void;onCasesChange?:(cases:HealthInsightCase[]|null,hasMore:boolean)=>void;onCaseReviewed?:(item:HealthInsightCase)=>void;canRunTests?:boolean;canManageFollowUp?:boolean }) {
  const elderKey=(elder:Elder)=>String(elder.phone||elder.id||'');
  const [elderId,setElderId]=useState(ALL_ELDERS);
  const [items,setItems]=useState<HealthInsightCase[]>([]);
  const [points,setPoints]=useState<HealthInsightTrendPoint[]>([]);
  const [rankings,setRankings]=useState<HealthInsightRankings|null>(null);
  const [details,setDetails]=useState<Record<string,HealthInsightDetail>>({});
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [busyCaseId,setBusyCaseId]=useState('');
  const [disabled,setDisabled]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const requestVersion=useRef(0);
  const [showCompleted,setShowCompleted]=useState(false);
  const [search,setSearch]=useState('');
  const [topicFilter,setTopicFilter]=useState('all');
  const [stateFilter,setStateFilter]=useState('all');
  const [page,setPage]=useState(1);
  const [completedPage,setCompletedPage]=useState(1);
  const reviewHeading=useRef<HTMLHeadingElement>(null);
  const [selectedDay,setSelectedDay]=useState('');
  const [period,setPeriod]=useState<HealthPeriod|'custom'>('week');
  const [today,setToday]=useState(koreanDate);
  const [customRange,setCustomRange]=useState(()=>healthPeriod('week'));
  const [editingDates,setEditingDates]=useState(false);
  const [draftFrom,setDraftFrom]=useState('');
  const [draftTo,setDraftTo]=useState('');
  const [dateError,setDateError]=useState('');
  const [reportBusy,setReportBusy]=useState(false);
  const [reportError,setReportError]=useState('');
  const range=useMemo(()=>period==='custom'?customRange:healthPeriod(period,today),[period,today,customRange]);
  const applyDates=(event:React.FormEvent)=>{
    event.preventDefault();
    const error=validateHealthDates(draftFrom,draftTo,today);
    setDateError(error);
    if(error)return;
    setCustomRange(customHealthPeriod(draftFrom,draftTo));setPeriod('custom');setEditingDates(false);
  };
  useEffect(()=>{const timer=window.setInterval(()=>setToday(koreanDate()),30000);return()=>window.clearInterval(timer)},[]);

  const load=async()=>{
    const version=++requestVersion.current;
    setLoading(true);setLoadError('');setDetails({});setExpanded({});
    try{
      const {from,to}=range;
      const q=`elderId=${encodeURIComponent(elderId)}&from=${from}&to=${to}`;
      const [a,b,c]=await Promise.all([
        authFetch(`${SERVER_URL}/health/insights?${elderId===ALL_ELDERS?'':`elderId=${encodeURIComponent(elderId)}&`}limit=2000`),
        elderId===ALL_ELDERS?Promise.resolve(null):authFetch(`${SERVER_URL}/health/insights/trend?${q}`),
        authFetch(`${SERVER_URL}/health/insights/rankings?${elderId===ALL_ELDERS?'':`elderId=${encodeURIComponent(elderId)}&`}from=${from}&to=${to}`),
      ]);
      if(version!==requestVersion.current)return;
      if(a.status===501||b?.status===501||c.status===501){setDisabled(true);setItems([]);setPoints([]);setRankings(null);if(elderId===ALL_ELDERS)onCasesChange?.(null,false);return}
      const ad:unknown=await a.json(),bd:unknown=b?await b.json():null,cd:unknown=await c.json();
      if(!a.ok||(b&&!b.ok)||!c.ok)throw new Error(errMsg(!a.ok?ad:b&&!b.ok?bd:cd));
      const parsedList=HealthInsightListSchema.safeParse(ad),parsedTrend=b?HealthInsightTrendSchema.safeParse(bd):null,parsedRankings=HealthInsightRankingsSchema.safeParse(cd);
      if(!parsedList.success||(parsedTrend&&!parsedTrend.success)||!parsedRankings.success)throw new Error('건강 변화 API 응답 형식이 올바르지 않습니다');
      if(version!==requestVersion.current)return;
      const allItems=new Map(parsedList.data.items.map(item=>[item.caseId,item]));
      const cursors=new Set<string>();
      let cursor=parsedList.data.nextCursor;
      while(cursor){
        if(version!==requestVersion.current)return;
        if(cursors.has(cursor))throw new Error('이전 기록 조회가 반복되었습니다. 다시 시도해 주세요.');
        cursors.add(cursor);
        const response=await authFetch(`${SERVER_URL}/health/insights?${elderId===ALL_ELDERS?'':`elderId=${encodeURIComponent(elderId)}&`}limit=100&cursor=${encodeURIComponent(cursor)}`);
        const body:unknown=await response.json();
        if(!response.ok)throw new Error(errMsg(body,'전체 확인 목록을 불러오지 못했습니다'));
        const next=HealthInsightListSchema.safeParse(body);
        if(!next.success)throw new Error('건강 변화 API 응답 형식이 올바르지 않습니다');
        next.data.items.forEach(item=>allItems.set(item.caseId,item));cursor=next.data.nextCursor;
      }
      if(version!==requestVersion.current)return;
      const complete=Array.from(allItems.values());

      setDisabled(false);setItems(complete);setPoints(parsedTrend?.data.points||[]);setRankings(parsedRankings.data);
      if(elderId===ALL_ELDERS)onCasesChange?.(complete,false);
    }catch(error:unknown){if(version!==requestVersion.current)return;const message=error instanceof Error?error.message:'건강 변화 정보를 불러오지 못했습니다';setLoadError(message);setItems([]);setPoints([]);setRankings(null);if(elderId===ALL_ELDERS)onCasesChange?.(null,false);notify?.(message)}
    finally{if(version===requestVersion.current)setLoading(false)}
  };
  useEffect(()=>{setDetails({});setExpanded({});setShowCompleted(false);setSelectedDay('');setSearch('');setTopicFilter('all');setStateFilter('all');setPage(1);setCompletedPage(1);load();return()=>{requestVersion.current++}},[elderId,range.from,range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected=elderId===ALL_ELDERS?null:elders.find(e=>elderKey(e)===elderId);
  const downloadHealthReport=async()=>{
    if(!selected||reportBusy)return;
    const version=requestVersion.current;
    setReportBusy(true);setReportError('');
    try{
      const response=await authFetch(`${SERVER_URL}/health/insights/report?elderId=${encodeURIComponent(elderId)}&from=${range.from}&to=${range.to}`);
      const body:unknown=await response.json();
      if(!response.ok)throw new Error(errMsg(body,'건강 보고서를 불러오지 못했습니다'));
      const parsed=HealthInsightReportSchema.safeParse(body);
      if(!parsed.success)throw new Error('건강 보고서 응답 형식을 확인하지 못했습니다');
      if(version!==requestVersion.current)throw new Error('조회 대상 또는 기간이 바뀌었습니다. 다시 다운로드해 주세요.');
      if(parsed.data.elderId!==elderId||parsed.data.from!==range.from||parsed.data.to!==range.to)throw new Error('건강 보고서의 대상·기간이 현재 조회와 다릅니다');
      await exportHealthReport(parsed.data,selected.name||'이름 없음');
    }catch(e){setReportError(e instanceof Error?e.message:'건강 보고서를 내려받지 못했습니다')}
    finally{setReportBusy(false)}
  };
  const activeItems=items.filter(item=>item.state==='unreviewed'||item.state==='reviewing');
  const completedItems=items.filter(item=>['resolved','corrected','dismissed'].includes(item.state));
  const options:ApexOptions=useMemo(()=>({chart:{type:'bar',toolbar:{show:false},fontFamily:'Pretendard, sans-serif',animations:{enabled:false},redrawOnParentResize:true},colors:['#246beb','#805700','#7c3aed','#64748b'],dataLabels:{enabled:false},markers:{size:4,strokeWidth:3,strokeColors:'#fff',hover:{size:6}},grid:{borderColor:'#e8edf5',strokeDashArray:4},stroke:{curve:'straight',width:3},fill:{type:'solid',opacity:1},xaxis:{categories:points.map(p=>new Date(p.observedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'})),labels:{style:{colors:'#8290a6',fontSize:'12px'}},axisBorder:{show:false},axisTicks:{show:false}},yaxis:{min:0,forceNiceScale:true,decimalsInFloat:0,labels:{style:{colors:'#8290a6'}}},tooltip:{y:{formatter:v=>`${v}개`}}}),[points]);
  const institutionOptions:ApexOptions=useMemo(()=>({chart:{type:'bar',toolbar:{show:false},fontFamily:'Pretendard, sans-serif',animations:{enabled:false},redrawOnParentResize:true},colors:['#ef3f4a'],dataLabels:{enabled:false},markers:{size:4,strokeWidth:3,strokeColors:'#fff',hover:{size:6}},grid:{borderColor:'#e8edf5',strokeDashArray:4},stroke:{curve:'straight',width:3},fill:{type:'solid',opacity:1},xaxis:{categories:(rankings?.points||[]).map(p=>new Date(`${p.date}T00:00:00+09:00`).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'})),labels:{style:{colors:'#8290a6',fontSize:'12px'}},axisBorder:{show:false},axisTicks:{show:false}},yaxis:{min:0,forceNiceScale:true,decimalsInFloat:0,labels:{style:{colors:'#8290a6'}}},tooltip:{y:{formatter:v=>`${v}${rankings?.coverage?'명':'건'}`}}}),[rankings]);

  const elderName=(id:string)=>elders.find(elder=>elderKey(elder)===id)?.name||'이름 미등록';
  const dayPeople=rankings?.points.find(point=>point.date===selectedDay)?.detectedElderIds;
  const filteredItems=activeItems.filter(item=>(topicFilter==='all'||item.topic===topicFilter)
    &&(stateFilter==='all'||item.state===stateFilter)
    &&elderName(item.elderId).includes(search.trim())
    &&(!selectedDay||(Array.isArray(dayPeople)&&dayPeople.includes(item.elderId))))
    .sort((a,b)=>(a.state==='unreviewed'?0:1)-(b.state==='unreviewed'?0:1)||a.latestObservedAt.localeCompare(b.latestObservedAt)||a.caseId.localeCompare(b.caseId));
  const pageCount=Math.max(1,Math.ceil(filteredItems.length/20));
  const currentPage=Math.min(page,pageCount);
  const visibleItems=filteredItems.slice((currentPage-1)*20,currentPage*20);
  const openPeople=new Set(activeItems.map(item=>item.elderId)).size;
  const coverage=rankings?.coverage;
  const scopeName=selected?selected.name||'선택한 어르신':'기관 전체';
  const resetFilters=()=>{setSearch('');setTopicFilter('all');setStateFilter('all');setSelectedDay('');setPage(1)};

  const showDetail=async(item:HealthInsightCase)=>{
    if(expanded[item.caseId]){setExpanded(v=>({...v,[item.caseId]:false}));return}
    if(details[item.caseId]){setExpanded(v=>({...v,[item.caseId]:true}));return}
    const version=requestVersion.current;
    setBusyCaseId(item.caseId);
    try{
      const response=await authFetch(`${SERVER_URL}/health/insights/${item.caseId}`);
      const data:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(errMsg(data,'근거 내용을 불러오지 못했습니다'));
      const parsed=HealthInsightDetailSchema.safeParse(data);
      if(!parsed.success)throw new Error('건강 변화 상세 응답 형식이 올바르지 않습니다');
      if(version!==requestVersion.current)return;
      setDetails(v=>({...v,[item.caseId]:parsed.data}));setExpanded(v=>({...v,[item.caseId]:true}));
    }catch(error:unknown){notify?.(error instanceof Error?error.message:'근거 내용을 불러오지 못했습니다')}
    finally{setBusyCaseId('')}
  };

  const update=async(item:HealthInsightCase,state:'reviewing'|'resolved'|'corrected'|'dismissed',correction?:{observationIds:string[];reason:string}):Promise<boolean>=>{
    const reviewNote=correction?.reason ?? (state==='resolved' ? window.prompt('실제 조치 내용을 입력하세요. (예: 전화 확인 — 현재 이상 없음, 보호자 연락 예정)') : '');
    if(state==='resolved'&&reviewNote===null)return false;
    if(state==='resolved'&&!reviewNote.trim()){notify?.('조치 완료 내용을 입력해 주세요');return false}
    setBusyCaseId(item.caseId);
    try{
      const response=await authFetch(`${SERVER_URL}/health/insights/${item.caseId}/review`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision:item.revision,requestId:crypto.randomUUID(),reviewNote,...(correction?{observationIds:correction.observationIds}:{})})});
      const data:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(errMsg(data,'상태를 저장하지 못했습니다'));
      const parsedCase=HealthInsightCaseSchema.safeParse(data),parsedDetail=HealthInsightDetailSchema.safeParse(data);
      if(!parsedCase.success)throw new Error('건강 변화 저장 응답 형식이 올바르지 않습니다');
      onCaseReviewed?.(parsedCase.data);
      notify?.(correction?(parsedCase.data.state==='reviewing'?'선택 근거를 정정·제외했습니다. 다른 유효 근거가 남아 확인 중 상태를 유지합니다.':'선택 근거의 정정·제외를 저장했습니다.'):state==='reviewing'?'확인을 시작했습니다. 아래에서 근거 내용을 확인해 주세요.':'조치 완료 상태로 저장했습니다.','success');
      await load();
      if(parsedDetail.success){setDetails(v=>({...v,[item.caseId]:parsedDetail.data}));setExpanded(v=>({...v,[item.caseId]:true}))}
      return true;
    }catch(error:unknown){notify?.(error instanceof Error?error.message:'상태를 저장하지 못했습니다');return false}
    finally{setBusyCaseId('')}
  };

  if(disabled)return null;
  const renderEvidence=(detail:HealthInsightDetail,tone:'active'|'done')=><div className="health-insight-evidence">
    <strong>통화 원문 근거</strong>
    {detail.evidenceCount>detail.evidence.length&&<p className="health-scope-note">원문 근거 {detail.evidenceCount}건 중 {detail.evidence.length}건을 표시합니다. 화면에 표시되지 않은 근거는 선택 정정·제외에 포함되지 않습니다.</p>}
    {detail.evidence.length?detail.evidence.map((e,index)=><blockquote key={`${e.sourceId}-${e.line}-${index}`} className={tone==='active'?'is-active':''}><div>&ldquo;{e.excerpt}&rdquo;</div><small>{new Date(e.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 원문 {e.line}번째 줄</small></blockquote>):<p>표시할 원문 근거가 없습니다.</p>}
  </div>;

  return <><section className="health-insights-board" aria-labelledby="health-insights-title">
    <header className="health-insights-head">
      <div><span className="health-insights-eyebrow">통화 기반 건강 관찰</span><h2 id="health-insights-title">건강 변화 확인</h2><p>통화에서 확인된 변화 신호와 담당자 조치 기록입니다. 의료 진단이나 건강 위험 순위가 아닙니다.</p></div>
      <div className="health-insights-controls">
        <label>어르신 필터<select disabled={!!busyCaseId} value={elderId} onChange={e=>setElderId(e.target.value)}><option value={ALL_ELDERS}>전체 어르신</option>{elders.map(e=><option key={elderKey(e)} value={elderKey(e)}>{e.name||'이름 없음'}</option>)}</select></label>
        <div className="health-period-control"><span>조회 기간</span><div className="health-range-tabs" role="group" aria-label="조회 기간">{([['week','이번 주'],['month','이번 달'],['quarter','최근 3개월']] as const).map(([key,label])=><button key={key} type="button" className={period===key?'is-active':''} aria-pressed={period===key} disabled={!!busyCaseId} onClick={()=>{setPeriod(key);setEditingDates(false);setDateError('')}}>{period===key&&<span aria-hidden="true">✓ </span>}{label}</button>)}<button type="button" className={period==='custom'?'is-active':''} aria-pressed={period==='custom'} aria-expanded={editingDates} disabled={!!busyCaseId} onClick={()=>{setDraftFrom(range.from);setDraftTo(range.to);setDateError('');setEditingDates(value=>!value)}}>{period==='custom'&&<span aria-hidden="true">✓ </span>}직접 선택</button></div></div>
      </div>
    </header>
    {editingDates&&<form className="health-custom-dates" onSubmit={applyDates} noValidate aria-label="직접 조회 기간 선택">
      <label>시작일<input type="date" value={draftFrom} max={today} disabled={!!busyCaseId} aria-describedby="health-date-help" onChange={e=>{setDraftFrom(e.target.value);setDateError('')}} /></label>
      <label>종료일<input type="date" value={draftTo} min={draftFrom||undefined} max={today} disabled={!!busyCaseId} aria-describedby="health-date-help" onChange={e=>{setDraftTo(e.target.value);setDateError('')}} /></label>
      <button type="submit" className="btn-primary" disabled={!!busyCaseId}>선택 기간 조회</button>
      <button type="button" className="btn-secondary" onClick={()=>setEditingDates(false)}>취소</button>
      <p id="health-date-help">시작일·종료일 포함 최대 92일 · 한국시간 기준 · 조회 버튼을 누르면 적용됩니다.</p>
      {dateError&&<p className="health-date-error" role="alert">{dateError}</p>}
    </form>}
    <div className="health-period-caption" role="status"><strong>조회 기간 {displayHealthDate(range.from)} ~ {displayHealthDate(range.to)}</strong><span>{range.description} · 한국시간 기준 · 오늘 포함 시 현재까지 수집된 기록</span></div>
    {loading?<div className="health-board-loading" role="status">전체 확인 목록과 기간 통계를 불러오는 중입니다…</div>:loadError?<div className="health-empty" role="alert"><p>{loadError}</p><button type="button" className="btn-secondary" onClick={load}>다시 시도</button></div>:<>
      <div className="health-summary-grid" aria-label="확인 업무 요약">
        <div className="health-summary-card"><span>확인할 어르신</span><strong>{openPeople}<small>명</small></strong><p>기간과 관계없이 남아 있는 미처리 대상</p></div>
        <div className="health-summary-card is-amber"><span>미확인 조치</span><strong>{activeItems.filter(item=>item.state==='unreviewed').length}<small>건</small></strong><p>동일 어르신에게 여러 항목이 있을 수 있습니다</p></div>
        <div className="health-summary-card"><span>확인 중</span><strong>{activeItems.filter(item=>item.state==='reviewing').length}<small>건</small></strong><p>근거 확인 후 실제 조치 내용을 저장하세요</p></div>
      </div>

      <div className="health-review-heading"><div><span className="health-insights-eyebrow">담당자 확인 목록</span><h3 ref={reviewHeading} tabIndex={-1}>{selected?`${selected.name||'어르신'} 확인할 변화`:'전체 어르신 확인할 변화'}</h3></div><button type="button" className="btn-secondary" disabled={!!busyCaseId} onClick={load}>목록 새로고침</button></div>
      <p className="health-scope-note">미처리 건은 조회 기간 밖의 기록도 유지합니다. 미확인 → 확인 중, 각 상태에서는 오래된 근거부터 표시합니다. 긴급 위험 알림은 별도입니다. 통화의 회복 보고와 담당자의 조치 완료는 별도로 관리합니다.</p>
      <div className="health-work-filters">
        <label>이름 검색<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="어르신 이름" /></label>
        <label>관찰 항목<select value={topicFilter} onChange={e=>{setTopicFilter(e.target.value);setPage(1)}}><option value="all">모든 항목</option>{Object.entries(topicLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>처리 상태<select value={stateFilter} onChange={e=>{setStateFilter(e.target.value);setPage(1)}}><option value="all">미처리 전체</option><option value="unreviewed">미확인</option><option value="reviewing">확인 중</option></select></label>
        <button type="button" className="btn-secondary" onClick={resetFilters}>검색 초기화</button>
      </div>
      {selectedDay&&<p className="health-day-filter" role="status">{selectedDay} 변화 감지 대상의 현재 미처리 건 · 해당 날짜 통화만 표시하는 목록이 아닙니다. <button type="button" className="btn-secondary" onClick={()=>{setSelectedDay('');setPage(1)}}>날짜 대상 필터 해제</button></p>}
      <p className="health-scope-note" role="status">검색 결과 {new Set(filteredItems.map(item=>item.elderId)).size}명 · {filteredItems.length}건 / 전체 미처리 {activeItems.length}건</p>
      <div className="health-work-list" aria-label="확인 대상과 통화 근거">{visibleItems.length?visibleItems.map(item=>{
        const detail=details[item.caseId],open=!!expanded[item.caseId],busy=!!busyCaseId;
        return <article key={item.caseId} className="health-review-card health-work-row" aria-label={`${elderName(item.elderId)} ${topicLabel[item.topic]} ${stateLabel[item.state]}`}>
          <div className="health-work-person"><button type="button" className="health-person-link" disabled={busy} onClick={()=>setElderId(item.elderId)}>{elderName(item.elderId)}</button><span>{topicLabel[item.topic]}</span></div>
          <div><span className="health-signal-badge">{signalLabel[item.signal]||item.signal}</span><p>원문 근거 {item.evidenceCount}건</p><time dateTime={item.latestObservedAt}>마지막 문제 근거: {new Date(item.latestObservedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time>{koreanDate(new Date(item.latestObservedAt))<range.from&&<small className="health-carryover">조회 기간 이전 · 미처리 유지</small>}</div>
          <div><span className="health-state-badge">{stateLabel[item.state]}</span><div className="health-review-actions">{item.state==='unreviewed'&&<button type="button" className="btn-primary" disabled={busy} onClick={()=>update(item,'reviewing')}>확인 시작</button>}<button type="button" className="btn-secondary" disabled={busy} aria-expanded={open} onClick={()=>showDetail(item)}>{busyCaseId===item.caseId?'처리 중…':open?'근거 닫기':'근거 보기'}</button>{onOpenCallRecords&&<button type="button" className="btn-secondary" onClick={()=>onOpenCallRecords(item.elderId)}>전체 통화 기록 보기</button>}<button type="button" className="btn-secondary" disabled={busy} onClick={()=>update(item,'resolved')}>조치 완료</button></div></div>
          {item.recoveryStatus==='reported'&&<p className="health-scope-note">통화에서 회복 보고{item.recoveryReportedAt?` · ${new Date(item.recoveryReportedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`:''} — 담당자 조치 완료와 별개입니다.</p>}
          {open&&detail&&<div className="health-work-detail">{renderEvidence(detail,'active')}<p className="health-scope-note">회복 응답이 있어도 담당자가 근거와 필요한 조치를 확인할 때까지 유지됩니다. 다른 항목의 정상 응답만으로는 완료되지 않습니다.</p>{detail.reviewNote&&<p>조치 기록: {detail.reviewNote}</p>}<HealthEvidenceCorrection key={`${detail.caseId}-${detail.revision}`} detail={detail} busy={busy} onSave={(state,observationIds,reason)=>update(detail,state,{observationIds,reason})}/>{canManageFollowUp&&<HealthCaseNoteLink caseId={detail.caseId} revision={detail.revision} onOpenNote={onOpenNote} onChanged={revision=>{setItems(rows=>rows.map(row=>row.caseId===detail.caseId?{...row,revision:Math.max(row.revision,revision)}:row));setDetails(rows=>({...rows,[detail.caseId]:{...rows[detail.caseId],revision:Math.max(rows[detail.caseId].revision,revision)}}))}}/>}<HealthFollowUpControls canManage={canManageFollowUp} key={`follow-up-${detail.caseId}`} caseId={detail.caseId} onChanged={revision=>{setItems(rows=>rows.map(row=>row.caseId===detail.caseId?{...row,revision:Math.max(row.revision,revision)}:row));setDetails(rows=>({...rows,[detail.caseId]:{...rows[detail.caseId],revision:Math.max(rows[detail.caseId].revision,revision)}}))}}/></div>}
        </article>;
      }):<div className="health-empty"><b>{activeItems.length?'검색 조건에 맞는 미처리 건이 없습니다.':'현재 확인할 변화가 없습니다.'}</b><p>확인 건이 없다는 뜻이며, 모든 어르신의 건강이 정상으로 확인됐다는 뜻은 아닙니다.</p></div>}</div>
      {pageCount>1&&<nav className="health-work-pagination" aria-label="확인 목록 페이지"><button type="button" className="btn-secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>이전</button><span>{currentPage} / {pageCount} 페이지 · 20건씩</span><button type="button" className="btn-secondary" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>다음</button></nav>}

      <div className="health-completed-wrap"><button type="button" className="btn-secondary" aria-expanded={showCompleted} onClick={()=>setShowCompleted(value=>!value)}>{showCompleted?'완료 이력 닫기':`완료 이력 보기 (${completedItems.length})`}</button><span className="health-scope-note"> 기간과 관계없는 처리 이력</span>
        {showCompleted&&<div className="health-completed-list">{completedItems.length?completedItems.slice((completedPage-1)*20,completedPage*20).map(item=>{const detail=details[item.caseId],open=!!expanded[item.caseId];return <article key={item.caseId} className="health-completed-card"><div><span className="health-elder-badge">{elderName(item.elderId)}</span><b>{topicLabel[item.topic]}</b><span>{stateLabel[item.state]}</span></div><button type="button" className="btn-secondary" disabled={!!busyCaseId} aria-expanded={open} onClick={()=>showDetail(item)}>{open?'상세 닫기':'완료 상세'}</button>{open&&detail&&<><dl><dt>조치 내용</dt><dd>{detail.reviewNote||'기록 없음'}</dd><dt>담당자</dt><dd>{detail.reviewedBy||'확인할 수 없음'}</dd><dt>처리 시각</dt><dd>{detail.updatedAt?new Date(detail.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'기록 없음'}</dd></dl>{renderEvidence(detail,'done')}</>}</article>}):<div className="health-empty">완료된 조치 이력이 없습니다.</div>}</div>}
        {showCompleted&&completedItems.length>20&&<nav className="health-work-pagination" aria-label="완료 이력 페이지"><button type="button" className="btn-secondary" disabled={completedPage===1} onClick={()=>setCompletedPage(value=>value-1)}>이전 이력</button><span>{completedPage} / {Math.ceil(completedItems.length/20)}</span><button type="button" className="btn-secondary" disabled={completedPage*20>=completedItems.length} onClick={()=>setCompletedPage(value=>value+1)}>다음 이력</button></nav>}
      </div>

      {selected&&<section className="health-person-history" aria-label="선택한 어르신 변화 신호 이력"><div className="health-person-detail-head"><h3>{selected.name||'어르신'} · 변화 신호가 감지된 통화 이력</h3><button type="button" className="btn-secondary" disabled={!!busyCaseId} onClick={()=>setElderId(ALL_ELDERS)}>전체 보기</button></div><p className="health-scope-note">{displayHealthDate(range.from)} ~ {displayHealthDate(range.to)} · 변화 신호가 집계된 통화만 표시합니다. 신호가 없거나 분석되지 않은 통화는 이 표에 포함되지 않습니다. 숫자는 해당 통화의 변화 신호 기록 수입니다. 0은 그 통화에서 해당 변화 신호가 집계되지 않았다는 뜻이며 건강 정상 판정이 아닙니다.</p>
        {points.length?<><Chart options={options} series={Object.entries(topicLabel).map(([topic,name])=>({name,data:points.map(point=>point.topics[topic as 'meal'|'sleep'|'activity'|'discomfort'])}))} type="bar" height={180}/><div className="health-history-scroll"><table className="health-history-table"><caption>선택 기간의 통화별 항목 집계</caption><thead><tr><th>통화 시각</th>{Object.values(topicLabel).map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{points.map(point=><tr key={point.pointId}><th>{new Date(point.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</th>{Object.keys(topicLabel).map(topic=><td key={topic}>{point.topics[topic as 'meal'|'sleep'|'activity'|'discomfort']}건</td>)}</tr>)}</tbody></table></div></>:<div className="health-empty">선택한 기간에 개인 그래프 자료가 없습니다.</div>}
        {onOpenCallRecords&&<button type="button" className="btn-secondary" onClick={()=>onOpenCallRecords(elderId)}>선택한 어르신 통화 기록 보기</button>}
        <div style={{marginTop:16}}><button type="button" className="btn-secondary" style={{minHeight:44}} disabled={reportBusy||!!busyCaseId} onClick={downloadHealthReport}>{reportBusy?'건강 보고서 준비 중…':'건강 보고서 엑셀'}</button><p className="health-scope-note">선택한 어르신·조회 기간의 통화 근거와 담당자 처리 기록을 내려받습니다. 회복 보고와 담당자 조치 완료를 별도 열로 표시하며, 자료 한도 초과나 원본 확인 실패 시 일부 보고서를 내려받지 않습니다.</p>{reportError&&<p role="alert">{reportError}</p>}</div>
      </section>}

      <section className="health-trend-card health-institution-summary" aria-label="선택 기간 관찰 통계">
        <div className="health-card-heading"><div><span>선택 기간 · {scopeName}</span><h3>통화 관찰 추이</h3></div><span className="health-trend-pill">{displayHealthDate(range.from)} ~ {displayHealthDate(range.to)}</span></div>
        <dl className="health-metrics-grid">
          <div><dt>감지 기록</dt><dd>{rankings?.total||0}건</dd></div><div><dt>감지 인원</dt><dd>{coverage?.detectedPeople??rankings?.people.length??0}명</dd></div><div><dt>분석 인원</dt><dd>{coverage?`${coverage.analyzedPeople}명`:'집계 불가'}</dd></div><div><dt>감지 비율</dt><dd>{coverage?.detectionRate!=null?`${(coverage.detectionRate*100).toFixed(1)}%`:'산출 불가'}</dd></div><div><dt>미연결 인원</dt><dd>{coverage?.unconnectedPeople!=null?`${coverage.unconnectedPeople}명`:'집계 불가'}</dd></div>
        </dl>
        <p className="health-scope-note">감지 기록은 같은 통화의 동일 항목을 한 번 집계합니다. 인원은 기간 내 중복을 제외합니다. 감지 비율은 분석 인원 대비 감지 인원이며 건강 위험 확률이 아닙니다. 건강 분석 자료에는 모든 발신 시도가 포함되지 않아 미연결 인원은 별도 통화 집계가 필요합니다. 개인 변화 판단은 최근 7일과 이전 23일을 비교하며, 이 화면의 선택 기간·직전 동일 기간 통계와 기준이 다릅니다.</p>
        {coverage?.detectionRate==null&&<p className="health-scope-note">분석 인원이 없거나 비교 가능한 자료가 부족하면 비율을 산출하지 않습니다.</p>}
        {rankings?.points.length?<><Chart options={institutionOptions} series={[{name:coverage?'감지 인원':'감지 기록',data:rankings.points.map(point=>coverage?point.detectedPeople??0:point.total)}]} type="bar" height={170}/><details className="health-chart-data"><summary>날짜별 수치와 대상 보기</summary><table><thead><tr><th scope="col">날짜</th><th scope="col">감지 기록</th><th scope="col">감지 / 분석 인원</th><th scope="col">감지 비율</th><th scope="col">대상</th></tr></thead><tbody>{rankings.points.map(point=><tr key={point.date}><th scope="row">{point.date}</th><td>{point.total}건</td><td>{point.detectedPeople!=null?`${point.detectedPeople} / ${point.analyzedPeople}명`:'집계 불가'}</td><td>{point.detectionRate!=null?`${(point.detectionRate*100).toFixed(1)}%`:'산출 불가'}</td><td>{point.detectedElderIds?<button type="button" className="btn-secondary" onClick={()=>{setSelectedDay(point.date);setSearch('');setTopicFilter('all');setStateFilter('all');setPage(1);reviewHeading.current?.focus();reviewHeading.current?.scrollIntoView?.({block:'start'})}}>이 날짜 대상 보기</button>:'추가 집계 필요'}</td></tr>)}</tbody></table></details></>:<div className="health-empty">선택한 기간에 분석된 통화 자료가 없습니다.</div>}
        {selectedDay&&dayPeople&&<div className="health-day-people"><h4>{selectedDay} 변화 감지 대상 {dayPeople.length}명</h4><p className="health-scope-note">위 확인 목록에는 이 대상들의 현재 미처리 건이 표시됩니다. 처리 완료된 대상도 아래에서 개인 이력을 볼 수 있습니다.</p>{dayPeople.length?dayPeople.map(id=><button type="button" className="btn-secondary" key={id} onClick={()=>setElderId(id)}>{elderName(id)} · 개인 이력</button>):<p>이 날짜에 변화 신호가 감지된 대상이 없습니다.</p>}</div>}
      </section>
    </>}
  </section>{canRunTests&&<HealthSyntheticTestPanel elders={elders} notify={notify}/>}</>;
}
