import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { generateId, getPurchaseDeviceIds } from '@/lib/deviceUtils';
import AttachmentUploader from '@/components/ui/AttachmentUploader';
import type { AcceptanceStatus, Attachment } from '@/types/lifecycle';

interface Props {
  purchaseRecordId?: string;
  onClose: () => void;
}

export default function ReceptionForm({ purchaseRecordId, onClose }: Props) {
  const { devices, purchaseRecords, receptionRecords, addReceptionRecord, departments } = useStore();

  const selectedPurchase = purchaseRecords.find(p => p.id === purchaseRecordId);

  const availableDevices = useMemo(() => {
    if (!selectedPurchase) return devices.filter(d => d.current_status === 'received' || d.current_status === 'purchased');

    const purchaseDeviceIds = getPurchaseDeviceIds(selectedPurchase);
    const alreadyReceivedIds = new Set(
      receptionRecords
        .filter(r => r.purchase_record_id === selectedPurchase.id)
        .map(r => r.device_id)
    );

    return devices.filter(d =>
      purchaseDeviceIds.includes(d.id) &&
      !alreadyReceivedIds.has(d.id)
    );
  }, [devices, receptionRecords, selectedPurchase]);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    device_id: '',
    reception_date: today,
    serial_number: '',
    asset_code: '',
    installation_date: '',
    commissioning_date: '',
    warranty_start: today,
    warranty_end: '',
    initial_location: '',
    acceptance_status: 'passed' as AcceptanceStatus,
    notes: '',
    attachments: [] as Attachment[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addReceptionRecord({
      id: generateId(),
      device_id: form.device_id,
      purchase_record_id: selectedPurchase?.id,
      reception_date: form.reception_date,
      reception_committee: [],
      serial_number: form.serial_number.trim(),
      asset_code: form.asset_code.trim(),
      installation_date: form.installation_date,
      commissioning_date: form.commissioning_date,
      warranty_start: form.warranty_start,
      warranty_end: form.warranty_end,
      initial_location: form.initial_location,
      acceptance_status: form.acceptance_status,
      attachments: form.attachments,
      notes: form.notes.trim(),
      created_at: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-800">
        Nghiệm thu đạt và có ngày đưa vào sử dụng thì thiết bị sẽ chuyển sang <strong>Đang vận hành</strong>.
        Nếu chưa có ngày đưa vào sử dụng, thiết bị giữ ở trạng thái <strong>Đã tiếp nhận</strong>.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Thiết bị *</label>
          <select
            className="select"
            value={form.device_id}
            onChange={e => setForm(p => ({ ...p, device_id: e.target.value }))}
            required
          >
            <option value="">-- Chọn thiết bị --</option>
            {availableDevices.map(d => (
              <option key={d.id} value={d.id}>
                {d.device_code} - {d.name}
              </option>
            ))}
          </select>
          {availableDevices.length === 0 && (
            <p className="mt-1 text-xs text-red-500">Không còn thiết bị nào trong gói cần nghiệm thu.</p>
          )}
        </div>

        <div>
          <label className="label">Ngày tiếp nhận</label>
          <input className="input" type="date" value={form.reception_date} onChange={e => setForm(p => ({ ...p, reception_date: e.target.value }))} />
        </div>

        <div>
          <label className="label">Kết quả nghiệm thu</label>
          <select
            className="select"
            value={form.acceptance_status}
            onChange={e => setForm(p => ({ ...p, acceptance_status: e.target.value as AcceptanceStatus }))}
          >
            <option value="passed">Đạt</option>
            <option value="conditional">Đạt có điều kiện</option>
            <option value="failed">Không đạt</option>
          </select>
        </div>

        <div>
          <label className="label">Serial number</label>
          <input className="input" value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} />
        </div>

        <div>
          <label className="label">Mã tài sản</label>
          <input className="input" value={form.asset_code} onChange={e => setForm(p => ({ ...p, asset_code: e.target.value }))} />
        </div>

        <div>
          <label className="label">Ngày lắp đặt</label>
          <input className="input" type="date" value={form.installation_date} onChange={e => setForm(p => ({ ...p, installation_date: e.target.value }))} />
        </div>

        <div>
          <label className="label">Ngày đưa vào sử dụng</label>
          <input className="input" type="date" value={form.commissioning_date} onChange={e => setForm(p => ({ ...p, commissioning_date: e.target.value }))} />
        </div>

        <div>
          <label className="label">Bảo hành từ</label>
          <input className="input" type="date" value={form.warranty_start} onChange={e => setForm(p => ({ ...p, warranty_start: e.target.value }))} />
        </div>

        <div>
          <label className="label">Bảo hành đến</label>
          <input className="input" type="date" value={form.warranty_end} onChange={e => setForm(p => ({ ...p, warranty_end: e.target.value }))} />
        </div>

        <div className="md:col-span-2">
          <label className="label">Khoa/Phòng sử dụng</label>
          <select
            className="select"
            value={form.initial_location}
            onChange={e => setForm(p => ({ ...p, initial_location: e.target.value }))}
          >
            <option value="">-- Chọn --</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label">Ghi chú</label>
          <textarea className="textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <AttachmentUploader
            attachments={form.attachments}
            onChange={attachments => setForm(p => ({ ...p, attachments }))}
            label="Tài liệu nghiệm thu"
            helperText="Upload biên bản nghiệm thu, phiếu bàn giao, hình ảnh lắp đặt hoặc giấy tờ bảo hành."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">Lưu nghiệm thu</button>
      </div>
    </form>
  );
}