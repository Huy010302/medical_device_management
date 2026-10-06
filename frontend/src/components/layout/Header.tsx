import { useState } from 'react';
import { AlertTriangle, Bell, Clock, LogOut, Menu, Shield, User } from 'lucide-react';
import { ROLE_LABELS, useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export default function Header({ onOpenSidebar }: HeaderProps) {
  const { currentUser, logout } = useAuth();
  const { maintenanceRecords, receptionRecords } = useStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const warrantyAlerts = receptionRecords.filter(r => {
    if (!r.warranty_end) return false;
    const end = new Date(r.warranty_end);
    return end > now && end <= in60Days;
  });

  const overdueMaintenances = maintenanceRecords.filter(m => {
    if (!m.scheduled_date || m.actual_date) return false;
    return new Date(m.scheduled_date) < now;
  });

  const totalAlerts = warrantyAlerts.length + overdueMaintenances.length;
  const initials = currentUser?.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenSidebar} className="btn-icon lg:hidden" aria-label="Mở menu">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">Hệ thống Quản lý Vòng đời Thiết bị Y tế</h2>
          <p className="text-xs text-slate-500 truncate">Bệnh viện Đa khoa Quảng Nam</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative">
          <button
            onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
            className="relative btn-icon"
            aria-label="Thông báo"
          >
            <Bell size={20} className="text-slate-600" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {totalAlerts}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] card shadow-xl z-50">
              <div className="card-header flex items-center justify-between">
                <h3 className="text-sm font-semibold">Thông báo ({totalAlerts})</h3>
                <span className="text-[11px] text-slate-400">60 ngày tới</span>
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                {warrantyAlerts.map(r => (
                  <div key={r.id} className="px-4 py-3 border-b border-slate-50 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-800">Bảo hành sắp hết</p>
                      <p className="text-xs text-slate-500">S/N: {r.serial_number} - Hết hạn: {r.warranty_end}</p>
                    </div>
                  </div>
                ))}
                {overdueMaintenances.map(m => (
                  <div key={m.id} className="px-4 py-3 border-b border-slate-50 flex items-start gap-3">
                    <Clock size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-800">Bảo trì quá hạn</p>
                      <p className="text-xs text-slate-500">Dự kiến: {m.scheduled_date} - {m.description?.substring(0, 50)}</p>
                    </div>
                  </div>
                ))}
                {totalAlerts === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">Không có thông báo</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
            className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200"
          >
            <div className="w-9 h-9 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">
              {initials || <User size={16} />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-800 leading-4">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500 leading-4">{currentUser ? ROLE_LABELS[currentUser.role] : ''}</p>
            </div>
          </button>

          {showUserMenu && currentUser && (
            <div className="absolute right-0 top-full mt-2 w-72 card shadow-xl z-50 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <p className="font-semibold text-slate-900">{currentUser.name}</p>
                <p className="text-xs text-slate-500 mt-1">{currentUser.email}</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-50 text-primary-700 border border-primary-100 px-3 py-1 text-xs font-semibold">
                  <Shield size={13} /> {ROLE_LABELS[currentUser.role]}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs text-slate-500">Khoa/Phòng</p>
                <p className="text-sm font-medium text-slate-800">{currentUser.department}</p>
              </div>
              <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 border-t border-slate-100">
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
