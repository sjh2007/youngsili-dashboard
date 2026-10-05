import {authFetch} from './api';
jest.mock('../firebase',()=>({authEnabled:false,auth:null}));
jest.mock('firebase/auth',()=>({onAuthStateChanged:jest.fn()}));
it('인증 초기화 실패 시 무토큰 서버 요청을 보내지 않는다',async()=>{
 const original=global.fetch;
 const fetchMock=jest.fn();global.fetch=fetchMock;
 try{await expect(authFetch('https://fixture.invalid/elders')).rejects.toThrow('인증 서비스');expect(fetchMock).not.toHaveBeenCalled()}
 finally{global.fetch=original}
});
