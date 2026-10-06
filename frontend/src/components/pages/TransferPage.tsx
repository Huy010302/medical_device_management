import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { usePagedRecords } from '@/lib/usePagedRecords';
import { generateId } from '@/lib/deviceUtils';
import Pager from '@/components/ui/Pager';
import type { Device } from '@/types/lifecycle';

export default function TransferPage() {
  const { can, currentUser } = useAuth();
  const { addTransferRecord, updateDevice, transferRecords } = useStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [approved, setApproved] = useState('');
  const [error, setError] = useState('');
  const { data, error: loadError } = usePagedRecords<Device>('/devices', { page, page_size: 20, search });
  const names = useRef(new Map<string, string>());
  data.items.forEach(d => names.current.set(d.id, `${d.device_code} · ${d.name}`));

  const resetForm = () => { setTo(''); setReason(''); setApproved(''); setError(''); };
  const toggle = (d: Device) => {
    if (openId === d.id) { setOpenId(null); resetForm(); return; }   // bấm lại -> đóng
    setOpenId(d.id); resetForm();
  };
  const save = (d: Device) => {
    if (!to.trim() || !approved.trim()) { setError('Cần nhập vị trí nhận và người phê duyệt.'); return; }
    try {
      const now = new Date().toISOString();
      addTransferRecord({ id: generateId(), device_id: d.id, transfer_date: now.slice(0, 10), from_location: d.current_location || '', to_location: to.trim(), reason: reason.trim(), approved_by: approved.trim(), decision_number: '', attachments: [], created_at: now });
      updateDevice({ ...d, current_location: to.trim() });
      setOpenId(null); resetForm();
    } catch (e) { setError(String(e)); }
  };

  const canTransfer = can('device:update') && can('workflow:create');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Điều chuyển thiết bị</h1>
      {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
      {canTransfer && <>
        <input className="input" placeholder="Tìm thiết bị để điều chuyển" value={search} onChange={e => { setSearch(e.target.value); setPage(1); setOpenId(null); }} />
        <div className="card table-container">
          <table className="table">
            <thead><tr><th>Mã</th><th>Thiết bị</th><th>Vị trí</th><th></th></tr></thead>
            <tbody>
              {data.items.map(d => {
                const open = openId === d.id;
                return [
                  <tr key={d.id} className={open ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}>
                    <td className={open ? 'font-semibold text-blue-700' : ''}>{d.device_code}</td>
                    <td>{d.name}</td>
                    <td>{d.current_location || '—'}</td>
                    <td className="text-right">
                      <button className={open ? 'btn-primary' : 'btn-secondary'} onClick={() => toggle(d)}>{open ? 'Đóng phiếu ▲' : 'Điều chuyển'}</button>
                    </td>
                  </tr>,
                  open && (
                    <tr key={d.id + ':form'} className="bg-blue-50/60">
                      <td colSpan={4} className="!p-0">
                        <div className="m-3 rounded-xl border-2 border-blue-200 bg-white p-4 space-y-3">
                          <h2 className="font-semibold text-blue-800">Phiếu điều chuyển · {d.device_code} · {d.name}</h2>
                          <p className="text-xs text-slate-500">Từ: <b>{d.current_location || '—'}</b></p>
                          <div className="grid gap-3 md:grid-cols-3">
                            <input className="input" placeholder="Vị trí nhận *" value={to} onChange={e => setTo(e.target.value)} />
                            <input className="input" placeholder="Lý do" value={reason} onChange={e => setReason(e.target.value)} />
                            <input className="input" placeholder="Người phê duyệt *" value={approved} onChange={e => setApproved(e.target.value)} onFocus={() => { if (!approved && currentUser?.name) setApproved(currentUser.name); }} />
                          </div>
                          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                          <div className="flex gap-2">
                            <button className="btn-primary" onClick={() => save(d)}>Lưu phiếu</button>
                            <button className="btn-secondary" onClick={() => { setOpenId(null); resetForm(); }}>Hủy</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} totalPages={data.total_pages} total={data.total} onPage={p => { setPage(p); setOpenId(null); }} />
      </>}
      <h2 className="font-semibold">Phiếu gần đây ({transferRecords.length} đã tải)</h2>
      <div className="card table-container">
        <table className="table">
          <thead><tr><th>Ngày</th><th>Thiết bị</th><th>Từ</th><th>Đến</th><th>Phê duyệt</th></tr></thead>
          <tbody>{transferRecords.slice(-30).reverse().map(r => <tr key={r.id}><td>{r.transfer_date}</td><td>{names.current.get(r.device_id) || r.device_id}</td><td>{r.from_location}</td><td>{r.to_location}</td><td>{r.approved_by}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
