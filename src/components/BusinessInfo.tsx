/**
 * 사업자 정보 표기 (2026-09-09).
 *
 * 전자상거래법 제10조는 통신판매업자가 사이버몰 초기화면에 상호·대표자·주소·전화번호·
 * 전자우편주소·사업자등록번호 등을 표시하도록 한다. 이 대시보드는 기관 전용 도구지만
 * 크레딧 충전(결제) 기능이 있어 표시 대상으로 본다 — 로그인 화면(초기화면)에 둔다.
 *
 * ⚠️ 통신판매업 신고번호는 아직 미발급이라 빠져 있다. 발급되면 아래 배열에 한 줄 추가할 것.
 */
const ITEMS: [string, string][] = [
  ['상호', '(주)크래프트'],
  ['대표자', '신주환'],
  ['사업자등록번호', '884-81-02216'],
  ['대표전화', '1877-1979'],
];

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
      {/* 좁은 화면에서 항목이 단어 중간에 끊기지 않도록 각 항목을 통째로 유지한다 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2px 10px' }}>
        {ITEMS.map(([k, v]) => (
          <span key={k} style={{ whiteSpace: 'nowrap' }}>
            {k} {v}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 2 }}>
        대구광역시 동구 동대구로 465, 스케일업허브 712호 (41585)
      </div>
      <div style={{ marginTop: 2 }}>
        <a href="mailto:kraft@krafte.net" style={{ color: '#94a3b8' }}>
          kraft@krafte.net
        </a>
        <span style={{ margin: '0 6px', color: '#cbd5e1' }}>·</span>
        <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>
          개인정보처리방침
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
      <div style={{ marginTop: 8 }}>© 2026 (주)크래프트 · AI 영실이</div>
    </div>
  );
}
