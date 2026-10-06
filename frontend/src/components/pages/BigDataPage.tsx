import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Clock,
  Cpu,
  Database,
  FileText,
  Layers,
  Lightbulb,
  RefreshCw,
  Server,
  Settings,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { apiJson } from '@/lib/api';

type DatasetRow = Record<string, string>;

type AnalyticsResponse = {
  source: string;
  datasets: Record<string, DatasetRow[]>;
  meta?: {
    dataset_count?: number;
    analytical_dataset_count?: number;
    technical_dataset_count?: number;
    core_dataset_count?: number;
    extended_dataset_count?: number;
    generated_at?: string | null;
  };
};

type EventCountResponse = { events: number };

type MonthlyPoint = {
  month: string;
  total?: number;
  maintenance?: number;
  repair?: number;
  maintenanceCost?: number;
  repairCost?: number;
};

const EVENT_LABELS: Record<string, string> = {
  MAINTENANCE_COMPLETED: 'Bảo trì hoàn tất',
  REPAIR_COMPLETED: 'Sửa chữa hoàn tất',
  DEVICE_STATUS_CHANGED: 'Đổi trạng thái',
  DEVICE_TRANSFERRED: 'Điều chuyển',
  DEVICE_RECEIVED: 'Tiếp nhận',
  DEVICE_DISPOSED: 'Thanh lý',
  DEVICE_REGISTERED: 'Đăng ký thiết bị',
};

function asNumber(value: string | number | undefined): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Chưa có';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN');
}

function partialBoundaryMonths(firstEvent?: string, lastEvent?: string): string[] {
  const partial = new Set<string>();

  if (firstEvent) {
    const first = new Date(firstEvent);
    if (!Number.isNaN(first.getTime()) && first.getUTCDate() > 1) {
      partial.add(firstEvent.slice(0, 7));
    }
  }

  if (lastEvent) {
    const last = new Date(lastEvent);
    if (!Number.isNaN(last.getTime())) {
      const lastDay = new Date(
        Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0),
      ).getUTCDate();
      if (last.getUTCDate() < lastDay) {
        partial.add(lastEvent.slice(0, 7));
      }
    }
  }

  return [...partial].sort();
}

function withoutPartialMonths<T extends { month: string }>(
  rows: T[],
  partialMonths: string[],
): T[] {
  if (partialMonths.length === 0) return rows;
  const excluded = new Set(partialMonths);
  return rows.filter(row => !excluded.has(row.month));
}

