import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/deviceUtils';
import { usePagedRecords } from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
import Modal from '@/components/ui/Modal';
import DisposalForm from '@/components/lifecycle/DisposalForm';
import type { DisposalRecord } from '@/types/lifecycle';

const methodLabel: Record<string, string> = {
  auction: 'Đấu giá',
  destroy: 'Tiêu hủy',
  donate: 'Tặng/Cho',
  return_vendor: 'Trả NCC',
};
const methodColor: Record<string, string> = {
  auction: 'bg-blue-100 text-blue-800 border-blue-300',
  destroy: 'bg-red-100 text-red-800 border-red-300',
  donate: 'bg-green-100 text-green-800 border-green-300',
  return_vendor: 'bg-amber-100 text-amber-800 border-amber-300',
};

export default function DisposalPage() {
  const { can } = useAuth();
  const canWrite = can('workflow:create');
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('all');
  const { data, error } = usePagedRecords<DisposalRecord & { device_code?: string; device_name?: string }>(
    '/disposal-records', { page, page_size: 20, search, method });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Thanh lý</h1>
          <p className="text-sm text-gray-500 mt-1">{data.total.toLocaleString('vi-VN')} phiếu thanh lý</p>
        </div>
        {canWrite && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Thanh lý thiết bị
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-2">
        <input className="input" placeholder="Tìm theo lý do, số quyết định..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="select w-52" value={method} onChange={e => { setMethod(e.target.value); setPage(1); }}>
          <option value="all">Tất cả phương thức</option>
          {Object.entries(methodLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Thiết bị</th>
              <th>Ngày thanh lý</th>
              <th>Lý do</th>
              <th>Phương thức</th>
              <th>Giá trị sổ sách</th>
              <th>Giá trị thu hồi</th>
              <th>Số QĐ</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(r => (
              <tr key={r.id}>
                <td className="font-medium">{r.device_code ? `${r.device_code} - ${r.device_name}` : r.device_id}</td>
                <td className="text-gray-500 text-xs">{r.disposal_date}</td>
                <td className="max-w-[250px] truncate text-gray-600">{r.reason}</td>
                <td><span className={`badge ${methodColor[r.disposal_method] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{methodLabel[r.disposal_method] || r.disposal_method}</span></td>
                <td>{formatCurrency(r.book_value)}</td>
                <td className="font-medium text-emerald-600">{formatCurrency(r.disposal_value)}</td>
                <td className="font-mono text-xs">{r.decision_number}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-slate-400">Chưa có phiếu thanh lý.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage} />

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Thanh lý thiết bị" maxWidth="max-w-3xl">
        <DisposalForm onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
