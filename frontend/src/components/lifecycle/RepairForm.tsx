import { useState } from 'react';
import { useStore } from '@/lib/store';
import { generateId } from '@/lib/deviceUtils';
import type { RepairRecord, RepairStatus } from '@/types/lifecycle';
import DateInputVN from '@/components/ui/DateInputVN';
import AttachmentUploader from '@/components/ui/AttachmentUploader';

interface Props {
  deviceId?: string;
  repair?: RepairRecord | null;
  onClose: () => void;
}

// Định dạng số nguyên dùng dấu '.' ngăn cách hàng nghìn, ví dụ 1234567 -> "1.234.567"
const formatNumberInput = (value: number | string): string => {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Chuyển chuỗi đã format (có dấu '.') về number thuần
const parseNumberInput = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export default function RepairForm({ deviceId, repair, onClose }: Props) {
  const { devices, addRepairRecord, updateRepairRecord } = useStore();
  const [form, setForm] = useState({
    device_id: repair?.device_id || deviceId || '',
    report_date: repair?.report_date || '',
    reported_by: repair?.reported_by || '',
    fault_description: repair?.fault_description || '',
    repair_start_date: repair?.repair_start_date || '',
    repair_end_date: repair?.repair_end_date || '',
    repair_company: repair?.repair_company || '',
    technician: repair?.technician || '',
    repair_description: repair?.repair_description || '',
    total_cost: repair?.total_cost || 0,
    repair_status: (repair?.repair_status || 'reported') as RepairStatus,
    warranty_claim: repair?.warranty_claim || false,
    attachments: repair?.attachments || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const today = new Date().toISOString().slice(0, 10);
    const normalizedForm = { ...form };

    if (normalizedForm.repair_status === 'in_progress' && !normalizedForm.repair_start_date) {
      normalizedForm.repair_start_date = today;
    }

    if (normalizedForm.repair_status === 'completed') {
      if (!normalizedForm.repair_start_date) normalizedForm.repair_start_date = repair?.repair_start_date || today;
      if (!normalizedForm.repair_end_date) normalizedForm.repair_end_date = today;
    }

    const nextRecord: RepairRecord = {
      id: repair?.id || generateId(),
      ...normalizedForm,
      total_cost: Number(normalizedForm.total_cost),
      parts_replaced: repair?.parts_replaced || [],
      attachments: normalizedForm.attachments,
      created_by: repair?.created_by,
      created_at: repair?.created_at || new Date().toISOString(),
    };

    if (repair) updateRepairRecord(nextRecord);
    else addRepairRecord(nextRecord);

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!deviceId && (
          <div className="md:col-span-2">
            <label className="label">Thiết bị *</label>
            <select className="select" value={form.device_id} onChange={e => setForm(p => ({ ...p, device_id: e.target.value }))} required>
              <option value="">-- Chọn --</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.device_code} - {d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Ngày phát hiện hỏng</label>
          <DateInputVN
            className="input"
            value={form.report_date}
            onChange={value => setForm(p => ({ ...p, report_date: value }))}
          />
        </div>
        <div>
          <label className="label">Người báo cáo</label>
          <input className="input" value={form.reported_by} onChange={e => setForm(p => ({ ...p, reported_by: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Mô tả lỗi</label>
          <textarea className="textarea" value={form.fault_description} onChange={e => setForm(p => ({ ...p, fault_description: e.target.value }))} />
        </div>
        <div>
          <label className="label">Ngày bắt đầu sửa</label>
          <DateInputVN
            className="input"
            value={form.repair_start_date}
            onChange={value => setForm(p => ({ ...p, repair_start_date: value }))}
          />
        </div>
        <div>
          <label className="label">Ngày kết thúc</label>
          <DateInputVN
            className="input"
            value={form.repair_end_date}
            onChange={value => setForm(p => ({ ...p, repair_end_date: value }))}
          />
        </div>
        <div>
          <label className="label">Đơn vị sửa chữa</label>
          <input className="input" value={form.repair_company} onChange={e => setForm(p => ({ ...p, repair_company: e.target.value }))} />
        </div>
        <div>
          <label className="label">Kỹ thuật viên</label>
          <input className="input" value={form.technician} onChange={e => setForm(p => ({ ...p, technician: e.target.value }))} />
        </div>
        <div>
          <label className="label">Trạng thái</label>
          <select className="select" value={form.repair_status} onChange={e => setForm(p => ({ ...p, repair_status: e.target.value as RepairStatus }))}>
            <option value="reported">Đã báo cáo</option>
            <option value="in_progress">Đang sửa</option>
            <option value="awaiting_parts">Chờ linh kiện</option>
            <option value="completed">Hoàn thành</option>
            <option value="irreparable">Không sửa được</option>
          </select>
        </div>
        {form.repair_status === 'reported' && (
          <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Thiết bị sẽ được chuyển sang trạng thái <strong>Cần sửa chữa</strong>.
          </div>
        )}

        {form.repair_status === 'in_progress' && (
          <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Thiết bị sẽ được chuyển sang trạng thái <strong>Đang sửa chữa</strong>.
          </div>
        )}

        {form.repair_status === 'awaiting_parts' && (
          <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Thiết bị sẽ được chuyển sang trạng thái <strong>Chờ linh kiện</strong>.
          </div>
        )}

        {form.repair_status === 'irreparable' && (
          <div className="md:col-span-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            Thiết bị sẽ được đánh dấu <strong>Không sửa được</strong>. Nên xem xét quy trình thanh lý.
          </div>
        )}

        {form.repair_status === 'completed' && (
          <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Phiếu này sẽ được đánh dấu <strong>Sửa xong</strong>. Nếu không còn phiếu sửa chữa/bảo trì/linh kiện đang mở, thiết bị sẽ quay về <strong>Đang vận hành</strong>.
          </div>
        )}
        <div>
          <label className="label">Chi phí (VNĐ)</label>
          <input
            className="input"
            inputMode="numeric"
            value={formatNumberInput(form.total_cost)}
            onChange={e => setForm(p => ({ ...p, total_cost: parseNumberInput(e.target.value) }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Mô tả công việc sửa chữa</label>
          <textarea className="textarea" value={form.repair_description} onChange={e => setForm(p => ({ ...p, repair_description: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.warranty_claim} onChange={e => setForm(p => ({ ...p, warranty_claim: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
            <span className="text-sm">Yêu cầu bảo hành</span>
          </label>
        </div>
        <div className="md:col-span-2">
          <AttachmentUploader
            attachments={form.attachments}
            onChange={attachments => setForm(p => ({ ...p, attachments }))}
            label="Tài liệu sửa chữa"
            helperText="Upload biên bản sửa chữa, hình ảnh lỗi, báo giá linh kiện, hóa đơn hoặc giấy bảo hành."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{repair ? 'Cập nhật' : 'Lưu'}</button>
      </div>
    </form>
  );
}
