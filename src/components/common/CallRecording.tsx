import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AudioLines, Download, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { z } from 'zod';
import { authFetch, SERVER_URL } from '../../utils/api';
import { RecordingConfigSchema, RecordingConsentSchema, RecordingMetadataSchema } from '../../schemas';
import { recordingWaveform } from './recordingWaveform';

function clock(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

const Context = createContext<z.infer<typeof RecordingConfigSchema> | null>(null);
class RecordingAccessError extends Error {}
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
  const [waveform, setWaveform] = useState<[number, number][] | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const urlRef = useRef('');
  const controllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const reset = () => {
      controllerRef.current?.abort(); audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = ''; setAudioUrl(''); setWaveform(null); setPosition(0); setPlaying(false); setSpeed(1); setMuted(false);
      setMeta(null); setMessage(''); setBusy(false);
    };
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== callId) reset();
    };
    reset(); window.addEventListener('recording-consent-changed', reset);
    window.addEventListener('recording-player-opened', closeOther);
    return () => {
      reset(); window.removeEventListener('recording-consent-changed', reset);
      window.removeEventListener('recording-player-opened', closeOther);
    };
  }, [callId]);
  if (!config?.canRead || !callId) return null;
  const base = `${SERVER_URL}/call-recordings/${encodeURIComponent(callId)}`;
  function clearAudio() {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = ''; setAudioUrl(''); setWaveform(null); setPosition(0); setPlaying(false); setSpeed(1); setMuted(false); setMeta(null);
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
      if (data.state === 'ready') await prepareAudio(signal);
    });
  }
  async function prepareAudio(signal: AbortSignal) {
    try { await loadAudio(signal); }
    catch (error) {
      if (error instanceof RecordingAccessError) throw error;
      if (!signal.aborted) setMessage('파형과 재생을 불러오지 못했습니다. 다운로드를 이용하거나 다시 시도해 주세요.');
    }
  }
  async function loadAudio(signal: AbortSignal) {
    const response = await authFetch(`${base}/audio?format=wav&purpose=play`, { signal });
    if ([401, 403, 404].includes(response.status)) throw new RecordingAccessError();
    if (!response.ok) throw new Error();
    const blob = await response.blob();
    if (signal.aborted) return;
    if (blob.size > 35 * 1024 * 1024 || blob.type !== 'audio/wav') throw new Error();
    const peaks = recordingWaveform(await blob.arrayBuffer());
    if (signal.aborted) return;
    // One decrypted recording in memory at a time, and only one voice playing on this page.
    window.dispatchEvent(new CustomEvent('recording-player-opened', { detail: callId }));
    const url = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url; setAudioUrl(url); setWaveform(peaks); setPosition(0); setPlaying(false);
  }
  function file(format: 'mp3' | 'wav') {
    return run(async signal => {
      const response = await authFetch(`${base}/audio?format=${format}&purpose=download`, { signal });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (signal.aborted) return;
      if (blob.size > 35 * 1024 * 1024 || blob.type !== (format === 'mp3' ? 'audio/mpeg' : 'audio/wav')) throw new Error();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `call-recording.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  const duration = meta?.durationSec || 0;
  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); }
      catch { setMessage('재생을 시작하지 못했습니다. 다시 눌러 주세요.'); }
    } else audio.pause();
  }
  function skip(seconds: number) {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  }
  function changeSpeed() {
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  }
  return <div className="recording-entry">
    {!meta && <button className="recording-open" onClick={inspect} disabled={busy} aria-label={busy ? '녹음 확인 중' : '녹음 확인'}>
      <AudioLines size={17} aria-hidden="true" />{busy ? '녹음 확인 중…' : '녹음 확인'}
    </button>}
    {meta?.state === 'ready' && <div className="recording-card">
      <div className="recording-card-head">
        <span className="recording-card-mark"><AudioLines size={18} aria-hidden="true" /></span>
        <div className="recording-card-titles"><strong>통화 녹음</strong><span>{meta.channel === 'pstn' ? '070 일반전화' : '앱 전화'} · {clock(duration)} · 보관 12개월</span></div>
        <span className="recording-ready">재생 가능</span>
      </div>
      {audioUrl ? <>
        <div className="recording-wave" role="group" aria-label="통화 녹음 파형">
          <div className="recording-wave-labels"><span>영실이</span><span>어르신</span></div>
          {waveform ? <svg viewBox="0 0 600 112" preserveAspectRatio="none" aria-hidden="true">
            {waveform.map(([elder, ai], index) => {
              const x = (index + .5) * 600 / waveform.length;
              const active = index / waveform.length <= position / (duration || 1);
              return <g key={index}>
                <line x1={x} x2={x} y1={29 - ai * 23} y2={29 + ai * 23} stroke={active ? '#7357d9' : '#cfc4f3'} strokeWidth="2.6" strokeLinecap="round" />
                <line x1={x} x2={x} y1={83 - elder * 23} y2={83 + elder * 23} stroke={active ? '#ed9638' : '#f5d7ad'} strokeWidth="2.6" strokeLinecap="round" />
              </g>;
            })}
          </svg> : <div className="recording-wave-unavailable">파형은 표시할 수 없지만 녹음 재생은 가능합니다.</div>}
          <input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(position, duration || 1)}
            onChange={event => { if (audioRef.current) { audioRef.current.currentTime = Number(event.target.value); setPosition(audioRef.current.currentTime); } }}
            aria-label="녹음 재생 위치" aria-valuetext={`${clock(position)} / ${clock(duration)}`} />
        </div>
        <div className="recording-time"><span>{clock(position)}</span><span>{clock(duration)}</span></div>
        <div className="recording-transport">
          <button className="recording-play" onClick={togglePlayback} aria-label={playing ? '일시정지' : '다시 듣기'}>
            {playing ? <Pause size={19} fill="currentColor" aria-hidden="true" /> : <Play size={19} fill="currentColor" aria-hidden="true" />}
          </button>
          <button className="recording-skip" onClick={() => skip(-10)} aria-label="10초 뒤로"><RotateCcw size={17} aria-hidden="true" /><small>10</small></button>
          <button className="recording-skip" onClick={() => skip(10)} aria-label="10초 앞으로"><RotateCw size={17} aria-hidden="true" /><small>10</small></button>
          <button className="recording-speed" onClick={changeSpeed} aria-label={`재생 속도 ${speed}배`}>{speed}×</button>
          <button className="recording-skip" onClick={toggleMute} aria-label={muted ? '음소거 해제' : '음소거'}>
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </button>
          <span className="recording-transport-note">파형을 눌러 원하는 위치로 이동</span>
        </div>
        <audio ref={audioRef} src={audioUrl} aria-label="통화 녹음 재생" preload="metadata" hidden
          onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onError={() => setMessage('음성을 재생할 수 없습니다. 다시 불러오거나 파일을 다운로드해 주세요.')} />
      </> : <div className="recording-card-hint">재생 파일을 준비하지 못했습니다. <button onClick={() => run(prepareAudio)} disabled={busy}>재생 다시 시도</button></div>}
      <div className="recording-card-footer">
        <span>암호화 보관 · 권한 있는 기관 사용자만 이용</span>
        <div className="recording-downloads">
          <button onClick={() => file('mp3')} disabled={busy}><Download size={15} aria-hidden="true" />MP3 다운로드</button>
          <button onClick={() => file('wav')} disabled={busy}><Download size={15} aria-hidden="true" />WAV 다운로드</button>
          <button className="recording-refresh" onClick={inspect} disabled={busy} aria-label="녹음 다시 확인">다시 확인</button>
        </div>
      </div>
    </div>}
    {meta && meta.state !== 'ready' && <div className="recording-state" role="status">{meta.state === 'failed' ? (meta.errorCode === 'storage_full' ? '녹음 저장공간 부족 · 운영 관리자에게 문의해 주세요.' : '녹음 저장 실패 · 통화 텍스트는 별도로 확인해 주세요.') : '녹음 수집·처리 중입니다. 잠시 후 다시 확인해 주세요.'}<button onClick={inspect}>다시 확인</button></div>}
    {message && <p className="recording-message" role="status">{message}</p>}
  </div>;
}
