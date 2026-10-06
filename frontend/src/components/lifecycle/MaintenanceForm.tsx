import { useState } from 'react';
import { useStore } from '@/lib/store';
import { generateId } from '@/lib/deviceUtils';
import type { MaintenanceRecord, MaintenanceType, MaintenanceResult } from '@/types/lifecycle';
import DateInputVN from '@/components/ui/DateInputVN';
import AttachmentUploader from '@/components/ui/AttachmentUploader';

interface Props {
  deviceId?: string;
  maintenance?: MaintenanceRecord | null;
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

export default function MaintenanceForm({ deviceId, maintenance, onClose }: Props) {
  const { devices, addMaintenanceRecord, updateMaintenanceRecord } = useStore();
  const [form, setForm] = useState({
    device_id: maintenance?.device_id || deviceId || '',
    maintenance_type: (maintenance?.maintenance_type || 'preventive') as MaintenanceType,
    scheduled_date: maintenance?.scheduled_date || '',
    actual_date: maintenance?.actual_date || '',
    performed_by: maintenance?.performed_by || '',
    service_company: maintenance?.service_company || '',
    description: maintenance?.description || '',
    result: (maintenance?.result || 'completed') as MaintenanceResult,
    cost: maintenance?.cost || 0,
    next_maintenance_date: maintenance?.next_maintenance_date || '',
    attachments: maintenance?.attachments || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const today = new Date().toISOString().slice(0, 10);
    const normalizedForm = {
      ...form,
      actual_date: form.result === 'completed' ? (form.actual_date || today) : form.actual_date,
    };

    const nextRecord: MaintenanceRecord = {
      id: maintenance?.id || generateId(),
      ...normalizedForm,
      cost: Number(normalizedForm.cost),
      attachments: normalizedForm.attachments,
      created_by: maintenance?.created_by,
      created_at: maintenance?.created_at || new Date().toISOString(),
    };

    if (maintenance) updateMaintenanceRecord(nextRecord);
    else addMaintenanceRecord(nextRecord);

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!deviceId && (
          <div className="md:col-span-2">
            <label className="label">Thiết bị *</label>
            <select className="select" value={form.device_id} onChange={e => setForm(p => ({ ...p, device_id: e.target.value }))} required disabled={Boolean(maintenance)}>
              <option value="">-- Chọn --</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.device_code} - {d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Loại bảo trì</label>
          <select className="select" value={form.maintenance_type} onChange={e => setForm(p => ({ ...p, maintenance_type: e.target.value as MaintenanceType }))}>
            <option value="preventive">Định kỳ</option>
            <option value="corrective">Sửa chữa nhỏ</option>
            <option value="calibration">Hiệu chuẩn</option>
          </select>
        </div>
        <div>
          <label className="label">Ngày lịch trình</label>
          <DateInputVN
            className="input"
            value={form.scheduled_date}
            onChange={value => setForm(p => ({ ...p, scheduled_date: value }))}
          />
        </div>
        <div>
          <label className="label">Ngày thực hiện</label>
          <DateInputVN
            className="input"
            value={form.actual_date}
            onChange={value => setForm(p => ({ ...p, actual_date: value }))}
          />
        </div>
        <div>
          <label className="label">Người thực hiện</label>
          <input className="input" value={form.performed_by} onChange={e => setForm(p => ({ ...p, performed_by: e.target.value }))} />
        </div>
        <div>
          <label className="label">Công ty dịch vụ</label>
          <input className="input" value={form.service_company} onChange={e => setForm(p => ({ ...p, service_company: e.target.value }))} />
        </div>
        <div>
          <label className="label">Kết quả</label>
          <select className="select" value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value as MaintenanceResult }))}>
            <option value="completed">Hoàn thành</option>
            <option value="incomplete">Chưa hoàn thành</option>
            <option value="needs_repair">Cần sửa chữa</option>
          </select>
        </div>
        {form.result === 'incomplete' && (
          <div className="md:col-span-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Bảo trì chưa hoàn thành: thiết bị sẽ được chuyển sang trạng thái
            <strong> Bảo trì chưa hoàn thành</strong> và cần tiếp tục xử lý.
          </div>
        )}

        {form.result === 'needs_repair' && (
          <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Kết quả này sẽ chuyển thiết bị sang trạng thái
            <strong> Cần sửa chữa</strong>. Nếu thiết bị chưa có phiếu sửa chữa mở,
            hệ thống sẽ tự tạo một phiếu sửa chữa mới.
          </div>
        )}

        {form.result === 'completed' && (
          <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Khi lưu <strong>Hoàn thành</strong>, nếu không còn phiếu sửa chữa hoặc linh kiện đang mở,
            thiết bị sẽ tự quay về <strong>Đang vận hành</strong>.
          </div>
        )}
        <div>
          <label className="label">Chi phí (VNĐ)</label>
          <input
            className="input"
            inputMode="numeric"
            value={formatNumberInput(form.cost)}
            onChange={e => setForm(p => ({ ...p, cost: parseNumberInput(e.target.value) }))}
          />
        </div>
        <div>
          <label className="label">Bảo trì tiếp theo</label>
          <DateInputVN
            className="input"
            value={form.next_maintenance_date}
            onChange={value => setForm(p => ({ ...p, next_maintenance_date: value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Mô tả công việc</label>
          <textarea className="textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <AttachmentUploader
            attachments={form.attachments}
            onChange={attachments => setForm(p => ({ ...p, attachments }))}
            label="Tài liệu bảo trì"
            helperText="Upload biên bản bảo trì, hình ảnh kiểm tra, chứng từ dịch vụ hoặc phiếu hiệu chuẩn."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{maintenance ? 'Cập nhật' : 'Lưu'}</button>
      </div>
    </form>
  );
}