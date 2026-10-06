import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, Lock, MapPin, ShieldCheck, Stethoscope, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiJson } from '@/lib/api';
import { STATUS_COLORS, STATUS_LABELS, formatDate } from '@/lib/deviceUtils';
import type { Device, DeviceStatus, MaintenanceRecord, RepairRecord, ReplacementPartLog, ReceptionRecord } from '@/types/lifecycle';

interface Props {
  qrToken: string;
}

type PublicDeviceInfo = Pick<
  Device,
  'id' | 'device_code' | 'name' | 'category' | 'manufacturer' | 'model' | 'current_status' | 'current_location' | 'updated_at'
> & {
  qr_token?: string | null;
};

function normalizeStatus(status: string | null | undefined): DeviceStatus {
  if (status && status in STATUS_LABELS) return status as DeviceStatus;
  return 'operating';
}

function getStatusLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] || status || 'Không xác định';
}

function getStatusColor(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return STATUS_COLORS[normalized] || 'bg-slate-100 text-slate-700 border-slate-300';
}

function latestByCreatedAt<T extends { created_at?: string }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
}

export default function QRDeviceScanPage({ qrToken }: Props) {
  const { currentUser, loading: authLoading, can } = useAuth();

  const [publicDevice, setPublicDevice] = useState<PublicDeviceInfo | null>(null);
  const [fullDevice, setFullDevice] = useState<Device | null>(null);
  const [remoteMaintenances, setRemoteMaintenances] = useState<MaintenanceRecord[]>([]);
  const [remoteRepairs, setRemoteRepairs] = useState<RepairRecord[]>([]);
  const [remoteParts, setRemoteParts] = useState<ReplacementPartLog[]>([]);
  const [remoteReceptions, setRemoteReceptions] = useState<ReceptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isInternalUser = Boolean(currentUser && currentUser.role !== 'pending');
  const canUpdateWorkflow = can('workflow:update');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const publicInfo = await apiJson<PublicDeviceInfo>(`/qr/${encodeURIComponent(qrToken)}`, {}, false);
        if (!active) return;
        setPublicDevice(publicInfo);
        if (isInternalUser) {
          const internal = await apiJson<{
            device: Device; maintenance: MaintenanceRecord[]; repairs: RepairRecord[];
            replacement_parts: ReplacementPartLog[]; receptions: ReceptionRecord[];
          }>(`/qr/${encodeURIComponent(qrToken)}/internal`);
          if (!active) return;
          setFullDevice(internal.device);
          setRemoteMaintenances(internal.maintenance);
          setRemoteRepairs(internal.repairs);
          setRemoteParts(internal.replacement_parts);
          setRemoteReceptions(internal.receptions);
        } else { setFullDevice(null); }
      } catch (err) {
        if (!active) return;
        setPublicDevice(null);
        setFullDevice(null);
        setError(err instanceof Error ? err.message : 'Không thể tải QR từ API.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [isInternalUser, qrToken]);

  const device = fullDevice || publicDevice;
  const internalMaintenances = remoteMaintenances;
  const internalRepairs = remoteRepairs;
  const internalParts = remoteParts;
  const internalReceptions = remoteReceptions;

  const latestMaintenance = latestByCreatedAt(internalMaintenances);
  const latestRepair = latestByCreatedAt(internalRepairs);
  const latestReception = latestByCreatedAt(internalReceptions);
  const openMaintenance = internalMaintenances.find(record => record.result !== 'completed');
  const openRepair = internalRepairs.find(record => !['completed', 'irreparable'].includes(record.repair_status));

  const goToApp = () => {
    window.history.replaceState(null, '', '/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">MedDevice QR</p>
            <h1 className="text-lg font-bold text-slate-900">Thông tin thiết bị y tế</h1>
          </div>
          <button onClick={goToApp} className="btn-secondary">
            <ArrowLeft size={16} /> Về hệ thống
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loading || authLoading ? (
          <div className="card p-8 text-center text-slate-500">Đang tải thông tin thiết bị...</div>
        ) : error && !device ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5" size={22} />
              <div>
                <h2 className="font-bold">Không mở được mã QR</h2>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            </div>
          </div>
        ) : device ? (
          <div className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
            )}

            <section className="card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900">{device.name}</h2>
                    <span className={`badge ${getStatusColor(device.current_status)}`}>
                      {getStatusLabel(device.current_status)}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold text-primary-600">{device.device_code}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                    {device.current_location && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                        <MapPin size={14} /> {device.current_location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <Stethoscope size={14} /> {device.category || 'Chưa phân loại'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:min-w-56">
                  <p className="font-semibold text-slate-900">Chế độ hiển thị</p>
                  {isInternalUser ? (
                    <p className="mt-1 flex items-center gap-2 text-green-700"><ShieldCheck size={16} /> Nội bộ: xem chi tiết</p>
                  ) : (
                    <p className="mt-1 flex items-center gap-2 text-slate-600"><Lock size={16} /> Công khai: thông tin cơ bản</p>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Hãng sản xuất</p>
                  <p className="mt-1 font-semibold text-slate-900">{device.manufacturer || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Model</p>
                  <p className="mt-1 font-semibold text-slate-900">{device.model || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Cập nhật gần nhất</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatDate(device.updated_at)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Tình trạng xử lý</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {openRepair ? 'Có phiếu sửa chữa mở' : openMaintenance ? 'Có phiếu bảo trì mở' : 'Không có phiếu mở'}
                  </p>
                </div>
              </div>
            </section>

            {!isInternalUser && (
              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
                <p className="font-semibold">Bạn đang xem chế độ công khai.</p>
                <p className="mt-1">Đăng nhập bằng tài khoản nội bộ bệnh viện rồi quét lại QR để xem lịch sử bảo trì, sửa chữa, linh kiện và tài liệu chi tiết.</p>
              </section>
            )}

            {isInternalUser && (
              <section className="grid gap-4 lg:grid-cols-3">
                <div className="card p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <CalendarCheck size={18} className="text-orange-500" />
                    <h3 className="font-bold">Bảo trì gần nhất</h3>
                  </div>
                  {latestMaintenance ? (
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p><span className="font-medium text-slate-800">Ngày:</span> {formatDate(latestMaintenance.actual_date || latestMaintenance.scheduled_date)}</p>
                      <p><span className="font-medium text-slate-800">Người thực hiện:</span> {latestMaintenance.performed_by || '—'}</p>
                      <p><span className="font-medium text-slate-800">Kết quả:</span> {latestMaintenance.result === 'completed' ? 'Hoàn thành' : latestMaintenance.result === 'needs_repair' ? 'Cần sửa chữa' : 'Chưa hoàn thành'}</p>
                    </div>
                  ) : <p className="mt-4 text-sm text-slate-400">Chưa có lịch sử bảo trì.</p>}
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Wrench size={18} className="text-red-500" />
                    <h3 className="font-bold">Sửa chữa gần nhất</h3>
                  </div>
                  {latestRepair ? (
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p><span className="font-medium text-slate-800">Báo lỗi:</span> {formatDate(latestRepair.report_date)}</p>
                      <p><span className="font-medium text-slate-800">Kỹ thuật viên:</span> {latestRepair.technician || latestRepair.repair_company || '—'}</p>
                      <p><span className="font-medium text-slate-800">Trạng thái:</span> {latestRepair.repair_status}</p>
                    </div>
                  ) : <p className="mt-4 text-sm text-slate-400">Chưa có lịch sử sửa chữa.</p>}
                </div>

                <div className="card p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <h3 className="font-bold">Thông tin tiếp nhận</h3>
                  </div>
                  {latestReception ? (
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p><span className="font-medium text-slate-800">Serial:</span> {latestReception.serial_number || '—'}</p>
                      <p><span className="font-medium text-slate-800">Mã tài sản:</span> {latestReception.asset_code || '—'}</p>
                      <p><span className="font-medium text-slate-800">Bảo hành:</span> {formatDate(latestReception.warranty_start)} - {formatDate(latestReception.warranty_end)}</p>
                    </div>
                  ) : <p className="mt-4 text-sm text-slate-400">Chưa có thông tin tiếp nhận.</p>}
                </div>
              </section>
            )}

            {isInternalUser && (openMaintenance || openRepair || internalParts.length > 0) && (
              <section className="card p-5">
                <h3 className="font-bold text-slate-900">Việc đang xử lý</h3>
                <div className="mt-4 space-y-3 text-sm">
                  {openMaintenance && (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-900">
                      <p className="font-semibold">Bảo trì chưa hoàn tất</p>
                      <p className="mt-1">Ngày lịch: {formatDate(openMaintenance.scheduled_date)} · Người thực hiện: {openMaintenance.performed_by || '—'}</p>
                    </div>
                  )}
                  {openRepair && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
                      <p className="font-semibold">Phiếu sửa chữa đang mở</p>
                      <p className="mt-1">Trạng thái: {openRepair.repair_status} · Kỹ thuật viên: {openRepair.technician || '—'}</p>
                    </div>
                  )}
                  {internalParts.filter(part => !['installed', 'cancelled'].includes(part.part_status || '')).slice(0, 3).map(part => (
                    <div key={part.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                      <p className="font-semibold">Linh kiện: {part.part_name}</p>
                      <p className="mt-1">Trạng thái: {part.part_status || 'requested'} · SL: {part.quantity}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isInternalUser && canUpdateWorkflow && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Cập nhật nghiệp vụ</p>
                <p className="mt-1">Tài khoản của bạn có quyền cập nhật workflow. Vào menu Bảo trì hoặc Sửa chữa để cập nhật phiếu đang mở của thiết bị này.</p>
                <button onClick={goToApp} className="btn-primary mt-4">Mở hệ thống quản lý</button>
              </section>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
