import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useEffect,useState } from 'react';
import { apiJson } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { DeviceStatus } from '@/types/lifecycle';

const STATUS_PIE_COLORS: Record<string, string> = {
  tendering: '#eab308',
  approved: '#3b82f6',
  purchased: '#6366f1',
  received: '#8b5cf6',
  operating: '#10b981',
  maintenance: '#f97316',
  repairing: '#ef4444',
  disposed: '#6b7280',
};

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6b7280'];

export default function Charts() {
  const { repairRecords, maintenanceRecords, getDeviceStatusLabel } = useStore();

  const [summary,setSummary]=useState<{status_summary:Record<string,number>}|null>(null);
  const [categories,setCategories]=useState<Record<string,number>>({});
  useEffect(()=>{let active=true;const load=()=>{
    void apiJson<{status_summary:Record<string,number>}>('/analytics/summary').then(data=>{if(active)setSummary(data)}).catch(()=>{});
    void apiJson<Record<string,number>>('/analytics/category-summary').then(data=>{if(active)setCategories(data)}).catch(()=>{});
  };load();window.addEventListener('mdlm:record-saved',load);return()=>{active=false;window.removeEventListener('mdlm:record-saved',load)}},[]);
  const statusData=Object.entries(summary?.status_summary||{}).filter(([,count])=>count>0).map(([status,count])=>({name:status==='other'?'Khác':getDeviceStatusLabel(status as DeviceStatus),value:count,color:STATUS_PIE_COLORS[status]||'#6b7280'}));
  const categoryData=Object.entries(categories).map(([name,value])=>({name,value}));

  // Monthly repair costs
  const repairCostByMonth: Record<string, number> = {};
  const maintenanceCostByMonth: Record<string, number> = {};
  
  repairRecords.forEach(r => {
    const month = r.report_date?.substring(0, 7) || r.created_at.substring(0, 7);
    repairCostByMonth[month] = (repairCostByMonth[month] || 0) + (r.total_cost || 0);
  });
  
  maintenanceRecords.forEach(m => {
    const month = (m.actual_date || m.scheduled_date || m.created_at).substring(0, 7);
    maintenanceCostByMonth[month] = (maintenanceCostByMonth[month] || 0) + (m.cost || 0);
  });

  const allMonths = [...new Set([...Object.keys(repairCostByMonth), ...Object.keys(maintenanceCostByMonth)])].sort();
  const costData = allMonths.map(m => ({
    month: m,
    'Sửa chữa': (repairCostByMonth[m] || 0) / 1000000,
    'Bảo trì': (maintenanceCostByMonth[m] || 0) / 1000000,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Pie */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-gray-800">Phân bố theo trạng thái</h3>
        </div>
        <div className="card-body flex items-center justify-center">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Pie */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-gray-800">Phân bố theo loại thiết bị</h3>
        </div>
        <div className="card-body flex items-center justify-center">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Bar Chart */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-gray-800">Chi phí theo tháng của các phiếu đã tải (triệu VNĐ)</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={costData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)} triệu`} />
              <Legend />
              <Bar dataKey="Sửa chữa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Bảo trì" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
