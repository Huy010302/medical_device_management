import { useState } from 'react';
import { usePagedRecords } from '@/lib/usePagedRecords';
import Pager from '@/components/ui/Pager';
import { Edit3, Plus, PackageCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import {
  formatCurrency,
  getPurchaseDeviceIds,
  getPurchaseDeviceSummary,
  getPurchaseStatus,
} from '@/lib/deviceUtils';
import type { PurchaseRecord } from '@/types/lifecycle';
import Modal from '@/components/ui/Modal';
import PurchaseForm from '@/components/lifecycle/PurchaseForm';
import ReceptionForm from '@/components/lifecycle/ReceptionForm';


export default function PurchasingPage() {
  const { can } = useAuth();
  const { devices, tenderingRecords, getPurchaseStatusLabel, getPurchaseStatusColor } = useStore();
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(20);
  const [search,setSearch] = useState('');
  const [dateFrom,setDateFrom] = useState('');
  const [dateTo,setDateTo] = useState('');
  const [statusFilter,setStatusFilter] = useState('');
  const {data,error} = usePagedRecords<PurchaseRecord>('/purchases',{page,page_size:pageSize,search,date_from:dateFrom,date_to:dateTo,status:statusFilter});
  const purchaseRecords = data.items;
  const canCreate = can('workflow:create');
  const canUpdate = can('workflow:update');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<PurchaseRecord | null>(null);
  const [receptionPurchase, setReceptionPurchase] = useState<PurchaseRecord | null>(null);

  const getTenderLabel = (id?: string) => {
    const tender = tenderingRecords.find(t => t.id === id);
    return tender ? `${tender.tender_code} - ${tender.tender_name}` : 'Không liên kết gói thầu';
  };

  const pendingCount = purchaseRecords.filter(r => getPurchaseStatus(r) === 'pending_contract').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Mua sắm</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.total} hồ sơ mua sắm · {pendingCount} hồ sơ chờ ký hợp đồng
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Tạo/cập nhật hợp đồng
          </button>
        )}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Trang này quản lý mua sắm theo <strong>gói thầu/hợp đồng</strong>. Khi gói thầu chuyển sang <strong>Đã chọn thầu</strong>, hệ thống tự tạo hồ sơ <strong>Chờ ký hợp đồng</strong>. Khi ký hợp đồng, các thiết bị trong gói chuyển sang <strong>Đang mua sắm</strong>; khi tiếp nhận/nghiệm thu, chuyển sang <strong>Đã tiếp nhận</strong>.
      </div>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="card p-4 flex flex-wrap gap-3">
        <input className="input" placeholder="Số hợp đồng, nhà cung cấp" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
        <label className="text-xs">Từ ngày<input className="input" type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} /></label><label className="text-xs">Đến ngày<input className="input" type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}} /></label>
        <select className="select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}><option value="">Mọi trạng thái</option>{['pending_contract','contract_signed','delivering','received','completed','cancelled'].map(v=><option key={v} value={v}>{v}</option>)}</select>
        <select className="select" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}><option value={20}>20/trang</option><option value={50}>50/trang</option></select>
      </div>
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Hợp đồng</th>
              <th>Gói thầu</th>
              <th>Thiết bị trong gói</th>
              <th>SL hồ sơ</th>
              <th>Nhà cung cấp</th>
              <th>Tổng giá trị</th>
              <th>Trạng thái</th>
              <th>Ngày giao</th>
              <th>Ngày ký</th>
              {canUpdate && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {purchaseRecords.map(record => {
              const status = getPurchaseStatus(record);
              const deviceCount = getPurchaseDeviceIds(record).length;

              return (
                <tr key={record.id}>
                  <td>
                    <div className="font-mono text-xs font-semibold">{record.contract_number || 'Chờ ký HĐ'}</div>
                    {record.warranty_months > 0 && <div className="text-xs text-gray-500">BH {record.warranty_months} tháng</div>}
                  </td>
                  <td className="max-w-xs text-gray-600">
                    <div className="line-clamp-2">{getTenderLabel(record.tendering_record_id)}</div>
                  </td>
                  <td className="max-w-xs text-gray-600">
                    <div className="line-clamp-2">{getPurchaseDeviceSummary(record, devices)}</div>
                  </td>
                  <td>{deviceCount}</td>
                  <td className="text-gray-600">{record.vendor_name || '—'}</td>
                  <td className="font-medium">{formatCurrency(record.total_value || 0)}</td>
                  <td><span className={`badge ${getPurchaseStatusColor(status)}`}>{getPurchaseStatusLabel(status)}</span></td>
                  <td className="text-gray-500 text-xs">{record.delivery_date || '—'}</td>
                  <td className="text-gray-500 text-xs">{record.contract_date || '—'}</td>
                  {canUpdate && (
                    <td>
                      <button type="button" onClick={() => setEditRecord(record)} className="btn-secondary whitespace-nowrap">
                        <Edit3 size={14} /> Cập nhật
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceptionPurchase(record)}
                        className="btn-secondary whitespace-nowrap mt-2"
                      >
                        <PackageCheck size={14} /> Nghiệm thu
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
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Tạo/cập nhật hợp đồng mua sắm" maxWidth="max-w-4xl">
        <PurchaseForm onClose={() => setShowForm(false)} />
      </Modal>

      <Modal
        isOpen={Boolean(editRecord)}
        onClose={() => setEditRecord(null)}
        title={editRecord ? `Cập nhật mua sắm: ${editRecord.contract_number || 'Chờ ký HĐ'}` : 'Cập nhật mua sắm'}
        maxWidth="max-w-4xl"
      >
        {editRecord && <PurchaseForm tenderingRecordId={editRecord.tendering_record_id} onClose={() => setEditRecord(null)} />}
      </Modal>
      <Modal
        isOpen={Boolean(receptionPurchase)}
        onClose={() => setReceptionPurchase(null)}
        title={receptionPurchase ? `Nghiệm thu: ${receptionPurchase.contract_number || 'Hồ sơ mua sắm'}` : 'Nghiệm thu'}
        maxWidth="max-w-3xl"
      >
        {receptionPurchase && (
          <ReceptionForm
            purchaseRecordId={receptionPurchase.id}
            onClose={() => setReceptionPurchase(null)}
          />
        )}
      </Modal>
    </div>
  );
}
