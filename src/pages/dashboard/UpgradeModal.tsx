// DashboardApplication.tsx의 showUpgradeModal(요금제 선택) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { X, CheckCircle2 } from 'lucide-react';
import { CHARGE_TIERS, UPGRADE_PLANS, REFUND_REASON_PRESETS } from '../dashboardConstants';
import { isPayTestEnabled } from '../../utils/api';

export default function UpgradeModal(props: any) {
  const {
    setShowUpgradeModal, upgradeTab, setUpgradeTab, fetchPaymentHistory, setPendingTopup,
    customAmount, setCustomAmount, subStatus, subCancelBusy, cancelSubscription, subscribeBusy,
    billing, startTrial, startSubscription, paymentHistoryLoading, paymentHistory, setRefundTarget,
    setRefundReasonPreset, setRefundReasonCustom,
  } = props;

  return (
    <div className="modal-overlay" onClick={()=>setShowUpgradeModal(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:920,width:'96%',textAlign:'left',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>요금제 선택</div>
          <button onClick={()=>setShowUpgradeModal(false)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:18}}>
          {[['metered','정량제'],['flat','정액제'],['history','결제 내역']].map(([k,label])=>(
            <button key={k} onClick={()=>{ setUpgradeTab(k); if (k==='history') fetchPaymentHistory(); }} style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(upgradeTab===k?'#246BEB':'#e2e8f0'),background:upgradeTab===k?'#eff6ff':'#fff',color:upgradeTab===k?'#246BEB':'#64748b',fontWeight:700,fontSize:14,cursor:'pointer'}}>{label}</button>
          ))}
        </div>

        {upgradeTab==='metered' ? (<>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
            발신 시도마다 <b>발신 기본료 40원</b> + 실제 연결된 통화에만 <b>통화 요금</b>이 충전액에서 차감됩니다.
            발신이 없는 달은 차감도 청구도 없습니다(VAT 별도). 아래는 대표적인 충전 단위입니다 — 원하는 금액을 직접 입력해도 됩니다.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:14}}>
            {CHARGE_TIERS.map(c=>(
              <div key={c.key} style={{border:c.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontWeight:900,fontSize:22,color:'#0f172a'}}>{c.amount.toLocaleString()}원</div>
                <div style={{fontSize:14,fontWeight:700,color:'#246BEB'}}>{c.calls} 도달(3분 통화 기준)</div>
                <div style={{fontSize:13,color:'#475467',lineHeight:1.5,flex:1}}>{c.usage}</div>
                <button
                  className="btn-primary"
                  style={{width:'100%'}}
                  onClick={()=>setPendingTopup({amount:c.amount})}
                >신청</button>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:16}}>
            <input
              className="form-input"
              style={{marginBottom:0,flex:1}}
              type="number"
              min={10000}
              step={1000}
              placeholder="직접 입력(원, 10,000원 이상)"
              value={customAmount}
              onChange={e=>setCustomAmount(e.target.value)}
            />
            <button
              className="btn-secondary"
              disabled={!customAmount || Number(customAmount) < 10000}
              onClick={()=>setPendingTopup({amount:Number(customAmount)})}
            >직접 충전</button>
          </div>
          {/* 실결제 파이프라인(포트원 연동·웹훅) 자체가 살아있는지 실제 결제해 확인하는
              테스트 버튼 — 서버가 amount===1000만 예외로 허용한다(일반 충전 최소단위는 그대로
              유지). 처음엔 1원으로 뒀는데 PG사 최소 결제금액 미만이라 결제가 안 돼 1,000원으로 조정.
              2026-09-09: 운영 대시보드에는 노출하지 않는다 — 기관 담당자가 실수로 누르면
              실제로 1,000원이 결제된다.
              2026-09-10: 다만 이니시스가 결제창 호출 도메인을 운영 주소로만 허용해 dev에서는
              실결제 검증 자체가 불가능했다(prepare 400). 그래서 dev이거나 `?testpay=1`이
              붙었을 때만 보이게 한다 — 평소 화면에는 그대로 안 보인다. */}
          {isPayTestEnabled() && (
            <button
              className="btn-secondary"
              style={{marginTop:8,fontSize:12,color:'#94a3b8'}}
              onClick={()=>setPendingTopup({amount:1000})}
            >1,000원 테스트 결제 (점검용)</button>
          )}
          <p style={{color:'#94a3b8',fontSize:12,margin:'18px 0 0'}}>정확한 채널 배정·이용 패턴별 견적은 담당 매니저에게 문의해 주세요.</p>
        </>) : upgradeTab==='flat' ? (<>
          <p style={{color:'#64748b',fontSize:15,margin:'0 0 20px',lineHeight:1.6}}>
            예산을 매월 고정해야 하는 기관을 위한 인·월 정액 요금제입니다(앱 설치 방식 기준, VAT 별도).
          </p>
          {subStatus?.autoRenew && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:16,flexWrap:'wrap'}}>
              <div style={{fontSize:14,color:'#1e3a6e'}}>
                <b>{UPGRADE_PLANS.find(p=>p.key===subStatus.plan)?.name || subStatus.plan}</b> 플랜 자동결제 중
                {subStatus.nextChargeAt && <> · 다음 청구일 {new Date(subStatus.nextChargeAt).toLocaleDateString('ko-KR')}</>}
                {subStatus.monthlyAmount != null && <> · {subStatus.monthlyAmount.toLocaleString()}원/월</>}
                {subStatus.lastChargeError && <div style={{color:'#c5221f',marginTop:4}}>최근 청구 실패: {subStatus.lastChargeError}</div>}
              </div>
              <button className="btn-secondary" style={{fontSize:13,padding:'6px 14px',color:'#c5221f',flexShrink:0}} disabled={subCancelBusy} onClick={cancelSubscription}>
                {subCancelBusy ? '처리 중...' : '자동결제 해지'}
              </button>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))',gap:14}}>
            {UPGRADE_PLANS.map(p=>{
              const isCurrent = subStatus?.autoRenew && subStatus.plan === p.key;
              return (
              <div key={p.key} style={{border:isCurrent?'2px solid #1e8e3e':p.recommended?'2px solid #246BEB':'1px solid #e2e8f0',borderRadius:14,padding:'20px 16px',display:'flex',flexDirection:'column',gap:12}}>
                <div style={{fontWeight:800,fontSize:16,color:'#0f172a'}}>{p.name}</div>
                <div><span style={{fontWeight:900,fontSize:22,color:'#0f172a'}}>{p.price}</span><span style={{fontSize:13,color:'#94a3b8',marginLeft:4}}>/{p.unit}</span></div>
                <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:6,flex:1}}>
                  {p.features.map(f=>(
                    <li key={f} style={{fontSize:13,color:'#475467',display:'flex',gap:6,alignItems:'flex-start'}}>
                      <CheckCircle2 size={14} color="#246BEB" style={{flexShrink:0,marginTop:2}}/>{f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div style={{width:'100%',textAlign:'center',fontSize:13,fontWeight:700,color:'#1e8e3e',background:'#e6f4ea',borderRadius:10,padding:'9px 0'}}>자동결제 중</div>
                ) : (
                  // 2026-09-01: 이니시스 정기결제 채널 연동으로 빌링키 발급이 가능해져
                  // startSubscription() 실결제 흐름을 다시 켠다(trial은 결제 없이 startTrial()).
                  // 2026-09-04: trial 카드가 "신청 접수" 토스트만 띄우고 실제로 아무 것도 안
                  // 바꾸던 문제 수정 — POST /billing/start-trial로 실제 30일 체험을 시작한다.
                  <button
                    className="btn-primary"
                    style={{width:'100%'}}
                    disabled={subscribeBusy === p.key || (p.key === 'trial' && !!billing?.trialEndsAt)}
                    onClick={()=> p.key === 'trial' ? startTrial() : startSubscription(p.key, p.name)}
                  >{subscribeBusy === p.key ? '처리 중...' : (p.key === 'trial' && billing?.trialEndsAt) ? '이미 시작됨' : '신청'}</button>
                )}
              </div>
              );
            })}
          </div>
          <p style={{color:'#94a3b8',fontSize:12,margin:'18px 0 0'}}>정액제 세부 조건은 담당 매니저에게 문의해 주세요.</p>
        </>) : (<>
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
                      {p.status==='cancelled' ? <span style={{color:'#94a3b8'}}>환불됨</span>
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
