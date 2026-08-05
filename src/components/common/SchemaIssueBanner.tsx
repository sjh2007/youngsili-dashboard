/**
 * 서버 응답 타입 불일치 알림 배너.
 *
 * 예전에는 불일치가 콘솔 경고 한 줄로만 남고 화면은 "데이터 없음"처럼 보여서,
 * 어르신 목록·통화 기록·경보 멘트가 안 보이는 원인을 찾는 데 매번 오래 걸렸다.
 * 이제는 화면에 바로 뜨게 해 다음번엔 즉시 알아채도록 한다.
 *
 * 개발 중 진단용이라 운영 빌드에서는 표시하지 않는다.
 */
import { useEffect, useState } from 'react';
import { onSchemaIssue, getSchemaIssues, clearSchemaIssues, type SchemaIssue } from '../../schemas';

export default function SchemaIssueBanner() {
  const [list, setList] = useState<SchemaIssue[]>(getSchemaIssues());
  const [open, setOpen] = useState(false);

  useEffect(() => onSchemaIssue(setList), []);

  if (process.env.NODE_ENV === 'production') return null;
  if (!list.length) return null;

  return (
    <div
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 9999, maxWidth: 460,
        background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '12px 14px', fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ color: '#92400e' }}>서버 응답 타입 불일치 {list.length}건</b>
        <button onClick={() => setOpen((v) => !v)} style={btn}>{open ? '접기' : '자세히'}</button>
        <button onClick={() => { clearSchemaIssues(); setList([]); }} style={btn}>지우기</button>
      </div>
      <div style={{ color: '#78350f', marginTop: 4, lineHeight: 1.5 }}>
        데이터는 그대로 표시됩니다. 프론트 스키마를 서버 응답에 맞춰 주세요.
      </div>
      {open && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
          {list.map((i, n) => (
            <li key={n} style={{ color: '#78350f', marginBottom: 3 }}>
              <code>{i.path}</code> — {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  fontSize: 12, padding: '3px 8px', borderRadius: 6,
  border: '1px solid #fcd34d', background: '#fff', color: '#92400e', cursor: 'pointer',
};
