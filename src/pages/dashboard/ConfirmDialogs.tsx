// DashboardApplication.tsx의 forceReg·bulkConfirm·callModal(Dialog 기반 확인창 3개) 블록을
// 그대로 옮긴 것 — 로직 변경 없음, 부모가 갖고 있던 state를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
import { Button, Dialog } from '../../components/ui';

export function ForceRegDialog(props: any) {
  const { setForceReg, fetchElders, confirmForceReg } = props;
  return (
    <Dialog open alert tone="danger" className="modal--confirm" title="이미 다른 기관에 등록된 어르신입니다"
      description="같은 전화번호가 다른 기관에 등록되어 있습니다. 그래도 등록하면 이 어르신은 우리 기관 소속으로 이관되며, 기존 기관에서는 더 이상 보이지 않게 됩니다."
      onClose={()=>{ setForceReg(null); fetchElders(); }} actions={<>
      <button className="btn-secondary" onClick={()=>{ setForceReg(null); fetchElders(); }}>취소</button>
      <button className="btn-primary" onClick={confirmForceReg}>그래도 등록</button>
    </>} />
  );
}

export function BulkConfirmDialog(props: any) {
  const {
    bulkConfirm, setBulkConfirm, startBulkCall, batchSize, batchIntervalSec, alertIncludeCare,
    setAlertIncludeCare, activeAlert, wildfireStage,
  } = props;
  return (
    <Dialog open title={`${bulkConfirm.count}명에게 지금 전화를 발신합니다`} alert tone={bulkConfirm.isAlert?'danger':'default'} className="modal--confirm" onClose={()=>setBulkConfirm(null)} actions={<>
          <Button onClick={()=>setBulkConfirm(null)}>취소</Button>
          <Button variant="primary" onClick={()=>{ const q = bulkConfirm.queue; const ch = bulkConfirm.channel || 'app'; const wa = !!bulkConfirm.isAlert; setBulkConfirm(null); startBulkCall(q, ch, wa); }}>발신 시작</Button>
        </>}>
        <div className="confirm-facts">
          <div className="confirm-row"><span>대상</span><b>{bulkConfirm.count}명</b></div>
          <div className="confirm-row"><span>내용</span><b>{bulkConfirm.alertLabel || '일반 안부 통화'}</b></div>
          {bulkConfirm.count > batchSize && (
            <div className="confirm-row"><span>발신 방식</span><b>
              {bulkConfirm.channel === 'pstn'
                ? `${batchSize}명씩 동시 발신, 배치 간 ${batchIntervalSec}초 대기`
                : `${batchSize}명씩 ${batchIntervalSec}초 간격`}
            </b></div>
          )}
        </div>
        {/* 경보 통화만 선택지가 생긴다 — 경보만 전할지, 안부 질문까지 이어갈지 */}
        {bulkConfirm.isAlert && (
          <div style={{marginTop:14,padding:'12px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10}}>
            <div style={{fontSize:16,fontWeight:700,color:'#334155',marginBottom:8}}>통화 내용 선택</div>
            {[
              { v:false, t:'경보 멘트만',        d:'경보를 전하고 이해하셨는지 확인한 뒤 끊습니다. (약 3분)' },
              { v:true,  t:'경보 + 안부 질문',   d:'경보를 먼저 전하고, 이어서 평소 안부 질문까지 여쭙니다. (약 5분)' },
            ].map(o => (
              <label key={String(o.v)} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'8px 4px',cursor:'pointer'}}>
                <input type="radio" name="alertFlow" checked={alertIncludeCare===o.v} onChange={()=>setAlertIncludeCare(o.v)} style={{marginTop:3}} />
                <span>
                  <span style={{fontSize:17,fontWeight:600,color:'#1f2937'}}>{o.t}</span>
                  <span style={{display:'block',fontSize:15,color:'#64748b',marginTop:2}}>{o.d}</span>
                </span>
              </label>
            ))}
            {activeAlert==='wildfire' && wildfireStage==='evacuate' && alertIncludeCare && (
              <div style={{fontSize:15,color:'#b45309',marginTop:6,lineHeight:1.5}}>
                긴급 대피 단계에서는 어르신이 빨리 움직이셔야 해서 <b>안부 질문을 생략</b>하고 경보만 안내합니다.
              </div>
            )}
          </div>
        )}
        <div className={`confirm-warn ${bulkConfirm.isAlert ? 'is-alert' : ''}`}>
          {bulkConfirm.isAlert
            ? '경보 멘트는 어르신에게 대피·안전 행동을 안내합니다. 대상과 단계를 반드시 확인해 주세요.'
            : bulkConfirm.channel === 'pstn'
              ? '발신하면 어르신 전화로 실제 전화가 걸립니다. 시작 후에는 남은 발신만 중단할 수 있습니다.'
              : '발신하면 어르신 휴대폰에 실제로 수신 알림이 갑니다. 시작 후에는 남은 발신만 중단할 수 있습니다.'}
        </div>
      </Dialog>
  );
}

export function CallModalDialog(props: any) {
  const { callModal, setCallModal, makeCall } = props;
  return (
    <Dialog open title={<>{callModal.name} 어르신 앱으로<br/>수신 알림을 보내시겠습니까?</>} description="영실이 앱 → 수신화면 표시 → 받기 클릭 → AI 영실이 대화" onClose={()=>setCallModal(null)} actions={<>
          <Button onClick={()=>setCallModal(null)}>취소</Button>
          <Button variant="call" onClick={()=>makeCall(callModal)}>앱으로 알림 보내기</Button>
        </>} />
  );
}
