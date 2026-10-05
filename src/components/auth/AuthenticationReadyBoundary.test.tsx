import {render,screen} from '@testing-library/react';
import AuthenticationReadyBoundary from './AuthenticationReadyBoundary';
jest.mock('../../firebase',()=>({authEnabled:false}));
it('인증 초기화 실패 시 요청을 보내는 자식 화면을 마운트하지 않는다',()=>{
 const mount=jest.fn();
 const Protected=()=>{mount();return <p>기관 기록</p>};
 render(<AuthenticationReadyBoundary><Protected/></AuthenticationReadyBoundary>);
 expect(screen.getByRole('alert')).toHaveTextContent('로그인을 준비하지 못했습니다');
 expect(mount).not.toHaveBeenCalled();
 expect(screen.queryByText('기관 기록')).not.toBeInTheDocument();
});
