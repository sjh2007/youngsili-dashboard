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

export default function HealthInsightsPanel({ elders, notify }: { elders:Elder[]; notify?:(m:string,t?:string)=>void }) {
  const elderKey=(elder:Elder)=>String(elder.phone||elder.id||'');
  const [elderId,setElderId]=useState('');
  const [items,setItems]=useState<HealthInsightCase[]>([]);
  const [points,setPoints]=useState<HealthInsightTrendPoint[]>([]);
  const [details,setDetails]=useState<Record<string,HealthInsightDetail>>({});
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [busyCaseId,setBusyCaseId]=useState('');
  const [disabled,setDisabled]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{ if(!elderId&&elders?.length) setElderId(elderKey(elders[0])); },[elders,elderId]);

  const load=async()=>{
    if(!elderId)return;
    setLoading(true);
    try{
      const now=new Date(),from=new Date(now.getTime()-30*86400000);
      const q=`elderId=${encodeURIComponent(elderId)}&from=${from.toISOString().slice(0,10)}&to=${now.toISOString().slice(0,10)}`;
      const [a,b]=await Promise.all([
        authFetch(`${SERVER_URL}/health/insights?elderId=${encodeURIComponent(elderId)}`),
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
  useEffect(()=>{setDetails({});setExpanded({});load()},[elderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected=elders.find(e=>elderKey(e)===elderId);
  const options:ApexOptions=useMemo(()=>({chart:{type:'area',toolbar:{show:false},fontFamily:'Pretendard, sans-serif'},colors:['#b42318'],dataLabels:{enabled:true},stroke:{curve:'smooth',width:3},fill:{type:'gradient',gradient:{opacityFrom:.24,opacityTo:.03}},xaxis:{categories:points.map(p=>new Date(p.observedAt).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}))},yaxis:{min:0,forceNiceScale:true,title:{text:'확인 필요 항목 수'}},tooltip:{y:{formatter:v=>`${v}개`}}}),[points]);

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
    setBusyCaseId(item.caseId);
    try{
      const response=await authFetch(`${SERVER_URL}/health/insights/${item.caseId}/review`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision:item.revision,requestId:crypto.randomUUID(),reviewNote:''})});
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
  return <section className="section" aria-labelledby="health-insights-title" style={{marginBottom:20}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}>
      <div><div id="health-insights-title" className="section-title">건강 변화 확인</div><div style={{fontSize:14,color:'#64748b'}}>의료 진단이 아닌, 통화에서 담당자가 확인할 항목입니다.</div></div>
      <label style={{fontSize:14,fontWeight:700}}>어르신별 보기 <select value={elderId} onChange={e=>setElderId(e.target.value)} style={{marginLeft:7,padding:'8px 10px',border:'1px solid #cbd5e1',borderRadius:8}}>{elders.map(e=><option key={elderKey(e)} value={elderKey(e)}>{e.name||'이름 없음'}</option>)}</select></label>
    </div>
    {loading?<p>불러오는 중…</p>:<>
      <div style={{marginTop:16,border:'1px solid #e2e8f0',borderRadius:12,padding:16}}><b>{selected?.name||'선택한 어르신'} 통화별 변화 흐름</b><p style={{fontSize:13,color:'#64748b'}}>세로값은 각 통화에서 확인이 필요한 항목 수입니다.</p>{points.length?<Chart options={options} series={[{name:'확인 필요 항목',data:points.map(p=>p.needsReviewCount)}]} type="area" height={260}/>:<div style={{padding:44,textAlign:'center',color:'#64748b'}}>최근 30일 그래프 자료가 없습니다.</div>}</div>
      <div style={{display:'grid',gap:10,marginTop:14}}>{items.length?items.map(item=>{
        const detail=details[item.caseId],open=!!expanded[item.caseId],busy=busyCaseId===item.caseId;
        return <article key={item.caseId} style={{border:'1px solid #dfe6ef',borderLeft:`5px solid ${['new_statement','repeated_statement'].includes(item.signal)?'#b42318':'#b45309'}`,borderRadius:12,padding:16}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><b>{topicLabel[item.topic]||item.topic}</b><span style={{fontSize:12,fontWeight:800,padding:'4px 8px',borderRadius:20,background:'#fff0ee',color:'#b42318'}}>{signalLabel[item.signal]||item.signal}</span><span style={{fontSize:12,color:'#64748b'}}>{stateLabel[item.state]||item.state}</span></div>
          <p>최근 통화에서 확인이 필요한 변화가 있습니다. 원문 근거 {item.evidenceCount}건을 확인해 주세요.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{item.state==='unreviewed'&&<button className="btn-primary" disabled={busy} onClick={()=>update(item,'reviewing')}>{busy?'처리 중…':'확인 시작'}</button>}<button className="btn-secondary" disabled={busy} aria-expanded={open} onClick={()=>showDetail(item)}>{busy?'불러오는 중…':open?'근거 닫기':'근거 보기'}</button><button className="btn-secondary" disabled={busy} onClick={()=>update(item,'resolved')}>조치 완료</button></div>
          {open&&detail&&<div style={{marginTop:14,padding:'14px 16px',background:'#f8fafc',borderRadius:10}}><b style={{display:'block',marginBottom:10}}>통화 원문 근거</b>{detail.evidence.length?detail.evidence.map((e,index)=><blockquote key={`${e.sourceId}-${e.line}-${index}`} style={{margin:'8px 0',padding:'10px 12px',background:'#fff',borderLeft:'3px solid #b42318',borderRadius:6}}><div style={{fontWeight:700}}>&ldquo;{e.excerpt}&rdquo;</div><small style={{color:'#64748b'}}>{new Date(e.observedAt).toLocaleString('ko-KR')} · 원문 {e.line}번째 줄</small></blockquote>):<p style={{color:'#64748b'}}>표시할 원문 근거가 없습니다.</p>}</div>}
        </article>;
      }):<div style={{padding:28,textAlign:'center',color:'#64748b'}}>현재 확인할 변화가 없습니다.</div>}</div>
    </>}
  </section>;
}
