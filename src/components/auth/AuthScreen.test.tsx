import { render, screen } from '@testing-library/react';
import AuthScreen from './AuthScreen';
jest.mock('../../firebase',()=>({auth:{}}));
jest.mock('../../utils/api',()=>({errMsg:()=> '오류'}));
jest.mock('firebase/auth',()=>({}));
const props={authUser:null,needsProvision:false,authFetch:jest.fn(),serverUrl:'https://fixture.invalid',onReload:jest.fn(),onProvisioned:jest.fn()};
afterEach(()=>{window.location.hash=''});
it.each(['#signup','#trial'])('공개 %s 링크에서 기관 가입 양식을 연다',hash=>{
 window.location.hash=hash;
 render(<AuthScreen {...props}/>);
 expect(screen.getByLabelText('가입 비밀번호')).toBeInTheDocument();
});
it('공개 비밀번호 찾기 링크에서 재설정 양식을 연다',()=>{
 window.location.hash='#find-password';
 render(<AuthScreen {...props}/>);
 expect(screen.getByPlaceholderText('example@center.or.kr')).toBeInTheDocument();
});
