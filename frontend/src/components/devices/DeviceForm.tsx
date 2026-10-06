import { useState } from 'react';
import { useStore } from '@/lib/store';
import { generateDeviceCode, generateId } from '@/lib/deviceUtils';
import type { Device, DeviceStatus } from '@/types/lifecycle';

interface DeviceFormProps {
  device: Device | null;
  onClose: () => void;
}

export default function DeviceForm({ device, onClose }: DeviceFormProps) {
  const { addDevice, updateDevice, deviceCategories, departments, deviceStatusOptions } = useStore();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: device?.name || '',
    category: device?.category || '',
    manufacturer: device?.manufacturer || '',
    model: device?.model || '',
    origin_country: device?.origin_country || '',
    unit: device?.unit || 'Cái',
    current_status: device?.current_status || 'tendering' as DeviceStatus,
    current_location: device?.current_location || '',
    notes: device?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return;

    try {
      if (device) {
        updateDevice({
          ...device,
          ...form,
          category_id: deviceCategories.find(c => c.name === form.category)?.id || null,
          department_id: departments.find(d => d.name === form.current_location)?.id || null,
          updated_at: new Date().toISOString(),
        });
      } else {
        const id = generateId();
        const newDevice: Device = {
          id,
          device_code: generateDeviceCode(),
          ...form,
          category_id: deviceCategories.find(c => c.name === form.category)?.id || null,
          department_id: departments.find(d => d.name === form.current_location)?.id || null,
          qr_data: `/devices/${id}`,
          qr_token: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
        addDevice(newDevice);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu thiết bị.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Tên thiết bị *</label>
          <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Loại thiết bị</label>
          <select className="select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            <option value="">-- Chọn loại --</option>
            {form.category && !deviceCategories.some(c => c.name === form.category) && <option value={form.category}>{form.category}</option>}
            {deviceCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Hãng sản xuất</label>
          <input className="input" value={form.manufacturer} onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))} />
        </div>
        <div>
          <label className="label">Model / Phiên bản</label>
          <input className="input" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} />
        </div>
        <div>
          <label className="label">Nước sản xuất</label>
          <input className="input" value={form.origin_country} onChange={e => setForm(p => ({ ...p, origin_country: e.target.value }))} />
        </div>
        <div>
          <label className="label">Đơn vị tính</label>
          <select className="select" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
            <option value="Cái">Cái</option>
            <option value="Bộ">Bộ</option>
            <option value="Hệ thống">Hệ thống</option>
          </select>
        </div>
        <div>
          <label className="label">Trạng thái</label>

          {device ? (
            <div className="input bg-gray-50 flex items-center">
              {deviceStatusOptions.find(s => s.value === device.current_status)?.label || device.current_status}
            </div>
          ) : (
            <select
              className="select"
              value={form.current_status}
              onChange={e => setForm(p => ({ ...p, current_status: e.target.value as DeviceStatus }))}
            >
              {deviceStatusOptions
                .filter(status => ['tendering', 'operating'].includes(status.value))
                .map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
            </select>
          )}

          {device && (
            <p className="mt-1 text-xs text-gray-500">
              Trạng thái thiết bị được cập nhật qua quy trình đấu thầu, mua sắm, tiếp nhận, bảo trì, sửa chữa hoặc thanh lý.
            </p>
          )}
        </div>
        <div>
          <label className="label">Khoa/Phòng hiện tại</label>
          <select className="select" value={form.current_location} onChange={e => setForm(p => ({ ...p, current_location: e.target.value }))}>
            <option value="">-- Chọn --</option>
            {form.current_location && !departments.some(d => d.name === form.current_location) && <option value={form.current_location}>{form.current_location}</option>}
            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Ghi chú</label>
          <textarea className="textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{device ? 'Cập nhật' : 'Tạo mới'}</button>
      </div>
    </form>
  );
}
