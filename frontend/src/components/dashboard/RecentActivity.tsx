import { Activity, FileText, ShoppingCart, Wrench, Settings, Trash2, ArrowRightLeft } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatDate, getPurchaseDeviceIds, getPurchaseDeviceSummary, getTenderDeviceIds, getTenderDeviceSummary } from '@/lib/deviceUtils';

interface ActivityItem {
  date: string;
  type: string;
  description: string;
  deviceName: string;
}

export default function RecentActivity() {
  const { devices, tenderingRecords, purchaseRecords, receptionRecords, maintenanceRecords, repairRecords, transferRecords, disposalRecords } = useStore();

  const getDeviceName = (id: string) => devices.find(d => d.id === id)?.name || 'N/A';

  const activities: ActivityItem[] = [];

  tenderingRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'tender', description: `Đấu thầu: ${r.tender_name}`, deviceName: `${getTenderDeviceSummary(r, devices)} (${getTenderDeviceIds(r).length} thiết bị)` });
  });
  purchaseRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'purchase', description: r.contract_number ? `Ký HĐ: ${r.contract_number}` : 'Tạo hồ sơ mua sắm chờ ký HĐ', deviceName: `${getPurchaseDeviceSummary(r, devices)} (${getPurchaseDeviceIds(r).length} thiết bị)` });
  });
  receptionRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'reception', description: `Tiếp nhận: S/N ${r.serial_number}`, deviceName: getDeviceName(r.device_id) });
  });
  maintenanceRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'maintenance', description: `Bảo trì: ${r.description?.substring(0, 50)}`, deviceName: getDeviceName(r.device_id) });
  });
  repairRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'repair', description: `Sửa chữa: ${r.fault_description?.substring(0, 50)}`, deviceName: getDeviceName(r.device_id) });
  });
  transferRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'transfer', description: `Điều chuyển: ${r.from_location} → ${r.to_location}`, deviceName: getDeviceName(r.device_id) });
  });
  disposalRecords.forEach(r => {
    activities.push({ date: r.created_at, type: 'disposal', description: `Thanh lý: ${r.reason?.substring(0, 50)}`, deviceName: getDeviceName(r.device_id) });
  });

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent = activities.slice(0, 8);

  const iconMap: Record<string, typeof Activity> = {
    tender: FileText,
    purchase: ShoppingCart,
    reception: Activity,
    maintenance: Wrench,
    repair: Settings,
    transfer: ArrowRightLeft,
    disposal: Trash2,
  };

  const colorMap: Record<string, string> = {
    tender: 'bg-yellow-100 text-yellow-600',
    purchase: 'bg-indigo-100 text-indigo-600',
    reception: 'bg-purple-100 text-purple-600',
    maintenance: 'bg-orange-100 text-orange-600',
    repair: 'bg-red-100 text-red-600',
    transfer: 'bg-cyan-100 text-cyan-600',
    disposal: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-gray-800">Hoạt động gần đây</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {recent.map((act, i) => {
          const Icon = iconMap[act.type] || Activity;
          return (
            <div key={i} className="px-6 py-3 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[act.type] || 'bg-gray-100 text-gray-600'}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{act.description}</p>
                <p className="text-xs text-gray-500">{act.deviceName}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(act.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
