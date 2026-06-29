import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 렌더가 통째로 실패해도 "흰 화면"이 아니라 원인 문구가 뜨게 한다(원인불명 흰화면 방지).
try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  console.error('대시보드 렌더 실패:', e);
  const el = document.getElementById('root');
  if (el) el.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#475569;text-align:center;padding:24px"><div><div style="font-size:18px;font-weight:700;margin-bottom:8px">화면을 불러오지 못했습니다</div><div style="font-size:14px">새로고침(Ctrl+Shift+R) 후에도 같으면 다른 브라우저로 시도해 주세요.<br/>오류: ' + ((e && e.message) || e) + '</div></div></div>';
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
