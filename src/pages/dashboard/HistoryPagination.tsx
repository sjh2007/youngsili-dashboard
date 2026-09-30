type Props = {
  page: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
};

export default function HistoryPagination({ page, totalItems, pageSize, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  return <nav aria-label="내역 페이지" style={{display:'flex',justifyContent:'center',alignItems:'center',gap:10,marginTop:16}}>
    <button type="button" className="btn-secondary" disabled={page <= 1} onClick={()=>onChange(page-1)}>이전</button>
    <span aria-live="polite" style={{fontSize:13,color:'#475569'}}><b>{page}</b> / {totalPages} 페이지</span>
    <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={()=>onChange(page+1)}>다음</button>
  </nav>;
}
