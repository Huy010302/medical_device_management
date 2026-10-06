import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  LayoutDashboard,
  Monitor,
  QrCode,
  Settings,
  ShoppingCart,
  Stethoscope,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { Page } from '@/types/auth';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}

const sections: {title:string;items:{id:Page;label:string;icon:typeof LayoutDashboard}[]}[]=[
 {title:'Tổng quan',items:[{id:'dashboard',label:'Dashboard',icon:LayoutDashboard}]},
 {title:'Thiết bị',items:[{id:'devices',label:'Danh sách thiết bị',icon:Monitor},{id:'qrcode',label:'QR Code',icon:QrCode},{id:'risk',label:'Nguy cơ thiết bị',icon:BarChart3}]},
 {title:'Nghiệp vụ',items:[{id:'maintenance',label:'Bảo trì',icon:Wrench},{id:'repairs',label:'Sửa chữa',icon:Settings},{id:'transfer',label:'Điều chuyển',icon:Settings},{id:'disposal',label:'Thanh lý',icon:Trash2}]},
 {title:'Mua sắm',items:[{id:'tendering',label:'Đấu thầu',icon:FileText},{id:'purchasing',label:'Hợp đồng',icon:ShoppingCart},{id:'receiving',label:'Tiếp nhận',icon:ShoppingCart}]},
 {title:'Phân tích',items:[{id:'bigdata',label:'Big Data',icon:Database},{id:'cost',label:'Chi phí vòng đời',icon:BarChart3},{id:'failure',label:'Phân tích lỗi',icon:BarChart3},{id:'reports',label:'Báo cáo',icon:FileText}]},
 {title:'Quản trị',items:[{id:'administration',label:'Người dùng · Danh mục · Nhật ký',icon:Users}]},
];

export default function Sidebar({ currentPage, onNavigate, collapsed, mobileOpen, onToggle, onCloseMobile }: SidebarProps) {
  const { hasPageAccess } = useAuth();


  return (
    <aside className={`fixed left-0 top-0 h-full w-64 ${collapsed ? 'lg:w-16' : 'lg:w-64'} bg-sidebar text-white z-40 transition-all duration-300 flex flex-col ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-900/20">
          <Stethoscope size={18} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <h1 className="text-base font-bold leading-tight">MedDevice</h1>
            <p className="text-[10px] text-slate-400 leading-tight">Quản lý thiết bị y tế</p>
          </div>
        )}
        <button onClick={onCloseMobile} className="lg:hidden btn-icon text-slate-300 hover:text-white hover:bg-white/10" aria-label="Đóng menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1 px-2">
          {sections.map(section => {
            const visible=section.items.filter(item=>hasPageAccess(item.id));
            return visible.length ? <li key={section.title}><p className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-widest text-slate-400">{!collapsed&&section.title}</p><ul className="space-y-1">{visible.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sidebar-active text-white shadow-lg shadow-primary-600/25'
                      : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              </li>
            );
          })}</ul></li> : null;
          })}
        </ul>
      </nav>

      <button
        onClick={onToggle}
        className="hidden lg:flex items-center justify-center p-3 border-t border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}

export type { Page };
