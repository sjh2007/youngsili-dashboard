import { onAuthStateChanged } from 'firebase/auth';
import { auth, authEnabled } from '../firebase';

export const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'https://youngsili-server-production.up.railway.app';

/**
 * Firebase 세션 복원을 기다린다 (앱 수명당 한 번).
 *
 * 401 이 쏟아지던 진짜 원인: 새로고침 직후 화면이 곧바로 데이터를 조회하는데, 그 시점의
 * `auth.currentUser` 는 아직 null 이다. 토큰이 없으니 Authorization 헤더 없이 나가고 서버는 401.
 * (토큰을 어디에 보관하느냐의 문제가 아니라 **토큰이 생기기 전에 보내는** 문제다.
 *  localStorage 에 idToken 을 넣어도 1시간 만료·중복 상태 문제만 생기고 이건 해결되지 않는다.)
 *
 * onAuthStateChanged 는 복원이 끝나면 **로그인 여부와 무관하게** 한 번 발화하므로,
 * 미로그인 사용자도 즉시 통과한다. 타임아웃은 SDK 가 끝내 응답하지 않는 경우의 안전장치다.
 */
let authReady: Promise<void> | null = null;
function waitForAuth(): Promise<void> {
  if (!authEnabled || !auth) return Promise.resolve();
  if (auth.currentUser) return Promise.resolve();
  if (!authReady) {
    authReady = new Promise<void>((resolve) => {
      const done = () => { clearTimeout(timer); unsub(); resolve(); };
      const timer = setTimeout(done, 3000);
      const unsub = onAuthStateChanged(auth, done, done);
    });
  }
  return authReady;
}

/**
 * 모든 서버 요청에 Firebase ID 토큰 첨부 → 서버가 기관(orgId)을 식별·격리.
 * (서버는 토큰의 uid로 users/{uid}.orgId를 조회해 본인 기관 데이터만 반환)
 *
 * 세션 복원을 기다린 뒤 보내고, 그래도 401 이면 토큰을 강제 갱신해 한 번만 재시도한다
 * (탭을 오래 열어둬 토큰이 만료된 경우 — getIdToken 캐시가 만료 직전 값을 줄 수 있다).
 */
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  await waitForAuth();

  const send = async (forceRefresh: boolean): Promise<Response> => {
    const headers: Record<string, string> = { ...((opts.headers as Record<string, string>) || {}) };
    try {
      if (authEnabled && auth?.currentUser) {
        headers['Authorization'] = 'Bearer ' + (await auth.currentUser.getIdToken(forceRefresh));
      }
    } catch { /* 토큰 발급 실패 → 무토큰 전송, 서버가 401 로 응답 */ }
    return fetch(url, { ...opts, headers });
  };

  const res = await send(false);
  if (res.status !== 401 || !authEnabled || !auth?.currentUser) return res;
  return send(true); // 만료 토큰이었을 수 있다 — 갱신 후 1회 재시도
}

/**
 * 서버 오류 응답에서 사람이 읽을 메시지를 뽑는다.
 *
 * 서버 v2(NestJS)는 `{error:{code,message,details}}` 로 바뀌었고 레거시는 `{error:'문자열'}` 이다.
 * 두 형식을 모두 받으므로 운영(레거시)·dev(v2) 어느 쪽에 붙어도 같은 코드가 동작한다.
 * 그냥 `d.error` 를 쓰면 v2 응답에서 화면에 `[object Object]` 가 찍힌다.
 */
export function errMsg(data: any, fallback = '요청에 실패했습니다'): string {
  const e = data?.error;
  if (!e) return fallback;
  if (typeof e === 'string') return e || fallback;
  return e.message || e.code || fallback;
}

// 통화내용 표시: 화자(영실이/어르신)별 줄바꿈 + 길면 그 자리서 펼치기(인라인). 잘림 없음.
