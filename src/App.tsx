import './App.css';
import PageRouter from './pages/PageRouter';
import { SchemaIssueBanner } from './components/common';
import { lazy, Suspense } from 'react';

const DesignPreview = process.env.NODE_ENV === 'development'
  ? lazy(() => import('./pages/dashboard/DashboardDesignPreview')) : null;

/** Application entry: page routing lives here; page UI lives under src/pages. */
export default function App() {
  if (DesignPreview && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get('designpreview') === '1') {
    return <Suspense fallback={<p>미리보기 불러오는 중…</p>}><DesignPreview /></Suspense>;
  }
  return (
    <>
      <PageRouter />
      {/* 서버 응답 타입 불일치를 화면에 드러낸다 (개발 빌드 전용) */}
      <SchemaIssueBanner />
    </>
  );
}
