// 로그인 / 회원가입(이메일 인증) / 인증대기 / 기관설정 — 영실이 색상
import { useState } from 'react';
import { auth } from './firebase';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'firebase/auth';

const NAVY = '#1e3a6e', BLUE = '#2563eb', GREEN = '#16a34a';
const PW_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/;

const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${NAVY},#0f1f3d)`, padding: 20 };
const card = { background: '#fff', borderRadius: 20, padding: 36, width: 420, maxWidth: '92vw', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' };
const label = { fontSize: 13, fontWeight: 700, color: '#334155', margin: '14px 0 6px' };
const input = { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: 15 };
const primaryBtn = { width: '100%', padding: 14, borderRadius: 10, border: 'none', background: BLUE, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 18 };
const linkBtn = { background: 'none', border: 'none', color: BLUE, fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0 };
const errBox = { color: '#dc2626', fontSize: 13, marginTop: 10, background: '#fef2f2', padding: '8px 10px', borderRadius: 8 };

export default function AuthScreen({ authUser, needsProvision, authFetch, serverUrl, onReload, onProvisioned }) {
  const [tab, setTab] = useState('login');     // login | signup
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  // 로그인
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [keep, setKeep] = useState(true);
  // 회원가입
  const [su, setSu] = useState({ email: '', pw: '', pw2: '', org: '', phone: '', referral: '' });
  const [agree, setAgree] = useState({ tos: false, privacy: false, mkt: false });
  // 기관설정(안전망)
  const [orgName, setOrgName] = useState('');

  const Header = () => (
    <div style={{ textAlign: 'center', marginBottom: 22 }}>
      <img src="/youngsili.png" alt="영실이" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }} />
      <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 8 }}>AI 영실이 관제</div>
      <div style={{ fontSize: 13, color: '#64748b' }}>기관 전용 돌봄 대시보드</div>
    </div>
  );

  // ── 1) 인증 대기 (로그인됐지만 이메일 미인증) ──
  if (authUser && !authUser.emailVerified) {
    const resend = async () => {
      setErr(''); setMsg(''); setBusy(true);
      try { await sendEmailVerification(auth.currentUser); setMsg('인증 메일을 다시 보냈습니다. 메일함(스팸함 포함)을 확인하세요.'); }
      catch (e) { setErr(e.code === 'auth/too-many-requests' ? '잠시 후 다시 시도해 주세요.' : '발송 실패. 잠시 후 다시 시도해 주세요.'); }
      setBusy(false);
    };
    return (
      <div style={wrap}><div style={card}>
        <Header />
        <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, textAlign: 'center' }}>📧 이메일 인증이 필요합니다</div>
        <div style={{ fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
          <b>{authUser.email}</b> 로 보낸 인증 메일의<br />링크를 클릭한 뒤 아래 버튼을 눌러주세요.
        </div>
        {msg && <div style={{ ...errBox, color: GREEN, background: '#f0fdf4' }}>{msg}</div>}
        {err && <div style={errBox}>{err}</div>}
        <button style={{ ...primaryBtn, background: GREEN }} disabled={busy} onClick={onReload}>✅ 인증 완료했어요</button>
        <button style={{ ...primaryBtn, background: '#fff', color: BLUE, border: `1px solid ${BLUE}`, marginTop: 10 }} disabled={busy} onClick={resend}>인증 메일 재발송</button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button style={linkBtn} onClick={() => signOut()}>다른 계정으로 로그인</button>
        </div>
      </div></div>
    );
    function signOut() { auth.signOut(); }
  }

  // ── 2) 기관 설정(가입 직후 provision 실패한 안전망) ──
  if (authUser && authUser.emailVerified && needsProvision) {
    const provision = async () => {
      const name = orgName.trim();
      if (!name) { setErr('기관·단체명을 입력하세요'); return; }
      setErr(''); setBusy(true);
      try {
        const r = await authFetch(`${serverUrl}/signup/provision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgName: name }) });
        const d = await r.json();
        if (d.success) { onProvisioned && onProvisioned(); } else setErr(d.error || '기관 생성 실패');
      } catch { setErr('네트워크 오류'); }
      setBusy(false);
    };
    return (
      <div style={wrap}><div style={card}>
        <Header />
        <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, textAlign: 'center' }}>🏢 기관 정보 설정</div>
        <div style={{ fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 8 }}>마지막 단계예요. 기관·단체명을 입력하면 바로 시작합니다.</div>
        <div style={label}>기관 · 단체명</div>
        <input style={input} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="예) ○○구 노인복지관" onKeyDown={e => e.key === 'Enter' && provision()} />
        {err && <div style={errBox}>{err}</div>}
        <button style={{ ...primaryBtn, background: GREEN }} disabled={busy} onClick={provision}>{busy ? '설정 중…' : '시작하기 →'}</button>
      </div></div>
    );
  }

  // ── 3) 로그인 ──
  const doLogin = async () => {
    setErr(''); setBusy(true);
    try {
      await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      // 이후 App이 authUser/emailVerified로 분기
    } catch (e) {
      setErr(/wrong-password|user-not-found|invalid-credential/.test(e.code || '') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : '로그인 실패. 잠시 후 다시 시도해 주세요.');
    }
    setBusy(false);
  };
  const doReset = async () => {
    if (!email.trim()) { setErr('비밀번호를 재설정할 이메일을 입력하세요.'); return; }
    setErr(''); setMsg('');
    try { await sendPasswordResetEmail(auth, email.trim()); setMsg('비밀번호 재설정 메일을 보냈습니다.'); }
    catch { setErr('재설정 메일 발송 실패. 이메일을 확인하세요.'); }
  };

  // ── 4) 회원가입 ──
  const doSignup = async () => {
    setErr(''); setMsg('');
    if (!su.email.trim()) return setErr('이메일을 입력하세요.');
    if (!PW_RE.test(su.pw)) return setErr('비밀번호는 영문+숫자+특수문자 조합 8~20자여야 합니다.');
    if (su.pw !== su.pw2) return setErr('비밀번호가 일치하지 않습니다.');
    if (!su.org.trim()) return setErr('기관·단체명을 입력하세요.');
    if (!agree.tos || !agree.privacy) return setErr('필수 약관에 동의해 주세요.');
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, su.email.trim(), su.pw);
      // 기관 자동 생성 (운영자 승인 없이)
      try {
        await authFetch(`${serverUrl}/signup/provision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgName: su.org.trim(), phone: su.phone, referral: su.referral }) });
      } catch { /* 실패 시 인증 후 기관설정 안전망에서 재시도 */ }
      await sendEmailVerification(auth.currentUser);
      // authUser가 생기고 emailVerified=false → 위 '인증 대기' 화면으로 전환됨
    } catch (e) {
      setErr(e.code === 'auth/email-already-in-use' ? '이미 가입된 이메일입니다. 로그인해 주세요.' : e.code === 'auth/invalid-email' ? '이메일 형식이 올바르지 않습니다.' : '가입 실패. 잠시 후 다시 시도해 주세요.');
    }
    setBusy(false);
  };

  const allAgree = agree.tos && agree.privacy && agree.mkt;
  const toggleAll = () => { const v = !allAgree; setAgree({ tos: v, privacy: v, mkt: v }); };

  return (
    <div style={wrap}><div style={card}>
      <Header />
      {/* 탭 */}
      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 8 }}>
        {[['login', '로그인'], ['signup', '회원가입']].map(([k, t]) => (
          <button key={k} onClick={() => { setTab(k); setErr(''); setMsg(''); }}
            style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 15, background: tab === k ? BLUE : 'transparent', color: tab === k ? '#fff' : '#64748b' }}>{t}</button>
        ))}
      </div>

      {tab === 'login' ? (
        <div>
          <div style={label}>아이디 (이메일)</div>
          <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@example.com" autoComplete="username" />
          <div style={label}>비밀번호</div>
          <input style={input} type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} placeholder="비밀번호 입력" autoComplete="current-password" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} /> 자동 로그인
          </label>
          {err && <div style={errBox}>{err}</div>}
          {msg && <div style={{ ...errBox, color: GREEN, background: '#f0fdf4' }}>{msg}</div>}
          <button style={primaryBtn} disabled={busy} onClick={doLogin}>{busy ? '로그인 중…' : '로그인'}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>회원이 아니신가요? <button style={linkBtn} onClick={() => setTab('signup')}>회원가입</button></span>
            <button style={{ ...linkBtn, color: '#64748b' }} onClick={doReset}>비밀번호 찾기</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={label}>아이디 <span style={{ color: BLUE, fontWeight: 600 }}>*실제 사용하는 이메일을 입력하세요(인증 메일 발송)</span></div>
          <input style={input} type="email" value={su.email} onChange={e => setSu(s => ({ ...s, email: e.target.value }))} placeholder="example@example.com" autoComplete="off" />
          <div style={label}>비밀번호 <span style={{ color: '#94a3b8', fontWeight: 500 }}>*영문+숫자+특수문자 8~20자</span></div>
          <input style={input} type="password" value={su.pw} onChange={e => setSu(s => ({ ...s, pw: e.target.value }))} placeholder="비밀번호 입력" autoComplete="new-password" />
          <div style={label}>비밀번호 확인</div>
          <input style={input} type="password" value={su.pw2} onChange={e => setSu(s => ({ ...s, pw2: e.target.value }))} placeholder="비밀번호 재입력" autoComplete="new-password" />
          <div style={label}>기관 · 단체명</div>
          <input style={input} value={su.org} onChange={e => setSu(s => ({ ...s, org: e.target.value }))} placeholder="예) ○○구 노인복지관" />
          <div style={label}>휴대폰 번호</div>
          <input style={input} value={su.phone} onChange={e => setSu(s => ({ ...s, phone: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="숫자만 입력" inputMode="numeric" />
          <div style={label}>추천인 코드 <span style={{ color: '#94a3b8', fontWeight: 500 }}>(선택)</span></div>
          <input style={input} value={su.referral} onChange={e => setSu(s => ({ ...s, referral: e.target.value }))} placeholder="추천인 코드 입력" />
          {/* 약관 */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer', color: NAVY }}>
              <input type="checkbox" checked={allAgree} onChange={toggleAll} /> 약관 전체 동의
            </label>
            <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
            {[['tos', '서비스 이용약관 동의 (필수)'], ['privacy', '개인정보 수집 동의 (필수)'], ['mkt', '혜택/이벤트 정보 수신 동의 (선택)']].map(([k, t]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', padding: '4px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree[k]} onChange={e => setAgree(a => ({ ...a, [k]: e.target.checked }))} /> {t}
              </label>
            ))}
          </div>
          {err && <div style={errBox}>{err}</div>}
          <button style={{ ...primaryBtn, background: GREEN }} disabled={busy} onClick={doSignup}>{busy ? '가입 중…' : '가입하기'}</button>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#64748b' }}>
            이미 계정이 있으신가요? <button style={linkBtn} onClick={() => setTab('login')}>로그인</button>
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8' }}>© 2026 KRAFT · AI 영실이</div>
    </div></div>
  );
}
