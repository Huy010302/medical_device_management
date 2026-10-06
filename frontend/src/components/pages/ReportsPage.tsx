import { useState } from 'react';
import { Download, Printer, BarChart3, Building2, Calendar, Shield, Trash2, DollarSign } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/deviceUtils';
import { exportToExcel } from '@/lib/exportUtils';

type ReportType = 'department' | 'maintenance_cost' | 'due_maintenance' | 'warranty_expiring' | 'disposal';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('department');
  const { devices, maintenanceRecords, repairRecords, receptionRecords, disposalRecords } = useStore();

  const reports: { id: ReportType; label: string; icon: typeof BarChart3; desc: string }[] = [
    { id: 'department', label: 'TB theo Khoa/Phòng', icon: Building2, desc: 'Tổng hợp thiết bị theo khoa/phòng' },
    { id: 'maintenance_cost', label: 'Chi phí BT & SC', icon: DollarSign, desc: 'Chi phí bảo trì, sửa chữa theo năm' },
    { id: 'due_maintenance', label: 'Đến hạn bảo trì', icon: Calendar, desc: 'Thiết bị cần bảo trì sắp tới' },
    { id: 'warranty_expiring', label: 'Hết bảo hành', icon: Shield, desc: 'Thiết bị bảo hành sắp hết' },
    { id: 'disposal', label: 'Thanh lý', icon: Trash2, desc: 'Báo cáo thiết bị đã thanh lý' },
  ];

  // Department report data
  const deptData = Object.entries(
    devices.reduce<Record<string, { total: number; operating: number; repairing: number; disposed: number }>>((acc, d) => {
      const loc = d.current_location || 'Chưa phân bổ';
      if (!acc[loc]) acc[loc] = { total: 0, operating: 0, repairing: 0, disposed: 0 };
      acc[loc].total++;
      if (d.current_status === 'operating') acc[loc].operating++;
      if (d.current_status === 'repairing') acc[loc].repairing++;
      if (d.current_status === 'disposed') acc[loc].disposed++;
      return acc;
    }, {})
  );

  // Maintenance cost data
  const costData = devices.map(d => {
    const mCost = maintenanceRecords.filter(m => m.device_id === d.id).reduce((s, m) => s + (m.cost || 0), 0);
    const rCost = repairRecords.filter(r => r.device_id === d.id).reduce((s, r) => s + (r.total_cost || 0), 0);
    return { device: d, maintenanceCost: mCost, repairCost: rCost, total: mCost + rCost };
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

  // Due maintenance
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dueMaintenances = maintenanceRecords.filter(m => {
    if (!m.next_maintenance_date) return false;
    const d = new Date(m.next_maintenance_date);
    return d <= in30Days;
  });

  // Warranty expiring
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const warrantyExpiring = receptionRecords.filter(r => {
    if (!r.warranty_end) return false;
    const end = new Date(r.warranty_end);
    return end > now && end <= in60Days;
  });

  const handleExport = () => {
    if (activeReport === 'department') {
      exportToExcel(
        deptData.map(([dept, data]) => ({
          'Khoa/Phòng': dept,
          'Tổng TB': data.total,
          'Đang vận hành': data.operating,
          'Đang sửa chữa': data.repairing,
          'Đã thanh lý': data.disposed,
        })),
        'BaoCao_ThietBi_TheoKhoa'
      );
    } else if (activeReport === 'maintenance_cost') {
      exportToExcel(
        costData.map(x => ({
          'Mã TB': x.device.device_code,
          'Tên TB': x.device.name,
          'Chi phí BT': x.maintenanceCost,
          'Chi phí SC': x.repairCost,
          'Tổng chi phí': x.total,
        })),
        'BaoCao_ChiPhi_BaoTri_SuaChua'
      );
    } else if (activeReport === 'due_maintenance') {
      exportToExcel(
        dueMaintenances.map(m => {
          const d = devices.find(x => x.id === m.device_id);
          return {
            'Mã TB': d?.device_code || '',
            'Tên TB': d?.name || '',
            'Ngày BT tiếp': m.next_maintenance_date,
            'Loại BT': m.maintenance_type,
            'Công ty DV': m.service_company,
          };
        }),
        'BaoCao_BaoTri_DenHan'
      );
    } else if (activeReport === 'warranty_expiring') {
      exportToExcel(
        warrantyExpiring.map(r => {
          const d = devices.find(x => x.id === r.device_id);
          return {
            'Mã TB': d?.device_code || '',
            'Tên TB': d?.name || '',
            'Serial': r.serial_number,
            'BH từ': r.warranty_start,
            'BH đến': r.warranty_end,
          };
        }),
        'BaoCao_BaoHanh_SapHet'
      );
    } else if (activeReport === 'disposal') {
      exportToExcel(
        disposalRecords.map(dr => {
          const d = devices.find(x => x.id === dr.device_id);
          return {
            'Mã TB': d?.device_code || '',
            'Tên TB': d?.name || '',
            'Ngày TL': dr.disposal_date,
            'Lý do': dr.reason,
            'Phương thức': dr.disposal_method,
            'Giá trị sổ sách': dr.book_value,
            'Giá trị thu hồi': dr.disposal_value,
            'Số QĐ': dr.decision_number,
          };
        }),
        'BaoCao_ThanhLy'
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
          <p className="text-sm text-gray-500 mt-1">Xuất báo cáo và thống kê thiết bị</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-success">
            <Download size={16} /> Xuất Excel
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={16} /> In
          </button>
        </div>
      </div>

      {/* Report tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {reports.map(r => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`card p-4 text-left transition-all cursor-pointer ${activeReport === r.id ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <Icon size={20} className={activeReport === r.id ? 'text-primary-600' : 'text-gray-400'} />
              <p className="text-sm font-medium mt-2">{r.label}</p>
              <p className="text-xs text-gray-400 mt-1">{r.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Report content */}
      <div className="card">
        {activeReport === 'department' && (
          <>
            <div className="card-header"><h3 className="text-sm font-semibold">Thiết bị theo Khoa/Phòng</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Khoa/Phòng</th>
                    <th className="text-center">Tổng TB</th>
                    <th className="text-center">Đang vận hành</th>
                    <th className="text-center">Đang sửa chữa</th>
                    <th className="text-center">Đã thanh lý</th>
                  </tr>
                </thead>
                <tbody>
                  {deptData.map(([dept, data]) => (
                    <tr key={dept}>
                      <td className="font-medium">{dept}</td>
                      <td className="text-center font-bold">{data.total}</td>
                      <td className="text-center text-green-600">{data.operating}</td>
                      <td className="text-center text-red-600">{data.repairing}</td>
                      <td className="text-center text-gray-500">{data.disposed}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td>TỔNG CỘNG</td>
                    <td className="text-center">{deptData.reduce((s, [, d]) => s + d.total, 0)}</td>
                    <td className="text-center text-green-600">{deptData.reduce((s, [, d]) => s + d.operating, 0)}</td>
                    <td className="text-center text-red-600">{deptData.reduce((s, [, d]) => s + d.repairing, 0)}</td>
                    <td className="text-center text-gray-500">{deptData.reduce((s, [, d]) => s + d.disposed, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'maintenance_cost' && (
          <>
            <div className="card-header"><h3 className="text-sm font-semibold">Chi phí Bảo trì & Sửa chữa</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã TB</th>
                    <th>Tên thiết bị</th>
                    <th className="text-right">Chi phí bảo trì</th>
                    <th className="text-right">Chi phí sửa chữa</th>
                    <th className="text-right">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {costData.map(x => (
                    <tr key={x.device.id}>
                      <td className="font-mono text-xs">{x.device.device_code}</td>
                      <td className="font-medium">{x.device.name}</td>
                      <td className="text-right text-orange-600">{formatCurrency(x.maintenanceCost)}</td>
                      <td className="text-right text-red-600">{formatCurrency(x.repairCost)}</td>
                      <td className="text-right font-bold">{formatCurrency(x.total)}</td>
                    </tr>
                  ))}
                  {costData.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Chưa có dữ liệu chi phí</td></tr>
                  )}
                  {costData.length > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={2}>TỔNG CỘNG</td>
                      <td className="text-right text-orange-600">{formatCurrency(costData.reduce((s, x) => s + x.maintenanceCost, 0))}</td>
                      <td className="text-right text-red-600">{formatCurrency(costData.reduce((s, x) => s + x.repairCost, 0))}</td>
                      <td className="text-right">{formatCurrency(costData.reduce((s, x) => s + x.total, 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'due_maintenance' && (
          <>
            <div className="card-header"><h3 className="text-sm font-semibold">Thiết bị đến hạn bảo trì (30 ngày tới)</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã TB</th>
                    <th>Tên thiết bị</th>
                    <th>Loại BT</th>
                    <th>Ngày BT tiếp theo</th>
                    <th>Công ty DV</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {dueMaintenances.map(m => {
                    const d = devices.find(x => x.id === m.device_id);
                    const isOverdue = new Date(m.next_maintenance_date) < now;
                    return (
                      <tr key={m.id}>
                        <td className="font-mono text-xs">{d?.device_code}</td>
                        <td className="font-medium">{d?.name}</td>
                        <td>{m.maintenance_type === 'preventive' ? 'Định kỳ' : m.maintenance_type === 'calibration' ? 'Hiệu chuẩn' : 'Sửa chữa'}</td>
                        <td className={isOverdue ? 'text-red-600 font-semibold' : ''}>{m.next_maintenance_date}</td>
                        <td className="text-gray-600">{m.service_company}</td>
                        <td>
                          <span className={`badge ${isOverdue ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                            {isOverdue ? 'Quá hạn' : 'Sắp đến'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {dueMaintenances.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">Không có thiết bị nào đến hạn bảo trì</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'warranty_expiring' && (
          <>
            <div className="card-header"><h3 className="text-sm font-semibold">Thiết bị bảo hành sắp hết (60 ngày)</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã TB</th>
                    <th>Tên thiết bị</th>
                    <th>Serial</th>
                    <th>Vị trí</th>
                    <th>BH từ</th>
                    <th>BH đến</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {warrantyExpiring.map(r => {
                    const d = devices.find(x => x.id === r.device_id);
                    return (
                      <tr key={r.id}>
                        <td className="font-mono text-xs">{d?.device_code}</td>
                        <td className="font-medium">{d?.name}</td>
                        <td className="text-gray-600">{r.serial_number}</td>
                        <td className="text-gray-600">{d?.current_location}</td>
                        <td className="text-gray-500 text-xs">{r.warranty_start}</td>
                        <td className="text-red-600 font-semibold text-xs">{r.warranty_end}</td>
                        <td><span className="badge bg-amber-100 text-amber-700 border-amber-200">Sắp hết BH</span></td>
                      </tr>
                    );
                  })}
                  {warrantyExpiring.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Không có thiết bị nào sắp hết bảo hành</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeReport === 'disposal' && (
          <>
            <div className="card-header"><h3 className="text-sm font-semibold">Báo cáo Thanh lý</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th>Ngày TL</th>
                    <th>Lý do</th>
                    <th>Phương thức</th>
                    <th className="text-right">GT sổ sách</th>
                    <th className="text-right">GT thu hồi</th>
                    <th className="text-right">Chênh lệch</th>
                    <th>Số QĐ</th>
                  </tr>
                </thead>
                <tbody>
                  {disposalRecords.map(dr => {
                    const d = devices.find(x => x.id === dr.device_id);
                    const diff = dr.disposal_value - dr.book_value;
                    return (
                      <tr key={dr.id}>
                        <td className="font-medium">{d?.name || 'N/A'}</td>
                        <td className="text-gray-500 text-xs">{dr.disposal_date}</td>
                        <td className="max-w-[200px] truncate">{dr.reason}</td>
                        <td>{dr.disposal_method}</td>
                        <td className="text-right">{formatCurrency(dr.book_value)}</td>
                        <td className="text-right text-emerald-600">{formatCurrency(dr.disposal_value)}</td>
                        <td className={`text-right font-medium ${diff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(diff)}</td>
                        <td className="font-mono text-xs">{dr.decision_number}</td>
                      </tr>
                    );
                  })}
                  {disposalRecords.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Chưa có thiết bị nào được thanh lý</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
