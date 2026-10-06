import {useCallback,useEffect,useState} from 'react';
import {apiJson} from '@/lib/api';
import {readableStatusLabel} from '@/lib/deviceUtils';

type Row={id?:string;value?:string;code?:string;name?:string;label?:string;description?:string;is_active?:boolean};
type Kind='departments'|'device-categories'|'device-statuses';
const meta:Record<Kind,{title:string;code:string;name:string}>={
  departments:{title:'Khoa phòng',code:'Mã khoa',name:'Tên khoa'},
  'device-categories':{title:'Loại thiết bị',code:'Mã loại',name:'Tên loại'},
  'device-statuses':{title:'Trạng thái thiết bị',code:'Giá trị',name:'Nhãn'},
};
export default function MasterDataPage({kind}:{kind:Kind}){
  const [rows,setRows]=useState<Row[]>([]),[draft,setDraft]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const config=meta[kind], key=kind==='device-statuses'?'value':'id';
  const load=useCallback(()=>{apiJson<Row[]>(`/${kind}`).then(setRows).catch(e=>setError(String(e)));},[kind]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{
    if(!draft) return;
    const name=(kind==='device-statuses'?draft.label:draft.name)?.trim();
    const code=(kind==='device-statuses'?draft.value:draft.code)?.trim();
    if(!code||!name){setError('Cần nhập mã và tên.');return;}
    setBusy(true);setError('');
    try{
      const editing=rows.some(row=>row[key]===draft[key]);
      await apiJson(`/${kind}${editing?`/${encodeURIComponent(String(draft[key]))}`:''}`,{method:editing?'PATCH':'POST',body:JSON.stringify({...draft,[kind==='device-statuses'?'value':'code']:code,[kind==='device-statuses'?'label':'name']:name})});
      setDraft(null);load();window.dispatchEvent(new Event('mdlm:master-updated'));
    }catch(e){setError(String(e));}finally{setBusy(false);}
  };
  const remove=async(row:Row)=>{
    if(!window.confirm(`Ngừng sử dụng ${row.name||row.label}?`))return;
    try{await apiJson(`/${kind}/${encodeURIComponent(String(row[key]))}`,{method:'DELETE'});load();window.dispatchEvent(new Event('mdlm:master-updated'));}catch(e){setError(String(e));}
  };
  const toggle=async(row:Row)=>{
    try{await apiJson(`/${kind}/${encodeURIComponent(String(row[key]))}`,{method:'PATCH',body:JSON.stringify({is_active:row.is_active===false})});load();window.dispatchEvent(new Event('mdlm:master-updated'));}catch(e){setError(String(e));}
  };
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Quản trị · {config.title}</h1>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <button className="btn-primary" onClick={()=>setDraft({is_active:true})}>Thêm {config.title.toLowerCase()}</button>
    {draft&&<div className="card p-4 flex flex-wrap gap-3"><input className="input" placeholder={config.code} disabled={Boolean(draft[key])} value={kind==='device-statuses'?draft.value||'':draft.code||''} onChange={e=>setDraft({...draft,[kind==='device-statuses'?'value':'code']:e.target.value})}/><input className="input" placeholder={config.name} value={kind==='device-statuses'?draft.label||'':draft.name||''} onChange={e=>setDraft({...draft,[kind==='device-statuses'?'label':'name']:e.target.value})}/><input className="input" placeholder="Mô tả" value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})}/><button className="btn-primary" disabled={busy} onClick={()=>void save()}>Lưu</button><button className="btn-secondary" onClick={()=>setDraft(null)}>Hủy</button></div>}
    <div className="card table-container"><table className="table"><thead><tr><th>{config.code}</th><th>{config.name}</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(row=><tr key={row[key]}><td>{kind==='device-statuses'?row.value:row.code}</td><td>{kind==='device-statuses'?readableStatusLabel(row.value||'',row.label):row.name}</td><td>{row.is_active===false?'Inactive':'Active'}</td><td className="space-x-2"><button className="btn-secondary" onClick={()=>setDraft(kind==='device-statuses'?{...row,label:readableStatusLabel(row.value||'',row.label)}:row)}>Sửa</button><button className="btn-secondary" onClick={()=>void toggle(row)}>{row.is_active===false?'Kích hoạt':'Ngừng dùng'}</button><button className="btn-secondary" onClick={()=>void remove(row)}>Xóa</button></td></tr>)}</tbody></table></div>
  </div>;
}
