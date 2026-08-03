# youngsili-dashboard — 기관용 관제 대시보드

AI영실이(B2G 독거어르신 AI 안부전화)의 기관 관제 화면. React CRA 단일 페이지(src/App.js에 대부분).
전체 그림은 youngsili-callengine 저장소의 docs/ONBOARDING.md 참조.

## 명령어
- 개발: `npm start`
- 프로덕션 빌드(Windows): `CI=false npx react-scripts build`  ← `npm run build`는 cmd에서 CI=false 문법 실패
- 배포: **main 푸시 → Vercel 자동 배포** (별도 조작 불필요)

## 구조 요점
- src/App.js — 페이지 전부(해시 라우팅 #dashboard, #calls, #script, #data …). 거대 파일이지만 분리하지 말 것(합의 전).
- src/AuthScreen.js — 로그인/가입/아이디·비번 찾기. src/firebase.js — Firebase Auth(authEnabled 가드).
- 서버: https://youngsili-server-production.up.railway.app (authFetch가 Firebase 토큰 자동 첨부)
- 멀티테넌트: 서버가 토큰의 기관(orgId) 기준으로 데이터 반환. 기관 주소(orgRegion)가 기상·인구 공공데이터의 기준.

## UI 검증 패턴 (권장)
src/firebase.js의 `authEnabled`를 임시 `false` → 빌드 → Playwright로 서버 응답 목킹 캡처 → **반드시 원복 후 커밋**.
운영 서버에 목데이터 넣지 말 것.

## 규칙·함정
- 디자인: KRDS 정부 표준 — Primary #246BEB, Pretendard GOV, 위험 #DC2626/주의 #F59E0B/정상 #16A34A(정상은 배경 채색 금지), Lucide 아이콘 stroke 1.75, **이모지 금지**(날씨 아이콘 등 기존 예외만 유지).
- 외부 API 장애 시 그럴듯한 가짜 값 금지 — "정보 없음"/"연동 지연"(앰버) 표기.
- 지역 라벨 하드코딩 금지 — 기관 주소·데이터에서 파생 (디자인팀 스펙 04).
- 작업 전 `git fetch`로 원격과 비교(로컬이 크게 뒤처졌던 사고 이력). backup-* 브랜치 병합 금지.
- 커밋 메시지는 한국어 요약.
