import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/auth';
import type { UserRole } from '@/types/auth';

interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

interface RegisterOptionsResponse {
  departments: DepartmentOption[];
}

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string;
  username?: string | null;
  role_code: UserRole;
  role_name: string;
  department_id?: string | null;
  department_name?: string | null;
  is_active: boolean;
  auth_is_active: boolean;
  created_at?: string | null;
}

const APPROVABLE_ROLES: UserRole[] = [
  'clinical_user',
  'biomedical_engineer',
  'procurement_officer',
  'asset_manager',
  'admin',
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { role: UserRole; departmentId: string }>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [userRows, options] = await Promise.all([
        apiJson<AdminUser[]>('/admin/users'),
        apiJson<RegisterOptionsResponse>('/auth/register-options', {}, false),
      ]);
      setUsers(userRows);
      setDepartments(options.departments || []);
      setDrafts(Object.fromEntries(userRows.map(user => [user.user_id, {
        role: user.role_code === 'pending' ? 'clinical_user' : user.role_code,
        departmentId: user.department_id || '',
      }])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visibleUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter(user => {
      if (filter === 'pending' && user.role_code !== 'pending') return false;
      if (!keyword) return true;
      return `${user.full_name} ${user.email} ${user.department_name || ''}`.toLowerCase().includes(keyword);
    });
  }, [users, filter, search]);

  const pendingCount = users.filter(user => user.role_code === 'pending').length;
  const activeCount = users.filter(user => user.is_active && user.auth_is_active && user.role_code !== 'pending').length;

  const updateUser = async (user: AdminUser, activate = true) => {
    const draft = drafts[user.user_id] || { role: 'clinical_user' as UserRole, departmentId: '' };
    setSavingId(user.user_id);
    setError('');
    setNotice('');
    try {
      await apiJson(`/admin/users/${user.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role_code: activate ? draft.role : undefined,
          department_id: draft.departmentId || undefined,
          is_active: activate,
        }),
      });
      setNotice(activate ? `Đã cập nhật quyền cho ${user.full_name}.` : `Đã khóa tài khoản ${user.full_name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật người dùng.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-700">
            <Users size={22} />
            <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Phê duyệt tài khoản mới, gán vai trò và khoa/phòng cho người dùng hệ thống.</p>
        </div>
        <button className="btn-secondary inline-flex items-center gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Tổng tài khoản</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-600">Chờ phê duyệt</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-600">Đang hoạt động</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${filter === 'pending' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setFilter('pending')}>
              Chờ duyệt ({pendingCount})
            </button>
            <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${filter === 'all' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setFilter('all')}>
              Tất cả
            </button>
          </div>
          <div className="relative md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Tìm theo tên, email, khoa/phòng..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {notice && <div className="m-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{notice}</div>}
        {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="p-10 text-center text-slate-500">Đang tải danh sách người dùng...</div>
        ) : visibleUsers.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Không có tài khoản phù hợp.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleUsers.map(user => {
              const draft = drafts[user.user_id] || { role: 'clinical_user' as UserRole, departmentId: '' };
              const isPending = user.role_code === 'pending';
              const isActive = user.is_active && user.auth_is_active;
              return (
                <div key={user.user_id} className="grid gap-4 p-5 xl:grid-cols-[1.5fr_1fr_1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{user.full_name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isPending ? 'bg-amber-100 text-amber-700' : isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {isPending ? 'Chờ duyệt' : isActive ? 'Đang hoạt động' : 'Đã khóa'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">Hiện tại: {ROLE_LABELS[user.role_code] || user.role_name} · {user.department_name || 'Chưa có khoa/phòng'}</p>
                  </div>

                  <div>
                    <label className="label">Vai trò</label>
                    <select className="input" value={draft.role} onChange={e => setDrafts(prev => ({ ...prev, [user.user_id]: { ...draft, role: e.target.value as UserRole } }))}>
                      {APPROVABLE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label">Khoa/Phòng</label>
                    <select className="input" value={draft.departmentId} onChange={e => setDrafts(prev => ({ ...prev, [user.user_id]: { ...draft, departmentId: e.target.value } }))}>
                      <option value="">Chưa gán</option>
                      {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button className="btn-primary inline-flex items-center gap-2" disabled={savingId === user.user_id} onClick={() => void updateUser(user, true)}>
                      {isPending ? <UserCheck size={16} /> : <ShieldCheck size={16} />}
                      {savingId === user.user_id ? 'Đang lưu...' : isPending ? 'Phê duyệt' : 'Cập nhật'}
                    </button>
                    {!isPending && isActive && (
                      <button className="btn-secondary inline-flex items-center gap-2 text-red-600" disabled={savingId === user.user_id} onClick={() => void updateUser(user, false)}>
                        <UserX size={16} /> Khóa
                      </button>
                    )}
                    {!isPending && !isActive && (
                      <button className="btn-secondary inline-flex items-center gap-2 text-emerald-700" disabled={savingId === user.user_id} onClick={() => void updateUser(user, true)}>
                        <UserCheck size={16} /> Mở khóa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
