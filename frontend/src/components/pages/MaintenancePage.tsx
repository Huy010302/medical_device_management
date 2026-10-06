import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/deviceUtils';
import { usePagedRecords } from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
import { statusBadgeClass, STATUS_LABELS } from '@/lib/deviceUtils';
import Modal from '@/components/ui/Modal';
import MaintenanceForm from '@/components/lifecycle/MaintenanceForm';
import type { MaintenanceRecord, MaintenanceResult } from '@/types/lifecycle';

const typeLabel: Record<string, string> = {
  preventive: 'Định kỳ',
  corrective: 'Sửa chữa nhỏ',
  calibration: 'Hiệu chuẩn',
};

const resultLabel: Record<MaintenanceResult, string> = {
  completed: 'Hoàn thành',
  incomplete: 'Chưa hoàn thành',
  needs_repair: 'Cần sửa chữa',
};

const resultColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 border-green-200',
  incomplete: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  needs_repair: 'bg-red-100 text-red-700 border-red-200',
};

export default function MaintenancePage() {
  const { can } = useAuth();
  const { updateMaintenanceRecord } = useStore();
  const canWrite = can('workflow:create');
  const canUpdate = can('workflow:update');
  const [showForm, setShowForm] = useState(false);
  const [editMaintenance, setEditMaintenance] = useState<MaintenanceRecord | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const { data, error: loadError } = usePagedRecords<MaintenanceRecord & { device_code?: string; device_name?: string; device_status?: string }>(
    '/maintenance-records', { page, page_size: 20, search, result: resultFilter });

  const handleQuickResultChange = (record: MaintenanceRecord & Record<string, unknown>, result: MaintenanceResult) => {
    const today = new Date().toISOString().slice(0, 10);
    // bỏ các trường chỉ để hiển thị (device_code...) trước khi lưu
    const { device_code, device_name, device_status, ...clean } = record as Record<string, unknown>;
    void device_code; void device_name; void device_status;
    updateMaintenanceRecord({ ...(clean as unknown as MaintenanceRecord), result, actual_date: result === 'completed' ? (record.actual_date as string || today) : (record.actual_date as string) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Bảo trì</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.total.toLocaleString('vi-VN')} lần bảo trì
          </p>
        </div>
        {canWrite && (
          <button onClick={() => { setEditMaintenance(null); setShowForm(true); }} className="btn-primary">
            <Plus size={16} /> Thêm bảo trì
          </button>
        )}
      </div>

      {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
      <div className="flex gap-2">
        <input className="input" placeholder="Tìm theo người thực hiện, đơn vị, mô tả..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="select w-56" value={resultFilter} onChange={e => { setResultFilter(e.target.value); setPage(1); }}>
          <option value="all">Tất cả kết quả</option><option value="completed">Hoàn thành</option><option value="incomplete">Chưa hoàn thành</option><option value="needs_repair">Cần sửa chữa</option>
        </select>
      </div>
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Thiết bị</th>
              <th>Trạng thái thiết bị</th>
              <th>Loại</th>
              <th>Ngày lịch trình</th>
              <th>Ngày thực tế</th>
              <th>Người thực hiện</th>
              <th>Kết quả bảo trì</th>
              <th>Chi phí</th>
              <th>BT tiếp theo</th>
              {canUpdate && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map(r => {
              return (
                <tr key={r.id}>
                  <td className="font-medium">{r.device_code ? `${r.device_code} - ${r.device_name}` : r.device_id}</td>
                  <td>
                    {r.device_status ? <span className={`badge ${statusBadgeClass(r.device_status)}`}>{STATUS_LABELS[r.device_status as keyof typeof STATUS_LABELS] || r.device_status}</span> : '—'}
                  </td>
                  <td>{typeLabel[r.maintenance_type] || r.maintenance_type}</td>
                  <td className="text-gray-500 text-xs">{r.scheduled_date}</td>
                  <td className="text-gray-500 text-xs">{r.actual_date || '—'}</td>
                  <td className="text-gray-600">{r.performed_by || r.service_company || '—'}</td>
                  <td>
                    {canUpdate ? (
                      <select
                        className={`select min-w-[150px] border ${resultColor[r.result] || ''}`}
                        value={r.result}
                        onChange={e => handleQuickResultChange(r as unknown as MaintenanceRecord & Record<string, unknown>, e.target.value as MaintenanceResult)}
                      >
                        <option value="completed">Hoàn thành</option>
                        <option value="incomplete">Chưa hoàn thành</option>
                        <option value="needs_repair">Cần sửa chữa</option>
                      </select>
                    ) : (
                      <span className={`badge ${resultColor[r.result] || ''}`}>
                        {resultLabel[r.result] || r.result}
                      </span>
                    )}
                  </td>
                  <td>{formatCurrency(r.cost)}</td>
                  <td className="text-gray-500 text-xs">{r.next_maintenance_date || '—'}</td>
                  {canUpdate && (
                    <td>
                      <button
                        type="button"
                        onClick={() => { setEditMaintenance(r); setShowForm(true); }}
                        className="btn-icon"
                        title="Cập nhật phiếu bảo trì"
                      >
                        <Pencil size={16} className="text-blue-500" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {data.items.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-slate-400">Chưa có phiếu bảo trì. Chạy scripts/seed_workflow_demo.py hoặc bấm “Thêm bảo trì”.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage} />

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditMaintenance(null); }}
        title={editMaintenance ? 'Cập nhật phiếu bảo trì' : 'Thêm phiếu bảo trì'}
        maxWidth="max-w-3xl"
      >
        <MaintenanceForm
          maintenance={editMaintenance}
          onClose={() => { setShowForm(false); setEditMaintenance(null); }}
        />
      </Modal>
    </div>
  );
}
