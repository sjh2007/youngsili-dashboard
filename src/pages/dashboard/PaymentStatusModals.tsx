// DashboardApplication.tsx의 paymentSuccess·virtualAccountInfo(결제 접수완료/무통장입금 안내) 블록을
// 그대로 옮긴 것 — 로직 변경 없음, 부모가 갖고 있던 state를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { CheckCircle2, Database, X } from 'lucide-react';
import { BANK_LABELS, REFUND_REASON_PRESETS, PAY_METHOD_OPTIONS } from '../dashboardConstants';

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
        <div style={{fontSize:12,color:'#94a3b8',marginBottom:18}}>요청 후 담당자 확인을 거쳐 실제 환불·크레딧 회수가 진행됩니다.</div>
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
  const { pendingTopup, setPendingTopup, topupBusy, topupPayMethod, setTopupPayMethod, startTopup } = props;
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
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:22}}>
          {PAY_METHOD_OPTIONS.map(m=>{
            const Icon = m.icon;
            const selected = topupPayMethod===m.key;
            return (
              <button key={m.key} onClick={()=>setTopupPayMethod(m.key)}
                style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,padding:'14px',borderRadius:12,cursor:'pointer',textAlign:'left',
                  border:'2px solid '+(selected?'#246BEB':'#e2e8f0'),background:selected?'#eff6ff':'#fff'}}>
                <Icon size={22} color={selected?'#246BEB':'#64748b'}/>
                <div style={{fontSize:14,fontWeight:800,color:selected?'#246BEB':'#0f172a'}}>{m.label}</div>
                <div style={{fontSize:12,color:'#94a3b8'}}>{m.desc}</div>
              </button>
            );
          })}
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
