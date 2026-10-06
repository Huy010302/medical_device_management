import { useEffect, useState } from 'react';
import { ArrowLeft, Info, Clock, FileText, Wrench, Paperclip, Plus, AlertTriangle, Pencil, Download } from 'lucide-react';
import { useStore } from '@/lib/store';
import { apiJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate, generateId, getTenderDeviceIds, getPurchaseDeviceIds, getPurchaseStatus, purchaseIncludesDevice, tenderIncludesDevice } from '@/lib/deviceUtils';
import type { Attachment, Device, MaintenanceRecord, MaintenanceResult, RepairRecord, ReplacementPartLog, ReplacementPartStatus } from '@/types/lifecycle';
import DeviceQRCode from './DeviceQRCode';
import DeviceTimeline from './DeviceTimeline';
import Modal from '@/components/ui/Modal';
import MaintenanceForm from '@/components/lifecycle/MaintenanceForm';
import RepairForm from '@/components/lifecycle/RepairForm';
import AttachmentUploader, { formatFileSize } from '@/components/ui/AttachmentUploader';

interface Props {
  device: Device;
  onBack: () => void;
}

const formatDateOnly = (value: string): string => {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
};

type Tab = 'info' | 'timeline' | 'procurement' | 'maintenance' | 'documents';
type ServiceRecord<T> = T & { _source?: 'workflow' | 'legacy' };
interface ServiceHistory {
  maintenance_records: ServiceRecord<MaintenanceRecord>[];
  repair_records: ServiceRecord<RepairRecord>[];
  replacement_parts: ServiceRecord<ReplacementPartLog>[];
  events: { id: string; event_type: string; timestamp: string; metadata: Record<string, unknown> }[];
}

