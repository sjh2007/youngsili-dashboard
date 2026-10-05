import { ensureCallNote, fetchCaseNote, persistCaseNote, fetchCaseNotesPage, fetchCaseNotesVersion } from './caseNotesApi';
const mockFetch = jest.fn();
jest.mock('./api',()=>({SERVER_URL:'http://test',authFetch:(...args:unknown[])=>mockFetch(...args),errMsg:(data:any,fallback:string)=>data?.error?.message || fallback}));
const note={id:'auto_call',elderPhone:'01000000000',elderName:'가상어르신',type:'phone',category:'health',content:'저장된 내용',action:'',visitedAt:'2026-10-02T08:00:00Z',revision:2};
const reply=(body:unknown,ok=true,status=200)=>({ok,status,json:async()=>body});
beforeEach(()=>mockFetch.mockReset());
it('페이지와 버전 응답은 필수 메타데이터가 없으면 실패하고 취소 신호를 전달한다',async()=>{
  mockFetch.mockResolvedValueOnce(reply({notes:[]}));
  await expect(fetchCaseNotesPage({limit:'50'})).rejects.toThrow('확인하지 못했습니다');
  mockFetch.mockResolvedValueOnce(reply({version:15}));
  await expect(fetchCaseNotesVersion()).rejects.toThrow('확인하지 못했습니다');
  const controller=new AbortController();
  mockFetch.mockResolvedValueOnce(reply({notes:[],hasMore:true,nextCursor:'next',scanned:100,version:'v1'}));
  expect((await fetchCaseNotesPage({search:'가상 어르신',limit:'50'},controller.signal)).hasMore).toBe(true);
  expect(mockFetch.mock.calls[2][1].signal).toBe(controller.signal);
  expect(mockFetch.mock.calls[2][0]).toContain('search=%EA%B0%80%EC%83%81+%EC%96%B4%EB%A5%B4%EC%8B%A0');
});
it('HTTP 오류를 저장 성공으로 반환하지 않는다',async()=>{
  mockFetch.mockResolvedValue(reply({error:{message:'다른 담당자가 수정했습니다'}},false,409));
  await expect(persistCaseNote(note.id,{expectedRevision:1})).rejects.toThrow('다른 담당자가 수정했습니다');
});
it('잘못된 성공 응답과 다른 문서 ID를 거부한다',async()=>{
  mockFetch.mockResolvedValueOnce(reply({success:true,id:note.id}));
  await expect(persistCaseNote(note.id,{})).rejects.toThrow('확인하지 못했습니다');
  mockFetch.mockResolvedValueOnce(reply({success:true,id:'other',note}));
  await expect(persistCaseNote(note.id,{})).rejects.toThrow('일치하지 않습니다');
});
it('저장된 서버 본문과 revision을 반환하고 재시도 식별자를 유지한다',async()=>{
  mockFetch.mockResolvedValue(reply({success:true,id:note.id,note}));
  expect(await persistCaseNote(null,{requestId:'same-id',content:'입력'})).toEqual(note);
  expect(JSON.parse(mockFetch.mock.calls[0][1].body).requestId).toBe('same-id');
});
it('통화 원문을 브라우저에서 보내지 않고 통화 ID로 기존 일지를 요청한다',async()=>{
  mockFetch.mockResolvedValue(reply({success:true,id:note.id,note}));
  await ensureCallNote('call');
  expect(mockFetch.mock.calls[0][0]).toBe('http://test/case-notes/from-call');
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({callId:'call'});
});
it('출력용 일지는 서버에서 다시 읽고 삭제/권한 오류를 숨기지 않는다',async()=>{
  mockFetch.mockResolvedValueOnce(reply({note}));
  expect(await fetchCaseNote(note.id)).toEqual(note);
  mockFetch.mockResolvedValueOnce(reply({},false,403));
  await expect(fetchCaseNote(note.id)).rejects.toThrow('403');
});
