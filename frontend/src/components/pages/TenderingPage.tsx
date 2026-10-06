import { useState, type FormEvent } from 'react';
import { usePagedRecords } from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
import { Edit3, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { formatCurrency, getTenderDeviceIds, getTenderDeviceSummary } from '@/lib/deviceUtils';
import type { TenderingRecord, TenderStatus } from '@/types/lifecycle';
import Modal from '@/components/ui/Modal';
import TenderingForm from '@/components/lifecycle/TenderingForm';
import DateInputVN from '@/components/ui/DateInputVN';

const statusLabel: Record<TenderStatus, string> = {
  planning: 'Lập kế hoạch',
  open: 'Đang mở thầu',
  evaluating: 'Đang đánh giá',
  awarded: 'Đã chọn thầu',
  cancelled: 'Đã hủy',
};

const statusColor: Record<TenderStatus, string> = {
  planning: 'bg-gray-100 text-gray-700 border-gray-200',
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  evaluating: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  awarded: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const formatNumberInput = (value: number | string): string => {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseNumberInput = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

// yyyy-mm-dd -> dd/mm/yyyy để hiển thị trong bảng
const formatDateDisplay = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};


const tenderFlow: TenderStatus[] = ['planning', 'open', 'evaluating', 'awarded', 'cancelled'];

function TenderStatusForm({ record, onClose }: { record: TenderingRecord; onClose: () => void }) {
  const { updateTenderingRecord } = useStore();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    tender_status: record.tender_status,
    winning_vendor: record.winning_vendor || '',
    winning_bid_value: record.winning_bid_value || 0,
    decision_number: record.decision_number || '',
    decision_date: record.decision_date || '',
    notes: record.notes || '',
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (form.tender_status === 'awarded' && !form.winning_vendor.trim()) {
      setError('Khi chuyển sang Đã chọn thầu, vui lòng nhập nhà cung cấp trúng thầu.');
      return;
    }

    if (form.tender_status === 'cancelled') {
      const confirmed = window.confirm(
        'Khi hủy gói thầu, các thiết bị thuộc gói đang ở bước Đấu thầu/Đã phê duyệt sẽ bị xóa khỏi trang Thiết bị. Bạn chắc chắn muốn tiếp tục?'
      );
      if (!confirmed) return;
    }

    updateTenderingRecord({
      ...record,
      ...form,
      winning_bid_value: Number(form.winning_bid_value) || 0,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Khi cập nhật trạng thái thầu, hệ thống sẽ tự cập nhật vòng đời: <strong>Đã chọn thầu → thiết bị Đã phê duyệt + tạo hồ sơ Mua sắm chờ ký HĐ</strong>. Nếu chọn <strong>Đã hủy</strong>, các thiết bị thuộc gói đang ở bước Đấu thầu/Đã phê duyệt sẽ bị xóa khỏi trang Thiết bị.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Trạng thái thầu</label>
          <select
            className="select"
            value={form.tender_status}
            onChange={e => setForm(prev => ({ ...prev, tender_status: e.target.value as TenderStatus }))}
          >
            {tenderFlow.map(status => (
              <option key={status} value={status}>{statusLabel[status]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">NCC trúng thầu</label>
          <input
            className="input"
            value={form.winning_vendor}
            onChange={e => setForm(prev => ({ ...prev, winning_vendor: e.target.value }))}
            placeholder="Nhập khi đã chọn thầu"
          />
        </div>

        <div>
          <label className="label">Giá trúng thầu (VNĐ)</label>
          <input
            className="input"
            inputMode="numeric"
            value={formatNumberInput(form.winning_bid_value)}
            onChange={e => setForm(prev => ({ ...prev, winning_bid_value: parseNumberInput(e.target.value) }))}
          />
        </div>

        <div>
          <label className="label">Số QĐ phê duyệt</label>
          <input
            className="input"
            value={form.decision_number}
            onChange={e => setForm(prev => ({ ...prev, decision_number: e.target.value }))}
            placeholder="Ví dụ: QĐ-001/2026"
          />
        </div>

        <div>
          <label className="label">Ngày QĐ</label>
          <DateInputVN
            className="input"
            value={form.decision_date}
            onChange={value => setForm(prev => ({ ...prev, decision_date: value }))}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Ghi chú cập nhật</label>
          <textarea
            className="textarea"
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Ví dụ: Đã phê duyệt kết quả lựa chọn nhà thầu / Hủy do thay đổi nhu cầu..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">Lưu cập nhật</button>
      </div>
    </form>
  );
}

export default function TenderingPage() {
  const { can } = useAuth();
  const { devices } = useStore();
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(20);
  const [search,setSearch] = useState('');
  const [year,setYear] = useState('');
  const [status,setStatus] = useState('');
  const {data,error} = usePagedRecords<TenderingRecord>('/tendering',{page,page_size:pageSize,search,year,status});
  const tenderingRecords = data.items;
  const canCreate = can('workflow:create');
  const canUpdate = can('workflow:update');
  const [showForm, setShowForm] = useState(false);
  const [statusRecord, setStatusRecord] = useState<TenderingRecord | null>(null);

  const totalDevicesInTendering = tenderingRecords.reduce((sum, record) => sum + getTenderDeviceIds(record).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Đấu thầu</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.total} gói thầu · {totalDevicesInTendering} thiết bị thuộc gói thầu
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Thêm gói thầu
          </button>
        )}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Khi thêm gói thầu mới, bạn có thể khai báo nhiều thiết bị mới. Sau khi lưu, thiết bị tự xuất hiện trong trang <strong>Thiết bị</strong> với mã và QR riêng. Khi gói thầu <strong>Đã chọn thầu</strong>, thiết bị chuyển sang <strong>Đã phê duyệt</strong> và hệ thống tạo hồ sơ <strong>Mua sắm chờ ký HĐ</strong>. Nếu gói thầu <strong>Đã hủy</strong>, các thiết bị thuộc gói đang ở bước đấu thầu sẽ được xóa khỏi trang Thiết bị.
      </div>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="card p-4 flex flex-wrap gap-3">
        <input className="input" placeholder="Mã gói, tên gói, nhà cung cấp" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
        <input className="input" type="number" placeholder="Năm" value={year} onChange={e=>{setYear(e.target.value);setPage(1);}} />
        <select className="select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Mọi trạng thái</option>{tenderFlow.map(v=><option key={v} value={v}>{statusLabel[v]}</option>)}</select>
        <select className="select" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}><option value={20}>20/trang</option><option value={50}>50/trang</option></select>
      </div>
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Mã gói thầu</th>
              <th>Tên gói thầu</th>
              <th>Thiết bị trong gói</th>
              <th>SL hồ sơ</th>
              <th>Giá trị dự toán</th>
              <th>NCC trúng thầu</th>
              <th>Giá trúng</th>
              <th>Trạng thái</th>
              <th>Ngày mở thầu</th>
              {canUpdate && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {tenderingRecords.map(record => {
              const deviceIds = getTenderDeviceIds(record);
              const itemCount = record.tender_items?.length || (record.device_id ? 1 : 0);

              return (
                <tr key={record.id}>
                  <td className="font-mono text-xs font-semibold">{record.tender_code}</td>
                  <td>
                    <div className="font-medium text-gray-900">{record.tender_name}</div>
                    {itemCount > 1 && <div className="text-xs text-gray-500">{itemCount} dòng thiết bị</div>}
                  </td>
                  <td className="max-w-xs text-gray-600">
                    <div className="line-clamp-2">{getTenderDeviceSummary(record, devices)}</div>
                  </td>
                  <td>{deviceIds.length}</td>
                  <td>{formatCurrency(record.estimated_value)}</td>
                  <td className="text-gray-600">{record.winning_vendor || '—'}</td>
                  <td>{record.winning_bid_value ? formatCurrency(record.winning_bid_value) : '—'}</td>
                  <td><span className={`badge ${statusColor[record.tender_status] || ''}`}>{statusLabel[record.tender_status] || record.tender_status}</span></td>
                  <td className="text-gray-500 text-xs">{record.tender_date ? formatDateDisplay(record.tender_date) : '—'}</td>
                  {canUpdate && (
                    <td>
                      <button type="button" onClick={() => setStatusRecord(record)} className="btn-secondary whitespace-nowrap">
                        <Edit3 size={14} /> Cập nhật
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={setPage} />
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Thêm gói thầu mới" maxWidth="max-w-5xl">
        <TenderingForm onClose={() => setShowForm(false)} />
      </Modal>

      <Modal
        isOpen={Boolean(statusRecord)}
        onClose={() => setStatusRecord(null)}
        title={statusRecord ? `Cập nhật trạng thái: ${statusRecord.tender_code}` : 'Cập nhật trạng thái gói thầu'}
        maxWidth="max-w-3xl"
      >
        {statusRecord && <TenderStatusForm record={statusRecord} onClose={() => setStatusRecord(null)} />}
      </Modal>
    </div>
  );
}
