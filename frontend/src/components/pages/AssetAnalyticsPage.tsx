import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

type Row = Record<string, string>;
type Mode = 'risk' | 'cost' | 'failure';

const money = (n: string | number) => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
const RISK_STYLE: Record<string, { label: string; cls: string }> = {
  HIGH: { label: 'Cao', cls: 'bg-red-100 text-red-800 border-red-300' },
  MEDIUM: { label: 'Trung bình', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  LOW: { label: 'Thấp', cls: 'bg-green-100 text-green-800 border-green-300' },
};
const TITLES: Record<Mode, string> = { risk: 'Nguy cơ thiết bị', cost: 'Chi phí vòng đời', failure: 'Phân tích lỗi' };
const REQUIRED: Record<Mode, string[]> = {
  risk: ['device_risk_score'], cost: ['device_lifecycle_cost'], failure: ['failure_categories', 'failure_devices', 'failure_departments'],
};

function Stat({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p></div>;
}
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between text-sm"><span className="truncate pr-2">{label}</span><strong>{value.toLocaleString('vi-VN')}</strong></div>
      <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-blue-500" style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }} /></div>
    </div>
  );
}

export default function AssetAnalyticsPage({ mode }: { mode: Mode }) {
  const [datasets, setDatasets] = useState<Record<string, Row[]>>({});
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    apiJson<{ datasets: Record<string, Row[]> }>('/analytics/bigdata')
      .then(r => setDatasets(r.datasets)).catch(e => setError(String(e))).finally(() => setLoaded(true));
  }, []);

  const missing = REQUIRED[mode].filter(k => datasets[k] === undefined);
  const empty = loaded && !error && missing.length === 0 && REQUIRED[mode].every(k => (datasets[k] || []).length === 0);
  const risk = [...(datasets.device_risk_score || [])].sort((a, b) => Number(b.risk_score) - Number(a.risk_score));
  const cost = [...(datasets.device_lifecycle_cost || [])].sort((a, b) => Number(b.total_lifecycle_cost) - Number(a.total_lifecycle_cost));
  const sum = (k: string) => cost.reduce((t, r) => t + Number(r[k] || 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{TITLES[mode]}</h1>
        <p className="text-sm text-slate-600">Kết quả batch Spark từ dữ liệu nghiệp vụ. Chạy CAP_NHAT_BIGDATA.ps1 để cập nhật.</p>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {loaded && !error && (missing.length > 0 || empty) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Chưa có số liệu {missing.length > 0 ? `(thiếu ${missing.join(', ')}.csv)` : '(dữ liệu rỗng)'}.</p>
          <p className="mt-1">Cần có phiếu bảo trì/sửa chữa trong CSDL (chạy <code>scripts/seed_workflow_demo.py</code> nếu là demo), sau đó chạy <code>.\CAP_NHAT_BIGDATA.ps1</code> và tải lại trang.</p>
        </div>
      )}

      {mode === 'risk' && risk.length > 0 && <>
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Tổng thiết bị" value={risk.length.toLocaleString('vi-VN')} />
          <Stat label="Nguy cơ cao" value={risk.filter(r => r.risk_level === 'HIGH').length.toLocaleString('vi-VN')} cls="text-red-600" />
          <Stat label="Trung bình" value={risk.filter(r => r.risk_level === 'MEDIUM').length.toLocaleString('vi-VN')} cls="text-amber-600" />
          <Stat label="Thấp" value={risk.filter(r => r.risk_level === 'LOW').length.toLocaleString('vi-VN')} cls="text-green-600" />
        </div>
        <div className="card table-container">
          <table className="table">
            <thead><tr><th>Thiết bị</th><th>Điểm</th><th>Mức</th><th>Sửa 365 ngày</th><th>Ngày ngừng máy</th><th>Lý do</th></tr></thead>
            <tbody>{risk.slice(0, 50).map(r => {
              const st = RISK_STYLE[r.risk_level] || RISK_STYLE.LOW;
              return <tr key={r.device_id}>
                <td className="font-medium">{r.device_code || r.device_id}</td>
                <td><div className="flex items-center gap-2"><div className="h-2 w-20 rounded bg-slate-100"><div className={`h-2 rounded ${r.risk_level === 'HIGH' ? 'bg-red-500' : r.risk_level === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Number(r.risk_score))}%` }} /></div><strong>{r.risk_score}</strong></div></td>
                <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                <td>{r.repairs_365d}</td><td>{r.downtime_days}</td><td className="text-slate-600">{r.reason || '—'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Điểm 0–100 theo mức độ ưu tiên vận hành (tần suất sửa, thời gian ngừng máy, chi phí sửa/giá mua, tuổi máy); không thay thế đánh giá kỹ thuật. Hiển thị 50 thiết bị cao nhất.</p>
      </>}

      {mode === 'cost' && cost.length > 0 && <>
        <div className="grid gap-4 sm:grid-cols-5">
          <Stat label="Mua sắm" value={money(sum('purchase_cost'))} /><Stat label="Bảo trì" value={money(sum('maintenance_cost'))} />
          <Stat label="Sửa chữa" value={money(sum('repair_cost'))} /><Stat label="Linh kiện" value={money(sum('replacement_part_cost'))} />
          <Stat label="Tổng vòng đời" value={money(sum('total_lifecycle_cost'))} cls="text-blue-700" />
        </div>
        <div className="card table-container">
          <table className="table">
            <thead><tr><th>Thiết bị</th><th>Mua sắm</th><th>Bảo trì</th><th>Sửa chữa</th><th>Linh kiện</th><th>Tổng</th></tr></thead>
            <tbody>{cost.slice(0, 50).map(r => <tr key={r.device_id}><td className="font-medium">{r.device_code || r.device_id}</td><td>{money(r.purchase_cost)}</td><td>{money(r.maintenance_cost)}</td><td>{money(r.repair_cost)}</td><td>{money(r.replacement_part_cost)}</td><td className="font-bold">{money(r.total_lifecycle_cost)}</td></tr>)}</tbody>
          </table>
        </div>
      </>}

      {mode === 'failure' && !missing.length && !empty && (
        <div className="grid gap-4 lg:grid-cols-3">
          {([['failure_categories', 'Loại lỗi', 'fault_category'], ['failure_devices', 'Thiết bị lỗi nhiều', 'device_code'], ['failure_departments', 'Khoa có nhiều lỗi', 'department_name']] as const).map(([key, label, field]) => {
            const rows = (datasets[key] || []).slice(0, 15); const max = Math.max(0, ...rows.map(r => Number(r.repair_count)));
            return <div key={key} className="card p-4"><h2 className="font-semibold mb-2">{label}</h2>
              {rows.map((r, i) => <Bar key={i} label={r[field] || r.device_id || r.department_id || 'Chưa phân loại'} value={Number(r.repair_count)} max={max} />)}</div>;
          })}
        </div>
      )}
    </div>
  );
}
