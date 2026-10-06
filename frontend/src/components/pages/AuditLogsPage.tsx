import {useState} from 'react';
import {usePagedRecords} from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
type Log={id:number;user_id:string;action:string;table_name:string;record_id:string;old_value:Record<string,unknown>|null;new_value:Record<string,unknown>|null;created_at:string};
export default function AuditLogsPage(){
 const [page,setPage]=useState(1);
 const {data,error}=usePagedRecords<Log>('/admin/audit-logs',{page,page_size:50});
 return <div className="space-y-4"><h2 className="text-xl font-semibold">Nhật ký thay đổi</h2>{error&&<p role="alert" className="text-red-700">{error}</p>}<div className="card table-container"><table className="table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Bảng / bản ghi</th><th>Thay đổi</th></tr></thead><tbody>{data.items.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('vi-VN')}</td><td className="font-mono text-xs">{row.user_id||'—'}</td><td>{row.action}</td><td>{row.table_name} / {row.record_id}</td><td><details><summary>Xem</summary><pre className="max-w-lg overflow-auto text-xs">{JSON.stringify({old:row.old_value,new:row.new_value},null,2)}</pre></details></td></tr>)}</tbody></table></div><Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage}/></div>;
}
