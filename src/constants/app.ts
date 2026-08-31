export const CAREGIVERS = [];  // 서버 /settings/caregivers + 등록된 어르신의 담당 복지사에서 파생 (더미 폐지)
// (더미 INIT_ELDERS 제거 — 어르신 목록은 서버 /elders에서 로드)

// 본 서비스: 모든 통계·통화·현황은 서버(Firestore) 실데이터로 표시 (고정 더미 폐지)
export const STATUS_CONFIG = {
  danger:  { label: '위험', color: '#ef4444', bg: '#fef2f2' },
  warning: { label: '주의', color: '#f59e0b', bg: '#fffbeb' },
  normal:  { label: '정상', color: '#22c55e', bg: '#f0fdf4' },
};
export const RISK_CONFIG = {
  critical: { label: '긴급', color: '#ef4444' },
  urgent:   { label: '주의', color: '#f59e0b' },
  warning:  { label: '주의', color: '#f59e0b' },   // 앱이 어지럼·소화·기력저하 등을 warning으로 보냄 → 주의 표시
  normal:   { label: '정상', color: '#22c55e' },
};
// SPA 페이지 목록 (URL 해시 라우팅 — F5 시 현재 페이지 유지)
export const PAGES = ['dashboard','elders','safety','schedule','script','calls','health','casenotes','forms','report','data','admin','help','console','consoleSubscriptions'];

// 페이지 렌더 오류가 앱 전체를 흰 화면으로 만들지 않게 방어. 오류 시 메시지 표시 + 메뉴 이동(resetKey) 시 복구.
