# youngsili-dashboard — 기관용 관제 대시보드

AI영실이(B2G 독거어르신 AI 안부전화)의 기관 관제 화면. React CRA + **TypeScript** 단일 페이지(src/App.tsx에 대부분).
전체 그림은 youngsili-callengine 저장소의 docs/ONBOARDING.md 참조.

## 명령어
- 개발: `npm start` (또는 `docker compose up dev` → :3000)
- 프로덕션 빌드(Windows): `CI=false npx react-scripts build`  ← `npm run build`는 cmd에서 CI=false 문법 실패
- 타입 체크: `npx tsc --noEmit` (0 오류 유지 — 커밋 전 습관화)
- Docker 프로덕션: `docker compose up prod` (nginx, :8080) 또는 `docker build` — KT클라우드 이전 대비
- 배포: **main 푸시 → Vercel 자동 배포** (별도 조작 불필요)

## 구조 요점 (2026-08-03 TypeScript 전환 — .jsx/.js 사용 금지, .tsx/.ts만)
- src/App.tsx — 페이지 전부(해시 라우팅 #dashboard, #calls, #script, #data …). 거대 파일이지만 분리하지 말 것(합의 전).
- src/AuthScreen.tsx — 로그인/가입/아이디·비번 찾기. src/firebase.ts — Firebase Auth(authEnabled 가드).
- src/schemas.ts — **zod 서버 응답 스키마**(Elder/Alert/Call/Me/Weather) + `parseOr` 헬퍼. 새 fetch를 추가하면 여기 스키마부터 정의하고 `parseOr(Schema, json, fallback)`로 감쌀 것. 스키마는 loose(.catchall) — 알려진 필드만 검증, 미지 필드 통과.
- TypeScript 5.9.3 + zod 4. react-scripts 5의 peer 선언(^3||^4)과 어긋나지만 실동작 검증됨 — `.npmrc`의 legacy-peer-deps로 npm ci 통과(지우면 Docker 빌드 깨짐). **TS 7(네이티브)은 CRA와 비호환 — 설치 금지.** tsconfig는 strict:false 프래그머틱 모드.
- 서버: https://youngsili-server-production.up.railway.app (authFetch가 Firebase 토큰 자동 첨부). 로컬 서버 테스트는 .env.local의 `REACT_APP_SERVER_URL` (예: http://localhost:4001, 커밋 금지).
- 멀티테넌트: 서버가 토큰의 기관(orgId) 기준으로 데이터 반환. 기관 주소(orgRegion)가 기상·인구 공공데이터의 기준.

## UI 검증 패턴 (권장)
src/firebase.js의 `authEnabled`를 임시 `false` → 빌드 → Playwright로 서버 응답 목킹 캡처 → **반드시 원복 후 커밋**.
운영 서버에 목데이터 넣지 말 것.

## 규칙·함정
- 디자인 **현행 기준(2026-08-04 확정)**: **main 브랜치 원본 디자인으로 전면 원복**. KRDS·정부24·TDS·네이버 레이어는 모두 폐기 — 다시 적용하지 말 것.
  - 스타일 위치: `src/App.css`(App.tsx에서 import) + `src/index.css`(기본 body/code만). 빌드 산출 CSS를 src에 복사하지 말 것.
  - 토큰: 캔버스 #F4F6F8 · 카드 흰 배경 + 1px #E2E8F0 + radius 10~16 + 옅은 그림자 · Primary **#246BEB** · 위험 #DC2626/#EF4444 · 주의 #F59E0B(텍스트 #B45309) · 정상 #16A34A/#22C55E · 텍스트 #0F172A/#334155/#475569/#64748B/#94A3B8 · 서체 Pretendard GOV.
  - **사이드바는 다크**(#0F172A, hover #1E293B, 활성 #246BEB). 로그인 화면은 네이비 그라데이션 배경 + 흰 카드(radius 20 + 그림자).
  - **테두리 사용함**(무보더 제약 폐기), 굵기 700/800/900 사용, 칩·배지는 radius 20.
  - App.css 하단 **"신규 화면 요소"** 섹션 = 원복 이후 추가된 클래스(nav-cta/nav-quick/nav-search/infobar/bulkbar/empty-state/callprog/ui-* 등)를 원본 톤에 맞춰 정의한 곳. 새 UI를 추가하면 여기에 같은 토큰으로 이어서 작성.
  - 인쇄용 공문서 서식(일정표·보고서 print HTML)의 표 괘선은 그대로 유지.
- 외부 API 장애 시 그럴듯한 가짜 값 금지 — "정보 없음"/"연동 지연"(앰버) 표기.
- 지역 라벨 하드코딩 금지 — 기관 주소·데이터에서 파생 (디자인팀 스펙 04).
- 작업 전 `git fetch`로 원격과 비교(로컬이 크게 뒤처졌던 사고 이력). backup-* 브랜치 병합 금지.
- 커밋 메시지는 한국어 요약.
