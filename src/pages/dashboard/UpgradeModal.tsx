// DashboardApplication.tsx의 showUpgradeModal(요금제 선택) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import {
  APP_PHONE_PLANS, APP_WEEKLY_FREQUENCIES, CHARGE_TIERS, PSTN_COMMON_FEATURES,
  PSTN_SUBSCRIPTION_PLANS,
  REFUND_REASON_PRESETS, billingPlanName,
} from '../dashboardConstants';
import CreditLedgerPanel from './CreditLedgerPanel';

export default function UpgradeModal(props: any) {
  const {
    setShowUpgradeModal, upgradeTab, setUpgradeTab, fetchPaymentHistory, setPendingTopup,
    subStatus, subCancelBusy, cancelSubscription, subscribeBusy,
    billing, startTrial, startSubscription, paymentHistoryLoading, paymentHistory, setRefundTarget,
    setRefundReasonPreset, setRefundReasonCustom,
  } = props;
  const [selectedWeeks, setSelectedWeeks] = useState(4);
  const [selectedAppKey, setSelectedAppKey] = useState('app300');
  const [selectedAppFrequency, setSelectedAppFrequency] = useState(1);
  const selectedAppPlan = APP_PHONE_PLANS.find(plan=>plan.key === selectedAppKey) || APP_PHONE_PLANS[0];
  const selectedAppPrice = selectedAppPlan.prices[selectedAppFrequency];
  const selectedAppPlanKey = `${selectedAppKey}_w${selectedAppFrequency}`;
  const selectedAppCalls = selectedAppPlan.elderLimit * selectedWeeks * selectedAppFrequency;

  return (
    <div className="modal-overlay" onClick={()=>setShowUpgradeModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:920,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>요금제 선택</div>
          <button onClick={()=>setShowUpgradeModal(false)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:18}}>
          {[['metered','일반 전화'],['flat','앱 전화'],['history','충전·사용 내역']].map(([k,label])=>(
            <button key={k} onClick={()=>{ setUpgradeTab(k); if (k==='history') fetchPaymentHistory(); }} style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(upgradeTab===k?'#246BEB':'#e2e8f0'),background:upgradeTab===k?'#eff6ff':'#fff',color:upgradeTab===k?'#246BEB':'#64748b',fontWeight:700,fontSize:14,cursor:'pointer'}}>{label}</button>
          ))}
        </div>

        {upgradeTab==='metered' ? (<>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}><b style={{color:'#0f172a'}}>070 일반전화 정량제 구독</b>입니다. 표시 금액은 VAT 별도이며 포함 통화 소진 후 크레딧으로 이어서 이용합니다.</p>
          {subStatus?.autoRenew && <div style={{display:'flex',justifyContent:'space-between',gap:12,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:16,flexWrap:'wrap'}}><div style={{fontSize:14,color:'#1e3a6e'}}><b>{billingPlanName(subStatus.plan)}</b> 자동결제 중{subStatus.monthlyAmount!=null&&<> · 실제 청구 {subStatus.monthlyAmount.toLocaleString()}원/월</>}</div><button className="btn-secondary" disabled={subCancelBusy} onClick={cancelSubscription}>{subCancelBusy?'처리 중...':'자동결제 해지'}</button></div>}

          <div style={{border:'1px solid #d8e3f5',borderLeft:'5px solid #246BEB',borderRadius:14,padding:'20px 22px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',background:'#fff'}}><div><div style={{fontSize:13,color:'#64748b',fontWeight:700}}>시범사업</div><b style={{display:'block',fontSize:22,marginTop:4}}>30일 무료체험</b><span style={{fontSize:13,color:'#475569'}}>일반전화 30통(약 90분) · 동시통화 1채널 · 관리자 대시보드</span></div><button className="btn-secondary" disabled={!!billing?.trialEndsAt} onClick={startTrial}>{billing?.trialEndsAt?'이미 체험함':'무료체험 시작'}</button></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>{PSTN_SUBSCRIPTION_PLANS.map(plan=>{const current=subStatus?.autoRenew&&subStatus.plan===plan.key;return <div key={plan.key} style={{border:current?'2px solid #15803d':plan.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:10}}><div style={{fontWeight:850,fontSize:18}}>{plan.name}</div><div><b style={{fontSize:27}}>{plan.price.toLocaleString()}원</b><span style={{fontSize:13,color:'#94a3b8'}}> / 월</span></div><div style={{fontSize:12,color:'#64748b'}}>{'VAT 별도 · 실제 청구 '+plan.chargedAmount.toLocaleString()+'원'}</div><div style={{fontSize:14,fontWeight:750,color:'#246BEB'}}>포함 통화 {plan.includedCalls}통 · 약 {plan.minutes}분</div><div style={{fontSize:13,color:'#475569'}}>동시통화 {plan.channels}채널</div><ul style={{listStyle:'none',padding:0,margin:'4px 0',display:'grid',gap:6,flex:1}}>{PSTN_COMMON_FEATURES.map(feature=><li key={feature} style={{fontSize:13,color:'#475569',display:'flex',gap:6}}><CheckCircle2 size={14} color="#246BEB"/>{feature}</li>)}</ul><button className="btn-primary" disabled={current||subscribeBusy===plan.key} onClick={()=>startSubscription(plan.key,`일반전화 ${plan.name}`)}>{current?'자동결제 중':subscribeBusy===plan.key?'처리 중...':'구독하기'}</button></div>})}</div>
          <div style={{marginTop:18,padding:'20px',border:'1px solid #e2e8f0',borderRadius:14,background:'#fff'}}><b style={{display:'block',fontSize:16,color:'#0f172a'}}>모든 플랜에서 제공하는 기능</b><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'8px 16px',marginTop:14}}>{['070 일반전화 AI 안부전화','예약·자동 발신','관리자 대시보드','어르신·담당자 관리','통화 결과와 통화 이력','건강 상태 추적','3단계 위험 감지','위험 알림과 담당자 확인','전화멘트 관리','크레딧 충전·차감·잔액·만료 내역','포함 통화량 월별 집계','동시통화 채널 제어','미응답·통화중·거절·취소·실패 구분'].map(feature=><div key={feature} style={{display:'flex',gap:7,fontSize:13,color:'#475467'}}><CheckCircle2 size={15} color="#246BEB" style={{flexShrink:0}}/>{feature}</div>)}</div><div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #eef2f6',fontSize:12,color:'#64748b'}}><b>스탠다드·프리미엄 추가:</b> 리포트·통계 제공 · 재난특보 등 공공데이터 연동</div></div>
          <h3 style={{fontSize:17,margin:'24px 0 6px'}}>포함 통화가 부족하면 크레딧 충전</h3><p style={{fontSize:12,color:'#64748b',margin:'0 0 10px'}}>3분 완전통화 1건은 841크레딧입니다.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>{CHARGE_TIERS.map(item=><div key={item.key} style={{padding:18,border:'1px solid #dbe4f0',borderRadius:12,background:'#f8fafc'}}><b style={{display:'block',fontSize:20,color:'#246BEB'}}>{item.amount.toLocaleString()}원 충전</b><span style={{fontSize:13,color:'#64748b'}}>{item.calls} 이용 가능</span><button className="btn-primary" style={{width:'100%',marginTop:12}} onClick={()=>setPendingTopup({amount:item.amount})}>충전하기</button></div>)}</div>
          <div style={{marginTop:16,padding:'14px 16px',borderRadius:12,background:'#f8fafc',border:'1px solid #e2e8f0',fontSize:12,color:'#64748b',lineHeight:1.7}}>포함 통화는 매월 초기화됩니다. 미응답과 통화시간에 따른 실제 차감은 서버의 일반전화 과금 규칙을 따르며, 충전 크레딧은 결제일로부터 1년 후 소멸합니다. 크레딧은 신용·체크카드 일시불로만 충전할 수 있으며, 환불은 충전할 때 사용한 원 결제 카드로만 처리됩니다.</div>
        </>) : upgradeTab==='flat' ? (<>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}><b style={{color:'#0f172a'}}>앱 전화 안부콜</b>은 등록 인원과 주간 통화 횟수에 따라 월 요금이 정해집니다. 부가세 포함 금액이며 통화 크레딧을 별도로 충전하지 않습니다.</p>
          {subStatus?.autoRenew && <div style={{display:'flex',justifyContent:'space-between',gap:12,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:16,flexWrap:'wrap'}}><div style={{fontSize:14,color:'#1e3a6e'}}><b>{billingPlanName(subStatus.plan)}</b> 자동결제 중{subStatus.nextChargeAt && <> · 다음 청구일 {new Date(subStatus.nextChargeAt).toLocaleDateString('ko-KR')}</>}{subStatus.monthlyAmount != null && <> · {subStatus.monthlyAmount.toLocaleString()}원/월</>}{subStatus.lastChargeError && <div style={{color:'#c5221f'}}>최근 청구 실패: {subStatus.lastChargeError}</div>}</div><button className="btn-secondary" disabled={subCancelBusy} onClick={cancelSubscription}>{subCancelBusy?'처리 중...':'자동결제 해지'}</button></div>}
          <div style={{border:'1px solid #dbe4f0',borderRadius:16,padding:18,background:'linear-gradient(145deg,#fff 0%,#f7faff 100%)'}}>
            <div style={{fontWeight:850,fontSize:14,marginBottom:9}}>1. 등록 인원</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(86px,1fr))',gap:8}}>{APP_PHONE_PLANS.map(plan=><button key={plan.key} type="button" aria-pressed={selectedAppKey===plan.key} onClick={()=>setSelectedAppKey(plan.key)} style={{padding:'11px 8px',borderRadius:11,border:selectedAppKey===plan.key?'2px solid #246BEB':'1px solid #dbe4f0',background:selectedAppKey===plan.key?'#eaf2ff':'#fff',fontWeight:800,cursor:'pointer'}}>{plan.elderLimit}명</button>)}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:18,marginTop:18}}>
              <div><div style={{fontWeight:850,fontSize:14,marginBottom:9}}>2. 예상 월 주 수</div><div style={{display:'flex',gap:8}}>{[4,5].map(weeks=><button key={weeks} type="button" onClick={()=>setSelectedWeeks(weeks)} style={{flex:1,padding:10,borderRadius:10,border:selectedWeeks===weeks?'2px solid #246BEB':'1px solid #dbe4f0',background:selectedWeeks===weeks?'#eaf2ff':'#fff',fontWeight:800,cursor:'pointer'}}>월 {weeks}주</button>)}</div></div>
              <div><div style={{fontWeight:850,fontSize:14,marginBottom:9}}>3. 주간 통화 횟수</div><div style={{display:'flex',gap:8}}>{APP_WEEKLY_FREQUENCIES.map(f=><button key={f} type="button" onClick={()=>setSelectedAppFrequency(f)} style={{flex:1,padding:10,borderRadius:10,border:selectedAppFrequency===f?'2px solid #246BEB':'1px solid #dbe4f0',background:selectedAppFrequency===f?'#eaf2ff':'#fff',fontWeight:800,cursor:'pointer'}}>주 {f}회</button>)}</div></div>
            </div>
            <div aria-live="polite" style={{marginTop:18,borderRadius:14,padding:'18px 20px',background:'#12233f',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,flexWrap:'wrap'}}><div><div style={{fontSize:13,color:'#b9c9e4',fontWeight:700}}>앱 {selectedAppPlan.elderLimit}명 · 주 {selectedAppFrequency}회</div><div style={{fontSize:12.5,color:'#d6e2f5',marginTop:7}}>최대 월 {selectedAppCalls.toLocaleString()}통 · 1회 3분</div><div style={{fontSize:12,color:'#9fb2d1',marginTop:4}}>월 요금은 5주 최대 사용량까지 포함합니다.</div></div><div style={{textAlign:'right'}}><div style={{fontSize:12,color:'#b9c9e4'}}>부가세 포함 월 요금</div><div style={{fontSize:29,fontWeight:900}}>{selectedAppPrice.toLocaleString()}원</div></div></div>
            <div style={{display:'flex',gap:10,marginTop:18,flexWrap:'wrap'}}><button className="btn-primary" style={{flex:1}} disabled={subscribeBusy===selectedAppPlanKey || subStatus?.plan===selectedAppPlanKey} onClick={()=>startSubscription(selectedAppPlanKey,`앱 ${selectedAppPlan.elderLimit}명·주 ${selectedAppFrequency}회`)}>{subscribeBusy===selectedAppPlanKey?'처리 중...':subStatus?.plan===selectedAppPlanKey?'자동결제 중':'이 요금제로 신청'}</button><button className="btn-secondary" disabled={!!billing?.trialEndsAt} onClick={startTrial}>{billing?.trialEndsAt?'이미 체험함':'30일 무료 체험'}</button></div>
          </div>
          <div style={{marginTop:14,padding:'14px 16px',borderRadius:12,background:'#f8fafc',border:'1px solid #e2e8f0',fontSize:12,color:'#64748b',lineHeight:1.7}}>관리자 대시보드, 예약 발신, 통화 결과·이력, 3단계 위험 감지와 담당자 알림을 포함합니다. 선택한 인원 상한을 넘으면 서버가 결제를 차단합니다.</div>
        </>) : (<>
          <CreditLedgerPanel />
          <h3 style={{fontSize:18}}>카드 결제 및 환불 내역</h3>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
            크레딧 충전·정액제 결제 내역입니다. 완료된 크레딧 충전 건은 환불을 요청할 수 있습니다(실제 처리는 담당자 확인 후 진행됩니다).
          </p>
          {paymentHistoryLoading ? (
            <div style={{color:'#94a3b8',fontSize:14,padding:'20px 4px'}}>불러오는 중...</div>
          ) : paymentHistory.length === 0 ? (
            <div style={{color:'#94a3b8',fontSize:14,padding:'20px 4px'}}>결제 내역이 없습니다</div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                <thead><tr style={{textAlign:'left',color:'#94a3b8',borderBottom:'1px solid #e2e8f0'}}>
                  <th style={{padding:'8px 10px',fontWeight:600}}>시각</th><th style={{padding:'8px 10px',fontWeight:600}}>종류</th>
                  <th style={{padding:'8px 10px',fontWeight:600}}>금액</th><th style={{padding:'8px 10px',fontWeight:600}}>상태</th><th style={{padding:'8px 10px',fontWeight:600}}></th>
                </tr></thead>
                <tbody>{paymentHistory.map((p:any)=>{
                  const canRequest = p.status==='paid' && p.type!=='subscription' && !p.refundRequestStatus;
                  return (
                  <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={{padding:'10px',color:'#94a3b8'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                    <td style={{padding:'10px'}}>{p.type==='subscription' ? `정액제${p.planKey?`(${p.planKey})`:''}` : '크레딧 충전'}</td>
                    <td style={{padding:'10px',fontWeight:700}}>{p.amount.toLocaleString()}원</td>
                    <td style={{padding:'10px'}}>
                      {p.status==='cancelled' ? <span style={{color:'#94a3b8'}}>전액 환불됨</span>
                        : p.status==='partially_refunded' ? <span style={{color:'#64748b'}}>부분 환불됨 ({Number(p.refundedAmount || 0).toLocaleString()}원)</span>
                        : p.refundRequestStatus==='pending' ? <span style={{color:'#754d00'}}>환불 요청됨</span>
                        : p.refundRequestStatus==='rejected' ? <span style={{color:'#c5221f'}}>환불 거절됨</span>
                        : p.status==='paid' ? <span style={{color:'#1e8e3e'}}>완료</span>
                        : <span style={{color:'#94a3b8'}}>{p.status}</span>}
                    </td>
                    <td style={{padding:'10px'}}>
                      {canRequest && (
                        <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px'}}
                          onClick={()=>{ setRefundTarget({id:p.id, amount:p.amount}); setRefundReasonPreset(REFUND_REASON_PRESETS[0]); setRefundReasonCustom(''); }}
                        >환불 요청</button>
                      )}
                    </td>
                  </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
