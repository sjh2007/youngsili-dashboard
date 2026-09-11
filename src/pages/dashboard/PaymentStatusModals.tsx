// DashboardApplication.tsx의 paymentSuccess·virtualAccountInfo(결제 접수완료/무통장입금 안내) 블록을
// 그대로 옮긴 것 — 로직 변경 없음, 부모가 갖고 있던 state를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { CheckCircle2, CreditCard, Database, X } from 'lucide-react';
import { BANK_LABELS, REFUND_REASON_PRESETS } from '../dashboardConstants';

export function PaymentSuccessModal(props: any) {
  const { paymentSuccess, setPaymentSuccess } = props;
  return (
    <div className="modal-overlay" onClick={()=>setPaymentSuccess(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:380,width:'92%',textAlign:'center',padding:'36px 28px'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:'#ecfdf5',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
          <CheckCircle2 size={30} color="#16a34a"/>
        </div>
        <div style={{fontWeight:800,fontSize:18,color:'#0f172a',marginBottom:8}}>결제가 접수됐습니다</div>
        <div style={{fontSize:15,color:'#64748b',lineHeight:1.6,marginBottom:24}}>
          {paymentSuccess.desc}<br/>
          결제 확인 후 반영됩니다.
        </div>
        <button className="btn-primary" style={{width:'100%'}} onClick={()=>setPaymentSuccess(null)}>확인</button>
      </div>
    </div>
  );
}

export function VirtualAccountInfoModal(props: any) {
  const { virtualAccountInfo, setVirtualAccountInfo } = props;
  return (
    <div className="modal-overlay" onClick={()=>setVirtualAccountInfo(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400,width:'92%',textAlign:'center',padding:'36px 28px'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
          <Database size={26} color="#246BEB"/>
        </div>
        <div style={{fontWeight:800,fontSize:18,color:'#0f172a',marginBottom:16}}>입금 계좌가 발급됐습니다</div>
        <div style={{background:'#f8fafc',borderRadius:12,padding:'16px 18px',textAlign:'left',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:13,color:'#64748b'}}>은행</span>
            <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{BANK_LABELS[virtualAccountInfo.bank] || virtualAccountInfo.bank || '-'}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:13,color:'#64748b'}}>계좌번호</span>
            <span style={{fontSize:15,fontWeight:800,color:'#0f172a',fontFamily:'monospace'}}>{virtualAccountInfo.accountNumber}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:13,color:'#64748b'}}>예금주</span>
            <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{virtualAccountInfo.remitteeName || 'AI영실이'}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:13,color:'#64748b'}}>입금액</span>
            <span style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{virtualAccountInfo.amount?.toLocaleString()}원</span>
          </div>
          {virtualAccountInfo.expiredAt && (
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:13,color:'#64748b'}}>입금 기한</span>
              <span style={{fontSize:14,fontWeight:700,color:'#c5221f'}}>{new Date(virtualAccountInfo.expiredAt).toLocaleString('ko-KR')}</span>
            </div>
          )}
        </div>
        <div style={{fontSize:13,color:'#64748b',marginBottom:20,lineHeight:1.6}}>
          위 계좌로 입금하시면 확인 후 자동으로 크레딧에 반영됩니다.
        </div>
        <button className="btn-primary" style={{width:'100%'}} onClick={()=>setVirtualAccountInfo(null)}>확인</button>
      </div>
    </div>
  );
}

