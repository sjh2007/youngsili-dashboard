// DashboardApplication.tsx의 page==='consoleSubscriptions'(정기결제 현황) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
export default function ConsoleSubscriptionsPage(props: any) {
  const { consoleSubs, consoleSubsLoading, fetchConsoleSubscriptions } = props;

  return (
    <div className="fade-in">
      <section className="section">
        <div className="script-editor-header" style={{marginBottom:10}}>
          <div className="section-title" style={{marginBottom:0}}>
            정기결제 현황 ({consoleSubs.length}개 기관)
            <span style={{marginLeft:10, fontSize:12, fontWeight:500, color:'#94a3b8'}}>정액제 자동결제(포트원 빌링키) 등록 여부·다음 청구일 — 조회 전용</span>
          </div>
          <button className={`btn-download ${consoleSubsLoading?'btn-calling':''}`} onClick={fetchConsoleSubscriptions} disabled={consoleSubsLoading}>
            {consoleSubsLoading ? '조회 중...' : '새로고침'}
          </button>
        </div>
        {consoleSubs.length === 0 ? (
          <div style={{color:'#5f6368', fontSize:14, padding:'20px 4px'}}>
            {consoleSubsLoading ? '불러오는 중...' : '기관 데이터가 없습니다'}
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
              <thead>
                <tr style={{textAlign:'left', color:'#5f6368', borderBottom:'1px solid #dadce0'}}>
                  <th style={{padding:'8px 10px', fontWeight:500}}>기관명</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>요금제</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>대상자</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>월 청구액</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>자동결제</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>다음 청구일</th>
                  <th style={{padding:'8px 10px', fontWeight:500}}>최근 오류</th>
                </tr>
              </thead>
              <tbody>
                {consoleSubs.map(s => (
                  <tr key={s.orgId} style={{borderBottom:'1px solid #f1f3f4'}}>
                    <td style={{padding:'10px'}}>{s.orgName || s.orgId}</td>
                    <td style={{padding:'10px'}}>{s.plan || '미설정'}</td>
                    <td style={{padding:'10px'}}>{s.elderCount}명</td>
                    <td style={{padding:'10px'}}>{s.monthlyAmount != null ? `${s.monthlyAmount.toLocaleString()}원` : '-'}</td>
                    <td style={{padding:'10px'}}>
                      <span style={{
                        fontSize:12, fontWeight:600, padding:'2px 10px', borderRadius:12,
                        background: s.autoRenew ? '#e6f4ea' : '#f1f3f4',
                        color: s.autoRenew ? '#1e8e3e' : '#5f6368',
                      }}>{s.autoRenew ? '등록됨' : '미등록'}</span>
                    </td>
                    <td style={{padding:'10px', color:'#5f6368'}}>{s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleDateString('ko-KR') : '-'}</td>
                    <td style={{padding:'10px', color: s.lastChargeError ? '#c5221f' : '#5f6368', fontSize:12}}>{s.lastChargeError || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
