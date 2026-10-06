import {useState} from 'react';
import {useAuth} from '@/lib/auth';
import {useStore} from '@/lib/store';
import ReceptionForm from '@/components/lifecycle/ReceptionForm';
import Modal from '@/components/ui/Modal';
export default function ReceivingPage(){
 const {can}=useAuth();const {receptionRecords,devices}=useStore();const [open,setOpen]=useState(false);
 return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-2xl font-bold">Tiếp nhận · Nghiệm thu</h1>{can('workflow:create')&&<button className="btn-primary" onClick={()=>setOpen(true)}>Tạo biên bản</button>}</div><p className="text-sm text-slate-500">Chọn hợp đồng tại trang Mua sắm để nghiệm thu theo gói thầu.</p><div className="card table-container"><table className="table"><thead><tr><th>Ngày</th><th>Thiết bị</th><th>Kết quả</th></tr></thead><tbody>{receptionRecords.slice(-100).reverse().map(r=><tr key={r.id}><td>{r.reception_date}</td><td>{devices.find(d=>d.id===r.device_id)?.device_code||r.device_id}</td><td>{r.acceptance_status}</td></tr>)}</tbody></table></div><Modal isOpen={open} onClose={()=>setOpen(false)} title="Nghiệm thu thiết bị"><ReceptionForm onClose={()=>setOpen(false)}/></Modal></div>;
}
