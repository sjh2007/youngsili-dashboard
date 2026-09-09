import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// App.css를 여기서 동기(static) import — 아래 App/ConsoleApp는 동적 import라, CSS까지
// 그 안에서만 import하면 CSS가 별도 비동기 청크로 분리돼 초기 로드 때 스타일 없는 화면이
// 잠깐 보인다(FOUC). 정적 import로 메인 번들에 포함시켜 그 문제를 없앤다.
import './App.css';
import reportWebVitals from './reportWebVitals';

// REACT_APP_TARGET=console(빌드 시점 env)이면 기관 대시보드 대신 총괄 관리자 전용 운영
// 콘솔을 띄운다 — 별도 서브도메인에 배포하는 완전히 분리된 빌드 산출물(build-console/).
// 동적 import로 갈라서 각 빌드 결과물에 반대쪽 코드가 섞여 들어가지 않게 한다.
const isConsole = process.env.REACT_APP_TARGET === 'console';
if (isConsole) document.title = 'AI영실이 운영 콘솔';

async function boot() {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  try {
    const Component = isConsole
      ? (await import('./pages/ConsoleApp')).default
      : (await import('./App')).default;
    root.render(
      <React.StrictMode>
        <Component />
      </React.StrictMode>
    );
  } catch (e: any) {
    console.error('화면 렌더 실패:', e);
    // 배포마다 청크 파일명이 해시로 바뀌는데, 배포 전부터 열려 있던 탭은 옛 청크 URL을
    // 계속 참조한다 — 그 dynamic import()가 404로 실패하는 게 가장 흔한 원인이다. 이 상태에서
    // 아래처럼 innerHTML로 #root를 덮어쓰면, 이미 그 노드에 붙어있던 React root가 나중에
    // 재조정을 시도하다 "관리하던 노드가 사라졌다"며 removeChild 에러로 완전히 빈 화면이
    // 된다(2026-09-04 실사용 확인). 청크 로드 실패로 보이면 innerHTML을 건드리지 않고
    // 새로고침으로 새 index.html·청크를 받아오게 한다 — 무한 새로고침 방지로 세션당 1회만.
    const isChunkError = /loading chunk|dynamically imported module|failed to fetch/i.test(String(e?.message ?? e));
    if (isChunkError && !sessionStorage.getItem('chunk-reload-once')) {
      sessionStorage.setItem('chunk-reload-once', '1');
      window.location.reload();
      return;
    }
    // 2026-09-09 보안점검: 오류 메시지를 innerHTML로 이어붙이고 있었다. 지금 당장 악용
    // 경로가 보이진 않지만, 메시지에 서버 응답 조각이 섞여 들어오면 그대로 스크립트가
    // 실행되는 패턴이다. 껍데기는 DOM으로 만들고 메시지는 textContent로만 넣는다.
    const el = document.getElementById('root');
    if (el) {
      el.textContent = '';
      const box = document.createElement('div');
      box.setAttribute('style', 'min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#475569;text-align:center;padding:24px');
      const inner = document.createElement('div');
      const title = document.createElement('div');
      title.setAttribute('style', 'font-size:18px;font-weight:700;margin-bottom:8px');
      title.textContent = '화면을 불러오지 못했습니다';
      const desc = document.createElement('div');
      desc.setAttribute('style', 'font-size:14px');
      desc.textContent = '새로고침(Ctrl+Shift+R) 후에도 같으면 다른 브라우저로 시도해 주세요.';
      const detail = document.createElement('div');
      detail.setAttribute('style', 'font-size:14px');
      detail.textContent = '오류: ' + String((e && e.message) || e);
      inner.append(title, desc, detail);
      box.append(inner);
      el.append(box);
    }
  }
}
boot();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