export default function DeviceProfile({ device, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('info');
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [editMaintenance, setEditMaintenance] = useState<MaintenanceRecord | null>(null);
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [editRepair, setEditRepair] = useState<RepairRecord | null>(null);
  const [showPartCostForm, setShowPartCostForm] = useState(false);
  const [editPart, setEditPart] = useState<ReplacementPartLog | null>(null);
  const { can } = useAuth();
  const {
    devices, allDevices, tenderingRecords, purchaseRecords, receptionRecords,
    maintenanceRecords, repairRecords, replacementParts, transferRecords, disposalRecords,
    addReplacementPart, updateReplacementPart, updateMaintenanceRecord,
    getDeviceStatusLabel, getDeviceStatusColor, getPurchaseStatusLabel,
  } = useStore();

  // Luôn lấy bản mới nhất từ store. Nếu chỉ dùng object device truyền từ DeviceList,
  // màn hình hồ sơ có thể bị stale sau khi đổi trạng thái hoặc tạo phiếu tự động.
  const profileDevice = allDevices.find(d => d.id === device.id) || devices.find(d => d.id === device.id) || device;
  const profileDeviceId = profileDevice.id;
  const [history, setHistory] = useState<ServiceHistory | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (active) setHistoryLoading(true);
      void apiJson<ServiceHistory>(`/devices/${encodeURIComponent(profileDeviceId)}/service-history`)
        .then(data => { if (active) { setHistory(data); setHistoryError(''); } })
        .catch(error => { if (active) { setHistory(null); setHistoryError(error instanceof Error ? error.message : String(error)); } })
        .finally(() => { if (active) setHistoryLoading(false); });
    };
    load();
    window.addEventListener('mdlm:record-saved', load);
    return () => { active = false; window.removeEventListener('mdlm:record-saved', load); };
  }, [profileDeviceId]);
  const canWriteWorkflow = can('workflow:create');
  const canUpdateWorkflow = can('workflow:update');

  const tenders = tenderingRecords.filter(r => tenderIncludesDevice(r, profileDeviceId));
  const purchases = purchaseRecords.filter(r => purchaseIncludesDevice(r, profileDeviceId));
  const receptions = receptionRecords.filter(r => r.device_id === profileDeviceId);
  const maintenances: ServiceRecord<MaintenanceRecord>[] = history?.maintenance_records || maintenanceRecords.filter(r => r.device_id === profileDeviceId).map(r => ({ ...r, _source: 'workflow' }));
  const repairs: ServiceRecord<RepairRecord>[] = history?.repair_records || repairRecords.filter(r => r.device_id === profileDeviceId).map(r => ({ ...r, _source: 'workflow' }));
  const parts: ServiceRecord<ReplacementPartLog>[] = history?.replacement_parts || replacementParts.filter(r => r.device_id === profileDeviceId).map(r => ({ ...r, _source: 'workflow' }));
  const transfers = transferRecords.filter(r => r.device_id === profileDeviceId);
  const disposals = disposalRecords.filter(r => r.device_id === profileDeviceId);

  const documents = [
    ...tenders.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `tender-${record.id}-${index}`,
      source: 'Đấu thầu',
      detail: record.tender_code || record.tender_name,
      date: record.tender_date || record.created_at,
      attachment,
    }))),
    ...purchases.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `purchase-${record.id}-${index}`,
      source: 'Mua sắm / Hợp đồng',
      detail: record.contract_number || record.vendor_name,
      date: record.contract_date || record.created_at,
      attachment,
    }))),
    ...receptions.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `reception-${record.id}-${index}`,
      source: 'Nghiệm thu',
      detail: record.asset_code || record.serial_number,
      date: record.reception_date || record.created_at,
      attachment,
    }))),
    ...maintenances.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `maintenance-${record.id}-${index}`,
      source: 'Bảo trì',
      detail: record.description || record.service_company,
      date: record.actual_date || record.scheduled_date || record.created_at,
      attachment,
    }))),
    ...repairs.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `repair-${record.id}-${index}`,
      source: 'Sửa chữa',
      detail: record.fault_description || record.repair_company,
      date: record.repair_end_date || record.repair_start_date || record.report_date || record.created_at,
      attachment,
    }))),
    ...parts.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `part-${record.id}-${index}`,
      source: 'Linh kiện / Chi phí',
      detail: record.part_name || record.vendor,
      date: record.replacement_date || record.created_at,
      attachment,
    }))),
    ...transfers.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `transfer-${record.id}-${index}`,
      source: 'Điều chuyển',
      detail: `${record.from_location || '—'} → ${record.to_location || '—'}`,
      date: record.transfer_date || record.created_at,
      attachment,
    }))),
    ...disposals.flatMap(record => (record.attachments || []).map((attachment, index) => ({
      id: `disposal-${record.id}-${index}`,
      source: 'Thanh lý',
      detail: record.decision_number || record.reason,
      date: record.disposal_date || record.created_at,
      attachment,
    }))),
  ].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

  const totalMaintenanceCost = maintenances.reduce((s, m) => s + (m.cost || 0), 0);
  const totalRepairCost = repairs.reduce((s, r) => s + (r.total_cost || 0), 0);
  const totalPartsCost = parts.reduce((s, p) => s + (p.quantity * p.unit_price || 0), 0);
  const openRepairs = [...repairs]
    .filter(r => !['completed', 'irreparable'].includes(r.repair_status))
    .sort((a, b) => new Date(b.created_at || b.report_date || '').getTime() - new Date(a.created_at || a.report_date || '').getTime());
  const currentRepair = openRepairs[0];
  const repairSteps = [
    { key: 'reported', label: 'Đã báo hỏng' },
    { key: 'in_progress', label: 'Đang sửa' },
    { key: 'awaiting_parts', label: 'Chờ linh kiện' },
    { key: 'completed', label: 'Sửa xong' },
  ];
  const currentRepairStepIndex = currentRepair
    ? repairSteps.findIndex(step => step.key === currentRepair.repair_status)
    : -1;
  const deviceAlert = (() => {
    switch (profileDevice.current_status) {
      case 'maintenance_pending':
        return {
          tone: 'yellow',
          title: 'Bảo trì chưa hoàn thành',
          message: 'Thiết bị chưa được xác nhận hoàn tất bảo trì. Cần tiếp tục xử lý trước khi đưa vào vận hành bình thường.',
        };
      case 'needs_repair':
        return {
          tone: 'red',
          title: 'Thiết bị cần sửa chữa',
          message: 'Thiết bị có phiếu báo hỏng hoặc bảo trì phát hiện lỗi. Cần xử lý sửa chữa.',
        };
      case 'repairing':
        return {
          tone: 'blue',
          title: 'Thiết bị đang sửa chữa',
          message: 'Thiết bị đang trong quá trình sửa chữa, không nên ghi nhận là vận hành bình thường.',
        };
      case 'awaiting_parts':
        return {
          tone: 'amber',
          title: 'Thiết bị đang chờ linh kiện',
          message: 'Thiết bị đang chờ linh kiện/chi phí thay thế để hoàn tất sửa chữa.',
        };
      case 'irreparable':
        return {
          tone: 'gray',
          title: 'Thiết bị không sửa được',
          message: 'Thiết bị cần được xem xét thanh lý hoặc thay thế.',
        };
      default:
        return null;
    }
  })();


  const getMaintenanceResultLabel = (result: MaintenanceResult) => {
    if (result === 'completed') return 'Hoàn thành';
    if (result === 'needs_repair') return 'Cần sửa chữa';
    return 'Chưa hoàn thành';
  };

  const getMaintenanceResultBadge = (result: MaintenanceResult) => {
    if (result === 'completed') return 'bg-green-100 text-green-700 border-green-200';
    if (result === 'needs_repair') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  const handleMaintenanceResultChange = (record: MaintenanceRecord, result: MaintenanceResult) => {
    const today = new Date().toISOString().slice(0, 10);
    updateMaintenanceRecord({
      ...record,
      result,
      actual_date: result === 'completed' ? (record.actual_date || today) : record.actual_date,
    });
  };

  const tabs: { id: Tab; label: string; icon: typeof Info }[] = [
    { id: 'info', label: 'Thông tin chung', icon: Info },
    { id: 'timeline', label: 'Vòng đời', icon: Clock },
    { id: 'procurement', label: 'Đấu thầu & Mua sắm', icon: FileText },
    { id: 'maintenance', label: 'Bảo trì & Sửa chữa', icon: Wrench },
    { id: 'documents', label: 'Tài liệu', icon: Paperclip },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{profileDevice.name}</h1>
            <span className={`badge ${getDeviceStatusColor(profileDevice.current_status)}`}>
              {getDeviceStatusLabel(profileDevice.current_status)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{profileDevice.device_code} • {profileDevice.manufacturer} {profileDevice.model}</p>
          {deviceAlert && (
            <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${deviceAlert.tone === 'red'
              ? 'bg-red-50 border-red-200 text-red-800'
              : deviceAlert.tone === 'yellow'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : deviceAlert.tone === 'amber'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : deviceAlert.tone === 'blue'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-800'
              }`}>
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{deviceAlert.title}</p>
                <p className="text-sm mt-1">{deviceAlert.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-all cursor-pointer ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card card-body">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Thông tin cơ bản</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Mã thiết bị" value={profileDevice.device_code} />
              <InfoRow label="Tên thiết bị" value={profileDevice.name} />
              <InfoRow label="Loại" value={profileDevice.category} />
              <InfoRow label="Hãng sản xuất" value={profileDevice.manufacturer} />
              <InfoRow label="Model" value={profileDevice.model} />
              <InfoRow label="Nước sản xuất" value={profileDevice.origin_country} />
              <InfoRow label="Đơn vị tính" value={profileDevice.unit} />
              <InfoRow label="Vị trí hiện tại" value={profileDevice.current_location || '—'} />
              <InfoRow label="Ngày tạo" value={formatDate(profileDevice.created_at)} />
              <InfoRow label="Cập nhật" value={formatDate(profileDevice.updated_at)} />
              {profileDevice.notes && <div className="col-span-2"><InfoRow label="Ghi chú" value={profileDevice.notes} /></div>}
            </div>
          </div>
          <div className="card card-body flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">QR Code</h3>
            <DeviceQRCode device={profileDevice} size={180} />
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="card card-body">
          <h3 className="text-sm font-semibold text-gray-800 mb-6">Vòng đời thiết bị</h3>
          <DeviceTimeline deviceId={profileDeviceId} />
        </div>
      )}

      {tab === 'procurement' && (
        <div className="space-y-4">
          {/* Tendering */}
          {tenders.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Đấu thầu</h3></div>
              <div className="card-body space-y-4">
                {tenders.map(t => (
                  <div key={t.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoRow label="Mã gói thầu" value={t.tender_code} />
                      <InfoRow label="Tên gói thầu" value={t.tender_name} />
                      <InfoRow label="Giá trị dự toán" value={formatCurrency(t.estimated_value)} />
                      <InfoRow label="Ngày mở thầu" value={formatDateOnly(t.tender_date)} />
                      <InfoRow label="NCC trúng thầu" value={t.winning_vendor || '—'} />
                      <InfoRow label="Giá trúng thầu" value={t.winning_bid_value ? formatCurrency(t.winning_bid_value) : '—'} />
                      <InfoRow label="Số QĐ phê duyệt" value={t.decision_number || '—'} />
                      <InfoRow label="Trạng thái" value={t.tender_status} />
                      <InfoRow label="Số thiết bị trong gói" value={`${getTenderDeviceIds(t).length} thiết bị`} />
                    </div>
                    {t.tender_items && t.tender_items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-2">Các dòng thiết bị thuộc gói thầu:</p>
                        <div className="space-y-2">
                          {t.tender_items.map(item => (
                            <div key={item.id} className={`rounded-lg border px-3 py-2 text-xs ${item.device_ids.includes(profileDeviceId) ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                              <div className="font-semibold">{item.name} × {item.quantity}</div>
                              <div>{item.manufacturer || '—'} {item.model || ''} · {formatCurrency(item.estimated_unit_value)} / {item.unit}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchases */}
          {purchases.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Hợp đồng mua sắm</h3></div>
              <div className="card-body space-y-4">
                {purchases.map(p => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoRow label="Số HĐ" value={p.contract_number || 'Chờ ký HĐ'} />
                      <InfoRow label="Trạng thái mua sắm" value={getPurchaseStatusLabel(getPurchaseStatus(p))} />
                      <InfoRow label="Ngày ký" value={formatDateOnly(p.contract_date)} />
                      <InfoRow label="Nhà cung cấp" value={p.vendor_name} />
                      <InfoRow label="Liên hệ" value={p.vendor_contact} />
                      <InfoRow label="Số thiết bị trong hợp đồng" value={`${getPurchaseDeviceIds(p).length} thiết bị`} />
                      <InfoRow label="Giá trị bình quân" value={formatCurrency(p.unit_price)} />
                      <InfoRow label="Tổng giá trị" value={formatCurrency(p.total_value)} />
                      <InfoRow label="Bảo hành" value={`${p.warranty_months} tháng`} />
                      <InfoRow label="Ngày giao dự kiến" value={formatDateOnly(p.delivery_date)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receptions */}
          {receptions.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Tiếp nhận & Nghiệm thu</h3></div>
              <div className="card-body space-y-4">
                {receptions.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoRow label="Ngày tiếp nhận" value={formatDateOnly(r.reception_date)} />
                      <InfoRow label="Số serial" value={r.serial_number} />
                      <InfoRow label="Mã tài sản" value={r.asset_code} />
                      <InfoRow label="Kết quả nghiệm thu" value={r.acceptance_status === 'passed' ? '✅ Đạt' : r.acceptance_status === 'failed' ? '❌ Không đạt' : '⚠️ Có điều kiện'} />
                      <InfoRow label="Ngày lắp đặt" value={formatDateOnly(r.installation_date)} />
                      <InfoRow label="Ngày vận hành" value={formatDateOnly(r.commissioning_date)} />
                      <InfoRow label="Bảo hành từ" value={formatDateOnly(r.warranty_start)} />
                      <InfoRow label="Bảo hành đến" value={formatDateOnly(r.warranty_end)} />
                      <InfoRow label="Vị trí lắp đặt" value={r.initial_location} />
                    </div>
                    {r.reception_committee.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-2">Hội đồng nghiệm thu:</p>
                        <div className="flex flex-wrap gap-2">
                          {r.reception_committee.map((m, i) => (
                            <span key={i} className="badge bg-blue-50 text-blue-700 border-blue-200">{m.name} - {m.title}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tenders.length === 0 && purchases.length === 0 && receptions.length === 0 && (
            <div className="card card-body text-center text-gray-400 py-12">Chưa có thông tin đấu thầu & mua sắm</div>
          )}
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-4">
          {historyLoading && <div className="card card-body text-sm text-slate-600">Đang tải lịch sử bảo trì, sửa chữa từ cơ sở dữ liệu...</div>}
          {historyError && <div className="card card-body text-sm text-red-700" role="alert">Không thể tải đầy đủ lịch sử thiết bị: {historyError}</div>}
          {/* Summary */}
          {!historyLoading && !historyError && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Chi phí bảo trì</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalMaintenanceCost)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Chi phí sửa chữa</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalRepairCost)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Chi phí linh kiện</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(totalPartsCost)}</p>
            </div>
          </div>}

          {!historyLoading && !historyError && currentRepair && (
            <div className="card card-body border-blue-200 bg-blue-50/60">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Ca sửa chữa đang mở</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{currentRepair.fault_description || 'Thiết bị đang được xử lý sửa chữa'}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Bắt đầu: {currentRepair.repair_start_date ? formatDateOnly(currentRepair.repair_start_date) : 'Chưa cập nhật'}
                    {' '}• Kết thúc: {currentRepair.repair_end_date ? formatDateOnly(currentRepair.repair_end_date) : 'Chưa hoàn tất'}
                  </p>
                </div>
                {canUpdateWorkflow && currentRepair._source !== 'legacy' && (
                  <button
                    type="button"
                    onClick={() => { setEditRepair(currentRepair); setShowRepairForm(true); }}
                    className="btn-secondary"
                  >
                    <Pencil size={16} /> Cập nhật ca sửa
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {repairSteps.map((step, index) => {
                  const isCurrent = step.key === currentRepair.repair_status;
                  const isDone = currentRepairStepIndex >= 0 && index < currentRepairStepIndex;
                  return (
                    <div
                      key={step.key}
                      className={`rounded-lg border px-3 py-2 text-sm ${isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : isDone
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-white text-slate-500 border-slate-200'
                        }`}
                    >
                      {index + 1}. {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {canWriteWorkflow && (
            <div className="card card-body">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Ghi nhận chi phí / nghiệp vụ cho thiết bị này</h3>
                  <p className="text-xs text-gray-500 mt-1">Các phiếu tạo tại đây sẽ tự gắn với {profileDevice.device_code} và cập nhật ngay vào bảng bên dưới.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setEditMaintenance(null); setShowMaintenanceForm(true); }} className="btn-secondary">
                    <Plus size={16} /> Bảo trì
                  </button>
                  <button type="button" onClick={() => { setEditRepair(null); setShowRepairForm(true); }} className="btn-secondary">
                    <Plus size={16} /> Sửa chữa
                  </button>
                  <button type="button" onClick={() => { setEditPart(null); setShowPartCostForm(true); }} className="btn-primary">
                    <Plus size={16} /> Kê linh kiện/chi phí
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Maintenance records */}
          {!historyLoading && !historyError && maintenances.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Bảo trì ({maintenances.length})</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Loại</th>
                      <th>Ngày lịch</th>
                      <th>Ngày thực tế</th>
                      <th>Người thực hiện</th>
                      <th>Kết quả</th>
                      <th>Mô tả</th>
                      <th>Chi phí</th>
                      {canUpdateWorkflow && <th>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {maintenances.map(m => (
                      <tr key={m.id}>
                        <td>{m.maintenance_type === 'preventive' ? 'Định kỳ' : m.maintenance_type === 'corrective' ? 'Sửa chữa' : 'Hiệu chuẩn'}</td>
                        <td>{formatDateOnly(m.scheduled_date)}</td>
                        <td>{m.actual_date ? formatDateOnly(m.actual_date) : '—'}</td>
                        <td>{m.performed_by || m.service_company}</td>
                        <td>
                          {canUpdateWorkflow && m._source !== 'legacy' ? (
                            <select
                              className={`select min-w-[150px] text-xs font-semibold ${getMaintenanceResultBadge(m.result)}`}
                              value={m.result}
                              onChange={e => handleMaintenanceResultChange(m, e.target.value as MaintenanceResult)}
                              title="Đổi kết quả bảo trì"
                            >
                              <option value="completed">Hoàn thành</option>
                              <option value="incomplete">Chưa hoàn thành</option>
                              <option value="needs_repair">Cần sửa chữa</option>
                            </select>
                          ) : (
                            <span className={`badge ${getMaintenanceResultBadge(m.result)}`}>
                              {getMaintenanceResultLabel(m.result)}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[260px] truncate text-gray-600" title={m.description}>{m.description || '—'}</td>
                        <td>{formatCurrency(m.cost)}</td>
                        {canUpdateWorkflow && (
                          <td>
                            {m._source !== 'legacy' ? <button
                              type="button"
                              onClick={() => { setEditMaintenance(m); setShowMaintenanceForm(true); }}
                              className="btn-secondary text-xs px-2 py-1"
                            >
                              Cập nhật
                            </button> : <span className="text-xs text-gray-500">Dữ liệu cũ</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Repair records */}
          {!historyLoading && !historyError && repairs.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Sửa chữa ({repairs.length})</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ngày báo</th>
                      <th>Mô tả lỗi</th>
                      <th>Đơn vị sửa</th>
                      <th>Trạng thái</th>
                      <th>Công việc</th>
                      <th>Chi phí</th>
                      <th>Bảo hành</th>
                      {canUpdateWorkflow && <th>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {repairs.map(r => (
                      <tr key={r.id}>
                        <td>{formatDateOnly(r.report_date)}</td>
                        <td className="max-w-[200px] truncate">{r.fault_description}</td>
                        <td>{r.repair_company}</td>
                        <td>
                          <span className={`badge ${r.repair_status === 'completed'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : r.repair_status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : r.repair_status === 'awaiting_parts'
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : r.repair_status === 'irreparable'
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}>
                            {r.repair_status === 'completed'
                              ? 'Hoàn thành'
                              : r.repair_status === 'in_progress'
                                ? 'Đang sửa'
                                : r.repair_status === 'awaiting_parts'
                                  ? 'Chờ linh kiện'
                                  : r.repair_status === 'irreparable'
                                    ? 'Không sửa được'
                                    : 'Đã báo'}
                          </span>
                        </td>
                        <td className="max-w-[260px] truncate text-gray-600" title={r.repair_description}>{r.repair_description || '—'}</td>
                        <td>{formatCurrency(r.total_cost)}</td>
                        <td>{r.warranty_claim ? '✅' : '—'}</td>
                        {canUpdateWorkflow && (
                          <td>
                            {r._source !== 'legacy' ? <button
                              type="button"
                              onClick={() => { setEditRepair(r); setShowRepairForm(true); }}
                              className="btn-secondary text-xs px-2 py-1"
                            >
                              Cập nhật
                            </button> : <span className="text-xs text-gray-500">Dữ liệu cũ</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Replacement parts */}
          {!historyLoading && !historyError && parts.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Linh kiện thay thế ({parts.length})</h3></div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Tên linh kiện</th>
                      <th>Mã LK</th>
                      <th>Trạng thái</th>
                      <th>SL</th>
                      <th>Đơn giá</th>
                      <th>Thành tiền</th>
                      {canUpdateWorkflow && <th>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map(p => (
                      <tr key={p.id}>
                        <td>{formatDateOnly(p.replacement_date)}</td>
                        <td>{p.part_name}</td>
                        <td className="font-mono text-xs">{p.part_code}</td>
                        <td>
                          <span className={`badge ${p.part_status === 'installed'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : p.part_status === 'cancelled'
                              ? 'bg-gray-100 text-gray-700 border-gray-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}>
                            {p.part_status === 'requested'
                              ? 'Đã yêu cầu'
                              : p.part_status === 'ordered'
                                ? 'Đã đặt hàng'
                                : p.part_status === 'received'
                                  ? 'Đã nhận'
                                  : p.part_status === 'installed'
                                    ? 'Đã lắp'
                                    : p.part_status === 'cancelled'
                                      ? 'Đã hủy'
                                      : 'Đã lắp'}
                          </span>
                        </td>
                        <td>{p.quantity}</td>
                        <td>{formatCurrency(p.unit_price)}</td>
                        <td className="font-medium">{formatCurrency(p.quantity * p.unit_price)}</td>
                        {canUpdateWorkflow && (
                          <td>
                            {p._source !== 'legacy' ? <button
                              type="button"
                              onClick={() => { setEditPart(p); setShowPartCostForm(true); }}
                              className="btn-secondary text-xs px-2 py-1"
                            >
                              Cập nhật
                            </button> : <span className="text-xs text-gray-500">Dữ liệu cũ</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!historyLoading && !historyError && history && history.events.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="text-sm font-semibold">Sự kiện bảo trì / sửa chữa ({history.events.length} gần nhất)</h3></div>
              <div className="card-body space-y-2 text-sm">
                <p className="text-xs text-gray-500">Sự kiện ghi nhận trong hệ thống; chi phí chỉ tính từ phiếu nghiệp vụ ở trên.</p>
                {history.events.map(event => (
                  <div key={event.id} className="flex justify-between gap-3 border-b border-gray-100 py-2">
                    <span>{event.event_type === 'MAINTENANCE_COMPLETED' ? 'Hoàn thành bảo trì' : 'Hoàn thành sửa chữa'}{typeof event.metadata.fault_category === 'string' ? ` · ${event.metadata.fault_category}` : ''}</span>
                    <span className="text-gray-500 whitespace-nowrap">{formatDate(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!historyLoading && !historyError && maintenances.length === 0 && repairs.length === 0 && parts.length === 0 && (history?.events.length || 0) === 0 && (
            <div className="card card-body text-center text-gray-400 py-12">Chưa có lịch sử bảo trì & sửa chữa</div>
          )}
        </div>
      )}

      <Modal
        isOpen={showMaintenanceForm}
        onClose={() => { setShowMaintenanceForm(false); setEditMaintenance(null); }}
        title={`${editMaintenance ? 'Cập nhật bảo trì' : 'Thêm bảo trì'} - ${profileDevice.device_code}`}
        maxWidth="max-w-3xl"
      >
        <MaintenanceForm
          deviceId={profileDeviceId}
          maintenance={editMaintenance}
          onClose={() => { setShowMaintenanceForm(false); setEditMaintenance(null); }}
        />
      </Modal>

      <Modal
        isOpen={showRepairForm}
        onClose={() => { setShowRepairForm(false); setEditRepair(null); }}
        title={`${editRepair ? 'Cập nhật sửa chữa' : 'Thêm sửa chữa'} - ${profileDevice.device_code}`}
        maxWidth="max-w-3xl"
      >
        <RepairForm
          deviceId={profileDeviceId}
          repair={editRepair}
          onClose={() => { setShowRepairForm(false); setEditRepair(null); }}
        />
      </Modal>

      <Modal
        isOpen={showPartCostForm}
        onClose={() => { setShowPartCostForm(false); setEditPart(null); }}
        title={`${editPart ? 'Cập nhật linh kiện/chi phí' : 'Kê linh kiện/chi phí'} - ${profileDevice.device_code}`}
        maxWidth="max-w-2xl"
      >
        <ReplacementPartCostForm
          deviceId={profileDeviceId}
          part={editPart}
          onClose={() => { setShowPartCostForm(false); setEditPart(null); }}
          onSubmit={(record) => {
            if (editPart) updateReplacementPart(record);
            else addReplacementPart(record);
            setShowPartCostForm(false);
            setEditPart(null);
          }}
        />
      </Modal>

      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Có thể upload tài liệu trực tiếp trong các form Đấu thầu, Mua sắm, Nghiệm thu, Bảo trì, Sửa chữa, Linh kiện và Thanh lý. Tài liệu sẽ tự gom về tab này theo từng thiết bị.
          </div>

          {documents.length > 0 ? (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="text-sm font-semibold">Tài liệu của thiết bị ({documents.length})</h3>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tên tài liệu</th>
                      <th>Nguồn hồ sơ</th>
                      <th>Ngày</th>
                      <th>Loại / dung lượng</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(item => {
                      const file = item.attachment as Attachment;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-gray-500" />
                              <span className="font-medium">{file.name}</span>
                            </div>
                          </td>
                          <td>
                            <p className="font-medium text-gray-800">{item.source}</p>
                            <p className="max-w-[240px] truncate text-xs text-gray-500" title={item.detail}>{item.detail || '—'}</p>
                          </td>
                          <td>{formatDateOnly(String(item.date || '').slice(0, 10)) || '—'}</td>
                          <td>{[file.type, formatFileSize(file.size)].filter(Boolean).join(' • ') || '—'}</td>
                          <td>
                            {file.url ? (
                              <a href={file.url} target="_blank" rel="noreferrer" download={file.name} className="btn-secondary text-xs px-2 py-1">
                                <Download size={14} /> Mở / tải
                              </a>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card card-body text-center text-gray-400 py-12">
              <Paperclip size={48} className="mx-auto mb-3 opacity-50" />
              <p>Chưa có tài liệu nào cho thiết bị này.</p>
              <p className="text-xs mt-2">Hãy mở một form nghiệp vụ và upload hợp đồng, biên bản nghiệm thu, biên bản sửa chữa hoặc hình ảnh liên quan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


interface ReplacementPartCostFormProps {
  deviceId: string;
  part?: ReplacementPartLog | null;
  onClose: () => void;
  onSubmit: (record: ReplacementPartLog) => void;
}

function ReplacementPartCostForm({ deviceId, part, onClose, onSubmit }: ReplacementPartCostFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    replacement_date: part?.replacement_date || today,
    part_name: part?.part_name || '',
    part_code: part?.part_code || '',
    quantity: part?.quantity || 1,
    unit_price: part?.unit_price || 0,
    vendor: part?.vendor || '',
    reason: part?.reason || '',
    performed_by: part?.performed_by || '',
    part_status: (part?.part_status || 'installed') as ReplacementPartStatus,
    attachments: part?.attachments || [],
  });

  const total = Number(form.quantity || 0) * Number(form.unit_price || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: part?.id || generateId(),
      device_id: part?.device_id || deviceId,
      replacement_date: form.replacement_date,
      part_name: form.part_name,
      part_code: form.part_code,
      quantity: Number(form.quantity) || 0,
      unit_price: Number(form.unit_price) || 0,
      vendor: form.vendor,
      reason: form.reason,
      performed_by: form.performed_by,
      part_status: form.part_status,
      repair_record_id: part?.repair_record_id,
      attachments: form.attachments,
      created_at: part?.created_at || new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Ngày kê chi phí</label>
          <input className="input" type="date" value={form.replacement_date} onChange={e => setForm(p => ({ ...p, replacement_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Người thực hiện</label>
          <input className="input" value={form.performed_by} onChange={e => setForm(p => ({ ...p, performed_by: e.target.value }))} />
        </div>
        <div>
          <label className="label">Trạng thái linh kiện</label>
          <select
            className="select"
            value={form.part_status}
            onChange={e => setForm(p => ({
              ...p,
              part_status: e.target.value as ReplacementPartStatus,
            }))}
          >
            <option value="requested">Cần thay / đã yêu cầu</option>
            <option value="ordered">Đã đặt hàng</option>
            <option value="received">Đã nhận linh kiện</option>
            <option value="installed">Đã lắp / đã thay</option>
            <option value="cancelled">Hủy</option>
          </select>
        </div>
        <div>
          <label className="label">Tên linh kiện / hạng mục chi phí *</label>
          <input className="input" value={form.part_name} onChange={e => setForm(p => ({ ...p, part_name: e.target.value }))} required placeholder="VD: Đầu dò, mainboard, phí kiểm định..." />
        </div>
        <div>
          <label className="label">Mã linh kiện</label>
          <input className="input" value={form.part_code} onChange={e => setForm(p => ({ ...p, part_code: e.target.value }))} />
        </div>
        <div>
          <label className="label">Số lượng</label>
          <input className="input" type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Đơn giá (VNĐ)</label>
          <input className="input" type="number" min="0" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Nhà cung cấp</label>
          <input className="input" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} />
        </div>
        <div>
          <label className="label">Thành tiền</label>
          <div className="input bg-gray-50 flex items-center font-semibold text-gray-800">{formatCurrency(total)}</div>
        </div>
        <div className="md:col-span-2">
          <label className="label">Lý do / ghi chú</label>
          <textarea className="textarea" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="VD: Thay do hỏng trong quá trình sửa chữa, chi phí kiểm định sau bảo trì..." />
        </div>
        <div className="md:col-span-2">
          <AttachmentUploader
            attachments={form.attachments}
            onChange={attachments => setForm(p => ({ ...p, attachments }))}
            label="Tài liệu linh kiện / chi phí"
            helperText="Upload báo giá, hóa đơn, ảnh linh kiện hoặc biên bản thay thế."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{part ? 'Cập nhật chi phí' : 'Lưu chi phí'}</button>
      </div>
    </form>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-800">{value || '—'}</p>
    </div>
  );
}
