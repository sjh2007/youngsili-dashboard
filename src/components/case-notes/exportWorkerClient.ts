export function buildExportFile(rows: string[][], signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve,reject) => {
    const worker = new Worker(new URL('./exportWorker.ts',import.meta.url));
    const done = () => { signal.removeEventListener('abort',abort); worker.terminate(); };
    const abort = () => { done(); reject(new DOMException('취소됨','AbortError')); };
    signal.addEventListener('abort',abort,{once:true});
    if (signal.aborted) { abort(); return; }
    worker.onerror = () => { done(); reject(new Error('엑셀 생성에 실패했습니다. 다시 시도해 주세요.')); };
    worker.onmessage = event => {
      done();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(new Blob([event.data.buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    };
    worker.postMessage(rows);
  });
}
