// 복지사용 도움말 센터 (대시보드 '도움말 보기' 페이지) — 검색 가능
// ⚙️ 계속 업데이트: 아래 HELP_ITEMS 배열에 항목을 추가/수정하면 바로 반영됩니다.
//    업데이트 소식을 추가하면 ANNOUNCEMENTS 맨 앞에 넣고 App.js의 LATEST_NOTICE도 같은 id로 올리세요.
import { useState, useMemo } from 'react';

export const LATEST_NOTICE = 4;

const SETUP_GUIDE_URL = 'https://www.krafte.net/youngsili-setup-guide.html';  // 그림 설치 매뉴얼(별도 배포)

const ANNOUNCEMENTS = [
  { id: 4, date: '2026-07-01', tag: '신규', text: '앱 설치·등록 그림 매뉴얼과 도움말 검색이 추가됐어요. 키워드로 빠르게 찾아보세요.' },
  { id: 3, date: '2026-06-29', tag: '신규', text: '기관코드 등록 방식이 추가됐어요. 어르신 폰 앱에 기관코드를 입력해 바로 등록 신청할 수 있습니다.' },
  { id: 2, date: '2026-06-29', tag: '개선', text: '"마지막 통화" 시각이 실제 통화 기준으로 정확히 표시되도록 개선했어요.' },
  { id: 1, date: '2026-06-29', tag: '개선', text: '대시보드 속도·안정성을 개선했습니다.' },
];

