import { useCallback, useEffect, useState } from 'react';
import { Cpu, Database, Layers, RefreshCw } from 'lucide-react';
import { apiJson } from '@/lib/api';

type DatasetRow = Record<string, string>;
type Analytics = {
  source: string;
  datasets: Record<string, DatasetRow[]>;
  meta?: { dataset_count?: number; generated_at?: string | null };
};

export default function BigDataPanel() {
  const [report, setReport] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await apiJson<Analytics>('/analytics/bigdata'));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Không tải được báo cáo Spark.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const distribution = report?.datasets.lifecycle_event_summary || [];
  const total = distribution.reduce((sum, row) => sum + Number(row.event_count || 0), 0);
  const deviceCount = report?.datasets.device_activity?.length || 0;

  return (
    <section className="card p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="text-blue-600" size={20} />
            <h2 className="text-lg font-bold">Big Data — Apache Spark Analytics</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            PostgreSQL → JSONL → Spark → analytical datasets → FastAPI → React.
          </p>
        </div>
        <button className="btn-secondary" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tải...' : 'Đọc kết quả Spark mới nhất'}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Chưa có dữ liệu phân tích đã xuất từ Spark: {error}. Sau khi ghi nghiệp vụ, chạy export_events.py và run_demo_pipeline.py rồi nhấn tải lại.
        </p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <Database className="text-blue-600" size={18} />
              <p className="mt-2 text-xl font-bold text-gray-900">{total.toLocaleString('vi-VN')}</p>
              <p className="text-xs text-gray-600">Sự kiện Spark đã xử lý</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <Layers className="text-emerald-600" size={18} />
              <p className="mt-2 text-xl font-bold text-gray-900">{deviceCount.toLocaleString('vi-VN')}</p>
              <p className="text-xs text-gray-600">Thiết bị có dữ liệu event</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
              <Cpu className="text-violet-600" size={18} />
              <p className="mt-2 text-xl font-bold text-gray-900">{distribution.length}</p>
              <p className="text-xs text-gray-600">Loại sự kiện được phân tích</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Loại sự kiện</th><th>Số lần</th></tr></thead>
              <tbody>
                {distribution.slice(0, 7).map(row => (
                  <tr key={row.event_type}>
                    <td>{row.event_type}</td>
                    <td>{Number(row.event_count).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border p-4"><h3 className="font-semibold mb-2">Thiết bị nguy cơ cao</h3>{[...(report.datasets.device_risk_score||[])].filter(row=>row.risk_level==='HIGH').sort((a,b)=>Number(b.risk_score)-Number(a.risk_score)).slice(0,5).map(row=><p key={row.device_id} className="border-t py-2 text-sm">{row.device_code||row.device_id}: <strong>{row.risk_score}</strong> · {row.reason}</p>)}</div>
            <div className="rounded-xl border p-4"><h3 className="font-semibold mb-2">Chi phí vòng đời cao nhất</h3>{[...(report.datasets.device_lifecycle_cost||[])].sort((a,b)=>Number(b.total_lifecycle_cost)-Number(a.total_lifecycle_cost)).slice(0,5).map(row=><p key={row.device_id} className="border-t py-2 text-sm">{row.device_code||row.device_id}: <strong>{Number(row.total_lifecycle_cost||0).toLocaleString('vi-VN')} ₫</strong></p>)}</div>
            <div className="rounded-xl border p-4"><h3 className="font-semibold mb-2">Loại lỗi thường gặp</h3>{(report.datasets.failure_categories||[]).slice(0,5).map((row,i)=><p key={i} className="border-t py-2 text-sm">{row.fault_category||'Chưa phân loại'}: <strong>{row.repair_count}</strong></p>)}</div>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Đây là kết quả batch, không phải thống kê CRUD realtime. Mở menu <strong>Phân tích Big Data</strong> để xem xu hướng theo thời gian, top thiết bị, maintenance/repair analytics, cost/fault analytics và benchmark Spark.
          </p>
        </>
      )}
    </section>
  );
}
