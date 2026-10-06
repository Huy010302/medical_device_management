import {useState} from 'react';
import {usePagedRecords} from '@/lib/usePagedRecords';
import {useStore} from '@/lib/store';
import Pager from '@/components/ui/Pager';
import DeviceQRCode from '@/components/devices/DeviceQRCode';
import Modal from '@/components/ui/Modal';

type QRRow = {id:string;device_code:string;name:string;qr_token:string;current_status:string};
export default function QRCodePage(){
  const {departments,deviceCategories,deviceStatusOptions}=useStore();
  const [page,setPage]=useState(1),[search,setSearch]=useState(''),[department,setDepartment]=useState(''),[category,setCategory]=useState(''),[status,setStatus]=useState('');
  const [selected,setSelected]=useState<QRRow|null>(null);
  const {data,error}=usePagedRecords<QRRow>('/qr/devices',{page,page_size:50,search,department_id:department,category_id:category,status});
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">QR Code Thiết bị</h1>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div className="card p-4 flex flex-wrap gap-3">
      <input className="input" placeholder="Nhập mã / tên thiết bị" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
      <select className="select" value={department} onChange={e=>{setDepartment(e.target.value);setPage(1);}}><option value="">Mọi khoa</option>{departments.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select>
      <select className="select" value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}><option value="">Mọi loại</option>{deviceCategories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <select className="select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Mọi trạng thái</option>{deviceStatusOptions.map(s=><option value={s.value} key={s.value}>{s.label}</option>)}</select>
    </div>
    <div className="card table-container"><table className="table"><thead><tr><th>Mã</th><th>Tên thiết bị</th><th>Trạng thái</th><th>QR</th></tr></thead><tbody>{data.items.map(d=><tr key={d.id}><td>{d.device_code}</td><td>{d.name}</td><td>{d.current_status}</td><td><button className="btn-secondary" onClick={()=>setSelected(d)}>Xem QR</button></td></tr>)}</tbody></table></div>
    <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage}/>
    <Modal isOpen={Boolean(selected)} onClose={()=>setSelected(null)} title="QR thiết bị">{selected && <><DeviceQRCode device={selected}/><button className="btn-secondary mt-3" onClick={()=>window.print()}>In QR</button></>}</Modal>
  </div>;
}
