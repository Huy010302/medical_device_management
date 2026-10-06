import { useState } from 'react';
import { useStore } from '@/lib/store';
import { generateId } from '@/lib/deviceUtils';
import AttachmentUploader from '@/components/ui/AttachmentUploader';
import type { Attachment, DisposalMethod } from '@/types/lifecycle';

interface Props {
  deviceId?: string;
  onClose: () => void;
}

export default function DisposalForm({ deviceId, onClose }: Props) {
  const { devices, addDisposalRecord } = useStore();
  const [form, setForm] = useState({
    device_id: deviceId || '',
    disposal_date: '',
    reason: '',
    disposal_method: 'auction' as DisposalMethod,
    book_value: 0,
    disposal_value: 0,
    decision_number: '',
    decision_date: '',
    notes: '',
    attachments: [] as Attachment[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addDisposalRecord({
      id: generateId(),
      ...form,
      book_value: Number(form.book_value),
      disposal_value: Number(form.disposal_value),
      disposal_committee: [],
      attachments: form.attachments,
      created_at: new Date().toISOString(),
    });

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
          <label className="label">Ngày thanh lý</label>
          <input className="input" type="date" value={form.disposal_date} onChange={e => setForm(p => ({ ...p, disposal_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Phương thức</label>
          <select className="select" value={form.disposal_method} onChange={e => setForm(p => ({ ...p, disposal_method: e.target.value as DisposalMethod }))}>
            <option value="auction">Đấu giá</option>
            <option value="destroy">Tiêu hủy</option>
            <option value="donate">Tặng/Cho</option>
            <option value="return_vendor">Trả NCC</option>
          </select>
        </div>
        <div>
          <label className="label">Giá trị sổ sách (VNĐ)</label>
          <input className="input" type="number" value={form.book_value} onChange={e => setForm(p => ({ ...p, book_value: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Giá trị thu hồi (VNĐ)</label>
          <input className="input" type="number" value={form.disposal_value} onChange={e => setForm(p => ({ ...p, disposal_value: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="label">Số QĐ thanh lý</label>
          <input className="input" value={form.decision_number} onChange={e => setForm(p => ({ ...p, decision_number: e.target.value }))} />
        </div>
        <div>
          <label className="label">Ngày QĐ</label>
          <input className="input" type="date" value={form.decision_date} onChange={e => setForm(p => ({ ...p, decision_date: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Lý do thanh lý</label>
          <textarea className="textarea" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Ghi chú</label>
          <textarea className="textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <AttachmentUploader
            attachments={form.attachments}
            onChange={attachments => setForm(p => ({ ...p, attachments }))}
            label="Tài liệu thanh lý"
            helperText="Upload quyết định thanh lý, biên bản hội đồng, hình ảnh hiện trạng hoặc chứng từ thu hồi."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-danger">Thanh lý</button>
      </div>
    </form>
  );
}
