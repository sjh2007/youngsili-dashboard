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
export const authEnabled = !JSON.stringify(firebaseConfig).includes('REPLACE');

let _auth = null;
if (authEnabled) {
  _auth = getAuth(initializeApp(firebaseConfig));
}
export const auth = _auth;
