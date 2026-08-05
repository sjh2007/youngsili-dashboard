import { useState } from 'react';

export default function CallTranscript({ text }) {
  const [open, setOpen] = useState(false);
  const raw = (text || '').trim();
  if (!raw) return <div style={{ color: '#94a3b8', fontSize: 13 }}>—</div>;
  // "영실이:" / "어르신:" 앞에서 분리해 화자별 턴으로 나눔
  const turns = raw.split(/(?=영실이\s*[:：]|어르신\s*[:：])/g).map(s => s.trim()).filter(Boolean);
  const PREVIEW = 4;
  const shown = open ? turns : turns.slice(0, PREVIEW);
  const more = turns.length - PREVIEW;
  return (
    <div style={{ width: '100%', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
      {shown.map((t, i) => {
        const m = t.match(/^(영실이|어르신)\s*[:：]\s*([\s\S]*)$/);
        const who = m ? m[1] : '';
        const body = m ? m[2].trim() : t;
        const isElder = who === '어르신';
        return (
          <div key={i} style={{ marginBottom: 3, wordBreak: 'break-word' }}>
            {who && <span style={{ fontWeight: 700, color: isElder ? '#1e3a6e' : '#94a3b8', marginRight: 6 }}>{who}</span>}
            <span style={{ color: isElder ? '#1f2937' : '#64748b' }}>{body}</span>
          </div>
        );
      })}
      {more > 0 && (
        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 4, background: 'none', border: 'none', color: '#246BEB', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {open ? '접기 ▴' : `전체 대화 ${more}턴 더 보기 ▾`}
        </button>
      )}
    </div>
  );
}

// P2-8/P2-9 공통 접기·펼치기 패턴 — 일자·그룹 아코디언 헤더 (접혀도 요약 노출 · 클릭 토글 · 스크롤 시 sticky)
// chips: [{label,value,color}] — 값 0이면 회색 일반, 0 초과면 지정색 볼드 (디자인팀 패턴 스펙)
