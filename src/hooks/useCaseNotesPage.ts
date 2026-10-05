import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { CaseNoteSummarySchema } from '../schemas';
import { CaseNotesQuery, fetchCaseNotesPage, fetchCaseNotesVersion } from '../utils/caseNotesApi';

export type CaseNoteSummary = z.infer<typeof CaseNoteSummarySchema>;
export interface CaseNotesPageOptions {
  active: boolean;
  elderPhone?: string;
  search?: string;
  type?: string;
  followUpOnly?: boolean;
  scopeKey?: string;
}

/** Bounded page reads; a version poll never downloads the whole note collection. */
export function useCaseNotesPage(options: CaseNotesPageOptions) {
  const {active, elderPhone = '', search = '', type = '', followUpOnly = false, scopeKey = ''} = options;
  const key = JSON.stringify([active, elderPhone, search, type, followUpOnly, scopeKey]);
  const latest = useRef({active, elderPhone, search, type, followUpOnly, key});
  latest.current = {active, elderPhone, search, type, followUpOnly, key};
  const [notes, setNotes] = useState<CaseNoteSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [query, setQuery] = useState<CaseNotesQuery>({});
  const [version, setVersion] = useState('');
  const state = useRef({epoch: 0, controller: null as AbortController | null, busy: false,
    base: {} as CaseNotesQuery, cursors: [''], page: 0, nextCursor: null as string | null,
    version: '', loadedAt: 0});

  const invalidate = useCallback(() => {
    state.current.epoch += 1;
    state.current.controller?.abort();
    state.current.busy = false;
  }, []);

  const load = useCallback(async (page: number) => {
    const current = state.current;
    const scope = latest.current;
    if (!scope.active || !current.base.from) return;
    invalidate();
    const epoch = current.epoch;
    const controller = new AbortController();
    current.controller = controller;
    current.busy = true;
    const request = {...current.base, ...(current.cursors[page] ? {cursor: current.cursors[page]} : {})};
    setLoading(true);
    setError('');
    setNotes([]);
    setQuery(request);
    setLoadedKey(scope.key);
    try {
      const result = await fetchCaseNotesPage(request, controller.signal);
      if (epoch !== current.epoch || scope.key !== latest.current.key) return;
      if (result.hasMore && !result.nextCursor) throw new Error('다음 일지 페이지 정보를 확인하지 못했습니다. 다시 조회해 주세요.');
      current.page = page;
      current.nextCursor = result.nextCursor;
      current.version = result.version;
      current.loadedAt = Date.now();
      setNotes(result.notes);
      setHasMore(result.hasMore);
      setScanned(result.scanned);
      setVersion(result.version);
      setPageNumber(page + 1);
    } catch (reason) {
      if (epoch === current.epoch && scope.key === latest.current.key && !controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : '일지를 불러오지 못했습니다. 다시 시도해 주세요.');
        setHasMore(false);
      }
    } finally {
      if (epoch === current.epoch) {current.busy = false; setLoading(false);}
    }
  }, [invalidate]);

  const reload = useCallback(() => {
    const scope = latest.current;
    if (!scope.active) return;
    const now = new Date();
    const base: CaseNotesQuery = {
      from: new Date(now.getTime() - 90 * 86400000).toISOString(), to: now.toISOString(), limit: '50',
    };
    if (scope.elderPhone) base.elderPhone = scope.elderPhone;
    if (scope.search.trim()) base.search = scope.search.trim();
    if (scope.type && scope.type !== 'all') base.type = scope.type;
    if (scope.followUpOnly) base.followUpOnly = 'true';
    state.current.base = base;
    state.current.cursors = [''];
    state.current.nextCursor = null;
    state.current.page = 0;
    setPageNumber(1);
    setHasMore(false);
    setScanned(0);
    void load(0);
  }, [load]);

  useEffect(() => {
    invalidate();
    setNotes([]); setError(''); setHasMore(false); setLoading(active);
    setLoadedKey(key); setQuery({}); setScanned(0); setPageNumber(1); setVersion('');
    state.current.base = {}; state.current.version = '';
    if (!active) return;
    const timer = window.setTimeout(reload, 250);
    return () => {window.clearTimeout(timer); invalidate();};
  }, [key, active, invalidate, reload]);

  useEffect(() => {
    if (!active) return;
    const poll = async () => {
      const current = state.current;
      if (document.visibilityState === 'hidden' || current.busy || !current.base.from || !latest.current.active) return;
      const epoch = current.epoch;
      const scope = latest.current.key;
      const controller = new AbortController();
      current.controller = controller; current.busy = true;
      try {
        const result = await fetchCaseNotesVersion(controller.signal);
        if (epoch !== current.epoch || scope !== latest.current.key) return;
        current.busy = false;
        if (result.version !== current.version) reload();
        else if (Date.now() - current.loadedAt >= 60000) void load(current.page);
      } catch (reason) {
        if (epoch === current.epoch && scope === latest.current.key && !controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : '일지 변경 확인에 실패했습니다. 새로고침해 주세요.');
        }
      } finally {if (epoch === current.epoch) current.busy = false;}
    };
    const timer = window.setInterval(poll, 15000);
    return () => window.clearInterval(timer);
  }, [active, load, reload]);

  const next = useCallback(() => {
    const current = state.current;
    if (current.busy || !current.nextCursor) return;
    current.cursors[current.page + 1] = current.nextCursor;
    void load(current.page + 1);
  }, [load]);
  const previous = useCallback(() => {
    const current = state.current;
    if (!current.busy && current.page > 0) void load(current.page - 1);
  }, [load]);
  const sameScope = key === loadedKey && active;
  return {notes: sameScope ? notes : [], setNotes, loading: active && (!sameScope || loading),
    error: sameScope ? error : '', reload, next, previous, invalidate,
    hasMore: sameScope && hasMore, pageNumber, scanned: sameScope ? scanned : 0, query, version};
}