export function RefundRequestModal(props: any) {
  const {
    refundTarget, setRefundTarget, refundRequestBusy, refundReasonPreset, setRefundReasonPreset,
    refundReasonCustom, setRefundReasonCustom, submitRefundRequest,
  } = props;
  return (
    <div className="modal-overlay" onClick={()=>!refundRequestBusy && setRefundTarget(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420,width:'92%'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
          <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>환불 요청</div>
          <button onClick={()=>setRefundTarget(null)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
        </div>
        <div style={{fontSize:14,color:'#64748b',marginBottom:18}}>
          <b style={{color:'#0f172a',fontSize:20,fontWeight:900}}>{refundTarget.amount.toLocaleString()}원</b> 결제 건 환불 요청
        </div>
        <div style={{fontSize:13,fontWeight:700,color:'#475467',marginBottom:8}}>환불 사유</div>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
          {REFUND_REASON_PRESETS.map(reason=>(
            <button key={reason} onClick={()=>setRefundReasonPreset(reason)}
              style={{textAlign:'left',padding:'10px 14px',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:refundReasonPreset===reason?700:500,
                border:'2px solid '+(refundReasonPreset===reason?'#246BEB':'#e2e8f0'),background:refundReasonPreset===reason?'#eff6ff':'#fff',color:refundReasonPreset===reason?'#246BEB':'#0f172a'}}
            >{reason}</button>
          ))}
        </div>
        {refundReasonPreset==='직접 입력' && (
          <textarea className="form-input" style={{width:'100%',minHeight:70,marginBottom:14,boxSizing:'border-box'}} placeholder="환불 사유를 입력해 주세요"
            value={refundReasonCustom} onChange={e=>setRefundReasonCustom(e.target.value)} />
        )}
        <div style={{fontSize:12,color:'#94a3b8',marginBottom:18}}>요청 후 담당자가 미사용 유상 크레딧을 확인해 원 결제 카드로 환불합니다. 승인된 환불은 3영업일 이내 카드 승인 취소를 요청합니다.</div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <button className="btn-primary" style={{width:'100%'}} disabled={refundRequestBusy} onClick={submitRefundRequest}>
            {refundRequestBusy ? '요청 중...' : '환불 요청 보내기'}
          </button>
          <button style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:14,fontWeight:600,padding:4}} disabled={refundRequestBusy} onClick={()=>setRefundTarget(null)}>취소</button>
        </div>
      </div>
    </div>
  );
}

export function TopupMethodModal(props: any) {
  const { pendingTopup, setPendingTopup, topupBusy, startTopup } = props;
  return (
    <div className="modal-overlay" onClick={()=>!topupBusy && setPendingTopup(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420,width:'92%'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
          <div className="modal-title" style={{textAlign:'left',marginBottom:0}}>결제 수단 선택</div>
          <button onClick={()=>setPendingTopup(null)} style={{background:'none',border:0,cursor:'pointer',color:'#94a3b8',padding:4}}><X size={20}/></button>
        </div>
        <div style={{fontSize:14,color:'#64748b',marginBottom:18}}>
          <b style={{color:'#0f172a',fontSize:20,fontWeight:900}}>{pendingTopup.amount.toLocaleString()}원</b> 충전
        </div>
        <p style={{fontSize:13,color:'#475569'}}>이번 결제는 크레딧 충전 금액입니다. (월 기본요금 {({300000:21000,500000:35000,1000000:70000} as Record<number, number>)[pendingTopup.amount]?.toLocaleString()}원 별도 · 부가세 포함)</p>
        <p style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>계좌이체·가상계좌·간편결제·할부는 지원하지 않습니다. 환불은 충전할 때 사용한 원 결제 카드로만 처리됩니다.</p>
        {/* 2026-09-10: 이니시스 입점조건으로 카드 단건만 남아 선택할 것이 없어졌다.
            버튼 하나짜리 선택지를 두는 대신 무엇으로 결제되는지 알려준다. */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderRadius:12,
          border:'1px solid #e2e8f0',background:'#f8fafc',marginBottom:18}}>
          <CreditCard size={20} color="#246BEB"/>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>신용·체크카드</div>
            <div style={{fontSize:12,color:'#94a3b8'}}>일시불로 결제됩니다</div>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <button className="btn-primary" style={{width:'100%'}} disabled={topupBusy} onClick={async ()=>{ const amt = pendingTopup.amount; await startTopup(amt); setPendingTopup(null); }}>
            {topupBusy ? '처리 중...' : '결제하기'}
          </button>
          <button
            style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:14,fontWeight:600,padding:4}}
            disabled={topupBusy}
            onClick={()=>setPendingTopup(null)}
          >취소</button>
        </div>
      </div>
    </div>
  );
}
