import React from 'react';

export default function InsufficientCreditDialog({ balance, onClose, onTopup, onRefresh }: {
  balance: number | null; onClose: () => void; onTopup: () => void; onRefresh: () => void;
}) {
  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="credit-call-title" onClick={event => event.stopPropagation()} style={{maxWidth:440}}>
      <h2 id="credit-call-title">전화 발신을 위한 충전 잔액이 없습니다</h2>
      <p>로그인과 기록 조회는 계속 이용할 수 있습니다. 충전 잔액이 반영된 후 발신 대상을 확인하고 다시 전화해 주세요.</p>
      <p>현재 잔액: <strong>{balance === null ? '확인 중' : `${balance.toLocaleString()}원`}</strong></p>
      <p style={{color:'#64748b'}}>대기 중인 추가 발신은 중단됩니다. 이미 접수된 통화는 계속 진행되며, 충전 후 자동 재발신하지 않습니다.</p>
      <div className="modal-actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn-secondary" onClick={onClose}>닫기</button>
        <button className="btn-secondary" onClick={onRefresh}>잔액 새로고침</button>
        <button className="btn-primary" onClick={onTopup}>충전하기</button>
      </div>
    </div>
  </div>;
}
