import {useState} from 'react';
import UserManagementPage from './UserManagementPage';
import MasterDataPage from './MasterDataPage';
import AuditLogsPage from './AuditLogsPage';
type Tab='users'|'departments'|'device-categories'|'device-statuses'|'audit';
const tabs:[Tab,string][]=[['users','Người dùng'],['departments','Khoa phòng'],['device-categories','Loại thiết bị'],['device-statuses','Trạng thái'],['audit','Nhật ký thay đổi']];
export default function AdministrationPage(){
 const [tab,setTab]=useState<Tab>('users');
 return <div className="space-y-5"><h1 className="text-2xl font-bold">Quản trị hệ thống</h1><div className="flex flex-wrap gap-2" role="tablist">{tabs.map(([key,label])=><button role="tab" aria-selected={tab===key} key={key} className={tab===key?'btn-primary':'btn-secondary'} onClick={()=>setTab(key)}>{label}</button>)}</div>{tab==='users'?<UserManagementPage/>:tab==='audit'?<AuditLogsPage/>:<MasterDataPage kind={tab}/>}</div>;
}
