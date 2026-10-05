import { fetchHealthSnapshot } from './healthApi';
import { authFetch } from './api';
jest.mock('./api',()=>({authFetch:jest.fn(),SERVER_URL:'https://fixture.invalid',errMsg:()=> '조회 실패'}));
const mock=authFetch as jest.Mock;
beforeEach(()=>mock.mockReset());
it('건강 현황이 정상이더라도 알림 오류를 빈 목록으로 바꾸지 않는다',async()=>{
 mock.mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:false,json:async()=>({error:'failed'})});
 await expect(fetchHealthSnapshot()).rejects.toThrow('조회 실패');
});
it('정상 빈 결과는 빈 현황으로 제공한다',async()=>{
 mock.mockResolvedValue({ok:true,json:async()=>[]});
 await expect(fetchHealthSnapshot()).resolves.toEqual({health:[],alerts:[]});
});
it('오류 객체가 HTTP 200으로 전달되어도 거부한다',async()=>{
 mock.mockResolvedValueOnce({ok:true,json:async()=>({error:'unavailable'})}).mockResolvedValueOnce({ok:true,json:async()=>[]});
 await expect(fetchHealthSnapshot()).rejects.toThrow('응답 형식');
});
