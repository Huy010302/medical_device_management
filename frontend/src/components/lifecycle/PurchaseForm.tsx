import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  formatCurrency,
  generateId,
  getPurchaseStatus,
  getTenderDeviceIds,
  getTenderDeviceSummary,
} from '@/lib/deviceUtils';
import AttachmentUploader from '@/components/ui/AttachmentUploader';
import type { Attachment, PurchaseDeviceItem, PurchaseStatus } from '@/types/lifecycle';

interface Props {
  tenderingRecordId?: string;
  onClose: () => void;
}

const purchaseFlow: PurchaseStatus[] = ['pending_contract', 'contract_signed', 'delivering', 'received', 'completed', 'cancelled'];

export default function PurchaseForm({ tenderingRecordId, onClose }: Props) {
  const { devices, tenderingRecords, purchaseRecords, addPurchaseRecord, updatePurchaseRecord, getPurchaseStatusLabel } = useStore();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    tendering_record_id: tenderingRecordId || '',
    contract_number: '',
    contract_date: '',
    vendor_name: '',
    vendor_contact: '',
    total_value: 0,
    payment_terms: '',
    delivery_date: '',
    warranty_months: 12,
    purchase_status: 'contract_signed' as PurchaseStatus,
    notes: '',
    attachments: [] as Attachment[],
  });

  const awardedTenders = useMemo(() => (
    tenderingRecords.filter(tender => tender.tender_status === 'awarded')
  ), [tenderingRecords]);

  const selectedTender = awardedTenders.find(tender => tender.id === form.tendering_record_id);
  const existingPurchase = purchaseRecords.find(record => record.tendering_record_id === form.tendering_record_id);
  const relatedDeviceIds = selectedTender ? getTenderDeviceIds(selectedTender) : [];

  const applyTenderSelection = (tenderId: string) => {
    const tender = awardedTenders.find(item => item.id === tenderId);
    const existing = purchaseRecords.find(record => record.tendering_record_id === tenderId);

    setForm(prev => ({
      ...prev,
      tendering_record_id: tenderId,
      contract_number: existing?.contract_number || '',
      contract_date: existing?.contract_date || '',
      vendor_name: existing?.vendor_name || tender?.winning_vendor || '',
      vendor_contact: existing?.vendor_contact || '',
      total_value: existing?.total_value || tender?.winning_bid_value || tender?.estimated_value || 0,
      payment_terms: existing?.payment_terms || '',
      delivery_date: existing?.delivery_date || '',
      warranty_months: existing?.warranty_months || 12,
      purchase_status: existing ? getPurchaseStatus(existing) : 'contract_signed',
      notes: existing?.notes || '',
      attachments: existing?.attachments || [],
    }));
  };

  useEffect(() => {
    if (tenderingRecordId) {
      applyTenderSelection(tenderingRecordId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderingRecordId]);

  const buildPurchaseItems = (): PurchaseDeviceItem[] => {
    if (!selectedTender) return [];

    if (selectedTender.tender_items && selectedTender.tender_items.length > 0) {
      return selectedTender.tender_items.map(item => ({
        id: generateId(),
        device_ids: item.device_ids,
        device_codes: item.device_codes,
        name: item.name,
        category: item.category,
        manufacturer: item.manufacturer,
        model: item.model,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.estimated_unit_value,
      }));
    }

    const quantity = Math.max(1, relatedDeviceIds.length);
    const unitValue = Number(form.total_value) / quantity;
    return relatedDeviceIds.map(id => {
      const device = devices.find(d => d.id === id);
      return {
        id: generateId(),
        device_ids: [id],
        device_codes: device ? [device.device_code] : [],
        name: device?.name || 'Thiết bị',
        category: device?.category || 'Khác',
        manufacturer: device?.manufacturer || '',
        model: device?.model || '',
        unit: device?.unit || 'Cái',
        quantity: 1,
        unit_price: unitValue,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTender) {
      setError('Vui lòng chọn gói thầu đã ở trạng thái Đã chọn thầu.');
      return;
    }

    if (form.purchase_status !== 'pending_contract' && form.purchase_status !== 'cancelled') {
      if (!form.contract_number.trim()) {
        setError('Vui lòng nhập số hợp đồng khi chuyển sang trạng thái đã ký/giao hàng/tiếp nhận.');
        return;
      }
      if (!form.contract_date) {
        setError('Vui lòng nhập ngày ký hợp đồng.');
        return;
      }
    }

    if (form.purchase_status === 'received' || form.purchase_status === 'completed') {
      const confirmed = window.confirm('Trạng thái này sẽ chuyển các thiết bị trong gói sang Đã tiếp nhận. Bạn chắc chắn muốn tiếp tục?');
      if (!confirmed) return;
    }

    const now = new Date().toISOString();
    const quantity = Math.max(1, relatedDeviceIds.length);
    const totalValue = Number(form.total_value) || selectedTender.winning_bid_value || selectedTender.estimated_value || 0;
    const nextRecord = {
      ...(existingPurchase || {}),
      id: existingPurchase?.id || generateId(),
      device_id: relatedDeviceIds[0] || '',
      device_ids: relatedDeviceIds,
      purchase_items: buildPurchaseItems(),
      tendering_record_id: selectedTender.id,
      purchase_status: form.purchase_status,
      contract_number: form.contract_number.trim(),
      contract_date: form.contract_date,
      vendor_name: form.vendor_name.trim() || selectedTender.winning_vendor,
      vendor_contact: form.vendor_contact.trim(),
      unit_price: totalValue / quantity,
      quantity,
      total_value: totalValue,
      currency: 'VND',
      payment_terms: form.payment_terms.trim(),
      delivery_date: form.delivery_date,
      warranty_months: Number(form.warranty_months) || 12,
      attachments: form.attachments,
      notes: form.notes.trim(),
      created_at: existingPurchase?.created_at || now,
    };

    if (existingPurchase) {
      updatePurchaseRecord(nextRecord);
    } else {
      addPurchaseRecord(nextRecord);
    }

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Mua sắm được quản lý theo <strong>gói thầu/hợp đồng</strong>. Khi ký hợp đồng, toàn bộ thiết bị trong gói chuyển sang <strong>Đang mua sắm</strong>. Khi tiếp nhận/nghiệm thu, thiết bị chuyển sang <strong>Đã tiếp nhận</strong>.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Gói thầu đã chọn thầu *</label>
          <select className="select" value={form.tendering_record_id} onChange={e => applyTenderSelection(e.target.value)} required>
            <option value="">-- Chọn gói thầu --</option>
            {awardedTenders.map(tender => (
              <option key={tender.id} value={tender.id}>
                {tender.tender_code} - {tender.tender_name} ({getTenderDeviceIds(tender).length} thiết bị)
              </option>
            ))}
          </select>
          {awardedTenders.length === 0 && <p className="mt-1 text-xs text-red-500">Chưa có gói thầu nào ở trạng thái Đã chọn thầu.</p>}
        </div>

        {selectedTender && (
          <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <div><strong>Thiết bị trong gói:</strong> {getTenderDeviceSummary(selectedTender, devices)}</div>
            <div><strong>Số lượng hồ sơ:</strong> {relatedDeviceIds.length}</div>
            <div><strong>Giá trị trúng thầu/dự toán:</strong> {formatCurrency(selectedTender.winning_bid_value || selectedTender.estimated_value || 0)}</div>
            {existingPurchase && <div className="mt-1 text-blue-700">Gói này đã có hồ sơ mua sắm. Lưu form sẽ cập nhật hồ sơ hiện có.</div>}
          </div>
        )}

        <div>
          <label className="label">Trạng thái mua sắm</label>
          <select className="select" value={form.purchase_status} onChange={e => setForm(p => ({ ...p, purchase_status: e.target.value as PurchaseStatus }))}>
            {purchaseFlow.map(status => <option key={status} value={status}>{getPurchaseStatusLabel(status)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tổng giá trị hợp đồng</label>
          <input className="input" type="number" min={0} value={form.total_value} onChange={e => setForm(p => ({ ...p, total_value: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Số hợp đồng</label>
          <input className="input" value={form.contract_number} onChange={e => setForm(p => ({ ...p, contract_number: e.target.value }))} />
        </div>
        <div>
          <label className="label">Ngày ký HĐ</label>
          <input className="input" type="date" value={form.contract_date} onChange={e => setForm(p => ({ ...p, contract_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Nhà cung cấp</label>
          <input className="input" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Liên hệ NCC</label>
          <input className="input" value={form.vendor_contact} onChange={e => setForm(p => ({ ...p, vendor_contact: e.target.value }))} />
        </div>
        <div>
          <label className="label">Ngày giao hàng dự kiến</label>
          <input className="input" type="date" value={form.delivery_date} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Bảo hành (tháng)</label>
          <input className="input" type="number" min={0} value={form.warranty_months} onChange={e => setForm(p => ({ ...p, warranty_months: Number(e.target.value) }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Điều khoản thanh toán</label>
          <input className="input" value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Ghi chú</label>
          <textarea className="textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <AttachmentUploader
            attachments={form.attachments}
            onChange={attachments => setForm(p => ({ ...p, attachments }))}
            label="Tài liệu hợp đồng mua sắm"
            helperText="Upload hợp đồng, phụ lục, báo giá, hóa đơn, phiếu giao hàng hoặc tài liệu mua sắm liên quan."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{existingPurchase ? 'Cập nhật mua sắm' : 'Lưu mua sắm'}</button>
      </div>
    </form>
  );
}