// 도움말 항목 (검색 대상: 제목 q + 키워드 kw + 본문 a)
const HELP_ITEMS = [
  // 시작하기
  { cat: '시작하기', q: '처음 시작하는 3단계', kw: '시작 로그인 등록 확인 quickstart', a: '① 발급받은 기관 계정으로 로그인 → ② 담당 어르신 등록(대시보드에서 직접 또는 어르신 폰 앱) → ③ 통화·건강·위험 알림을 매일 확인하고 필요하면 전화를 보냅니다.' },
  { cat: '시작하기', q: '대시보드 메뉴가 각각 무슨 역할인가요?', kw: '메뉴 대시보드 어르신관리 전화발신 통화기록 건강 리포트 공공데이터', a: '대시보드=전체 현황 / 어르신 관리=등록·수정·즉시전화 / 전화 발신 관리=여러 명 한번에 앱 알림 / 전화 멘트 관리=영실이 인사말 / 통화 기록=통화 내용·위험도 / 건강 상태=앱 건강체크·알림 / 리포트=통계 / 공공데이터=지역 현황.' },

  // 앱 설치·등록 (setup guide 요약)
  { cat: '앱 설치·등록', q: '영실이 앱 설치하기', kw: '설치 다운로드 플레이스토어 play store apk', a: '어르신 폰에서 Play 스토어를 열고 "영실이"를 검색해 설치합니다. (출시 전이면 받은 테스트 링크/APK로 설치)' },
  { cat: '앱 설치·등록', q: '권한 허용 (마이크·알림·배터리)', kw: '권한 허용 마이크 알림 배터리 최적화 절전', a: '앱 첫 실행 시 마이크·알림을 모두 허용하고, 배터리 최적화 제외를 설정하세요. 특히 배터리 최적화 제외가 안 되면 절전 상태에서 전화가 안 올 수 있어요.' },
  { cat: '앱 설치·등록', q: '기관코드 입력하는 법', kw: '기관코드 YS 코드 입력', a: '앱 설정 맨 위 🏢 기관코드 칸에 복지관에서 받은 코드를 넣습니다. "YS-" 뒤 부분(예: 0001)만 입력하면 됩니다. 코드가 맞아야 우리 기관 승인 대기에 정확히 뜹니다.' },
  { cat: '앱 설치·등록', q: '어르신 정보 입력 후 등록 신청', kw: '등록 신청 이름 호칭 보호자 복지사 응급 119', a: '기관코드 아래로 내려가며 본인 전화번호·이름·호칭·보호자·복지사·응급(119) 정보를 채운 뒤, 맨 아래 초록색 "📝 등록 신청 (관리자 승인)" 버튼을 누릅니다.' },
  { cat: '앱 설치·등록', q: '대시보드에서 승인하기', kw: '승인 대기 활성화 승인버튼', a: '복지사 대시보드 → 어르신 관리 → "승인 대기"에서 해당 어르신의 승인 버튼을 누르면 활성화됩니다. 앱은 약 7초 간격으로 승인을 확인해 자동으로 켜집니다.' },

  // 대시보드 사용
  { cat: '대시보드 사용', q: '어르신을 대시보드에서 직접 등록하려면?', kw: '신규 등록 주소검색 등록', a: '어르신 관리 → 우측 상단 "+ 신규 등록" → 주소 검색으로 주소 선택 후 정보 입력 → 등록 완료.' },
  { cat: '대시보드 사용', q: '기관코드는 어디서 확인하나요?', kw: '기관코드 위치 확인 복사', a: '① 화면 좌측 하단(기관명 아래)에 항상 표시됩니다. ② 어르신 관리 화면 상단 "앱으로 어르신 등록하기" 안내에도 크게 표시되고, 클릭하면 복사됩니다.' },
  { cat: '대시보드 사용', q: '여러 어르신에게 한 번에 전화하려면?', kw: '일괄 발신 전체 앱알림 배치', a: '전화 발신 관리 → 대상 선택 → "앱 알림 발신". 받음/부재중이 표시되고, 부재중인 분만 골라 다시 보낼 수 있습니다.' },

  // 위험·건강
  { cat: '위험·건강 알림', q: '위험 알림(긴급/주의) 대응', kw: '위험 긴급 주의 알림 키워드 119', a: '🔴 긴급("가슴이 아파·쓰러·119" 등): 즉시 어르신·보호자에게 연락하거나 방문. 🟡 주의("어지러워" 등): 통화 기록 확인 후 안부 전화. 위험 알림은 대시보드 홈 상단과 건강 상태 메뉴에서 확인합니다.' },
  { cat: '위험·건강 알림', q: '건강 상태는 어떻게 확인하나요?', kw: '건강 상태 건강체크 좋아요 안좋아요', a: '어르신이 앱에서 체크한 건강 상태가 건강 상태 메뉴에 표시되고, "안 좋아요"는 알림으로 옵니다.' },

  // 계정·기관
  { cat: '계정·기관', q: '로그인하면 다른 복지관 어르신도 보이나요?', kw: '기관 격리 분리 다른기관 보안', a: '아니요. 본인 기관의 어르신만 보입니다. 기관별로 완전히 분리되어 있습니다.' },
  { cat: '계정·기관', q: '회원가입은 어떻게 하나요?', kw: '회원가입 가입 이메일 인증 계정', a: '홈페이지 로그인 화면에서 회원가입 → 이메일 인증 후 바로 사용할 수 있습니다. 가입 즉시 본인 기관 대시보드가 생성됩니다(어르신 0명 상태).' },
  { cat: '계정·기관', q: '이메일 인증을 아직 못했어요', kw: '이메일 인증 메일 재발송 인증필요', a: '가입 후에도 대시보드는 바로 사용 가능합니다. 상단 배너의 "인증 메일 재발송"으로 다시 받고, 메일(스팸함 포함)의 링크를 클릭한 뒤 "인증 완료 → 새로고침"을 누르면 배너가 사라집니다.' },

  // 문제해결
  { cat: '문제해결', q: '영실이 전화가 오지 않아요', kw: '전화 안옴 수신 안됨 권한 배터리', a: '대부분 권한 문제입니다. 폰 설정에서 ① 영실이 알림이 켜져 있는지, ② 배터리 최적화 제외(제한 없음)가 설정돼 있는지 확인하세요(삼성 등 절전 강한 기종 주의).' },
  { cat: '문제해결', q: '승인 대기에 어르신이 안 떠요', kw: '승인대기 안뜸 기관코드 등록신청', a: '① 앱 기관코드가 우리 복지관 코드와 정확히 일치하는지, ② 정보 입력 후 "등록 신청" 버튼을 눌렀는지 확인하세요. 코드가 다르면 다른 기관으로 신청됩니다.' },
  { cat: '문제해결', q: '화면이 이상하거나 안 보일 때', kw: '흰화면 새로고침 캐시 오류', a: '브라우저에서 Ctrl+Shift+R(새로고침)을 한 번 눌러 최신 화면을 받아주세요.' },
];

