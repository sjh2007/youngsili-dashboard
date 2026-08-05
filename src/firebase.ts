// Firebase Authentication — 대시보드 로그인 인증
// ⚠️ 아래 config를 Firebase Console > 프로젝트 설정 > 일반 > 내 앱(웹) 의 값으로 교체하세요.
//    (client용 config라 공개돼도 안전 — 실제 보호는 Auth + 보안 규칙)
//    REPLACE_ 값이 남아 있으면 authEnabled=false 가 되어 로그인 가드가 자동으로 꺼집니다.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCumRaTUWawpIk_QFnXW9gY_2q8_P-a4p4",
  authDomain: "youngsili.firebaseapp.com",
  projectId: "youngsili",
  storageBucket: "youngsili.firebasestorage.app",
  messagingSenderId: "81194049083",
  appId: "1:81194049083:web:0043134f4433187cf5461e",
};

// config가 아직 placeholder면 인증 비활성화 (대시보드는 정상 작동, 가드만 꺼짐)
const configReady = !JSON.stringify(firebaseConfig).includes('REPLACE');

// ⚠️ Firebase 초기화를 try/catch로 감싼다.
// 일부 브라우저 환경(시크릿 모드·확장프로그램·IndexedDB/스토리지 차단 등)에서
// getAuth/initializeApp이 throw하면, 모듈 로드가 통째로 실패해 React가 아예
// 마운트되지 않고 "흰 화면"이 된다. 초기화 실패 시 인증을 끈 상태로라도 앱은 뜨게 한다.
let _auth = null;
let _ok = false;
if (configReady) {
  try {
    _auth = getAuth(initializeApp(firebaseConfig));
    _ok = true;
  } catch (e) {
    console.error('⚠️ Firebase 초기화 실패 — 인증 비활성 상태로 실행:', e && e.message);
    _auth = null;
    _ok = false;
  }
}
// 초기화가 실제로 성공했을 때만 authEnabled=true (실패 시 auth=null과 모순되지 않게)
export const authEnabled = configReady && _ok;
export const auth = _auth;
