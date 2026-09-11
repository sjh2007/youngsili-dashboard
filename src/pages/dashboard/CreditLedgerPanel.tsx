import { useEffect, useState } from 'react';
import { CreditLedgerSchema, parseOr } from '../../schemas';
import { authFetch, SERVER_URL } from '../../utils/api';

export default function CreditLedgerPanel() {
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch(`${SERVER_URL}/billing/ledger`);
      if (!response.ok) throw new Error('크레딧 내역을 불러오지 못했습니다. 다시 시도해 주세요.');
      const data = parseOr(CreditLedgerSchema, await response.json(), null);
      if (!data) throw new Error('크레딧 내역 응답을 확인할 수 없습니다.');
      setLedger(data);
    } catch (e) { setError(e instanceof Error ? e.message : '크레딧 조회 오류'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  return <section aria-label="크레딧 충전 및 사용 내역" style={{marginBottom:28}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <h3 style={{fontSize:18,margin:'0 0 12px'}}>충전 · 사용 · 잔여 크레딧</h3>
      <button className="btn-secondary" disabled={loading} onClick={refresh}>새로고침</button>
    </div>
    {loading ? <p role="status">내역을 확인하고 있습니다.</p> : error ? <p role="alert" style={{color:'#b45309'}}>{error}</p> : ledger && <>
      <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:18,margin:'12px 0'}}>
        <div style={{color:'#475569'}}>현재 잔여 크레딧</div>
        <strong style={{fontSize:28,color:'#1d4ed8'}}>{ledger.balance === null ? '잔액 미설정' : `${ledger.balance.toLocaleString()} 크레딧`}</strong>
        <div style={{fontSize:12,color:'#64748b',marginTop:6}}>1크레딧 = 1원 · 월 기본요금 결제는 크레딧 충전에 포함되지 않습니다.</div>
      </div>
      {ledger.openingBalance !== 0 && <p role="status" style={{color:'#b45309'}}>이전 잔액 {ledger.openingBalance.toLocaleString()}크레딧이 포함되어 있습니다. 이전 충전일은 담당자 확인이 필요합니다.</p>}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:570}}>
          <thead><tr style={{textAlign:'left',background:'#f8fafc'}}>{['일시','이용 서비스 / 내역','충전·차감','처리 후 잔액'].map(t=><th key={t} style={{padding:10}} scope="col">{t}</th>)}</tr></thead>
          <tbody>{ledger.entries.map(row=><tr key={row.id} style={{borderBottom:'1px solid #e2e8f0'}}>
            <td style={{padding:10,whiteSpace:'nowrap'}}>{new Date(row.occurredAt).toLocaleString('ko-KR')}</td>
            <td style={{padding:10}}>{row.productName}{row.expiresAt && <div style={{fontSize:11,color:'#64748b'}}>소진기한 {new Date(row.expiresAt).toLocaleString('ko-KR')}</div>}</td>
            <td style={{padding:10,fontWeight:700,color:row.amount > 0 ? '#1d4ed8' : '#334155',whiteSpace:'nowrap'}}>{row.amount > 0 ? '+' : ''}{row.amount.toLocaleString()}</td>
            <td style={{padding:10,fontWeight:700,whiteSpace:'nowrap'}}>{row.balanceAfter.toLocaleString()}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {ledger.entries.length === 0 && <p>아직 크레딧 충전·사용 내역이 없습니다.</p>}
    </>}
  </section>;
}
