/// <reference types="react-scripts" />

// 전역 확장 — 다음(카카오) 우편번호 스크립트, 파일 저장 피커(크로미움)
interface Window {
  daum?: any;
  showSaveFilePicker?: (opts?: any) => Promise<any>;
}
