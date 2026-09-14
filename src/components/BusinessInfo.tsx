export function BusinessInfo() {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: '1px solid #e2e8f0',
        fontSize: 11,
        lineHeight: 1.7,
        color: '#94a3b8',
        textAlign: 'center',
      }}
    >
      <div>
        <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>
          개인정보처리방침
        </a>
        <span style={{ margin: '0 6px', color: '#cbd5e1' }}>·</span>
        <a href="/refund-policy.html" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>
          결제·환불규정
        </a>
      </div>
      {/* 2026-09-10: KG이니시스 포인트충전 입점조건 — 민원책임 고지를 사이트 하단에 명시해야
          심사를 통과한다. 문구는 이니시스가 지정한 표현을 그대로 쓴다(임의로 다듬으면 재심사 사유). */}
      <div
        style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0',
          color: '#64748b', fontWeight: 600,
        }}
      >
        모든 거래에 대한 책임과 환불, 민원 등은 (주)크래프트에서 진행합니다.
        <br />
        민원담당자 신주환 · 1877-1979 · kraft@krafte.net
      </div>
    </div>
  );
}