function monthlyFromDaily(rows: DatasetRow[]): MonthlyPoint[] {
  const map = new Map<string, number>();
  rows.forEach(row => {
    const month = (row.event_date || '').slice(0, 7);
    if (!month) return;
    map.set(month, (map.get(month) || 0) + asNumber(row.event_count));
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

function monthlyMaintenanceRepair(
  maintenanceRows: DatasetRow[],
  repairRows: DatasetRow[],
): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>();
  maintenanceRows.forEach(row => {
    const month = (row.event_date || '').slice(0, 7);
    if (!month) return;
    const point = map.get(month) || { month, maintenance: 0, repair: 0 };
    point.maintenance = (point.maintenance || 0) + asNumber(row.event_count);
    map.set(month, point);
  });
  repairRows.forEach(row => {
    const month = (row.event_date || '').slice(0, 7);
    if (!month) return;
    const point = map.get(month) || { month, maintenance: 0, repair: 0 };
    point.repair = (point.repair || 0) + asNumber(row.event_count);
    map.set(month, point);
  });
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

export default function BigDataPage() {
  const [report, setReport] = useState<AnalyticsResponse | null>(null);
  const [committedEvents, setCommittedEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [analytics, count] = await Promise.all([
        apiJson<AnalyticsResponse>('/analytics/bigdata'),
        apiJson<EventCountResponse>('/analytics/events/count'),
      ]);
      setReport(analytics);
      setCommittedEvents(count.events || 0);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu Big Data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const datasets = report?.datasets || {};
  const distribution = datasets.lifecycle_event_summary || [];
  const sparkTotal = distribution.reduce((sum, row) => sum + asNumber(row.event_count), 0);
  const deviceActivity = datasets.device_activity || [];
  const pipelineRow = datasets.pipeline_run_summary?.[0];
  const distinctDevices = pipelineRow
    ? asNumber(pipelineRow.distinct_devices)
    : deviceActivity.length;
  const distinctEventTypes = pipelineRow
    ? asNumber(pipelineRow.distinct_event_types)
    : distribution.length;
  const sparkVersion = pipelineRow?.spark_version || '3.5.6';
  const syncDelta = committedEvents - sparkTotal;
  const synced = committedEvents > 0 && syncDelta === 0;

  const eventDistributionData = useMemo(
    () => distribution.map(row => ({
      eventType: EVENT_LABELS[row.event_type] || row.event_type,
      count: asNumber(row.event_count),
    })),
    [distribution],
  );

  const monthlyEventsRaw = useMemo(() => {
    const explicit = datasets.event_monthly_summary || [];
    if (explicit.length > 0) {
      const map = new Map<string, number>();
      explicit.forEach(row => {
        const month = row.event_month;
        if (!month) return;
        map.set(month, (map.get(month) || 0) + asNumber(row.event_count));
      });
      return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, total }));
    }
    return monthlyFromDaily(datasets.lifecycle_daily || []);
  }, [datasets.event_monthly_summary, datasets.lifecycle_daily]);

  const maintenanceRepairTrendRaw = useMemo(
    () => monthlyMaintenanceRepair(
      datasets.maintenance_daily || [],
      datasets.repair_daily || [],
    ),
    [datasets.maintenance_daily, datasets.repair_daily],
  );

  const topActivity = (datasets.device_activity || []).slice(0, 10).map(row => ({
    device: row.device_id,
    count: asNumber(row.event_count),
  }));

  const topMaintenance = (datasets.maintenance_by_device || []).slice(0, 10).map(row => ({
    device: row.device_id,
    count: asNumber(row.maintenance_count),
  }));

  const topRepair = (datasets.repair_by_device || []).slice(0, 10).map(row => ({
    device: row.device_id,
    count: asNumber(row.repair_count),
  }));

  const monthlyCostRaw = (datasets.monthly_cost_analysis || []).map(row => ({
    month: row.event_month,
    maintenanceCost: asNumber(row.maintenance_cost),
    repairCost: asNumber(row.repair_cost),
  }));

  const partialMonths = useMemo(
    () => partialBoundaryMonths(pipelineRow?.first_event, pipelineRow?.last_event),
    [pipelineRow?.first_event, pipelineRow?.last_event],
  );
  const partialMonthsLabel = partialMonths.join(', ');
  const monthlyEvents = useMemo(
    () => withoutPartialMonths(monthlyEventsRaw, partialMonths),
    [monthlyEventsRaw, partialMonths],
  );
  const maintenanceRepairTrend = useMemo(
    () => withoutPartialMonths(maintenanceRepairTrendRaw, partialMonths),
    [maintenanceRepairTrendRaw, partialMonths],
  );
  const monthlyCost = useMemo(
    () => withoutPartialMonths(monthlyCostRaw, partialMonths),
    [monthlyCostRaw, partialMonths],
  );

  const costRows = datasets.cost_summary || [];
  const maintenanceCost = costRows.find(row => row.event_type === 'MAINTENANCE_COMPLETED');
  const repairCost = costRows.find(row => row.event_type === 'REPAIR_COMPLETED');

  const faultData = (datasets.fault_category_summary || []).map(row => ({
    category: row.fault_category || 'Không xác định',
    count: asNumber(row.repair_count),
  }));

  const maintenanceTypeData = (datasets.maintenance_type_summary || []).map(row => ({
    type: row.maintenance_type || 'Không xác định',
    count: asNumber(row.maintenance_count),
  }));

  const benchmarkRows = datasets.spark_benchmark || [];
  const benchmarkV2 = benchmarkRows.some(
    row => row.benchmark_version === '2' || Boolean(row.median_total_seconds),
  );
  const benchmarkMeta = benchmarkRows[0];
  const benchmarkData = benchmarkRows.map(row => ({
    events: asNumber(row.actual_events),
    seconds: asNumber(row.median_total_seconds || row.total_seconds),
    throughput: asNumber(
      row.median_throughput_events_per_second || row.throughput_events_per_second,
    ),
    minSeconds: asNumber(row.min_total_seconds || row.total_seconds),
    maxSeconds: asNumber(row.max_total_seconds || row.total_seconds),
    repetitions: asNumber(row.repetitions) || 1,
    warmupEvents: asNumber(row.warmup_events),
  }));

  const syntheticEvents = pipelineRow ? asNumber(pipelineRow.synthetic_events) : 0;
  const syntheticRatio = pipelineRow ? asNumber(pipelineRow.synthetic_ratio) : 0;
  const isSyntheticDemo = Boolean(
    pipelineRow?.dataset_profile === 'synthetic_demo' || syntheticRatio >= 0.9,
  );

  const analyticalDatasetCount = asNumber(
    report?.meta?.analytical_dataset_count
      ?? pipelineRow?.analytical_datasets
      ?? report?.meta?.dataset_count,
  );
  const technicalDatasetCount = asNumber(
    report?.meta?.technical_dataset_count
      ?? Math.max(0, (report?.meta?.dataset_count || 0) - analyticalDatasetCount),
  );
  const totalPublishedDatasetCount = report?.meta?.dataset_count || Object.keys(datasets).length;

  const maintenanceEventCount = asNumber(
    distribution.find(row => row.event_type === 'MAINTENANCE_COMPLETED')?.event_count,
  );
  const repairEventCount = asNumber(
    distribution.find(row => row.event_type === 'REPAIR_COMPLETED')?.event_count,
  );
  const maintenanceShare = sparkTotal > 0 ? (maintenanceEventCount / sparkTotal) * 100 : 0;
  const repairShare = sparkTotal > 0 ? (repairEventCount / sparkTotal) * 100 : 0;
  const averageMaintenanceCost = asNumber(maintenanceCost?.average_cost);
  const averageRepairCost = asNumber(repairCost?.average_cost);
  const repairCostRatio = averageMaintenanceCost > 0
    ? averageRepairCost / averageMaintenanceCost
    : 0;
  const topActivityDevice = topActivity[0];

  const managementInsights = [
    maintenanceEventCount > 0
      ? `Bảo trì chiếm ${maintenanceShare.toFixed(2)}% tổng số sự kiện (${formatInteger(maintenanceEventCount)} event).`
      : '',
    repairEventCount > 0
      ? `Sửa chữa chiếm ${repairShare.toFixed(2)}% tổng số sự kiện (${formatInteger(repairEventCount)} event).`
      : '',
    repairCostRatio > 0
      ? `Chi phí sửa chữa trung bình cao gấp ${repairCostRatio.toFixed(2)} lần chi phí bảo trì trung bình trên bộ dữ liệu hiện tại.`
      : '',
    topActivityDevice
      ? `${topActivityDevice.device} là thiết bị có nhiều sự kiện nhất trong batch với ${formatInteger(topActivityDevice.count)} event.`
      : '',
    pipelineRow
      ? `Batch Spark gần nhất xử lý ${formatInteger(sparkTotal)} event trong ${asNumber(pipelineRow.processing_seconds).toFixed(2)} giây và tạo ${formatInteger(asNumber(pipelineRow.analytical_datasets))} tập phân tích.`
      : '',
  ].filter(Boolean);

  if (loading && !report) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center text-gray-500">
          <RefreshCw className="mx-auto mb-3 animate-spin" size={30} />
          <p className="font-semibold">Đang tải kết quả phân tích Spark...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="text-blue-600" size={26} />
            <h1 className="text-2xl font-bold text-gray-900">Phân tích Big Data</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Phân tích batch trên toàn bộ nhật ký sự kiện bằng Apache Spark; tách biệt với các màn hình CRUD nghiệp vụ.
          </p>
        </div>
        <button className="btn-secondary" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang tải...' : 'Tải kết quả mới nhất'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">Chưa thể đọc kết quả Spark.</p>
              <p className="mt-1">{error}</p>
              <p className="mt-2 text-xs">
                Chạy export_events.py và export_analytics_snapshot.py, sau đó chạy spark/run_demo_pipeline.py rồi tải lại trang.
              </p>
            </div>
          </div>
        </div>
      )}

      {report && (
        <>
          {isSyntheticDemo && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 shrink-0 text-violet-600" size={18} />
                  <div>
                    <p className="font-semibold">Synthetic Demo Dataset</p>
                    <p className="mt-1 text-sm">
                      Dữ liệu hiện tại được tạo phục vụ kiểm thử và trình diễn pipeline Big Data; không đại diện cho tình hình vận hành thực tế của bệnh viện.
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
                  {formatInteger(syntheticEvents)} / {formatInteger(sparkTotal)} synthetic events
                </span>
              </div>
            </div>
          )}

          <section className="card p-5 space-y-3">
            <h2 className="font-bold text-gray-900">Analytics Insight · vận hành thiết bị</h2>
            {datasets.device_risk_score ? <>
              <p>⚠ {formatInteger(datasets.device_risk_score.filter(row=>row.risk_level==='HIGH').length)} thiết bị nguy cơ cao theo thang điểm vận hành (không thay thế đánh giá kỹ thuật).</p>
              <p>💰 Khoa có chi phí bảo trì cao nhất: {datasets.maintenance_departments?.[0]?.department_name || datasets.maintenance_departments?.[0]?.department_id || 'Chưa xác định'} ({formatCurrency(asNumber(datasets.maintenance_departments?.[0]?.maintenance_cost))})</p>
              <p>🔧 Lỗi phổ biến nhất: {datasets.failure_categories?.[0]?.fault_category || 'Chưa có dữ liệu'} · {formatInteger(asNumber(datasets.failure_categories?.[0]?.repair_count))} phiếu.</p>
              <p className="text-xs text-gray-500">Chi phí mua sắm chỉ phân bổ khi hợp đồng có danh sách thiết bị. Tổng chi phí cộng các khoản đã ghi; kiểm tra quy ước ghi chi phí sửa chữa và linh kiện để tránh tính trùng.</p>
            </> : <p className="text-sm text-gray-500">Chạy lại pipeline với bản xuất dữ liệu nghiệp vụ để xem insight.</p>}
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              icon={Activity}
              label="Spark đã xử lý"
              value={formatInteger(sparkTotal)}
              detail="Sự kiện trong batch analytics"
            />
            <KpiCard
              icon={Database}
              label="PostgreSQL hiện có"
              value={formatInteger(committedEvents)}
              detail={synced ? 'Đã đồng bộ với Spark' : `Chênh ${formatInteger(Math.abs(syncDelta))} sự kiện`}
            />
            <KpiCard
              icon={Server}
              label="Thiết bị có dữ liệu"
              value={formatInteger(distinctDevices)}
              detail="Distinct device_id trong Spark"
            />
            <KpiCard
              icon={Layers}
              label="Loại sự kiện"
              value={formatInteger(distinctEventTypes)}
              detail="Nhóm event được phân tích"
            />
            <KpiCard
              icon={Cpu}
              label="Processing engine"
              value={`Spark ${sparkVersion}`}
              detail={`${formatInteger(analyticalDatasetCount)} phân tích + ${formatInteger(technicalDatasetCount)} kỹ thuật`}
            />
          </div>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900">Big Data Processing Pipeline</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Pipeline batch giúp tách tải phân tích khỏi các giao dịch quản lý thiết bị hằng ngày.
                </p>
              </div>
              <div className={`badge ${synced ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                {synced ? 'PostgreSQL ↔ Spark đồng bộ' : 'Cần chạy lại Spark để đồng bộ'}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
              {[
                { icon: Database, title: 'PostgreSQL', text: `${formatInteger(committedEvents)} events` },
                { icon: FileText, title: 'JSONL', text: 'Batch input' },
                { icon: Cpu, title: 'Apache Spark', text: `v${sparkVersion}` },
                { icon: Layers, title: 'Analytics', text: `${formatInteger(analyticalDatasetCount)} analytical + ${formatInteger(technicalDatasetCount)} technical` },
                { icon: BarChart3, title: 'React', text: 'Management insights' },
              ].map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.title} className="contents">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                      <StepIcon className="mx-auto text-blue-600" size={24} />
                      <p className="mt-2 text-sm font-semibold text-gray-900">{step.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{step.text}</p>
                    </div>
                    {index < 4 && (
                      <div className="hidden items-center justify-center text-gray-400 lg:flex">
                        <ArrowRight size={20} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-600 sm:grid-cols-3">
              <div><span className="font-semibold">Batch cập nhật:</span> {formatDateTime(pipelineRow?.processed_at || report.meta?.generated_at)}</div>
              <div><span className="font-semibold">Khoảng dữ liệu:</span> {pipelineRow ? `${formatDateTime(pipelineRow.first_event)} → ${formatDateTime(pipelineRow.last_event)}` : 'Chạy pipeline mới để bổ sung'}</div>
              <div><span className="font-semibold">Thời gian pipeline:</span> {pipelineRow ? `${asNumber(pipelineRow.processing_seconds).toFixed(2)} giây` : 'Chưa ghi nhận'}</div>
            </div>
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span className="font-semibold">Dataset công bố:</span>{' '}
              {formatInteger(totalPublishedDatasetCount)} file = {formatInteger(analyticalDatasetCount)} tập phân tích nghiệp vụ + {formatInteger(technicalDatasetCount)} tập kỹ thuật (pipeline/benchmark).
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                <Lightbulb size={20} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Management Insights</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Các nhận định dưới đây được tính tự động từ kết quả Spark hiện tại; với dữ liệu demo, chỉ dùng để minh họa cách hỗ trợ ra quyết định.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {managementInsights.map((insight, index) => (
                <div key={insight} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-gray-700">{insight}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Phân bố 500K+ sự kiện theo loại"
              subtitle="Cho thấy khối lượng hoạt động mà Spark phải tổng hợp trên toàn hệ thống."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={eventDistributionData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="eventType" width={135} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatInteger(Number(value))} />
                  <Bar dataKey="count" name="Số sự kiện" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Xu hướng phát sinh sự kiện theo tháng"
              subtitle={partialMonths.length > 0
                ? `Đã loại tháng biên chưa đủ dữ liệu (${partialMonthsLabel}) để tránh tạo xu hướng giảm giả.`
                : 'Tổng hợp từ dữ liệu lifecycle theo thời gian, không đọc từng record trực tiếp trên trình duyệt.'}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={monthlyEvents} margin={{ left: 5, right: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatInteger(Number(value))} />
                  <Line type="monotone" dataKey="total" name="Tổng sự kiện" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Top 10 thiết bị có nhiều sự kiện nhất"
              subtitle="Thiết bị có mật độ sự kiện cao cần được ưu tiên xem lịch sử vận hành."
            >
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={topActivity} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="device" width={115} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatInteger(Number(value))} />
                  <Bar dataKey="count" name="Sự kiện" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Bảo trì và sửa chữa theo tháng"
              subtitle={partialMonths.length > 0
                ? `So sánh trên các tháng đầy đủ; đã loại tháng biên ${partialMonthsLabel}.`
                : 'So sánh hai nhóm hoạt động kỹ thuật có tần suất lớn nhất trong dữ liệu sự kiện.'}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={maintenanceRepairTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatInteger(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="maintenance" name="Bảo trì" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="repair" name="Sửa chữa" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="Top 10 thiết bị bảo trì nhiều nhất" subtitle="Xếp hạng theo maintenance_count do Spark tổng hợp.">
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={topMaintenance} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="device" width={115} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatInteger(Number(value))} />
                  <Bar dataKey="count" name="Lần bảo trì" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 thiết bị sửa chữa nhiều nhất" subtitle="Xếp hạng theo repair_count do Spark tổng hợp.">
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={topRepair} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="device" width={115} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatInteger(Number(value))} />
                  <Bar dataKey="count" name="Lần sửa chữa" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {costRows.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Phân tích chi phí & nguyên nhân kỹ thuật</h2>
                <p className="text-sm text-gray-500">Các chỉ số này được Spark trích trực tiếp từ metadata.cost, fault_category và maintenance_type.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={Wrench} label="Tổng chi phí bảo trì" value={formatCurrency(asNumber(maintenanceCost?.total_cost))} detail="Tổng hợp từ MAINTENANCE_COMPLETED" />
                <KpiCard icon={Settings} label="Tổng chi phí sửa chữa" value={formatCurrency(asNumber(repairCost?.total_cost))} detail="Tổng hợp từ REPAIR_COMPLETED" />
                <KpiCard icon={Banknote} label="TB một lần bảo trì" value={formatCurrency(asNumber(maintenanceCost?.average_cost))} detail="Average cost do Spark tính" />
                <KpiCard icon={Banknote} label="TB một lần sửa chữa" value={formatCurrency(asNumber(repairCost?.average_cost))} detail="Average cost do Spark tính" />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Chi phí bảo trì và sửa chữa theo tháng"
                  subtitle={partialMonths.length > 0
                    ? `Đơn vị VNĐ; chỉ hiển thị tháng đầy đủ, loại ${partialMonthsLabel}.`
                    : 'Đơn vị VNĐ; dữ liệu tổng hợp từ metadata của event.'}
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={monthlyCost}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000_000)}B`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="maintenanceCost" name="Bảo trì" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="repairCost" name="Sửa chữa" stroke="#dc2626" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Phân bố nhóm lỗi sửa chữa" subtitle="Dựa trên metadata.fault_category của REPAIR_COMPLETED.">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={faultData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatInteger(Number(value))} />
                      <Bar dataKey="count" name="Số lần sửa chữa" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title="Cơ cấu loại bảo trì" subtitle="Dựa trên metadata.maintenance_type của MAINTENANCE_COMPLETED.">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={maintenanceTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatInteger(Number(value))} />
                    <Bar dataKey="count" name="Số lần bảo trì" fill="#ea580c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">Có thể mở rộng thêm Cost & Fault Analytics.</p>
              <p className="mt-1">
                Source Spark mới đã hỗ trợ chi phí, loại lỗi và loại bảo trì. Chạy lại run_demo_pipeline.py để sinh các dataset mở rộng.
              </p>
            </div>
          )}

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="text-blue-600" size={20} />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Spark Performance Benchmark</h2>
                <p className="text-sm text-gray-500">
                  Benchmark dùng để đánh giá xu hướng mở rộng của workload analytics; tách riêng với thời gian chạy pipeline end-to-end.
                </p>
              </div>
            </div>

            {benchmarkData.length > 0 ? (
              <>
                <div className={`rounded-xl border p-4 ${benchmarkV2 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                  {benchmarkV2 ? (
                    <div className="text-sm text-emerald-900">
                      <p className="font-semibold">Phương pháp benchmark v2</p>
                      <p className="mt-1 leading-6">
                        Warm-up {formatInteger(asNumber(benchmarkMeta?.warmup_events))} event không tính kết quả; mỗi quy mô chạy {formatInteger(asNumber(benchmarkMeta?.repetitions) || 3)} lần và báo cáo median.
                        Spark/JVM startup và bước parse JSONL ban đầu được loại khỏi phép đo; thời gian end-to-end thực tế vẫn được thể hiện riêng ở Pipeline phía trên.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-900">
                      <p className="font-semibold">Đang hiển thị benchmark legacy một lần chạy.</p>
                      <p className="mt-1">
                        Chạy lại <code className="rounded bg-white/70 px-1.5 py-0.5">.\CAP_NHAT_BIGDATA.ps1 -Benchmark</code> sau khi áp dụng patch v2 để có warm-up + 3 repetitions + median.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <ChartCard
                    title={benchmarkV2 ? 'Median processing time theo quy mô dữ liệu' : 'Thời gian xử lý theo quy mô dữ liệu'}
                    subtitle={benchmarkV2 ? 'Median của các lần chạy sau warm-up; workload gồm distribution, daily trend, top devices và cost aggregation.' : 'Benchmark legacy một lần chạy.'}
                  >
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={benchmarkData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="events" tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`} />
                        <YAxis tick={{ fontSize: 11 }} unit="s" />
                        <Tooltip formatter={(value) => `${Number(value).toFixed(2)} giây`} labelFormatter={(value) => `${formatInteger(Number(value))} events`} />
                        <Line type="monotone" dataKey="seconds" name={benchmarkV2 ? 'Median thời gian' : 'Tổng thời gian'} stroke="#2563eb" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Throughput xử lý"
                    subtitle={benchmarkV2 ? 'Throughput tính từ số event / median processing time.' : 'Throughput của benchmark legacy.'}
                  >
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={benchmarkData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="events" tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => `${formatInteger(Number(value))} events/s`} />
                        <Bar dataKey="throughput" name="Events/giây" fill="#059669" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                {benchmarkV2 && (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 px-4 py-3">
                      <h3 className="text-sm font-semibold text-gray-900">Chi tiết benchmark</h3>
                      <p className="mt-1 text-xs text-gray-500">Median và khoảng min–max giúp tránh diễn giải sai do một lần chạy bất thường.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-4 py-3">Quy mô</th>
                            <th className="px-4 py-3">Số lần chạy</th>
                            <th className="px-4 py-3">Median</th>
                            <th className="px-4 py-3">Min–Max</th>
                            <th className="px-4 py-3">Throughput</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {benchmarkData.map(row => (
                            <tr key={row.events}>
                              <td className="px-4 py-3 font-semibold text-gray-900">{formatInteger(row.events)} events</td>
                              <td className="px-4 py-3 text-gray-600">{formatInteger(row.repetitions)}</td>
                              <td className="px-4 py-3 text-gray-600">{row.seconds.toFixed(2)} s</td>
                              <td className="px-4 py-3 text-gray-600">{row.minSeconds.toFixed(2)}–{row.maxSeconds.toFixed(2)} s</td>
                              <td className="px-4 py-3 text-gray-600">{formatInteger(row.throughput)} events/s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5">
                <p className="font-semibold text-gray-800">Chưa chạy benchmark trên máy hiện tại.</p>
                <p className="mt-1 text-sm text-gray-500">
                  Chạy <code className="rounded bg-gray-100 px-1.5 py-0.5">.\CAP_NHAT_BIGDATA.ps1 -Benchmark</code>. Kết quả sẽ xuất thành spark_benchmark.csv và tự xuất hiện ở đây.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
