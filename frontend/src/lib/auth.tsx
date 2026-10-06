import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiJson, getToken, setToken, clearToken } from '@/lib/api';
import type { AuthUser, Page, Permission, UserRole } from '@/types/auth';

export const ROLE_LABELS: Record<UserRole, string> = {
  pending: 'Chờ duyệt',
  clinical_user: 'Người dùng lâm sàng',
  biomedical_engineer: 'Kỹ sư thiết bị y tế',
  procurement_officer: 'Nhân viên mua sắm/vật tư',
  asset_manager: 'Quản lý tài sản TTBYT',
  admin: 'Quản trị hệ thống',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  pending: 'Tài khoản mới đăng ký, đang chờ admin cấp quyền.',
  clinical_user: 'Xem thiết bị thuộc khoa/phòng của mình và tạo phiếu báo hỏng.',
  biomedical_engineer: 'Xem và xử lý thiết bị được giao phụ trách.',
  procurement_officer: 'Xem thiết bị toàn viện, quản lý mua sắm và nhà cung cấp.',
  asset_manager: 'Quản lý thiết bị và tài sản toàn viện.',
  admin: 'Toàn quyền hệ thống, quản lý người dùng và phân quyền.',
};

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  pending: [],
  clinical_user: ['workflow:create', 'report:view', 'qr:print'],
  biomedical_engineer: ['device:update', 'workflow:create', 'workflow:update', 'qr:print', 'report:view'],
  procurement_officer: ['device:create', 'device:update', 'workflow:create', 'workflow:update', 'report:view', 'qr:print'],
  asset_manager: ['device:create', 'device:update', 'workflow:create', 'workflow:update', 'report:view', 'qr:print'],
  admin: ['device:create', 'device:update', 'device:delete', 'workflow:create', 'workflow:update', 'report:view', 'qr:print', 'user:manage'],
};

const ROLE_PAGES: Record<UserRole, Page[]> = {
  pending: [],
  clinical_user: ['dashboard', 'devices', 'repairs', 'qrcode'],
  biomedical_engineer: ['dashboard', 'devices', 'maintenance', 'repairs', 'qrcode', 'reports', 'bigdata', 'risk', 'cost', 'failure'],
  procurement_officer: ['dashboard', 'devices', 'purchasing', 'tendering', 'receiving', 'qrcode', 'reports', 'bigdata', 'risk', 'cost', 'failure'],
  asset_manager: ['dashboard', 'devices', 'maintenance', 'repairs', 'disposal', 'transfer', 'qrcode', 'reports', 'bigdata', 'risk', 'cost', 'failure'],
  admin: ['dashboard', 'devices', 'tendering', 'purchasing', 'maintenance', 'repairs', 'disposal', 'transfer', 'qrcode', 'reports', 'bigdata', 'risk', 'cost', 'failure', 'transfer', 'receiving', 'users', 'departments', 'categories', 'statuses', 'administration'],
};

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  departmentId?: string | null;
}

export interface AuthActionResult {
  ok: boolean;
  message: string;
}

interface AuthState {
  currentUser: AuthUser | null;
  users: AuthUser[];
  allowedPages: Page[];
  loading: boolean;
  isRemoteAuth: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  signup: (input: SignupInput) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthActionResult>;
  can: (permission: Permission) => boolean;
  hasPageAccess: (page: Page) => boolean;
}

interface ApiMe {
  user_id: string;
  email: string;
  full_name: string;
  role_code: string;
  is_active: boolean;
  department_id?: string | null;
  department_name?: string | null;
}
interface ApiToken { access_token: string }
interface ApiRegister { message?: string }

const AuthContext = createContext<AuthState | null>(null);

function toUser(me: ApiMe): AuthUser {
  return {
    id: me.user_id,
    email: me.email,
    name: me.full_name,
    role: me.is_active && me.role_code in ROLE_PAGES ? me.role_code as UserRole : 'pending',
    department: me.department_name || 'Chưa cập nhật',
    departmentId: me.department_id || null,
    createdAt: new Date().toISOString(),
  };
}

function cleanApiMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^API\s+\d+:\s*/i, '') || fallback;
}

export function getDefaultPageForRole(role: UserRole): Page { return ROLE_PAGES[role]?.[0] || 'dashboard'; }
export function getPagesForRole(role: UserRole): Page[] { return ROLE_PAGES[role] || []; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    const me = await apiJson<ApiMe>('/auth/me');
    const user = toUser(me);
    setCurrentUser(user);
    return user;
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      if (!getToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const me = await apiJson<ApiMe>('/auth/me');
        if (active) setCurrentUser(toUser(me));
      } catch (error) {
        console.error('API session restore failed:', error);
        clearToken();
      } finally {
        if (active) setLoading(false);
      }
    };
    void restore();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    try {
      const token = await apiJson<ApiToken>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      }, false);
      setToken(token.access_token);
      await loadCurrentUser();
      return { ok: true, message: 'Đăng nhập thành công.' };
    } catch (error) {
      clearToken();
      setCurrentUser(null);
      return { ok: false, message: cleanApiMessage(error, 'Không thể đăng nhập.') };
    }
  }, [loadCurrentUser]);

  const signup = useCallback(async (input: SignupInput): Promise<AuthActionResult> => {
    try {
      const result = await apiJson<ApiRegister>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: input.email.trim().toLowerCase(),
          password: input.password,
          full_name: input.name.trim(),
          username: input.email.trim().toLowerCase(),
          department_id: input.departmentId || null,
        }),
      }, false);
      return {
        ok: true,
        message: result.message || 'Đăng ký thành công. Tài khoản đang chờ quản trị viên phê duyệt.',
      };
    } catch (error) {
      return { ok: false, message: cleanApiMessage(error, 'Không thể đăng ký.') };
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthActionResult> => {
    try {
      if (!getToken()) return { ok: false, message: 'Phiên đăng nhập không còn tồn tại.' };
      const user = await loadCurrentUser();
      return {
        ok: true,
        message: user.role === 'pending'
          ? 'Tài khoản vẫn đang chờ quản trị viên phê duyệt.'
          : 'Quyền truy cập đã được cập nhật.',
      };
    } catch (error) {
      clearToken();
      setCurrentUser(null);
      return { ok: false, message: cleanApiMessage(error, 'Không thể kiểm tra trạng thái tài khoản.') };
    }
  }, [loadCurrentUser]);

  const logout = useCallback(async () => {
    clearToken();
    setCurrentUser(null);
  }, []);

  const can = useCallback(
    (permission: Permission) => Boolean(currentUser && ROLE_PERMISSIONS[currentUser.role]?.includes(permission)),
    [currentUser],
  );
  const hasPageAccess = useCallback(
    (page: Page) => Boolean(currentUser && ROLE_PAGES[currentUser.role]?.includes(page)),
    [currentUser],
  );

  const value = useMemo<AuthState>(() => ({
    currentUser,
    users: currentUser ? [currentUser] : [],
    allowedPages: currentUser ? getPagesForRole(currentUser.role) : [],
    loading,
    isRemoteAuth: true,
    login,
    signup,
    logout,
    refreshSession,
    can,
    hasPageAccess,
  }), [currentUser, loading, login, signup, logout, refreshSession, can, hasPageAccess]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
