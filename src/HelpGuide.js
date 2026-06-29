// 복지사용 사용 설명서 (대시보드 내 '도움말' 페이지)
// ⚠️ 업데이트 소식을 추가하면 ANNOUNCEMENTS 맨 앞에 {id 증가, ...} 추가 →
//    App.js의 LATEST_NOTICE도 같은 id로 올리면 메뉴에 🔴 배지가 뜬다.
export const LATEST_NOTICE = 3;

const ANNOUNCEMENTS = [
  { id: 3, date: '2026-06-29', tag: '신규', text: '기관코드 등록 방식이 추가됐어요. 어르신 폰 앱에서 기관코드를 입력해 바로 등록 신청할 수 있습니다.' },
  { id: 2, date: '2026-06-29', tag: '개선', text: '"마지막 통화" 시각이 실제 통화 기준으로 정확히 표시되도록 개선했어요.' },
  { id: 1, date: '2026-06-29', tag: '개선', text: '대시보드 속도·안정성을 개선했습니다.' },
];

// ── 작은 UI 조각 (목업용) ──
const Phone = ({ title, children }) => (
  <div style={{ width: 240, border: '8px solid #1e293b', borderRadius: 28, background: '#fff', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', flexShrink: 0 }}>
    <div style={{ background: '#1e3a6e', color: '#fff', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>{title}</div>
    <div style={{ padding: 14 }}>{children}</div>
  </div>
);
const Field = ({ label, value, highlight }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
    <div style={{ border: highlight ? '2px solid #f59e0b' : '1px solid #cbd5e1', background: highlight ? '#fffbeb' : '#f8fafc', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontWeight: highlight ? 800 : 500, color: highlight ? '#b45309' : '#334155', letterSpacing: highlight ? 1 : 0 }}>{value}</div>
  </div>
);
const Btn = ({ color, children }) => (
  <div style={{ background: color, color: '#fff', borderRadius: 10, padding: '11px 0', textAlign: 'center', fontWeight: 800, fontSize: 14, marginTop: 6 }}>{children}</div>
);
const Step = ({ n }) => (
  <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 13, background: '#2563eb', color: '#fff', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, marginRight: 8, flexShrink: 0 }}>{n}</span>
);
const Card = ({ children, style }) => (
  <div className="section" style={{ marginBottom: 16, ...style }}>{children}</div>
);
const H = ({ children }) => <div className="section-title" style={{ fontSize: 18 }}>{children}</div>;

export default function HelpGuide({ orgCode }) {
  const code = orgCode || 'YS-0001';
  return (
    <div className="fade-in" style={{ maxWidth: 960, lineHeight: 1.6 }}>
      {/* 표지 */}
      <Card style={{ background: 'linear-gradient(135deg,#1e3a6e,#2563eb)', color: '#fff' }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>📖 영실이 사용 설명서</div>
        <div style={{ fontSize: 14, opacity: 0.92 }}>복지사 선생님을 위한 안내서 · AI 영실이가 어르신께 매일 안부 전화를 드리고, 위험 신호를 선생님께 알려드립니다.</div>
      </Card>

      {/* 업데이트 소식 */}
      <Card style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <H>📢 업데이트 소식</H>
        {ANNOUNCEMENTS.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #dbeafe' }}>
            <span style={{ background: a.tag === '신규' ? '#16a34a' : '#2563eb', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{a.tag}</span>
            <div><span style={{ color: '#64748b', fontSize: 12, marginRight: 8 }}>{a.date}</span>{a.text}</div>
          </div>
        ))}
      </Card>

      {/* 빠른 시작 */}
      <Card>
        <H>🚀 빠른 시작 (3단계)</H>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { n: 1, t: '로그인', d: '발급받은 기관 계정(이메일·비밀번호)으로 대시보드에 로그인합니다.' },
            { n: 2, t: '어르신 등록', d: '담당 어르신을 등록합니다. (대시보드에서 직접 또는 어르신 폰 앱에서)' },
            { n: 3, t: '매일 확인', d: '통화 기록·건강 상태·위험 알림을 확인하고, 필요하면 전화를 보냅니다.' },
          ].map(s => (
            <div key={s.n} style={{ flex: '1 1 240px', background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><Step n={s.n} /><b style={{ fontSize: 15 }}>{s.t}</b></div>
              <div style={{ fontSize: 13, color: '#475569' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 메뉴 안내 */}
      <Card>
        <H>🖥️ 대시보드 메뉴 안내</H>
        <table className="table">
          <tbody>
            {[
              ['⊞ 대시보드', '전체 현황 한눈에 — 담당 어르신 수, 오늘 통화, 위험 알림'],
              ['👥 어르신 관리', '어르신 등록·수정, 상세 정보, 즉시 전화'],
              ['📅 전화 발신 관리', '여러 어르신에게 한 번에 앱 알림 발신 (받음/부재중 확인)'],
              ['✍️ 전화 멘트 관리', '영실이가 전화할 때 하는 말(인사·안부) 설정'],
              ['📞 통화 기록', '실제 통화 내용·시간·위험도 기록'],
              ['💊 건강 상태', '어르신이 앱에서 체크한 건강 상태·위험 알림'],
              ['📊 리포트 / 통계', '기간별 통화·위험 키워드 통계'],
              ['🗺️ 공공데이터 현황', '지역별 독거노인 현황'],
            ].map(([m, d]) => (
              <tr key={m}><td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{m}</td><td style={{ color: '#475569', fontSize: 14 }}>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 어르신 등록 — 방법 A */}
      <Card>
        <H>👵 어르신 등록하기 — 방법 A. 대시보드에서 직접</H>
        <div style={{ fontSize: 14, color: '#334155' }}>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={1} /> 좌측 <b>👥 어르신 관리</b> → 우측 상단 <b>+ 신규 등록</b> 클릭</p>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={2} /> <b>🔍 주소 검색</b>으로 주소를 고르고(관할 구역 자동 입력), 이름·나이·전화번호 등 입력</p>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={3} /> 보호자 정보·전화 시간 설정 후 <b>등록 완료</b> → <b>6자리 인증코드</b>가 발급됩니다</p>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={4} /> 어르신 폰 앱 설정에 <b>전화번호 + 인증코드</b>를 입력하면 연결됩니다</p>
        </div>
      </Card>

      {/* 어르신 등록 — 방법 B (기관코드, 핵심 목업) */}
      <Card style={{ border: '2px solid #16a34a' }}>
        <H>📱 어르신 등록하기 — 방법 B. 어르신 폰 앱에서 (기관코드)</H>
        <div style={{ fontSize: 14, color: '#334155', marginBottom: 14 }}>
          현장에서 어르신 폰에 바로 등록 신청하는 방법입니다. 선생님 기관코드는 <b style={{ color: '#b45309', background: '#fffbeb', padding: '2px 8px', borderRadius: 6, letterSpacing: 1 }}>{code}</b> 입니다. (대시보드 <b>🏢 기관 관리</b>에서 확인)
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 1 */}
          <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}><Step n={1} />앱 설정에서 기관코드 입력</div>
            <Phone title="⚙️ 설정">
              <Field label="🏢 기관코드 (복지관에서 받은)" value={code} highlight />
              <Field label="본인 전화번호" value="010-0000-0000" />
            </Phone>
          </div>
          {/* 2 */}
          <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}><Step n={2} />어르신 정보 입력 → 등록 신청</div>
            <Phone title="⚙️ 설정">
              <Field label="이름" value="김영실" />
              <Field label="보호자 연락처" value="010-1234-5678" />
              <Btn color="#16a34a">📝 등록 신청 (관리자 승인)</Btn>
            </Phone>
          </div>
          {/* 3 */}
          <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}><Step n={3} />대시보드에서 승인</div>
            <div style={{ width: 240, border: '1px solid #e2e8f0', borderRadius: 14, background: '#fff', padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309', marginBottom: 8 }}>🔔 승인 대기 (1명)</div>
              <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>김영실</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>방금 신청 · {code}</div>
                <Btn color="#2563eb">✅ 승인 · 활성화</Btn>
              </div>
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 10, fontWeight: 700 }}>승인하면 어르신 앱이 자동으로 켜집니다 ✓</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: '#475569', background: '#f0fdf4', borderRadius: 10, padding: '10px 14px' }}>
          💡 <b>요약</b>: 앱에 <b>기관코드({code})</b> → 어르신 정보 → <b>등록 신청</b> → 대시보드 <b>어르신 관리</b>의 <b>승인 대기</b>에서 <b>승인</b> → 끝! 인증코드 없이 바로 연결됩니다.
        </div>
      </Card>

      {/* 앱 설치 */}
      <Card>
        <H>📲 어르신 폰에 앱 설치하기</H>
        <div style={{ fontSize: 14, color: '#334155' }}>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={1} /> 어르신 폰에서 <b>구글 플레이스토어</b>를 엽니다</p>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={2} /> <b>"AI 영실이"</b>를 검색해 설치합니다 (또는 받은 설치 링크)</p>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={3} /> 처음 실행 시 <b>마이크·알림 권한을 모두 허용</b>합니다 (전화를 받기 위해 꼭 필요)</p>
          <p style={{ margin: '6px 0', display: 'flex' }}><Step n={4} /> 설정에서 위 <b>방법 B</b>(기관코드) 또는 <b>방법 A</b>(인증코드)로 등록합니다</p>
        </div>
      </Card>

      {/* 위험 알림 */}
      <Card>
        <H>🚨 위험 알림 대응</H>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>🔴 긴급</div>
            <div style={{ fontSize: 13, color: '#475569' }}>"가슴이 아파·쓰러·119" 등 감지. <b>즉시 어르신·보호자에게 연락</b>하거나 방문하세요. (119 자동 발신 설정 가능)</div>
          </div>
          <div style={{ flex: '1 1 280px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 800, color: '#b45309', marginBottom: 4 }}>🟡 주의</div>
            <div style={{ fontSize: 13, color: '#475569' }}>"어지러워·기운이 없어" 등 감지. 통화 기록을 확인하고 <b>안부 전화</b>로 상태를 살펴주세요.</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 10 }}>※ 위험 알림은 <b>대시보드 홈</b> 상단과 <b>💊 건강 상태</b> 메뉴에서 확인할 수 있습니다.</div>
      </Card>

      {/* FAQ */}
      <Card>
        <H>❓ 자주 묻는 질문</H>
        {[
          ['어르신이 전화를 안 받으면요?', '받지 않으면 "부재중"으로 표시됩니다. 전화 발신 관리에서 부재중인 어르신만 골라 다시 보낼 수 있습니다.'],
          ['로그인하면 다른 복지관 어르신도 보이나요?', '아니요. 본인 기관의 어르신만 보입니다. 기관별로 완전히 분리되어 있습니다.'],
          ['기관코드는 어디서 확인하나요?', '운영자에게 받은 코드입니다. (운영자는 대시보드 🏢 기관 관리에서 발급·확인)'],
          ['화면이 이상하거나 안 보일 때?', '브라우저에서 Ctrl+Shift+R(새로고침)을 한 번 눌러 최신 화면을 받아주세요.'],
        ].map(([q, a]) => (
          <div key={q} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 700, color: '#1e3a6e' }}>Q. {q}</div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>A. {a}</div>
          </div>
        ))}
      </Card>

      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '8px 0 24px' }}>
        문의: 운영자 / AI 영실이 고객지원 · 이 설명서는 대시보드에서 항상 다시 볼 수 있습니다.
      </div>
    </div>
  );
}
