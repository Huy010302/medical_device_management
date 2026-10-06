import { v4 as uuidv4 } from 'uuid';
import type { Device, DeviceStatus, TimelineEvent, TenderingRecord, PurchaseRecord, PurchaseStatus, ReceptionRecord, MaintenanceRecord, RepairRecord, TransferRecord, DisposalRecord, OperationLog, ReplacementPartLog } from '@/types/lifecycle';

export function generateDeviceCode(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MED-${year}-${code}`;
}

export function generateId(): string {
  return uuidv4();
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  tendering: 'Đấu thầu',
  approved: 'Đã phê duyệt',
  purchased: 'Đang mua sắm',
  received: 'Đã tiếp nhận',
  operating: 'Đang vận hành',
  maintenance: 'Đang bảo trì',
  maintenance_pending: 'Bảo trì chưa hoàn thành',
  needs_repair: 'Cần sửa chữa',
  repairing: 'Đang sửa chữa',
  awaiting_parts: 'Chờ linh kiện',
  irreparable: 'Không sửa được',
  disposed: 'Đã thanh lý',
};

const LEGACY_STATUS_LABELS: Record<string, string> = {
  operational: 'Đang vận hành (mã cũ)',
  repair: 'Đang sửa chữa (mã cũ)',
  inactive: 'Ngừng sử dụng',
};

/** Keep the stored status code intact when an old import damaged its label. */
export function readableStatusLabel(value: string, label?: string | null): string {
  const raw = (label || '').trim();
  if (raw && !/[?\uFFFD]|Ã|Â/.test(raw)) return raw;
  return STATUS_LABELS[value as DeviceStatus]
    || LEGACY_STATUS_LABELS[value]
    || value.replace(/[_-]+/g, ' ');
}

export const STATUS_COLORS: Record<DeviceStatus, string> = {
  tendering: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-blue-100 text-blue-800 border-blue-300',
  purchased: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  received: 'bg-purple-100 text-purple-800 border-purple-300',
  operating: 'bg-green-100 text-green-800 border-green-300',
  maintenance: 'bg-orange-100 text-orange-800 border-orange-300',
  maintenance_pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  needs_repair: 'bg-red-100 text-red-800 border-red-300',
  repairing: 'bg-red-100 text-red-800 border-red-300',
  awaiting_parts: 'bg-amber-100 text-amber-800 border-amber-300',
  irreparable: 'bg-gray-200 text-gray-900 border-gray-400',
  disposed: 'bg-gray-100 text-gray-800 border-gray-300',
};


const STATUS_ALIASES: Record<string, DeviceStatus> = { operational: 'operating', repair: 'repairing', inactive: 'irreparable' };
export function statusBadgeClass(status: string): string {
  const key = (STATUS_ALIASES[status] || status) as DeviceStatus;
  return STATUS_COLORS[key] || 'bg-slate-100 text-slate-700 border-slate-300';
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending_contract: 'Chờ ký hợp đồng',
  contract_signed: 'Đã ký hợp đồng',
  delivering: 'Đang giao hàng',
  received: 'Đã tiếp nhận',
  completed: 'Hoàn tất mua sắm',
  cancelled: 'Đã hủy mua sắm',
};

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, string> = {
  pending_contract: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  contract_signed: 'bg-blue-100 text-blue-800 border-blue-300',
  delivering: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  received: 'bg-purple-100 text-purple-800 border-purple-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

export function formatDate(date: string): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('vi-VN');
}


export function getTenderDeviceIds(tender: TenderingRecord): string[] {
  const ids = tender.device_ids && tender.device_ids.length > 0
    ? tender.device_ids
    : tender.tender_items?.flatMap(item => item.device_ids) || [tender.device_id];

  return Array.from(new Set(ids.filter(Boolean)));
}

export function tenderIncludesDevice(tender: TenderingRecord, deviceId: string): boolean {
  return getTenderDeviceIds(tender).includes(deviceId);
}

export function getTenderDeviceSummary(tender: TenderingRecord, devices: Device[]): string {
  const ids = getTenderDeviceIds(tender);
  if (ids.length === 0) return 'Chưa có thiết bị';

  const names = ids
    .map(id => devices.find(device => device.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return `${ids.length} thiết bị`;

  const preview = names.slice(0, 2).join(', ');
  return ids.length > 2 ? `${preview} +${ids.length - 2} thiết bị` : preview;
}

export function getPurchaseDeviceIds(purchase: PurchaseRecord): string[] {
  const ids = purchase.device_ids && purchase.device_ids.length > 0
    ? purchase.device_ids
    : purchase.purchase_items?.flatMap(item => item.device_ids) || [purchase.device_id];

  return Array.from(new Set(ids.filter(Boolean)));
}

export function purchaseIncludesDevice(purchase: PurchaseRecord, deviceId: string): boolean {
  return getPurchaseDeviceIds(purchase).includes(deviceId);
}

export function getPurchaseDeviceSummary(purchase: PurchaseRecord, devices: Device[]): string {
  const ids = getPurchaseDeviceIds(purchase);
  if (ids.length === 0) return 'Chưa có thiết bị';

  const names = ids
    .map(id => devices.find(device => device.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return `${ids.length} thiết bị`;

  const preview = names.slice(0, 2).join(', ');
  return ids.length > 2 ? `${preview} +${ids.length - 2} thiết bị` : preview;
}

export function getPurchaseStatus(purchase: PurchaseRecord): PurchaseStatus {
  return purchase.purchase_status || (purchase.contract_number ? 'contract_signed' : 'pending_contract');
}

export function buildTimeline(
  tenders: TenderingRecord[],
  purchases: PurchaseRecord[],
  receptions: ReceptionRecord[],
  operations: OperationLog[],
  maintenances: MaintenanceRecord[],
  repairs: RepairRecord[],
  replacements: ReplacementPartLog[],
  transfers: TransferRecord[],
  disposals: DisposalRecord[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  tenders.forEach(t => {
    events.push({
      id: t.id,
      date: t.tender_date || t.created_at,
      type: 'tendering',
      title: 'Đấu thầu',
      description: `Gói thầu: ${t.tender_name} - ${t.tender_code}`,
      icon: 'FileText',
      color: 'text-yellow-600',
    });
    if (t.decision_date) {
      events.push({
        id: t.id + '-approved',
        date: t.decision_date,
        type: 'approved',
        title: 'Phê duyệt kết quả thầu',
        description: `QĐ số: ${t.decision_number} - NCC: ${t.winning_vendor}`,
        icon: 'CheckCircle',
        color: 'text-blue-600',
      });
    }
  });

  purchases.forEach(p => {
    events.push({
      id: p.id,
      date: p.contract_date || p.created_at,
      type: 'purchased',
      title: p.contract_number ? 'Ký hợp đồng mua sắm' : 'Hồ sơ mua sắm được tạo',
      description: `${p.contract_number ? `HĐ: ${p.contract_number}` : 'Chờ ký hợp đồng'} - ${p.vendor_name || 'Chưa cập nhật NCC'} - ${formatCurrency(p.total_value)}`,
      icon: 'ShoppingCart',
      color: 'text-indigo-600',
    });
  });

  receptions.forEach(r => {
    events.push({
      id: r.id,
      date: r.reception_date || r.created_at,
      type: 'received',
      title: 'Tiếp nhận & Nghiệm thu',
      description: `S/N: ${r.serial_number} - Mã TS: ${r.asset_code} - KQ: ${r.acceptance_status === 'passed' ? 'Đạt' : r.acceptance_status === 'failed' ? 'Không đạt' : 'Có điều kiện'}`,
      icon: 'PackageCheck',
      color: 'text-purple-600',
    });
    if (r.commissioning_date) {
      events.push({
        id: r.id + '-commission',
        date: r.commissioning_date,
        type: 'operating',
        title: 'Đưa vào vận hành',
        description: `Đặt tại: ${r.initial_location}`,
        icon: 'Play',
        color: 'text-green-600',
      });
    }
  });

  operations.forEach(o => {
    const typeLabels: Record<string, string> = {
      routine_check: 'Kiểm tra định kỳ',
      incident: 'Sự cố',
      transfer: 'Điều chuyển',
      calibration: 'Hiệu chuẩn',
    };
    events.push({
      id: o.id,
      date: o.log_date || o.created_at,
      type: 'operation',
      title: typeLabels[o.log_type] || o.log_type,
      description: o.description,
      icon: 'Activity',
      color: o.result === 'abnormal' ? 'text-red-600' : 'text-green-600',
    });
  });

  maintenances.forEach(m => {
    events.push({
      id: m.id,
      date: m.actual_date || m.scheduled_date || m.created_at,
      type: 'maintenance',
      title: `Bảo trì ${m.maintenance_type === 'preventive' ? 'định kỳ' : m.maintenance_type === 'corrective' ? 'sửa chữa' : 'hiệu chuẩn'}`,
      description: `${m.description} - Chi phí: ${formatCurrency(m.cost)}`,
      icon: 'Wrench',
      color: 'text-orange-600',
    });
  });

  repairs.forEach(r => {
    events.push({
      id: r.id,
      date: r.report_date || r.created_at,
      type: 'repair',
      title: 'Sửa chữa',
      description: `Lỗi: ${r.fault_description} - Chi phí: ${formatCurrency(r.total_cost)}`,
      icon: 'Settings',
      color: 'text-red-600',
    });
  });

  replacements.forEach(rp => {
    events.push({
      id: rp.id,
      date: rp.replacement_date || rp.created_at,
      type: 'replacement',
      title: 'Thay thế linh kiện',
      description: `${rp.part_name} (x${rp.quantity}) - ${formatCurrency(rp.unit_price * rp.quantity)}`,
      icon: 'Cpu',
      color: 'text-amber-600',
    });
  });

  transfers.forEach(t => {
    events.push({
      id: t.id,
      date: t.transfer_date || t.created_at,
      type: 'transfer',
      title: 'Điều chuyển',
      description: `${t.from_location} → ${t.to_location} - Lý do: ${t.reason}`,
      icon: 'ArrowRightLeft',
      color: 'text-cyan-600',
    });
  });

  disposals.forEach(d => {
    events.push({
      id: d.id,
      date: d.disposal_date || d.created_at,
      type: 'disposed',
      title: 'Thanh lý',
      description: `Phương thức: ${d.disposal_method} - Giá trị thu hồi: ${formatCurrency(d.disposal_value)}`,
      icon: 'Trash2',
      color: 'text-gray-600',
    });
  });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}
