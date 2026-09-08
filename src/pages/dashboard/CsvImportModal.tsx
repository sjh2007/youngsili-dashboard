// DashboardApplication.tsx의 csvImport(CSV 일괄 등록 미리보기) 블록을 그대로 옮긴 것 —
// 로직 변경 없음, 부모가 갖고 있던 state/함수를 전부 props로 받는다(6000줄 분리 작업, 2026-09-08).
export default function CsvImportModal(props: any) {
  const { csvImport, setCsvImport, csvSaving, csvOverwrite, setCsvOverwrite, confirmCsvImport } = props;

  const ok=csvImport.rows.filter(r=>r._status==='ok').length;
  const dup=csvImport.rows.filter(r=>r._status==='dup').length;
  const err=csvImport.rows.filter(r=>r._status==='error').length;
  const willRegister=ok+(csvOverwrite?dup:0);

  return (
    <div className="modal-overlay" onClick={()=>!csvSaving&&setCsvImport(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:860,width:'95%',textAlign:'left'}}>
        <div className="modal-title" style={{textAlign:'left',marginBottom:8}}>CSV 일괄 등록 미리보기</div>
        <div style={{fontSize:16,marginBottom:12,display:'flex',gap:14,flexWrap:'wrap'}}>
          <span style={{color:'#16a34a',fontWeight:700}}>등록 {ok}</span>
          <span style={{color:'#f59e0b',fontWeight:700}}>중복 {dup}</span>
          <span style={{color:'#dc2626',fontWeight:700}}>오류 {err}</span>
          <span style={{color:'#64748b'}}>· 총 {csvImport.rows.length}행</span>
        </div>
        <div style={{maxHeight:'50vh',overflowY:'auto',border:'1px solid #e2e8f0',borderRadius:10}}>
          <table className="table" style={{margin:0}}>
            <thead><tr><th>행</th><th>상태</th><th>이름</th><th>전화번호</th><th>나이</th><th>지역</th><th>담당</th></tr></thead>
            <tbody>
              {csvImport.rows.map((r,i)=>{
                const c=r._status==='ok'?{t:'등록',bg:'#f0fdf4',col:'#16a34a'}:r._status==='dup'?{t:'중복',bg:'#fffbeb',col:'#f59e0b'}:{t:'오류',bg:'#fef2f2',col:'#dc2626'};
                return (<tr key={i} style={{background:c.bg}}>
                  <td style={{color:'#94a3b8',fontSize:15}}>{r._row}</td>
                  <td><span style={{fontSize:15,fontWeight:700,color:c.col}}>{c.t}{r._reason?` · ${r._reason}`:''}</span></td>
                  <td><strong>{r.name||'—'}</strong></td>
                  <td style={{fontSize:16}}>{r.phone||'—'}</td>
                  <td style={{fontSize:16}}>{r.age||'—'}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{r.region||'—'}</td>
                  <td style={{fontSize:16,color:'#64748b'}}>{r.caregiver||'—'}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
        {dup>0 && (
          <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12,fontSize:16,color:'#334155',cursor:'pointer'}}>
            <input type="checkbox" checked={csvOverwrite} onChange={e=>setCsvOverwrite(e.target.checked)}/>
            이미 등록된 어르신(중복 {dup}명)도 <b>덮어쓰기</b>로 갱신
          </label>
        )}
        <div style={{fontSize:15,color:'#94a3b8',marginTop:10}}>· 오류 행은 등록에서 제외됩니다. 한글이 깨지면 엑셀에서 "CSV UTF-8"로 저장해 주세요.</div>
        <div className="modal-btns" style={{marginTop:16,justifyContent:'flex-end'}}>
          <button className="btn-secondary" disabled={csvSaving} onClick={()=>setCsvImport(null)}>취소</button>
          <button className="btn-primary" disabled={csvSaving||willRegister===0} onClick={confirmCsvImport}>{csvSaving?'등록 중...':`${willRegister}명 등록`}</button>
        </div>
      </div>
    </div>
  );
}
