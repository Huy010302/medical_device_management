import { useState } from 'react';
import { usePagedRecords } from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
import { Edit, Eye, Filter, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { formatDate } from '@/lib/deviceUtils';
import type { Device } from '@/types/lifecycle';
import DeviceForm from './DeviceForm';
import DeviceProfile from './DeviceProfile';
import Modal from '@/components/ui/Modal';

export default function DeviceList() {
  const { can } = useAuth();
  const { deleteDevice, deviceCategories, departments, deviceStatusOptions, getDeviceStatusLabel, getDeviceStatusColor } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const {data,error:loadError} = usePagedRecords<Device>('/devices',{page,page_size:50,search,category_id:categoryFilter,department_id:departmentFilter,status:statusFilter});
  const filtered = data.items;
  const [showForm, setShowForm] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [viewDevice, setViewDevice] = useState<Device | null>(null);
  const [error, setError] = useState('');

  const canCreate = can('device:create');
  const canUpdate = can('device:update');
  const canDelete = can('device:delete');

  const handleDelete = (device: Device) => {
    setError('');
    if (!confirm(`Xác nhận xoá mềm thiết bị ${device.device_code}?`)) return;
    try {
      deleteDevice(device.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xoá thiết bị.');
    }
  };

  if (viewDevice) {
    return <DeviceProfile device={viewDevice} onBack={() => setViewDevice(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Thiết bị</h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} / {data.total} thiết bị đang hiển thị</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditDevice(null); setShowForm(true); }} className="btn-primary">
            <Plus size={16} /> Thêm thiết bị
          </button>
        )}
      </div>

      {(error || loadError) && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || loadError}</div>}

      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã, tên, số serial, mã tài sản..."
              value={search}
              onChange={e => {setSearch(e.target.value);setPage(1);}}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Filter size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">Lọc</span>
            </div>
            <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value);setPage(1);}} className="select sm:w-44">
              <option value="all">Tất cả trạng thái</option>
              {deviceStatusOptions.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={e => {setCategoryFilter(e.target.value);setPage(1);}} className="select sm:w-48">
              <option value="all">Tất cả loại</option>
              {deviceCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="select sm:w-48" value={departmentFilter} onChange={e => {setDepartmentFilter(e.target.value);setPage(1);}}><option value="all">Tất cả khoa phòng</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </div>
        </div>
      </div>

      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Mã TB</th>
              <th>Tên thiết bị</th>
              <th>Loại</th>
              <th>Hãng SX</th>
              <th>Vị trí</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="cursor-pointer" onClick={() => setViewDevice(d)}>
                <td className="font-mono text-xs font-semibold text-primary-600">{d.device_code}</td>
                <td>
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.model || 'Chưa có model'}</p>
                </td>
                <td className="text-slate-600">{d.category || deviceCategories.find(c => c.id === d.category_id)?.name || '—'}</td>
                <td className="text-slate-600">{d.manufacturer}</td>
                <td className="text-slate-600">{d.current_location || '—'}</td>
                <td>
                  <span className={`badge ${getDeviceStatusColor(d.current_status)}`}>
                    {getDeviceStatusLabel(d.current_status)}
                  </span>
                </td>
                <td className="text-slate-500 text-xs">{formatDate(d.created_at)}</td>
                <td className="text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewDevice(d)} className="btn-icon" title="Xem">
                      <Eye size={16} className="text-slate-500" />
                    </button>
                    {canUpdate && (
                      <button onClick={() => { setEditDevice(d); setShowForm(true); }} className="btn-icon" title="Sửa">
                        <Edit size={16} className="text-blue-500" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(d)} className="btn-icon" title="Xóa">
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-400">Không tìm thấy thiết bị nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage} />
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editDevice ? 'Cập nhật thiết bị' : 'Thêm thiết bị mới'} maxWidth="max-w-3xl">
        <DeviceForm device={editDevice} onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
