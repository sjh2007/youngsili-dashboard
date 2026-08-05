export default function GroupHeader({ label, count, unit = '건', chips = [], flag, open, onToggle }) {
  return (
    <div onClick={onToggle} role="button" tabIndex={0} aria-expanded={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      style={{ position: 'sticky', top: 64, zIndex: 9, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        cursor: 'pointer', userSelect: 'none', background: open ? '#f0f5ff' : '#fff',
        border: '1px solid ' + (open ? '#bfdbfe' : '#e2e8f0'), borderRadius: 10, padding: '10px 14px', marginBottom: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
      <span aria-hidden="true" style={{ fontSize: 10, color: open ? '#246BEB' : '#94a3b8', width: 12, textAlign: 'center' }}>{open ? '▼' : '▶'}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: '#334155' }}>{label}</span>
      <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>{count}{unit}</span>
      {chips.map((c, i) => (
        <span key={i} style={{ fontSize: 13, fontWeight: c.value > 0 ? 800 : 600, color: c.value > 0 ? c.color : '#94a3b8' }}>{c.label} {c.value}</span>
      ))}
      {flag && <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 20, padding: '2px 10px' }}>{flag}</span>}
    </div>
  );
}
// 오늘 날짜 키(로컬 YYYY-MM-DD) — 일자별 아코디언 '기본 오늘만 펼침' 판정
