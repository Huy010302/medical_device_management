import KPICards from './KPICards';
import Charts from './Charts';
import RecentActivity from './RecentActivity';
import BigDataPanel from './BigDataPanel';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Tổng quan hệ thống quản lý thiết bị y tế</p>
      </div>
      <KPICards />
      <Charts />
      <RecentActivity />
      <BigDataPanel />
    </div>
  );
}
