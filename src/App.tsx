import './App.css';
import PageRouter from './pages/PageRouter';
import { SchemaIssueBanner } from './components/common';

/** Application entry: page routing lives here; page UI lives under src/pages. */
export default function App() {
  return (
    <>
      <PageRouter />
      {/* 서버 응답 타입 불일치를 화면에 드러낸다 (개발 빌드 전용) */}
      <SchemaIssueBanner />
    </>
  );
}
