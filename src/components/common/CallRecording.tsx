import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { z } from 'zod';
import { authFetch, SERVER_URL } from '../../utils/api';
import { RecordingConfigSchema, RecordingConsentSchema, RecordingMetadataSchema } from '../../schemas';

const Context = createContext<z.infer<typeof RecordingConfigSchema> | null>(null);
async function readJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) throw new Error('녹음 정보를 불러오지 못했습니다.');
  const result = schema.safeParse(await response.json());
  if (!result.success) throw new Error('녹음 응답을 확인할 수 없습니다.');
  return result.data;
}

export function RecordingProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [config, setConfig] = useState<z.infer<typeof RecordingConfigSchema> | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) { setConfig(null); return; }
    const controller = new AbortController();
    setError(false);
    authFetch(`${SERVER_URL}/call-recordings/config`, { signal: controller.signal })
      .then(r => readJson(r, RecordingConfigSchema)).then(c => { if (!controller.signal.aborted) setConfig(c); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [retry, enabled]);
  return <Context.Provider value={config}>
    {error && <div role="status" style={{ color: '#B45309', marginBottom: 12 }}>녹음 서비스 상태를 확인하지 못했습니다. <button onClick={() => setRetry(n => n + 1)}>다시 확인</button></div>}
    {children}
  </Context.Provider>;
}

