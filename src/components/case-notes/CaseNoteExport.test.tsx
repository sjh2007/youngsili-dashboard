import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaseNoteExport from './CaseNoteExport';
import type { ExportLoader } from './exportData';
jest.mock('./exportWorkerClient',()=>({buildExportFile:jest.fn()}));
jest.mock('./exportApi',()=>({exportLoader:{}}));
beforeEach(()=>{URL.createObjectURL=jest.fn().mockReturnValue('blob:test');URL.revokeObjectURL=jest.fn();});
test('retry starts failed part at checkpoint; creates one explicit download',async()=>{
  const api:ExportLoader={version:jest.fn().mockResolvedValue('v1'),note:jest.fn(),page:jest.fn().mockRejectedValueOnce(new Error('접속 실패')).mockResolvedValue({notes:[{id:'1',content:'기록'}],version:'v1',hasMore:false})};
  const buildFile=jest.fn().mockResolvedValue(new Blob(['xlsx']));
  render(<CaseNoteExport query={{from:'2026-01-01',to:'2026-03-31'}} onClose={()=>{}} loader={api} buildFile={buildFile}/>);
  fireEvent.click(screen.getByText('엑셀 만들기'));await screen.findByRole('alert');
  fireEvent.click(screen.getByText('현재 파일 다시 시도'));await screen.findByText('엑셀 저장 (1건)');
  expect((api.page as jest.Mock).mock.calls.map(c=>c[1])).toEqual([undefined,undefined]);expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(buildFile).toHaveBeenCalledTimes(1);
});
test('cancel prevents late results and revokes blob on unmount',async()=>{
  let resolvePage:(value:unknown)=>void;
  const api:ExportLoader={version:jest.fn().mockResolvedValue('v1'),note:jest.fn(),page:jest.fn().mockImplementation(()=>new Promise(resolve=>{resolvePage=resolve;}))};
  const buildFile=jest.fn();const view=render(<CaseNoteExport query={{}} onClose={()=>{}} loader={api} buildFile={buildFile}/>);
  fireEvent.click(screen.getByText('엑셀 만들기'));await waitFor(()=>expect(api.page).toHaveBeenCalled());fireEvent.click(screen.getByText('취소'));
  resolvePage({notes:[{id:'1'}],version:'v1',hasMore:false});await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('취소되었습니다'));
  expect(buildFile).not.toHaveBeenCalled();view.unmount();
});
test('scope changes cancel and reject reuse rather than mixing queries',async()=>{
  const api:ExportLoader={version:jest.fn().mockResolvedValue('v1'),note:jest.fn(),page:jest.fn().mockResolvedValue({notes:[{id:'1'}],version:'v1',hasMore:false})};
  const buildFile=jest.fn().mockResolvedValue(new Blob(['xlsx']));
  const view=render(<CaseNoteExport query={{from:'2026-01-01'}} onClose={()=>{}} loader={api} buildFile={buildFile}/>);
  fireEvent.click(screen.getByText('엑셀 만들기'));await screen.findByRole('link');
  view.rerender(<CaseNoteExport query={{from:'2026-02-01'}} onClose={()=>{}} loader={api} buildFile={buildFile}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('조회 조건이 변경');expect(screen.queryByRole('link')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');expect(screen.getByText('현재 파일 다시 시도')).toBeDisabled();
});
