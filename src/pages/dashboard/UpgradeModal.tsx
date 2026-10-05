// DashboardApplication.tsx의 showUpgradeModal(요금제 선택) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { Fragment, useState } from 'react';
import { X, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  CHARGE_TIERS, PSTN_COMMON_FEATURES,
  PSTN_SUBSCRIPTION_PLANS,
  REFUND_REASON_PRESETS, UPGRADE_PLANS, billingPlanName,
} from '../dashboardConstants';
import CreditLedgerPanel from './CreditLedgerPanel';
import HistoryPagination from './HistoryPagination';

const PAYMENT_PAGE_SIZE = 10;

export default function UpgradeModal(props: any) {
  const {
    setShowUpgradeModal, upgradeTab, setUpgradeTab, fetchPaymentHistory, setPendingTopup,
    subStatus, subCancelBusy, cancelSubscription, subscribeBusy,
    payTestEnabled,
    startSubscription, paymentHistoryLoading, paymentHistory, paymentHistoryTotal, setRefundTarget,
    setRefundReasonPreset, setRefundReasonCustom,
    subscriptionActionBusy, scheduleSubscriptionPlanChange, testSubscriptionRenewal,
  } = props;
  const [manageAction, setManageAction] = useState<'plan'|'payment'|'credit'|null>(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string|null>(null);
  const [historyView, setHistoryView] = useState<'usage'|'payments'>('usage');
  const [paymentPage, setPaymentPage] = useState(1);
  const paidAppPlans = UPGRADE_PLANS;
  const activeTrack = upgradeTab === 'flat' ? 'app' : 'pstn';
  const currentSub = subStatus?.subscriptions?.[activeTrack]
    ?? (subStatus?.track === activeTrack ? subStatus : null);
  const isCurrentActive = (item:any) => !!item && (item.autoRenew || (item.paidThrough && new Date(item.paidThrough).getTime() > Date.now()));
  const hasAnySubscription = !!(isCurrentActive(subStatus?.subscriptions?.app) || isCurrentActive(subStatus?.subscriptions?.pstn) || isCurrentActive(subStatus));

  return (
    <div className="modal-overlay" onClick={()=>setShowUpgradeModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:920,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>{hasAnySubscription?'내 구독 관리':'요금제 선택'}</div>
          <button onClick={()=>setShowUpgradeModal(false)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:18}}>
          {[['metered','일반 전화'],['flat','앱 전화'],['history','결제·사용 내역']].map(([k,label])=>(
            <button key={k} onClick={()=>{ setUpgradeTab(k); if (k==='history') fetchPaymentHistory(); }} style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(upgradeTab===k?'#246BEB':'#e2e8f0'),background:upgradeTab===k?'#eff6ff':'#fff',color:upgradeTab===k?'#246BEB':'#64748b',fontWeight:700,fontSize:14,cursor:'pointer'}}>{label}</button>
          ))}
        </div>

        {isCurrentActive(currentSub) && upgradeTab!=='history' ? (<>
          <section className="subscription-overview" aria-labelledby="current-subscription-title">
            <div className="subscription-overview__header" style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:12,fontWeight:850,color:'#246BEB',letterSpacing:.3}}>현재 이용 중</div>
                <div id="current-subscription-title" style={{fontSize:24,fontWeight:900,color:'#0f172a',marginTop:5}}>{billingPlanName(currentSub.plan)}</div>
                <div style={{fontSize:14,color:'#475569',marginTop:7}}>{currentSub.monthlyAmount?.toLocaleString()}원/월 · 어르신 {subStatus.elderCount}명</div>
              </div>
              <div className="subscription-status">{currentSub.autoRenew?'자동결제 정상':'입금 완료'}</div>
            </div>
            <div className="subscription-facts">
              <div className="subscription-fact"><div className="subscription-fact__label">결제수단</div><div className="subscription-fact__value">{currentSub.paymentMethod?.label||'등록된 결제수단'}</div>{currentSub.paymentMethod?.masked&&<div className="subscription-fact__meta">{currentSub.paymentMethod.masked}</div>}</div>
              <div className="subscription-fact"><div className="subscription-fact__label">{currentSub.autoRenew?'다음 결제일':'이용 종료일'}</div><div className="subscription-fact__value">{(currentSub.nextChargeAt||currentSub.paidThrough)?new Date(currentSub.nextChargeAt||currentSub.paidThrough).toLocaleDateString('ko-KR'):'확인 필요'}</div></div>
              <div className="subscription-fact"><div className="subscription-fact__label">결제 상태</div><div className={`subscription-fact__value ${currentSub.lastChargeError?'is-error':'is-ok'}`}>{currentSub.lastChargeError?'최근 결제 실패':'정상'}</div></div>
            </div>
            {currentSub.pendingPlan&&<div style={{marginTop:14,padding:'11px 13px',borderRadius:10,background:'#fff7ed',color:'#9a3412',fontSize:13}}>다음 결제일부터 <b>{billingPlanName(currentSub.pendingPlan)}</b> 요금제로 변경 예정입니다.</div>}
            {currentSub.lastChargeError&&<div style={{marginTop:10,padding:'11px 13px',borderRadius:10,background:'#fef2f2',color:'#b91c1c',fontSize:13}}>최근 청구 실패: {currentSub.lastChargeError}</div>}
            <div className="subscription-actions">
              <button className="btn-primary" onClick={()=>setManageAction(manageAction==='credit'?null:'credit')}>{manageAction==='credit'?'이용권 닫기':'추가 통화 구매'}</button>
              <button className="btn-secondary" onClick={()=>setManageAction(manageAction==='plan'?null:'plan')}>{manageAction==='plan'?'변경 닫기':'요금제 변경'}</button>
              {currentSub.autoRenew&&<button className="btn-secondary" onClick={()=>setManageAction(manageAction==='payment'?null:'payment')}>{manageAction==='payment'?'변경 닫기':'결제수단 변경'}</button>}
              {!currentSub.autoRenew&&<button className="btn-secondary" disabled={!!subscribeBusy} onClick={()=>startSubscription(currentSub.plan,billingPlanName(currentSub.plan))}>다음 달 무통장 청구서</button>}
              {payTestEnabled&&currentSub.testMode&&<button className="btn-secondary" disabled={subscriptionActionBusy==='renew'} onClick={()=>testSubscriptionRenewal(activeTrack)}>{subscriptionActionBusy==='renew'?'재결제 중...':'다음 달 재결제 테스트'}</button>}
              {currentSub.autoRenew&&<button className="subscription-cancel" disabled={subCancelBusy} onClick={()=>cancelSubscription(activeTrack)}>{subCancelBusy?'처리 중...':'자동결제 해지'}</button>}
            </div>
          </section>

          {manageAction==='credit'&&<div className="subscription-editor"><b style={{fontSize:16}}>추가 통화 이용권</b><p style={{fontSize:13,color:'#64748b',lineHeight:1.6}}>월 포함 통화를 모두 사용한 뒤 필요한 만큼 별도로 구매합니다. 카드 일시불 상품이며 결제일부터 3개월 동안 사용할 수 있습니다.</p><div className="subscription-credit-options">{CHARGE_TIERS.map(item=><button key={item.key} type="button" className="subscription-credit-option" onClick={()=>setPendingTopup({amount:item.amount})}><b>{item.amount.toLocaleString()}원</b><span>{item.calls} · {item.validity}</span></button>)}</div></div>}

          {manageAction==='payment'&&<div className="subscription-editor"><b style={{fontSize:16}}>새 카드 등록</b><p style={{fontSize:13,color:'#64748b',lineHeight:1.6}}>새 카드의 빌링키가 정상 확인된 뒤 이 통화 방식의 기존 카드를 교체합니다. 지금 추가 결제되지는 않습니다.</p><div style={{fontSize:13,fontWeight:750,color:'#1d4ed8',margin:'12px 0'}}>신용·체크카드 · 매월 자동결제</div><button className="btn-primary" disabled={!!subscribeBusy} onClick={()=>startSubscription(currentSub.plan,billingPlanName(currentSub.plan),{replacePaymentMethod:true})}>{subscribeBusy?'등록 중...':'이 카드로 변경'}</button></div>}

          {manageAction==='plan'&&<div style={{marginTop:14,padding:18,border:'1px solid #dbe4f0',borderRadius:14}}>
            <b style={{fontSize:16}}>다음 결제일부터 적용할 요금제</b>
            <p style={{fontSize:13,color:'#64748b'}}>현재 이용기간은 유지되며 다음 자동결제일부터 변경됩니다.</p>
            {upgradeTab==='metered' ? (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:12}}>{PSTN_SUBSCRIPTION_PLANS.map(plan=><div key={plan.key} style={{padding:15,border:'1px solid #e2e8f0',borderRadius:12}}><b>{plan.name}</b><div style={{fontSize:18,fontWeight:900,margin:'7px 0'}}>{plan.chargedAmount.toLocaleString()}원/월</div><div style={{fontSize:12,color:'#64748b'}}>포함 {plan.includedCalls}통 · {plan.channels}채널</div><button className="btn-primary" style={{width:'100%',marginTop:12}} disabled={subscriptionActionBusy==='plan'||(currentSub.plan===plan.key&&!currentSub.pendingPlan)} onClick={()=>scheduleSubscriptionPlanChange(plan.key,`일반전화 ${plan.name}`)}>{currentSub.pendingPlan===plan.key?'변경 예약됨':currentSub.plan===plan.key?'현재 요금제':'이 요금제로 변경'}</button></div>)}</div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:12}}>{paidAppPlans.map(plan=><div key={plan.key} style={{padding:15,border:'1px solid #e2e8f0',borderRadius:12}}><b>{plan.name}</b><div style={{fontSize:18,fontWeight:900,margin:'7px 0'}}>{plan.price}/인·월</div><div style={{fontSize:12,color:'#64748b'}}>{plan.summary}</div><button className="btn-primary" style={{width:'100%',marginTop:12}} disabled={subscriptionActionBusy==='plan'||(currentSub.plan===plan.key&&!currentSub.pendingPlan)} onClick={()=>scheduleSubscriptionPlanChange(plan.key,`앱 설치형 ${plan.name}`)}>{currentSub.pendingPlan===plan.key?'변경 예약됨':currentSub.plan===plan.key?'현재 요금제':'이 요금제로 변경'}</button></div>)}</div>
            )}
          </div>}
        </>) : upgradeTab==='metered' ? (<>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}><b style={{color:'#0f172a'}}>전화통화 월 정기결제</b>입니다. 전화통화 번호 유지와 월 포함 통화량을 제공하며, 포함 통화 소진 후에는 3개월 추가 통화 이용권을 별도로 구매할 수 있습니다.</p>
          <div style={{padding:'14px 16px',marginBottom:16,border:'1px solid #dbe4f0',borderRadius:12,background:'#f8fafc'}}><div style={{fontSize:13,fontWeight:800,color:'#0f172a'}}>정기결제 수단</div><div style={{fontSize:13,color:'#64748b',marginTop:6}}>신용·체크카드로 등록하며 해지 전까지 매월 자동 결제됩니다.</div></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>{PSTN_SUBSCRIPTION_PLANS.map(plan=>{const current=currentSub?.autoRenew&&currentSub.plan===plan.key;return <div key={plan.key} style={{border:current?'2px solid #15803d':plan.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:10}}><div style={{fontWeight:850,fontSize:18}}>{plan.name}</div><div><b style={{fontSize:27}}>{plan.price.toLocaleString()}원</b><span style={{fontSize:13,color:'#94a3b8'}}> / 월</span></div><div style={{fontSize:12,color:'#64748b'}}>{plan.vatIncluded?'부가세 포함 · 매월 자동결제':'VAT 별도 · 실제 청구 '+plan.chargedAmount.toLocaleString()+'원'}</div><div style={{fontSize:14,fontWeight:750,color:'#246BEB'}}>포함 통화 {plan.includedCalls}통 · 약 {plan.minutes}분</div><div style={{fontSize:13,color:'#475569'}}>동시통화 {plan.channels}채널</div><ul style={{listStyle:'none',padding:0,margin:'4px 0',display:'grid',gap:6,flex:1}}>{PSTN_COMMON_FEATURES.map(feature=><li key={feature} style={{fontSize:13,color:'#475569',display:'flex',gap:6}}><CheckCircle2 size={14} color="#246BEB"/>{feature}</li>)}</ul><button className="btn-primary" disabled={current||subscribeBusy===plan.key} onClick={()=>startSubscription(plan.key,`일반전화 ${plan.name}`)}>{current?'자동결제 중':subscribeBusy===plan.key?'처리 중...':'구독하기'}</button></div>})}</div>
          <div style={{marginTop:18,padding:'20px',border:'1px solid #e2e8f0',borderRadius:14,background:'#fff'}}><b style={{display:'block',fontSize:16,color:'#0f172a'}}>모든 플랜에서 제공하는 기능</b><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'8px 16px',marginTop:14}}>{['전화통화 AI 안부전화','예약·자동 발신','관리자 대시보드','어르신·담당자 관리','통화 결과와 통화 이력','건강 상태 추적','3단계 위험 감지','위험 알림과 담당자 확인','전화멘트 관리','추가 통화 이용권 구매·사용·잔액·만료 내역','포함 통화량 월별 집계','동시통화 채널 제어','미응답·통화중·거절·취소·실패 구분'].map(feature=><div key={feature} style={{display:'flex',gap:7,fontSize:13,color:'#475467'}}><CheckCircle2 size={15} color="#246BEB" style={{flexShrink:0}}/>{feature}</div>)}</div><div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #eef2f6',fontSize:12,color:'#64748b'}}><b>스탠다드·프리미엄 추가:</b> 리포트·통계 제공 · 재난특보 등 공공데이터 연동</div></div>
          <h3 style={{fontSize:17,margin:'24px 0 6px'}}>포함 통화가 부족하면 추가 통화 이용권</h3><p style={{fontSize:12,color:'#64748b',margin:'0 0 10px'}}>자동결제가 아닌 신용·체크카드 일시불 상품입니다.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>{CHARGE_TIERS.map(item=><div key={item.key} style={{padding:18,border:item.recommended?'2px solid #246BEB':'1px solid #dbe4f0',borderRadius:12,background:'#f8fafc'}}><b style={{display:'block',fontSize:20,color:'#246BEB'}}>{item.amount.toLocaleString()}원</b><span style={{display:'block',fontSize:13,color:'#475569',marginTop:6}}>{item.calls} 이용 가능</span><span style={{display:'block',fontSize:12,color:'#64748b',marginTop:4}}>{item.validity}</span><button className="btn-primary" style={{width:'100%',marginTop:12}} onClick={()=>setPendingTopup({amount:item.amount})}>이용권 구매</button></div>)}</div>
          <div style={{marginTop:16,padding:'14px 16px',borderRadius:12,background:'#f8fafc',border:'1px solid #e2e8f0',fontSize:12,color:'#64748b',lineHeight:1.7}}>월 포함 통화는 결제 주기마다 새로 제공되며 다음 달로 이월되지 않습니다. 추가 통화 이용권은 결제일부터 3개월 동안 사용할 수 있고 자동으로 다시 결제되지 않습니다. 환불은 구매에 사용한 원 결제 카드로만 처리됩니다.</div>
        </>) : upgradeTab==='flat' ? (<>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}><b style={{color:'#0f172a'}}>앱 설치형 AI 안부전화</b>입니다. 등록 어르신 수에 선택한 1인당 월 단가를 곱해 청구하며 표시 금액은 부가세 포함입니다.</p>
          <div style={{padding:'14px 16px',marginBottom:16,border:'1px solid #dbe4f0',borderRadius:12,background:'#f8fafc'}}><div style={{fontSize:13,fontWeight:800,color:'#0f172a'}}>정기결제 수단</div><div style={{fontSize:13,color:'#64748b',marginTop:6}}>신용·체크카드로 등록하며 해지 전까지 매월 자동 결제됩니다.</div></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>{paidAppPlans.map(plan=>{const current=currentSub?.autoRenew&&currentSub.plan===plan.key;return <div key={plan.key} style={{position:'relative',border:current?'2px solid #15803d':plan.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:10,background:'#fff'}}>{plan.recommended&&<span style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',padding:'4px 12px',borderRadius:999,background:'#246BEB',color:'#fff',fontSize:11,fontWeight:850}}>추천</span>}<div style={{fontWeight:850,fontSize:18}}>{plan.name}</div><div><b style={{fontSize:27}}>{plan.price}</b><span style={{fontSize:13,color:'#94a3b8'}}> / 인·월</span></div><div style={{fontSize:13,fontWeight:750,color:'#475569'}}>{plan.summary}</div><ul style={{listStyle:'none',padding:0,margin:'4px 0',display:'grid',gap:8,flex:1}}>{plan.features.map(feature=><li key={feature} style={{fontSize:13,color:'#475569',display:'flex',gap:7}}><CheckCircle2 size={15} color="#20a66a" style={{flexShrink:0}}/>{feature}</li>)}</ul><div style={{fontSize:12,color:'#64748b'}}>현재 {subStatus?.elderCount||0}명 기준 월 {((plan.monthlyRate||0)*(subStatus?.elderCount||0)).toLocaleString()}원</div><button className="btn-primary" disabled={current||subscribeBusy===plan.key} onClick={()=>startSubscription(plan.key,`앱 설치형 ${plan.name}`)}>{current?'자동결제 중':subscribeBusy===plan.key?'처리 중...':'구독하기'}</button></div>})}</div>
          <div style={{marginTop:14,padding:'14px 16px',borderRadius:12,background:'#f8fafc',border:'1px solid #e2e8f0',fontSize:12,color:'#64748b',lineHeight:1.7}}>앱 전화는 매일 발신 관리가 가능하며, 실제 월 청구액은 결제 시점에 등록된 어르신 수 × 플랜별 인·월 단가로 서버에서 다시 계산합니다.</div>
        </>) : (<>
          <div role="tablist" aria-label="결제와 사용 내역 구분" style={{display:'flex',gap:8,marginBottom:20,padding:5,borderRadius:12,background:'#f1f5f9',width:'fit-content',maxWidth:'100%'}}>
            <button type="button" role="tab" aria-selected={historyView==='usage'} className={historyView==='usage'?'btn-primary':'btn-secondary'}
              onClick={()=>setHistoryView('usage')}>이용권 사용·잔액</button>
            <button type="button" role="tab" aria-selected={historyView==='payments'} className={historyView==='payments'?'btn-primary':'btn-secondary'}
              onClick={()=>{setHistoryView('payments');setPaymentPage(1);setExpandedPaymentId(null);fetchPaymentHistory(1);}}>카드 결제·환불</button>
          </div>
          {historyView==='usage' ? <div role="tabpanel" aria-label="이용권 사용·잔액"><CreditLedgerPanel /></div> : <div role="tabpanel" aria-label="카드 결제·환불">
          <h3 style={{fontSize:18}}>카드 결제 및 환불 내역</h3>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
            추가 통화 이용권·월 정기결제 내역입니다. 완료된 이용권 결제는 환불을 요청할 수 있습니다(실제 처리는 담당자 확인 후 진행됩니다).
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
                  <th style={{padding:'8px 10px',fontWeight:600}}>금액</th><th style={{padding:'8px 10px',fontWeight:600}}>이용기한</th>
                  <th style={{padding:'8px 10px',fontWeight:600}}>상태</th><th style={{padding:'8px 10px',fontWeight:600}}></th>
                </tr></thead>
                <tbody>{paymentHistory.map((p:any)=>{
                  const canRequest = p.status==='paid' && p.type==='topup' && !p.refundRequestStatus;
                  const expanded = expandedPaymentId === p.id;
                  const productLabel = p.type==='subscription' ? `월 정기결제${p.planKey?`(${p.planKey})`:''}` : p.type==='trial' ? '기존 시범 이용 결제' : '추가 통화 이용권';
                  const validityLabel = p.type!=='topup' ? '-'
                    : p.validUntil ? new Date(p.validUntil).toLocaleString('ko-KR')
                    : p.productPolicyVersion ? '결제 완료 후 3개월' : '기존 구매조건 적용';
                  return <Fragment key={p.id}>
                  <tr style={{borderBottom:'1px solid #f1f5f9',cursor:'pointer',background:expanded?'#f8fafc':'#fff'}}
                    onClick={()=>setExpandedPaymentId(expanded?null:p.id)}>
                    <td style={{padding:'10px',color:'#94a3b8'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString('ko-KR') : '-'}</td>
                    <td style={{padding:'10px'}}>{productLabel}</td>
                    <td style={{padding:'10px',fontWeight:700}}>{p.amount.toLocaleString()}원</td>
                    <td style={{padding:'10px',color:'#64748b'}}>{validityLabel}</td>
                    <td style={{padding:'10px'}}>
                      {p.status==='cancelled' ? <span style={{color:'#94a3b8'}}>전액 환불됨</span>
                        : p.status==='partially_refunded' ? <span style={{color:'#64748b'}}>부분 환불됨 ({Number(p.refundedAmount || 0).toLocaleString()}원)</span>
                        : p.refundRequestStatus==='pending' ? <span style={{color:'#754d00'}}>환불 요청됨</span>
                        : p.refundRequestStatus==='rejected' ? <span style={{color:'#c5221f'}}>환불 거절됨</span>
                        : p.status==='paid' ? <span style={{color:'#1e8e3e'}}>완료</span>
                        : <span style={{color:'#94a3b8'}}>{p.status}</span>}
                    </td>
                    <td style={{padding:'10px',whiteSpace:'nowrap'}}>
                      {canRequest && (
                        <button className="btn-secondary" style={{fontSize:13,padding:'4px 10px'}}
                          onClick={e=>{ e.stopPropagation(); setRefundTarget({id:p.id, amount:p.amount}); setRefundReasonPreset(REFUND_REASON_PRESETS[0]); setRefundReasonCustom(''); }}
                        >환불 요청</button>
                      )}
                      <button type="button" aria-expanded={expanded} aria-label={expanded?'결제 상세 닫기':'결제 상세 보기'}
                        onClick={e=>{e.stopPropagation();setExpandedPaymentId(expanded?null:p.id);}}
                        style={{marginLeft:8,padding:4,border:0,background:'transparent',color:'#475569',cursor:'pointer',verticalAlign:'middle'}}>
                        <ChevronDown size={17} aria-hidden="true" style={{display:'block',transform:expanded?'rotate(180deg)':'none',transition:'transform .15s'}}/>
                      </button>
                    </td>
                  </tr>
                  {expanded&&<tr style={{borderBottom:'1px solid #dbe4f0',background:'#f8fafc'}}>
                    <td colSpan={6} style={{padding:'4px 10px 16px'}}>
                      <div style={{border:'1px solid #dbe4f0',borderRadius:12,background:'#fff',padding:16}}>
                        <div style={{fontSize:14,fontWeight:850,color:'#0f172a',marginBottom:12}}>결제 상세내역</div>
                        <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'12px 18px',margin:0}}>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>결제번호</dt><dd style={{margin:'3px 0 0',fontSize:13,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',overflowWrap:'anywhere'}}>{p.id}</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>상품</dt><dd style={{margin:'3px 0 0',fontWeight:750}}>{productLabel}</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>요청 시각</dt><dd style={{margin:'3px 0 0'}}>{p.createdAt?new Date(p.createdAt).toLocaleString('ko-KR'):'-'}</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>결제 완료 시각</dt><dd style={{margin:'3px 0 0'}}>{p.paidAt?new Date(p.paidAt).toLocaleString('ko-KR'):p.status==='paid'?'확인되지 않음':'결제 대기'}</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>결제금액</dt><dd style={{margin:'3px 0 0',fontWeight:750}}>{Number(p.amount||0).toLocaleString()}원</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>이용기한</dt><dd style={{margin:'3px 0 0'}}>{validityLabel}</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>결제 상태</dt><dd style={{margin:'3px 0 0'}}>{p.status||'-'}</dd></div>
                          <div><dt style={{fontSize:12,color:'#64748b'}}>환불 상태</dt><dd style={{margin:'3px 0 0'}}>{p.refundRequestStatus==='pending'?'요청 확인 중':p.refundRequestStatus==='rejected'?'요청 반려':p.status==='cancelled'?'전액 환불 완료':p.status==='partially_refunded'?'부분 환불 완료':'환불 요청 없음'}</dd></div>
                          {p.refundRequestReason&&<div style={{gridColumn:'1 / -1'}}><dt style={{fontSize:12,color:'#64748b'}}>환불 요청 사유</dt><dd style={{margin:'3px 0 0',whiteSpace:'pre-wrap'}}>{p.refundRequestReason}</dd></div>}
                        </dl>
                      </div>
                    </td>
                  </tr>}
                  </Fragment>;
                })}</tbody>
              </table>
            </div>
          )}
          {!paymentHistoryLoading&&<HistoryPagination page={paymentPage} totalItems={paymentHistoryTotal} pageSize={PAYMENT_PAGE_SIZE}
            onChange={next=>{setPaymentPage(next);setExpandedPaymentId(null);fetchPaymentHistory(next);}}/>}
          </div>}
        </>)}
      </div>
    </div>
  );
}
