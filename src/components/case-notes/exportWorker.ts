import { createExportWorkbook } from './exportWorkbook';

// All values are explicit strings. User text beginning with '=' remains text, never a formula.
const workerContext = globalThis as unknown as {onmessage:(event:MessageEvent<string[][]>)=>void;postMessage:(data:unknown,transfer?:Transferable[])=>void};
workerContext.onmessage = (event: MessageEvent<string[][]>) => {
  try {
    const buffer = createExportWorkbook(event.data);
    workerContext.postMessage({buffer},[buffer]);
  } catch (error) { workerContext.postMessage({error:error instanceof Error ? error.message : '엑셀 생성 실패'}); }
};
export {};
