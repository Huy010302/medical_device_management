import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Stethoscope,
  User,
  UserPlus,
} from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

interface RegisterOptionsResponse {
  departments: DepartmentOption[];
}

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    departmentId: '',
  });

  const shouldShowLeftIcon = (field: string, value: string) => focusedInput !== field && !value;

  useEffect(() => {
    if (mode !== 'signup' || departments.length > 0) return;
    let active = true;
    setLoadingDepartments(true);
    apiJson<RegisterOptionsResponse>('/auth/register-options', {}, false)
      .then(result => {
        if (active) setDepartments(result.departments || []);
      })
      .catch(err => {
        console.error('Cannot load department registration options:', err);
      })
      .finally(() => {
        if (active) setLoadingDepartments(false);
      });
    return () => { active = false; };
  }, [mode, departments.length]);

  const passwordChecks = useMemo(() => ({
    length: signupForm.password.length >= 8,
    letter: /[A-Za-z]/.test(signupForm.password),
    number: /\d/.test(signupForm.password),
    match: signupForm.password.length > 0 && signupForm.password === signupForm.confirmPassword,
  }), [signupForm.password, signupForm.confirmPassword]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await login(loginForm.email, loginForm.password);
      if (!result.ok) setError(result.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!passwordChecks.length || !passwordChecks.letter || !passwordChecks.number) {
      setError('Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.');
      return;
    }
    if (!passwordChecks.match) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signup({
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password,
        departmentId: signupForm.departmentId || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setNotice(result.message);
      setLoginForm({ email: signupForm.email.trim().toLowerCase(), password: '' });
      setSignupForm({ name: '', email: '', password: '', confirmPassword: '', departmentId: '' });
      setMode('login');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.22),transparent_35%)]" />
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur">
              <Stethoscope size={24} />
            </div>
            <div>
              <p className="text-lg font-bold">MedDevice Lifecycle</p>
              <p className="text-xs text-slate-300">Hospital medical equipment management</p>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm text-blue-100 mb-6">
              <Shield size={16} /> Đăng nhập an toàn + phân quyền theo vai trò
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-tight">
              Quản lý thiết bị y tế theo vòng đời, rõ quyền và dễ vận hành hơn.
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-3xl">
            {[
              ['Thiết bị', 'Theo dõi trạng thái và vị trí'],
              ['Lifecycle', 'Đấu thầu → thanh lý'],
              ['Phân quyền', 'Admin / Asset / Procurement / Biomedical / Clinical'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Activity size={18} className="text-blue-200" />
                <p className="mt-3 font-semibold">{title}</p>
                <p className="text-xs text-slate-300 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <div className="lg:hidden flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center">
                  <Stethoscope size={21} />
                </div>
                <div>
                  <p className="font-bold">MedDevice Lifecycle</p>
                  <p className="text-xs text-slate-500">Quản lý thiết bị y tế</p>
                </div>
              </div>
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${mode === 'signup' ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Đăng ký
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {notice && (
                <div className="mb-4 flex gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">Chào mừng quay lại</h2>
                    <p className="text-sm text-slate-500 mt-1">Đăng nhập bằng tài khoản đã đăng ký trong hệ thống.</p>
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <div className="relative">
                      {shouldShowLeftIcon('login-email', loginForm.email) && (
                        <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      )}
                      <input
                        className={`input ${shouldShowLeftIcon('login-email', loginForm.email) ? 'pl-9' : 'pl-3'}`}
                        type="email"
                        autoComplete="email"
                        value={loginForm.email}
                        onFocus={() => setFocusedInput('login-email')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Mật khẩu</label>
                    <div className="relative">
                      {shouldShowLeftIcon('login-password', loginForm.password) && (
                        <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      )}
                      <input
                        className={`input ${shouldShowLeftIcon('login-password', loginForm.password) ? 'pl-9' : 'pl-3'} pr-10`}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={loginForm.password}
                        onFocus={() => setFocusedInput('login-password')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

                  <button type="submit" disabled={submitting} className="btn-primary w-full py-3 disabled:opacity-60">
                    {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">Tạo tài khoản</h2>
                    <p className="text-sm text-slate-500 mt-1">Tài khoản mới được gán trạng thái chờ duyệt. Admin sẽ phê duyệt vai trò trước khi sử dụng chức năng nghiệp vụ.</p>
                  </div>

                  <div>
                    <label className="label">Họ tên</label>
                    <div className="relative">
                      <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-9" autoComplete="name" minLength={2} maxLength={120} value={signupForm.name} onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))} required />
                    </div>
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <div className="relative">
                      <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-9" type="email" autoComplete="email" value={signupForm.email} onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))} required />
                    </div>
                  </div>

                  <div>
                    <label className="label">Khoa/Phòng</label>
                    <div className="relative">
                      <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        className="input pl-9"
                        value={signupForm.departmentId}
                        disabled={loadingDepartments}
                        onChange={e => setSignupForm(p => ({ ...p, departmentId: e.target.value }))}
                      >
                        <option value="">{loadingDepartments ? 'Đang tải khoa/phòng...' : 'Chưa chọn / Admin sẽ cập nhật'}</option>
                        {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Mật khẩu</label>
                    <div className="relative">
                      <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-9 pr-10"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={signupForm.password}
                        onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Xác nhận mật khẩu</label>
                    <div className="relative">
                      <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-9 pr-10"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={signupForm.confirmPassword}
                        onChange={e => setSignupForm(p => ({ ...p, confirmPassword: e.target.value }))}
                        required
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon" aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}>
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className={passwordChecks.length ? 'text-emerald-600' : 'text-slate-400'}>• Tối thiểu 8 ký tự</span>
                    <span className={passwordChecks.letter ? 'text-emerald-600' : 'text-slate-400'}>• Có chữ cái</span>
                    <span className={passwordChecks.number ? 'text-emerald-600' : 'text-slate-400'}>• Có chữ số</span>
                    <span className={passwordChecks.match ? 'text-emerald-600' : 'text-slate-400'}>• Hai mật khẩu khớp</span>
                  </div>

                  {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

                  <button type="submit" disabled={submitting} className="btn-primary w-full py-3 disabled:opacity-60">
                    <UserPlus size={16} /> {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