export function RecordingConsent({ phone }: { phone: string }) {
  const config = useContext(Context);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    const current = ++sequence.current;
    setConsent(null); setConfirmed(false); setError(''); setBusy(false);
    if (!phone || !config?.canRead) return;
    const controller = new AbortController();
    authFetch(`${SERVER_URL}/call-recordings/consent/status`, { signal: controller.signal, method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      .then(r => readJson(r, RecordingConsentSchema)).then(d => { if (current === sequence.current) setConsent(d.enabled); })
      .catch(() => { if (!controller.signal.aborted && current === sequence.current) setError('녹음 동의 상태를 불러오지 못했습니다.'); });
    return () => controller.abort();
  }, [phone, config?.canRead]);
  if (!phone || !config?.canRead) return null;
  async function save() {
    const current = sequence.current;
    setBusy(true); setError('');
    try {
      const result = await readJson(await authFetch(`${SERVER_URL}/call-recordings/consent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, enabled: !consent, confirmed: true }),
      }), RecordingConsentSchema);
      window.dispatchEvent(new Event('recording-consent-changed'));
      if (current === sequence.current) { setConsent(result.enabled); setConfirmed(false); }
    } catch { if (current === sequence.current) setError('동의 변경 또는 녹음 삭제가 완료되지 않았습니다. 다시 확인해 주세요.'); }
    finally { if (current === sequence.current) setBusy(false); }
  }
  return <div style={{ padding: 12, margin: '12px 0', border: '1px solid #E2E8F0', borderRadius: 10 }}>
    <strong>선택한 어르신의 통화 녹음</strong>
    <p style={{ margin: '8px 0' }}>{consent === null ? '상태 확인 중' : consent ? '동의 확인됨 · 앱·070 통화 녹음 허용' : '녹음 동의 미확인 · 원음 저장 안 함'} · 보관 12개월</p>
    {config.canManage && consent !== null && <>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />{' '}
        {consent ? '동의 철회를 확인했으며 저장된 녹음 파일을 삭제합니다.' : '어르신 또는 권한 있는 대리인에게 녹음 목적·12개월 보관·재생 및 다운로드를 안내하고 동의를 받았습니다.'}
      </label>
      <button className="btn-secondary" disabled={busy || !confirmed || (!config.enabled && !consent)} onClick={save}>
        {busy ? '처리 중…' : consent ? '동의 철회 및 녹음 삭제' : '녹음 동의 확인'}
      </button>
      {!config.enabled && <span style={{ marginLeft: 8 }}>새 통화 녹음이 비활성 상태입니다.</span>}
    </>}
    {error && <div role="alert" style={{ color: '#B45309', marginTop: 8 }}>{error}</div>}
  </div>;
}

export function RecordingConsentToggle({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const config = useContext(Context);
  if (!config?.canManage) return null;
  return <div style={{ marginTop: 8 }}>
    <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>녹음 동의 관리</button>
    {open && <RecordingConsent phone={phone} />}
  </div>;
}

export function CallRecording({ callId }: { callId: string }) {
  const config = useContext(Context);
  const [meta, setMeta] = useState<z.infer<typeof RecordingMetadataSchema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const urlRef = useRef('');
  const controllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const reset = () => {
      controllerRef.current?.abort(); audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = ''; setAudioUrl(''); setMeta(null); setMessage(''); setBusy(false);
    };
    reset(); window.addEventListener('recording-consent-changed', reset);
    return () => { reset(); window.removeEventListener('recording-consent-changed', reset); };
  }, [callId]);
  if (!config?.canRead || !callId) return null;
  const base = `${SERVER_URL}/call-recordings/${encodeURIComponent(callId)}`;
  function clearAudio() {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = ''; setAudioUrl(''); setMeta(null);
  }
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); setMessage('');
    try { await action(controller.signal); }
    catch { if (!controller.signal.aborted) { clearAudio(); setMessage('녹음 조회·다운로드에 실패했습니다. 다시 시도해 주세요.'); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function inspect() {
    clearAudio();
    return run(async signal => {
      const response = await authFetch(base, { signal });
      if (signal.aborted) return;
      if (response.status === 404) { setMessage('저장된 녹음을 찾을 수 없습니다. 수집되지 않은 통화, 기능 적용 전 통화, 동의 미확인 또는 파기된 녹음은 제공되지 않습니다.'); return; }
      const data = await readJson(response, RecordingMetadataSchema);
      if (!signal.aborted) setMeta(data);
    });
  }
  function file(format: 'mp3' | 'wav', purpose: 'play' | 'download') {
    return run(async signal => {
      const response = await authFetch(`${base}/audio?format=${format}&purpose=${purpose}`, { signal });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (signal.aborted) return;
      if (blob.size > 35 * 1024 * 1024 || !['audio/mpeg', 'audio/wav'].includes(blob.type)) throw new Error();
      const url = URL.createObjectURL(blob);
      if (purpose === 'play') {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url; setAudioUrl(url);
      } else {
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `call-recording.${format}`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  }
  return <div style={{ margin: '8px 0' }}>
    <button className="btn-secondary" onClick={inspect} disabled={busy}>{busy ? '처리 중…' : '녹음 확인'}</button>
    {meta?.state === 'ready' && <>
      <button className="btn-secondary" style={{ marginLeft: 6 }} disabled={busy} onClick={() => file('mp3', 'play')}>다시 듣기</button>
      {(['mp3', 'wav'] as const).map(format => <button key={format} className="btn-secondary" style={{ marginLeft: 6 }} disabled={busy} onClick={() => file(format, 'download')}>{format.toUpperCase()} 다운로드</button>)}
    </>}
    {meta && meta.state !== 'ready' && <span role="status" style={{ marginLeft: 8, color: '#B45309' }}>{meta.state === 'failed' ? (meta.errorCode === 'storage_full' ? '녹음 저장공간 부족 · 운영 관리자에게 문의해 주세요.' : '녹음 저장 실패 · 통화 텍스트는 별도로 확인해 주세요.') : '녹음 수집·처리 중입니다. 잠시 후 다시 확인해 주세요.'}</span>}
    {audioUrl && <audio ref={audioRef} controls src={audioUrl} aria-label="통화 녹음 재생" style={{ display: 'block', marginTop: 8, maxWidth: '100%' }} onError={() => setMessage('음성을 재생할 수 없습니다. 다시 불러오거나 파일을 다운로드해 주세요.')} />}
    {message && <p role="status" style={{ color: '#B45309', margin: '8px 0' }}>{message}</p>}
  </div>;
}
