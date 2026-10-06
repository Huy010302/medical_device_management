export type UserRole =
  | 'pending'
  | 'clinical_user'
  | 'biomedical_engineer'
  | 'procurement_officer'
  | 'asset_manager'
  | 'admin';

export type Permission =
  | 'device:create'
  | 'device:update'
  | 'device:delete'
  | 'workflow:create'
  | 'workflow:update'
  | 'report:view'
  | 'qr:print'
  | 'user:manage';

export type Page =
  | 'dashboard'
  | 'devices'
  | 'tendering'
  | 'purchasing'
  | 'maintenance'
  | 'repairs'
  | 'disposal'
  | 'reports'
  | 'bigdata'
  | 'users'
  | 'departments'
  | 'categories'
  | 'statuses'
  | 'qrcode'
  | 'transfer'
  | 'receiving'
  | 'administration'
  | 'risk'
  | 'cost'
  | 'failure';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  departmentId?: string | null;
  createdAt: string;
}

export interface UserAccount extends AuthUser {
  password: string;
}
