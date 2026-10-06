import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { formatCurrency, generateDeviceCode, generateId } from '@/lib/deviceUtils';
import type { Attachment, Device, TenderStatus, TenderingDeviceItem } from '@/types/lifecycle';
import DateInputVN from '@/components/ui/DateInputVN';
import AttachmentUploader from '@/components/ui/AttachmentUploader';

interface Props {
  deviceId?: string;
  onClose: () => void;
}

type TenderDeviceDraft = {
  row_id: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  origin_country: string;
  unit: string;
  quantity: number;
  estimated_unit_value: number;
  notes: string;
};

const createEmptyItem = (defaultCategory = ''): TenderDeviceDraft => ({
  row_id: generateId(),
  name: '',
  category: defaultCategory,
  manufacturer: '',
  model: '',
  origin_country: '',
  unit: 'Cái',
  quantity: 1,
  estimated_unit_value: 0,
  notes: '',
});

const formatNumberInput = (value: number | string): string => {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseNumberInput = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export default function TenderingForm({ deviceId, onClose }: Props) {
  const { devices, addTenderingRecord, addTenderingPackage, updateDevice, deviceCategories } = useStore();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    device_id: deviceId || '',
    tender_code: '',
    tender_name: '',
    estimated_value: 0,
    tender_date: '',
    winning_vendor: '',
    winning_bid_value: 0,
    tender_status: 'planning' as TenderStatus,
    decision_number: '',
    decision_date: '',
    notes: '',
    attachments: [] as Attachment[],
  });
  const [items, setItems] = useState<TenderDeviceDraft[]>(() => deviceId ? [] : [createEmptyItem(deviceCategories[0]?.name || '')]);

  const draftTotal = useMemo(() => items.reduce((sum, item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return sum + quantity * (Number(item.estimated_unit_value) || 0);
  }, 0), [items]);

  const packageDeviceCount = useMemo(() => items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0), [items]);

  const setItem = (rowId: string, patch: Partial<TenderDeviceDraft>) => {
    setItems(prev => prev.map(item => item.row_id === rowId ? { ...item, ...patch } : item));
  };

  const addItem = () => setItems(prev => [...prev, createEmptyItem(deviceCategories[0]?.name || '')]);

  const removeItem = (rowId: string) => {
    setItems(prev => prev.length === 1 ? prev : prev.filter(item => item.row_id !== rowId));
  };

  const buildDeviceFromItem = (item: TenderDeviceDraft, now: string): Device => {
    const id = generateId();
    const deviceCode = generateDeviceCode();
    const tenderStatus = form.tender_status === 'awarded' ? 'approved' : 'tendering';

    return {
      id,
      device_code: deviceCode,
      name: item.name.trim(),
      category: item.category,
      category_id: deviceCategories.find(c=>c.name===item.category)?.id || null,
      manufacturer: item.manufacturer.trim(),
      model: item.model.trim(),
      origin_country: item.origin_country.trim(),
      unit: item.unit.trim() || 'Cái',
      current_status: tenderStatus,
      current_location: '',
      qr_data: `/devices/${id}`,
      qr_token: crypto.randomUUID(),
      notes: [
        `Tạo tự động từ gói thầu ${form.tender_code || form.tender_name || 'mới'}.`,
        item.notes.trim(),
      ].filter(Boolean).join('\n'),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const now = new Date().toISOString();

    if (deviceId) {
      if (!form.device_id) {
        setError('Vui lòng chọn thiết bị.');
        return;
      }

      addTenderingRecord({
        id: generateId(),
        ...form,
        estimated_value: Number(form.estimated_value),
        winning_bid_value: Number(form.winning_bid_value),
        device_ids: [form.device_id],
        tender_items: [],
        attachments: form.attachments,
        created_at: now,
      });

      const device = devices.find(d => d.id === form.device_id);
      if (device) {
        updateDevice({
          ...device,
          current_status: form.tender_status === 'awarded' ? 'approved' : 'tendering',
          updated_at: now,
        }, { skipAutoWorkflowLog: true });
      }

      onClose();
      return;
    }

    const validItems = items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      setError('Vui lòng thêm ít nhất một thiết bị trong gói thầu.');
      return;
    }

    const tenderItems: TenderingDeviceItem[] = [];
    const newDevices: Device[] = [];

    validItems.forEach(item => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const lineDevices = Array.from({ length: quantity }, () => buildDeviceFromItem(item, now));
      newDevices.push(...lineDevices);
      tenderItems.push({
        id: generateId(),
        device_ids: lineDevices.map(device => device.id),
        device_codes: lineDevices.map(device => device.device_code),
        name: item.name.trim(),
        category: item.category,
        manufacturer: item.manufacturer.trim(),
        model: item.model.trim(),
        origin_country: item.origin_country.trim(),
        unit: item.unit.trim() || 'Cái',
        quantity,
        estimated_unit_value: Number(item.estimated_unit_value) || 0,
        notes: item.notes.trim(),
      });
    });

    const totalEstimatedValue = Number(form.estimated_value) > 0 ? Number(form.estimated_value) : draftTotal;

    addTenderingPackage({
      id: generateId(),
      device_id: newDevices[0]?.id || '',
      device_ids: newDevices.map(device => device.id),
      tender_items: tenderItems,
      tender_code: form.tender_code,
      tender_name: form.tender_name,
      estimated_value: totalEstimatedValue,
      tender_date: form.tender_date,
      winning_vendor: form.winning_vendor,
      winning_bid_value: Number(form.winning_bid_value),
      tender_status: form.tender_status,
      decision_number: form.decision_number,
      decision_date: form.decision_date,
      attachments: form.attachments,
      notes: form.notes,
      created_at: now,
    }, newDevices);

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Gói thầu mới sẽ tự tạo thiết bị mới sang trang <strong>Thiết bị</strong>. Nếu trạng thái thầu là <strong>Đã chọn thầu</strong>, thiết bị sẽ ở trạng thái <strong>Đã phê duyệt</strong> và hệ thống tạo hồ sơ <strong>Mua sắm chờ ký HĐ</strong>; các trạng thái khác sẽ là <strong>Đấu thầu</strong>.
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Thông tin gói thầu</h3>
          <p className="text-xs text-gray-500">Thông tin chung áp dụng cho toàn bộ thiết bị trong gói.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deviceId && (
            <div className="md:col-span-2">
              <label className="label">Thiết bị *</label>
              <select className="select" value={form.device_id} onChange={e => setForm(p => ({ ...p, device_id: e.target.value }))} required>
                <option value="">-- Chọn thiết bị --</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.device_code} - {d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Mã gói thầu *</label>
            <input className="input" value={form.tender_code} onChange={e => setForm(p => ({ ...p, tender_code: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Tên gói thầu *</label>
            <input className="input" value={form.tender_name} onChange={e => setForm(p => ({ ...p, tender_name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Giá trị dự toán toàn gói (VNĐ)</label>
            <input
              className="input"
              inputMode="numeric"
              value={formatNumberInput(form.estimated_value)}
              onChange={e => setForm(p => ({ ...p, estimated_value: parseNumberInput(e.target.value) }))}
            />
            {!form.estimated_value && <p className="mt-1 text-xs text-gray-500">Để trống/0 để tự tính theo danh sách thiết bị.</p>}
          </div>
          <div>
            <label className="label">Ngày mở thầu</label>
            <DateInputVN
              className="input"
              value={form.tender_date}
              onChange={value => setForm(p => ({ ...p, tender_date: value }))}
            />
          </div>
          <div>
            <label className="label">Trạng thái thầu</label>
            <select className="select" value={form.tender_status} onChange={e => setForm(p => ({ ...p, tender_status: e.target.value as TenderStatus }))}>
              {/* <option value="planning">Lập kế hoạch</option> */}
              <option value="open">Đang mở thầu</option>
              <option value="evaluating">Đang đánh giá</option>
              <option value="awarded">Đã chọn thầu</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div>
            <label className="label">NCC trúng thầu</label>
            <input className="input" value={form.winning_vendor} onChange={e => setForm(p => ({ ...p, winning_vendor: e.target.value }))} />
          </div>
          <div>
            <label className="label">Giá trúng thầu</label>
            <input
              className="input"
              inputMode="numeric"
              value={formatNumberInput(form.winning_bid_value)}
              onChange={e => setForm(p => ({ ...p, winning_bid_value: parseNumberInput(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Số QĐ phê duyệt</label>
            <input className="input" value={form.decision_number} onChange={e => setForm(p => ({ ...p, decision_number: e.target.value }))} />
          </div>
          <div>
            <label className="label">Ngày QĐ</label>
            <input className="input" type="date" value={form.decision_date} onChange={e => setForm(p => ({ ...p, decision_date: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Ghi chú gói thầu</label>
            <textarea className="textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <AttachmentUploader
              attachments={form.attachments}
              onChange={attachments => setForm(p => ({ ...p, attachments }))}
              label="Tài liệu gói thầu"
              helperText="Upload quyết định phê duyệt, hồ sơ mời thầu, báo giá, biên bản chọn thầu hoặc tài liệu liên quan."
            />
          </div>
        </div>
      </section>

      {!deviceId && (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Danh sách thiết bị mới trong gói</h3>
              <p className="text-xs text-gray-500">Mỗi đơn vị số lượng sẽ sinh một hồ sơ thiết bị riêng để quản lý QR, bảo trì, sửa chữa và thanh lý.</p>
            </div>
            <button type="button" onClick={addItem} className="btn-secondary">+ Thêm dòng thiết bị</button>
          </div>

          <div className="grid gap-4">
            {items.map((item, index) => {
              const isOverBudget = form.estimated_value > 0 && item.estimated_unit_value > form.estimated_value;

              return (
                <div key={item.row_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">Thiết bị #{index + 1}</h4>
                      <p className="text-xs text-gray-500">Nhập thông tin thiết bị sẽ được tạo sau khi lưu gói thầu.</p>
                    </div>
                    <button type="button" onClick={() => removeItem(item.row_id)} className="btn-danger" disabled={items.length === 1}>Xóa dòng</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Tên thiết bị *</label>
                      <input className="input" value={item.name} onChange={e => setItem(item.row_id, { name: e.target.value })} placeholder="Ví dụ: Máy siêu âm Doppler màu" required />
                    </div>
                    <div>
                      <label className="label">Loại thiết bị</label>
                      <select className="select" value={item.category} onChange={e => setItem(item.row_id, { category: e.target.value })}>
                        <option value="">-- Chọn loại --</option>
                        {item.category && !deviceCategories.some(category => category.name === item.category) && <option value={item.category}>{item.category}</option>}
                        {deviceCategories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Hãng sản xuất</label>
                      <input className="input" value={item.manufacturer} onChange={e => setItem(item.row_id, { manufacturer: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Model</label>
                      <input className="input" value={item.model} onChange={e => setItem(item.row_id, { model: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Nước sản xuất</label>
                      <input className="input" value={item.origin_country} onChange={e => setItem(item.row_id, { origin_country: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Đơn vị tính</label>
                      <input className="input" value={item.unit} onChange={e => setItem(item.row_id, { unit: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Số lượng hồ sơ thiết bị</label>
                      <input className="input" type="number" min={1} value={item.quantity} onChange={e => setItem(item.row_id, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                    </div>
                    <div>
                      <label className="label">Đơn giá dự toán</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={formatNumberInput(item.estimated_unit_value)}
                        onChange={e => setItem(item.row_id, { estimated_unit_value: parseNumberInput(e.target.value) })}
                      />
                      {isOverBudget && (
                        <p className="mt-1 text-xs text-amber-600">
                          ⚠ Đơn giá vượt quá giá trị dự toán toàn gói ({formatCurrency(form.estimated_value)}).
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Ghi chú riêng của thiết bị</label>
                      <textarea className="textarea" value={item.notes} onChange={e => setItem(item.row_id, { notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Tổng thiết bị sẽ tạo: <strong>{packageDeviceCount}</strong> · Giá trị dự toán theo dòng thiết bị: <strong>{formatCurrency(draftTotal)}</strong>
          </div>
        </section>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">Lưu gói thầu</button>
      </div>
    </form>
  );
}
