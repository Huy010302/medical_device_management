import { useEffect, useState } from 'react';
import { AuthProvider, getDefaultPageForRole, useAuth } from '@/lib/auth';
import { StoreProvider } from '@/lib/store';
import AuthPage from '@/components/auth/AuthPage';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Dashboard from '@/components/dashboard/Dashboard';
import DeviceList from '@/components/devices/DeviceList';
import TenderingPage from '@/components/pages/TenderingPage';
import PurchasingPage from '@/components/pages/PurchasingPage';
import MaintenancePage from '@/components/pages/MaintenancePage';
import RepairsPage from '@/components/pages/RepairsPage';
import DisposalPage from '@/components/pages/DisposalPage';
import QRCodePage from '@/components/pages/QRCodePage';
import QRDeviceScanPage from '@/components/pages/QRDeviceScanPage';
import ReportsPage from '@/components/pages/ReportsPage';
import BigDataPage from '@/components/pages/BigDataPage';
import UserManagementPage from '@/components/pages/UserManagementPage';
import DepartmentManagementPage from '@/components/pages/DepartmentManagementPage';
import DeviceCategoryManagementPage from '@/components/pages/DeviceCategoryManagementPage';
import DeviceStatusManagementPage from '@/components/pages/DeviceStatusManagementPage';
import TransferPage from '@/components/pages/TransferPage';
import ReceivingPage from '@/components/pages/ReceivingPage';
import AdministrationPage from '@/components/pages/AdministrationPage';
import AssetAnalyticsPage from '@/components/pages/AssetAnalyticsPage';
import type { Page } from '@/types/auth';

function PendingApproval() {
  const { currentUser, logout, refreshSession } = useAuth();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Tài khoản đang chờ phê duyệt</h1>
        <p className="mt-3 text-sm text-slate-600 leading-6">
          Tài khoản của bạn đã được tạo nhưng chưa được admin cấp quyền.
          Vui lòng liên hệ quản trị hệ thống hoặc phòng Vật tư thiết bị y tế.
        </p>
        {currentUser?.department && <p className="mt-2 text-xs text-slate-500">Khoa/Phòng đăng ký: {currentUser.department}</p>}
        {statusMessage && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</div>}
        <div className="mt-5 flex justify-center gap-3">
          <button className="btn-primary" disabled={checking} onClick={async () => {
            setChecking(true);
            const result = await refreshSession();
            setStatusMessage(result.message);
            setChecking(false);
          }}>{checking ? 'Đang kiểm tra...' : 'Kiểm tra lại quyền'}</button>
          <button className="btn-secondary" onClick={() => void logout()}>Đăng xuất</button>
        </div>
      </div>
    </div>
  );
}

function getQrTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'qr' || !parts[1]) return '';
  return decodeURIComponent(parts[1]);
}

function AppContent() {
  const { currentUser, hasPageAccess, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  useEffect(() => {
    const onError = (event: Event) => setApiError((event as CustomEvent<string>).detail);
    window.addEventListener('mdlm:api-error', onError);
    return () => window.removeEventListener('mdlm:api-error', onError);
  }, []);

  useEffect(() => {
    if (currentUser && !hasPageAccess(currentPage)) {
      setCurrentPage(getDefaultPageForRole(currentUser.role));
    }
  }, [currentPage, currentUser, hasPageAccess]);

  const qrToken = getQrTokenFromPath();
  if (qrToken) return <QRDeviceScanPage qrToken={qrToken} />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="font-semibold">Đang kết nối hệ thống...</p>
          <p className="text-sm text-slate-300 mt-1">Đang kiểm tra phiên đăng nhập với FastAPI.</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <AuthPage />;
  if (currentUser.role === 'pending') return <PendingApproval />;

  const renderPage = () => {
    if (!hasPageAccess(currentPage)) return <Dashboard />;
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'devices': return <DeviceList />;
      case 'tendering': return <TenderingPage />;
      case 'purchasing': return <PurchasingPage />;
      case 'maintenance': return <MaintenancePage />;
      case 'repairs': return <RepairsPage />;
      case 'disposal': return <DisposalPage />;
      case 'qrcode': return <QRCodePage />;
      case 'reports': return <ReportsPage />;
      case 'bigdata': return <BigDataPage />;
      case 'transfer': return <TransferPage />;
      case 'receiving': return <ReceivingPage />;
      case 'administration': return <AdministrationPage />;
      case 'risk': return <AssetAnalyticsPage mode="risk" />;
      case 'cost': return <AssetAnalyticsPage mode="cost" />;
      case 'failure': return <AssetAnalyticsPage mode="failure" />;
      case 'users': return <UserManagementPage />;
      case 'departments': return <DepartmentManagementPage />;
      case 'categories': return <DeviceCategoryManagementPage />;
      case 'statuses': return <DeviceStatusManagementPage />;
      default: return <Dashboard />;
    }
  };

  const handleNavigate = (page: Page) => {
    if (!hasPageAccess(page)) return;
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
        onCloseMobile={() => setSidebarOpen(false)}
      />
      {sidebarOpen && <button aria-label="Đóng menu" className="fixed inset-0 bg-slate-900/45 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">
          {apiError && <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{apiError}<button className="ml-4 underline" onClick={() => setApiError('')}>Đóng</button></div>}
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </AuthProvider>
  );
}
