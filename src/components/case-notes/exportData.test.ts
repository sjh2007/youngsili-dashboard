import { collectExportPart, ExportLoader, exportRows, changedMessage } from './exportData';
const note=(id:string)=>({id,content:'=SUM(A1:A2)',elderName:'테스트'});
const loader=():ExportLoader=>({version:jest.fn().mockResolvedValue('v1'),page:jest.fn(),note:jest.fn()});
test('bounds each part to 5000 rows and preserves exact next cursor',async()=>{
  const api=loader();(api.page as jest.Mock).mockImplementation(async(_q,cursor,limit)=>{
    const start=Number(cursor||0);return {notes:Array.from({length:limit},(_,i)=>note(String(start+i))),hasMore:true,nextCursor:String(start+limit),version:'v1'};
  });
  const result=await collectExportPart(api,{},'v1',undefined,new AbortController().signal,()=>{});
  expect(result.notes).toHaveLength(5000);expect(result.nextCursor).toBe('5000');expect(api.page).toHaveBeenCalledTimes(50);
});
test('rejects changed version, repeated cursor and oversize response',async()=>{
  for(const page of [
    {notes:[],version:'v2',hasMore:false},
    {notes:[],version:'v1',hasMore:true,nextCursor:'same'},
    {notes:Array.from({length:101},(_,i)=>note(String(i))),version:'v1',hasMore:false},
  ]) {const api=loader();(api.page as jest.Mock).mockResolvedValue(page);await expect(collectExportPart(api,{},'v1','same',new AbortController().signal,()=>{})).rejects.toThrow();}
});
test('checks cancellation and final version',async()=>{
  const api=loader();const ctl=new AbortController();ctl.abort();
  await expect(collectExportPart(api,{},'v1',undefined,ctl.signal,()=>{})).rejects.toMatchObject({name:'AbortError'});expect(api.page).not.toHaveBeenCalled();
  (api.page as jest.Mock).mockResolvedValue({notes:[note('1')],version:'v1',hasMore:false});(api.version as jest.Mock).mockResolvedValue('v2');
  await expect(collectExportPart(api,{},'v1',undefined,new AbortController().signal,()=>{})).rejects.toThrow(changedMessage);
});
test('selected records reload with permission checks and exclude drafts by default',async()=>{
  const api=loader();(api.note as jest.Mock).mockImplementation(async id=>({...note(id),source:'auto-call',status:id==='1'?'draft':'confirmed'}));
  const result=await collectExportPart(api,{},'v1',undefined,new AbortController().signal,()=>{},['1','2','2']);
  expect(result.notes.map(n=>n.id)).toEqual(['2']);expect(api.note).toHaveBeenCalledTimes(2);
  expect(exportRows([note('1')])[1][4]).toBe('=SUM(A1:A2)');
});
