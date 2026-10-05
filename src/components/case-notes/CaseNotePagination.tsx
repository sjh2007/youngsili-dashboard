export default function CaseNotePagination({page}: {page?: {pageNumber:number;hasMore:boolean;loading:boolean;next:()=>void;previous:()=>void;scanned:number}}) {
  if (!page) return null;
  return <nav aria-label="일지 페이지" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'16px 0'}}>
    <button className="btn-secondary" style={{minHeight:44}} disabled={page.loading || page.pageNumber <= 1} onClick={page.previous}>이전 일지</button>
    <span>{page.pageNumber}페이지 · 최대 50건씩 조회</span>
    <button className="btn-secondary" style={{minHeight:44}} disabled={page.loading || !page.hasMore} onClick={page.next}>다음 일지</button>
    <span style={{fontSize:13,color:'#64748b'}}>필터에 맞는 일지가 없어도 다음 페이지가 있을 수 있습니다.</span>
  </nav>;
}
