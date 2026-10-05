import type { ReactNode } from 'react';
import { authEnabled } from '../../firebase';

/** A failed SDK initialization must never mount screens that issue authenticated requests. */
export default function AuthenticationReadyBoundary({children}:{children:ReactNode}) {
  const preview=process.env.NODE_ENV==='development'
    && ['localhost','127.0.0.1'].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get('designpreview')==='1';
  if(authEnabled||preview)return <>{children}</>;
  return <main className="health-empty" role="alert">
    <h1>로그인을 준비하지 못했습니다</h1>
    <p>인증 서비스를 초기화할 수 없어 서비스 연결을 중단했습니다. 브라우저의 저장소 설정을 확인한 뒤 다시 시도해 주세요.</p>
    <button type="button" className="btn-primary" onClick={()=>window.location.reload()}>다시 시도</button>
  </main>;
}
