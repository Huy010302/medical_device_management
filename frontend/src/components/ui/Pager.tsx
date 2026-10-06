export default function Pager({page, totalPages, total, onPage}: {page:number;totalPages:number;total:number;onPage:(p:number)=>void}) {
  const start = Math.max(1,Math.min(page-2,totalPages-4));
  const pages = Array.from({length:Math.min(5,totalPages)},(_,i)=>start+i);
  return <nav aria-label="Phân trang" className="flex items-center gap-2 p-4 flex-wrap">
    <span className="text-sm text-gray-500 mr-2">{total.toLocaleString('vi-VN')} bản ghi · trang {page}/{Math.max(totalPages,1)}</span>
    <button className="btn-secondary" disabled={page<=1} onClick={()=>onPage(page-1)}>‹</button>
    {pages.map(n=><button key={n} aria-current={n===page?'page':undefined} className="btn-secondary" onClick={()=>onPage(n)}>{n}</button>)}
    <button className="btn-secondary" disabled={page>=totalPages} onClick={()=>onPage(page+1)}>›</button>
  </nav>;
}
