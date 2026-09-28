import { useEffect, useState } from 'react';
import { z } from 'zod';
import { DemoSessionsSchema } from '../../schemas';
import { authFetch, SERVER_URL } from '../../utils/api';
import { CallRecording, RecordingProvider } from '../../components/common/CallRecording';

const scenarios = { care: '일상 안부', weather: '날씨 안전', risk: '건강 확인' };
const statuses: Record<string, string> = { requesting: '발신 요청 중', accepted: '발신 접수',
  completed: '통화 완료', 'no-answer': '응답 없음', busy: '통화 중', rejected: '수신 거절',
  canceled: '취소됨', failed: '발신 실패' };
function dateLabel(value: string) {
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
}

/** Mount only after ConsoleApp establishes superadmin. The API enforces the same access boundary. */
export default function DemoCallsPanel() {
  const [data, setData] = useState<z.infer<typeof DemoSessionsSchema> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    authFetch(`${SERVER_URL}/demo/sessions`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(response.status === 403 ? '운영관리자만 체험 통화를 열람할 수 있습니다.'
        : response.status === 410 ? '체험 통화의 보관 기간이 만료되었습니다. 새로고침해 주세요.'
        : '체험 통화를 불러오지 못했습니다. 새로고침해 주세요.');
      // Do not send raw personal data to parseOr's diagnostic console logging on schema failure.
      const parsed = DemoSessionsSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error('체험 통화 응답을 확인할 수 없습니다. 새로고침해 주세요.');
      if (!controller.signal.aborted) { setData(parsed.data); setNow(Date.now()); }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '체험 통화 조회에 실패했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    // Unmount transcripts and audio (revoking blob URLs) as soon as a session expires.
    const next = data?.items.map(item => Date.parse(item.expiresAt)).filter(at => at > now).sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [data, now]);
  const items = data?.items.filter(item => Date.parse(item.expiresAt) > now) || [];
  const expired = (data?.items.length || 0) - items.length;
  return <section className="section fade-in" aria-label="체험 통화 목록" aria-busy={loading}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>홈페이지 체험 통화</h2>
      <button className="btn-secondary" style={{ minHeight: 44 }} onClick={() => setRetry(value => value + 1)} disabled={loading}>
        {loading ? '불러오는 중…' : '새로고침'}
      </button>
    </div>
    <p style={{ color: '#475569', lineHeight: 1.7 }}>등록 여부와 관계없이 홈페이지에서 신청한 체험입니다. 운영관리자만 열람하며 기관 통화 기록과 분리됩니다.</p>
    <p style={{ padding: 12, background: '#EFF6FF', color: '#1E40AF', borderRadius: 8, lineHeight: 1.7 }}>
      신청일 기준 1일 보관 · 대화 텍스트와 별도 선택 동의한 녹음은 보관 기간이 지나면 삭제됩니다. 이전에 수집하지 않은 녹음은 복원할 수 없습니다.
    </p>
    {error && <p role="alert" style={{ color: '#B45309' }}>{error}</p>}
    {expired > 0 && <p role="status">보관 기간이 만료된 체험 {expired}건은 더 이상 표시하지 않습니다.</p>}
    {!loading && !error && <p role="status">{items.length ? `최근 ${data?.limit}건 중 열람 가능한 체험 ${items.length}건` : '현재 열람 가능한 체험 통화가 없습니다.'}</p>}
    <RecordingProvider enabled={items.some(item => item.recordingConsent)}>
      {items.map(item => <article key={item.callId} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, marginTop: 16, overflowWrap: 'anywhere' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <strong>{item.name || '체험 신청자'}</strong><span>{item.phone}</span>
          <span className="gcp-chip" style={{ background: '#EFF6FF', color: '#1E40AF' }}>{scenarios[item.scenario]}</span>
          <span>{statuses[item.status] || '상태 확인 필요'}</span>
          <span>{Math.floor(item.durationSec / 60)}분 {Math.floor(item.durationSec % 60)}초</span>
        </div>
        <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7 }}>신청 {dateLabel(item.createdAt)} · 보관 만료 {dateLabel(item.expiresAt)} (한국시간)</p>
        <details style={{ margin: '12px 0' }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'list-item', paddingTop: 10, color: '#1E40AF' }}>대화 텍스트 보기</summary>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{item.transcript || '저장된 대화 텍스트가 없습니다. 통화 진행 중이거나 결과가 아직 도착하지 않았을 수 있습니다.'}</p>
        </details>
        {item.recordingConsent ? <CallRecording callId={item.callId} /> : <p style={{ color: '#475569' }}>녹음 미동의 · 텍스트만 저장</p>}
      </article>)}
    </RecordingProvider>
  </section>;
}
