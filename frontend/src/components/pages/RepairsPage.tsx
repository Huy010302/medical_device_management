import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePagedRecords } from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
import { formatCurrency } from '@/lib/deviceUtils';
import Modal from '@/components/ui/Modal';
import RepairForm from '@/components/lifecycle/RepairForm';
import type { RepairRecord } from '@/types/lifecycle';

const statusLabel: Record<string, string> = {
  reported: 'Đã báo cáo',
  in_progress: 'Đang sửa',
  awaiting_parts: 'Chờ linh kiện',
  completed: 'Hoàn thành',
  irreparable: 'Không sửa được',
};

const statusColor: Record<string, string> = {
  reported: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_parts: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  irreparable: 'bg-red-100 text-red-700 border-red-200',
};

export default function RepairsPage() {
  const { can } = useAuth();
  const canWrite = can('workflow:create');
  const canUpdate = can('workflow:update');
  const [showForm, setShowForm] = useState(false);
  const [editRepair, setEditRepair] = useState<RepairRecord | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data, error: loadError } = usePagedRecords<RepairRecord & { device_code?: string; device_name?: string }>(
    '/repair-records', { page, page_size: 20, search, status: statusFilter });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Sửa chữa</h1>
          <p className="text-sm text-gray-500 mt-1">{data.total.toLocaleString('vi-VN')} phiếu sửa chữa</p>
        </div>
        {canWrite && (
          <button onClick={() => { setEditRepair(null); setShowForm(true); }} className="btn-primary">
            <Plus size={16} /> Thêm phiếu sửa chữa
          </button>
        )}
      </div>

      {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
      <div className="flex gap-2">
        <input className="input" placeholder="Tìm theo mô tả lỗi, đơn vị sửa, kỹ thuật viên..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="select w-56" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Thiết bị</th>
              <th>Ngày báo</th>
              <th>Mô tả lỗi</th>
              <th>Đơn vị sửa</th>
              <th>Trạng thái</th>
              <th>Chi phí</th>
              <th>Bảo hành</th>
              {canUpdate && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map(r => (
              <tr key={r.id}>
                <td className="font-medium">{r.device_code ? `${r.device_code} - ${r.device_name}` : r.device_id}</td>
                <td className="text-gray-500 text-xs">{r.report_date}</td>
                <td className="max-w-[250px] truncate text-gray-600">{r.fault_description}</td>
                <td className="text-gray-600">{r.repair_company}</td>
                <td>
                  <span className={`badge ${statusColor[r.repair_status] || ''}`}>
                    {statusLabel[r.repair_status] || r.repair_status}
                  </span>
                </td>
                <td>{formatCurrency(r.total_cost)}</td>
                <td>{r.warranty_claim ? '✅ Có' : '—'}</td>
                {canUpdate && (
                  <td>
                    <button
                      type="button"
                      onClick={() => { setEditRepair(r); setShowForm(true); }}
                      className="btn-icon"
                      title="Cập nhật phiếu sửa chữa"
                    >
                      <Pencil size={16} className="text-blue-500" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">Chưa có phiếu sửa chữa.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage} />

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditRepair(null); }}
        title={editRepair ? 'Cập nhật phiếu sửa chữa' : 'Thêm phiếu sửa chữa'}
        maxWidth="max-w-3xl"
      >
        <RepairForm repair={editRepair} onClose={() => { setShowForm(false); setEditRepair(null); }} />
      </Modal>
    </div>
  );
}
