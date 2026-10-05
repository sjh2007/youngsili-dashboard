import React, { useEffect, useRef, useState } from 'react';
import { exportLoader } from './exportApi';
import { buildExportFile } from './exportWorkerClient';
import { changedMessage, collectExportPart, exportRows, ExportLoader } from './exportData';

export interface CaseNoteExportProps {
  query: Record<string,string>;
  selectedIds?: string[];
  onClose: ()=>void;
  loader?: ExportLoader;
  buildFile?: (rows:string[][],signal:AbortSignal)=>Promise<Blob>;
}
export default function CaseNoteExport({query,selectedIds,onClose,loader=exportLoader,buildFile=buildExportFile}:CaseNoteExportProps) {
  const [frozen] = useState(()=>({...query}));
  const [ids] = useState(()=>selectedIds ? [...selectedIds] : undefined);
  const [status,setStatus] = useState('준비');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [part,setPart] = useState(1);
  const [file,setFile] = useState<{url:string;count:number;more:boolean;cursor?:string}|null>(null);
  const [downloaded,setDownloaded] = useState(false);
  const controller = useRef<AbortController|null>(null);
  const version = useRef<string|null>(null);
  const checkpoint = useRef<string|undefined>(undefined);
  const liveUrl = useRef<string|null>(null);
  const scopeKey = JSON.stringify([Object.entries(query).sort(([a],[b])=>a.localeCompare(b)),selectedIds]);
  const initialScope = useRef(scopeKey);
  const scopeChanged = scopeKey !== initialScope.current;
  const invalidate = () => { if (liveUrl.current) URL.revokeObjectURL(liveUrl.current); liveUrl.current=null; setFile(null); setDownloaded(false); };
  useEffect(()=>()=>{controller.current?.abort(); if(liveUrl.current)URL.revokeObjectURL(liveUrl.current);},[]);
  useEffect(()=>{
    if (!scopeChanged) return;
    controller.current?.abort();controller.current=null;
    if(liveUrl.current)URL.revokeObjectURL(liveUrl.current);liveUrl.current=null;
    setFile(null);setBusy(false);setError('조회 조건이 변경되었습니다. 창을 닫고 다시 내보내 주세요.');
  },[scopeChanged]);
  const run = async (next=false) => {
    if (controller.current || scopeChanged) return;
    if (next) {checkpoint.current=file?.cursor;setPart(p=>p+1);}
    invalidate(); setBusy(true);setError('');setStatus('일지 조회 중');
    const ctl = new AbortController();controller.current=ctl;
    try {
      const currentVersion = await loader.version(frozen,ctl.signal);
      if (version.current === null) version.current=currentVersion;
      if (version.current !== currentVersion) throw new Error(changedMessage);
      const result = await collectExportPart(loader,frozen,version.current,checkpoint.current,ctl.signal,
        (count,scanned)=>{if(!ctl.signal.aborted)setStatus(`${count.toLocaleString()}건 준비 · ${scanned.toLocaleString()}건 조회`);},ids);
      if (ctl.signal.aborted) return;
      if (!result.notes.length) {setStatus('내보낼 일지가 없습니다.');return;}
      setStatus(`${result.notes.length.toLocaleString()}건 엑셀 생성 중`);
      const blob = await buildFile(exportRows(result.notes),ctl.signal);
      if (await loader.version(frozen,ctl.signal) !== version.current) throw new Error(changedMessage);
      if (ctl.signal.aborted) return;
      const url=URL.createObjectURL(blob);liveUrl.current=url;
      setFile({url,count:result.notes.length,more:result.hasMore,cursor:result.nextCursor});setStatus('파일 준비 완료');
    } catch(e) {if(!ctl.signal.aborted){setError(e instanceof Error?e.message:'내보내기에 실패했습니다.');setStatus('중단');}}
    finally {if(controller.current===ctl){controller.current=null;if(!ctl.signal.aborted)setBusy(false);}}
  };
  const cancel = () => {controller.current?.abort();controller.current=null;setBusy(false);setStatus('취소되었습니다. 같은 파일 구간에서 다시 시도할 수 있습니다.');};
  return <section className="ui-card" aria-label="일지 엑셀 내보내기" style={{padding:20,margin:'16px 0',border:'1px solid #CBD5E1',borderRadius:12,background:'#fff'}}>
    <h3>일지 엑셀 내보내기</h3>
    <p>{frozen.from} ~ {frozen.to} · {ids?'선택 일지':'조회 결과'} · 파일당 최대 5,000건</p>
    <p>각 파일을 저장한 뒤 다음 파일을 만들어 주세요. 다음 파일을 만들면 이전 다운로드 링크는 사라집니다. 일지가 변경되면 처음부터 다시 시작해야 합니다.</p>
    <p role="status" aria-live="polite">{part}번째 파일 · {status}</p>
    {error&&<p role="alert">{error}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {!busy&&!file&&<button type="button" className="btn" onClick={()=>run()} disabled={error===changedMessage||scopeChanged}>{error?'현재 파일 다시 시도':'엑셀 만들기'}</button>}
      {busy&&<button type="button" className="btn" onClick={cancel}>취소</button>}
      {file&&<><a className="btn primary" href={file.url} download={`영실이_상담방문일지_${frozen.from}_${frozen.to}_${part}.xlsx`} onClick={()=>setDownloaded(true)}>엑셀 저장 ({file.count.toLocaleString()}건)</a>
        {file.more?<button type="button" className="btn" disabled={!downloaded} onClick={()=>run(true)}>다음 파일 만들기</button>:<span>마지막 파일입니다.</span>}</>}
      <button type="button" className="btn" onClick={()=>{cancel();onClose();}}>닫기</button>
    </div>
  </section>;
}