const CATS = ['시작하기', '앱 설치·등록', '대시보드 사용', '위험·건강 알림', '계정·기관', '문제해결'];

const Card = ({ children, style }) => <div className="section" style={{ marginBottom: 16, ...style }}>{children}</div>;

export default function HelpGuide() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return HELP_ITEMS;
    return HELP_ITEMS.filter(it => (it.q + ' ' + it.kw + ' ' + it.a).toLowerCase().includes(q));
  }, [q]);

  const Item = ({ it, i }) => {
    const key = it.cat + i + it.q;
    const isOpen = !!open[key] || !!q;   // 검색 중엔 펼쳐서 보여줌
    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
        <div onClick={() => setOpen(o => ({ ...o, [key]: !isOpen }))} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#1e3a6e' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{it.cat}</span>
          <span style={{ flex: 1 }}>{it.q}</span>
          <span style={{ color: '#2563eb', fontSize: 18 }}>{isOpen ? '−' : '+'}</span>
        </div>
        {isOpen && <div style={{ padding: '0 14px 14px', color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{it.a}</div>}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900, lineHeight: 1.6 }}>
      {/* 표지 */}
      <Card style={{ background: 'linear-gradient(135deg,#1e3a6e,#2563eb)', color: '#fff' }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📖 도움말 보기</div>
        <div style={{ fontSize: 14, opacity: 0.92 }}>궁금한 내용을 검색하거나 아래 항목에서 찾아보세요. 계속 업데이트됩니다.</div>
      </Card>

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#94a3b8' }}>🔍</span>
        <input
          className="form-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="도움말 검색 (예: 전화 안옴, 기관코드, 승인, 권한…)"
          style={{ width: '100%', padding: '14px 16px 14px 44px', fontSize: 15, borderRadius: 12 }}
        />
        {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>✕</button>}
      </div>

      {/* 앱 설치 상세 매뉴얼 링크 */}
      <a href={SETUP_GUIDE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>📱</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#1e3a6e' }}>앱 설치·등록 상세 안내 (그림 매뉴얼)</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>어르신 폰 앱 설치부터 기관코드·등록 신청·승인까지 그림으로 단계별 안내</div>
          </div>
          <span style={{ color: '#2563eb', fontWeight: 800 }}>열기 →</span>
        </div>
      </a>

      {/* 업데이트 소식 (검색 중엔 숨김) */}
      {!q && (
        <Card style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="section-title" style={{ fontSize: 16 }}>📢 업데이트 소식</div>
          {ANNOUNCEMENTS.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
              <span style={{ background: a.tag === '신규' ? '#16a34a' : '#2563eb', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{a.tag}</span>
              <div><span style={{ color: '#94a3b8', fontSize: 12, marginRight: 8 }}>{a.date}</span>{a.text}</div>
            </div>
          ))}
        </Card>
      )}

      {/* 검색 결과 / 항목 목록 */}
      {q ? (
        <Card>
          <div className="section-title" style={{ fontSize: 15 }}>🔍 "{query}" 검색 결과 ({filtered.length})</div>
          {filtered.length === 0
            ? <div style={{ color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>검색 결과가 없습니다. 다른 키워드로 찾아보거나 위 "상세 안내"를 확인하세요.</div>
            : filtered.map((it, i) => <Item key={i} it={it} i={i} />)}
        </Card>
      ) : (
        CATS.map(cat => {
          const items = HELP_ITEMS.filter(it => it.cat === cat);
          if (!items.length) return null;
          return (
            <Card key={cat}>
              <div className="section-title" style={{ fontSize: 16 }}>{cat}</div>
              {items.map((it, i) => <Item key={i} it={it} i={i} />)}
            </Card>
          );
        })
      )}

      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '8px 0 24px' }}>
        더 궁금한 점은 kraft@krafte.net · 1877-1979 로 문의해 주세요.
      </div>
    </div>
  );
}
