import {useEffect,useState} from 'react';
import {Monitor,Activity,Settings,Trash2,Wrench,AlertTriangle} from 'lucide-react';
import {apiJson} from '@/lib/api';
type Summary={total_devices:number;status_summary:Record<string,number>;maintenance_count:number;repair_count:number};
export default function KPICards(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const load=()=>apiJson<Summary>('/analytics/summary').then(v=>{if(active){setData(v);setError('');}}).catch(e=>{if(active)setError(String(e));});void load();window.addEventListener('mdlm:record-saved',load);return()=>{active=false;window.removeEventListener('mdlm:record-saved',load)};},[]);
 const cards=[['Tổng thiết bị',data?.total_devices,Monitor],['Đang vận hành',data?.status_summary.operating,Activity],['Đang sửa chữa',data?.status_summary.repairing,Settings],['Đang bảo trì',data?.status_summary.maintenance,Wrench],['Đã thanh lý',data?.status_summary.disposed,Trash2],['Phiếu bảo trì',data?.maintenance_count,AlertTriangle]] as const;
 return <div>{error&&<p role="alert" className="mb-3 rounded bg-red-50 p-3 text-red-700">{error}</p>}<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">{cards.map(([label,value,Icon])=><div className="card p-4" key={label}><Icon size={20} className="text-blue-600"/><p className="mt-3 text-2xl font-bold">{value==null?'—':value.toLocaleString('vi-VN')}</p><p className="text-xs text-slate-500">{label}</p></div>)}</div></div>;
}
