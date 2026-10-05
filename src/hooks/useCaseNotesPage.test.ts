import { act, renderHook } from '@testing-library/react';
import { useCaseNotesPage, CaseNotesPageOptions } from './useCaseNotesPage';
import { fetchCaseNotesPage, fetchCaseNotesVersion } from '../utils/caseNotesApi';
jest.mock('../utils/caseNotesApi', () => ({fetchCaseNotesPage: jest.fn(), fetchCaseNotesVersion: jest.fn()}));
const page = fetchCaseNotesPage as jest.Mock;
const version = fetchCaseNotesVersion as jest.Mock;
const row = (id: string) => ({id, elderPhone:'01000000000', elderName:id, type:'phone', category:'health', excerpt:'요약', revision:1, visitedAt:'2026-10-01T00:00:00Z'});
const result = (id: string, more = false) => ({notes:id ? [row(id)] : [], hasMore:more, nextCursor:more ? 'cursor-2' : null, scanned:50, version:'v1'});
const advance = async (ms: number) => {await act(async () => {jest.advanceTimersByTime(ms);});};
beforeEach(() => {
  jest.useFakeTimers(); page.mockReset(); version.mockReset();
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
  page.mockResolvedValue(result('first')); version.mockResolvedValue({version:'v1'});
});
afterEach(() => jest.useRealTimers());

it('bounds pages and preserves frozen range for next and previous, including empty filtered pages', async () => {
  page.mockResolvedValueOnce(result('', true)).mockResolvedValueOnce(result('second')).mockResolvedValueOnce(result('',true));
  const view = renderHook(() => useCaseNotesPage({active:true}));
  await advance(250);
  expect(view.result.current.notes).toEqual([]); expect(view.result.current.hasMore).toBe(true);
  const first = page.mock.calls[0][0]; expect(first.limit).toBe('50');
  await act(async()=>view.result.current.next());
  expect(page.mock.calls[1][0]).toEqual({...first,cursor:'cursor-2'});
  expect(view.result.current.pageNumber).toBe(2);
  await act(async()=>view.result.current.previous());
  expect(page.mock.calls[2][0]).toEqual(first);
});

it('clears former person immediately and rejects late responses even when abort is ignored',async()=>{
  let resolve: (value: unknown)=>void;
  page.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const view = renderHook((props:CaseNotesPageOptions)=>useCaseNotesPage(props),{initialProps:{active:true,elderPhone:'old',scopeKey:'orgA'}});
  await advance(250);
  view.rerender({active:true,elderPhone:'new',scopeKey:'orgB'});
  expect(view.result.current.notes).toEqual([]);
  await advance(250);
  await act(async()=>resolve(result('old-secret')));
  expect(view.result.current.notes[0].id).toBe('first');
  expect(page.mock.calls[0][1].aborted).toBe(true);
});

it('debounces search and does not issue a next request while a page is loading',async()=>{
  page.mockResolvedValueOnce(result('first',true));
  const view=renderHook((props:CaseNotesPageOptions)=>useCaseNotesPage(props),{initialProps:{active:true,search:''}});
  await advance(250);
  page.mockImplementationOnce(()=>new Promise(()=>{}));
  act(()=>{view.result.current.next(); view.result.current.next();});
  expect(page).toHaveBeenCalledTimes(2);
  view.rerender({active:true,search:'가'});
  await advance(100);
  view.rerender({active:true,search:'가상'});
  await advance(249); expect(page).toHaveBeenCalledTimes(2);
  await advance(1); expect(page.mock.calls[2][0].search).toBe('가상');
});

it('polls only a cheap version until changed, then refreshes first page',async()=>{
  const view=renderHook(()=>useCaseNotesPage({active:true}));
  await advance(250); await advance(15000);
  expect(version).toHaveBeenCalledTimes(1); expect(page).toHaveBeenCalledTimes(1);
  version.mockResolvedValue({version:'v2'}); page.mockResolvedValue({...result('updated'),version:'v2'});
  await advance(15000);
  expect(page).toHaveBeenCalledTimes(2); expect(view.result.current.notes[0].id).toBe('updated');
});

it('uses bounded safety refresh and stops all polling when hidden or inactive',async()=>{
  const view=renderHook((props:CaseNotesPageOptions)=>useCaseNotesPage(props),{initialProps:{active:true}});
  await advance(250);
  for(let i=0;i<5;i++) await advance(15000);
  expect(page).toHaveBeenCalledTimes(2);
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
  const count=version.mock.calls.length; await advance(60000);
  expect(version).toHaveBeenCalledTimes(count);
  view.rerender({active:false});
  expect(view.result.current.notes).toEqual([]);
  await advance(60000); expect(version).toHaveBeenCalledTimes(count);
});

it('shows page errors and allows retry without manufacturing success',async()=>{
  page.mockRejectedValueOnce(new Error('접근할 수 없습니다'));
  const view=renderHook(()=>useCaseNotesPage({active:true})); await advance(250);
  expect(view.result.current.error).toBe('접근할 수 없습니다');
  await act(async()=>view.result.current.reload());
  expect(view.result.current.notes[0].id).toBe('first'); expect(view.result.current.error).toBe('');
});
