import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import { useAuthStore, type AppTenantTheme } from './store/auth';
import { getTabsForRole, MobileShell, TopBar, EmptyState, Toast } from './components/MobileLayout';
import { Home, Users, Dumbbell, Plus, LogOut, Copy, CheckCircle, Clock, TrendingUp, ClipboardList, UserPlus, ChevronLeft, Edit3, X, ArrowRight, Check } from 'lucide-react';
import api from './services/api';
import { useState, type FormEvent } from 'react';
import { formatStudentId, copyToClipboard, formatDate, cn } from './utils';
import type { Student, Workout, StudentProgress } from '@trainer-room/shared-types';

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const show = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };
  return { toast, show };
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'MASTER_ADMIN' | 'TRAINER' | 'STUDENT' }) {
  const { token, user, loading, fetchMe } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && !user && !loading) fetchMe();
  }, [token, user, loading, fetchMe]);

  if (!token) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    if (user?.role === 'MASTER_ADMIN') return <Navigate to="/admin" replace />;
    if (user?.role === 'TRAINER') return <Navigate to="/trainer" replace />;
    if (user?.role === 'STUDENT') return <Navigate to="/student" replace />;
  }
  return <>{children}</>;
}

function LoginPage() {
  const { setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      logout();
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        setAuth(res.data.data);
        const role = res.data.data.user.role;
        show('Login realizado com sucesso!');
        if (role === 'MASTER_ADMIN') navigate('/admin');
        else if (role === 'TRAINER') navigate('/trainer');
        else navigate('/student');
      }
    } catch (err: any) {
      const msg = err.response?.data?.pendingApproval
        ? 'Cadastro pendente de aprovação pelo Personal'
        : err.response?.data?.error || 'Falha no login';
      show(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe flex items-center justify-center px-6 py-10"
      style={{ backgroundColor: 'var(--color-surface)' }}>
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <div className="w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center mb-10 pt-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-mobile-lg bg-brand-gradient">
            <Dumbbell className="w-10 h-10 text-white" strokeWidth={2.4} />
          </div>
          <h1 className="text-2xl font-black">Trainer Room</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Gestão de treinos personalizada
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 card">
          <div>
            <label className="label">E-mail</label>
            <input
              type="email" className="input-field" placeholder="voce@exemplo.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email" autoCapitalize="none"
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              type="password" className="input-field" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" minLength={6}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Aluno novo?
          </p>
          <p className="text-sm">
            Peça o link de cadastro ao seu Personal Trainer
          </p>
        </div>
      </div>
    </div>
  );
}

function TenantPublicRegisterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { fetchTenantTheme, tenantTheme } = useAuthStore();
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const [step, setStep] = useState<'loading' | 'register' | 'success' | 'notfound'>('loading');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultId, setResultId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchTenantTheme(slug).then((t: AppTenantTheme | null) => {
        setStep(t ? 'register' : 'notfound');
      });
    }
  }, [slug]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      show('As senhas não coincidem', 'error');
      return;
    }
    if (password.length < 8) {
      show('A senha deve ter pelo menos 8 dígitos', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/students/register', {
        tenantSlug: slug,
        name,
        email: email || undefined,
        password,
      });
      if (res.data.success) {
        setResultId(res.data.data.studentId);
        setStep('success');
      }
    } catch (err: any) {
      show(err.response?.data?.error || 'Erro no cadastro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = async () => {
    try {
      const formatted = formatStudentId(resultId);
      await copyToClipboard(formatted);
      setCopied(true);
      show('ID copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show('Não foi possível copiar', 'error');
    }
  };

  const renderPublicHeader = () => (
    <header className="public-header">
      <div className="flex items-center gap-3 min-w-0">
        <div className="brand-logo-circle">
          <Dumbbell className="w-6 h-6" strokeWidth={2.6} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="tenant-subtitle">CONSULTORIA</span>
          <span className="tenant-name-header truncate">
            {tenantTheme?.name || 'Personal Trainer'}
          </span>
        </div>
      </div>
      <span className="chip-fitsystem">FITSYSTEM</span>
    </header>
  );

  if (step === 'loading') {
    return (
      <div className="min-h-screen-safe flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="skeleton w-24 h-24 rounded-3xl" />
      </div>
    );
  }

  if (step === 'notfound') {
    return (
      <div className="min-h-screen-safe" style={{ backgroundColor: 'var(--color-bg)' }}>
        {renderPublicHeader()}
        <div className="flex items-center justify-center px-6 pt-12">
          <div className="text-center max-w-sm w-full">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#FEF2F2' }}>
              <Users className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-xl font-bold mb-2">Página não encontrada</h1>
            <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
              O link de cadastro é inválido ou foi desativado.
            </p>
            <Link to="/login" className="btn-primary inline-flex">
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen-safe flex flex-col"
        style={{ backgroundColor: '#FCFDF8' }}>
        {toast && <Toast message={toast.msg} type={toast.type} />}
        {renderPublicHeader()}
        <div className="flex-1 overflow-y-auto px-5 pb-10"
          style={{ paddingTop: '2rem' }}>
          <div className="w-full max-w-md mx-auto">
            <div className="flex items-start gap-4 mb-7">
              <div className="success-check-circle">
                <Check className="w-8 h-8" strokeWidth={3} />
              </div>
              <div className="pt-1">
                <p className="font-black text-lg mb-0.5"
                  style={{ color: 'var(--color-accent-lime-hover)' }}>
                  Cadastro concluído
                </p>
                <h1 className="text-2xl font-black leading-tight"
                  style={{ color: 'var(--color-text)' }}>
                  Sua conta foi criada!
                </h1>
              </div>
            </div>

            <div className="card-id-dark mb-5">
              <div className="relative z-10">
                <p className="text-xs font-bold tracking-[0.18em] mb-3"
                  style={{ color: 'rgba(255,255,255,0.6)' }}>
                  SEU ID ÚNICO DE ALUNO
                </p>
                <div className="text-4xl font-black tracking-wider mb-6"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {formatStudentId(resultId)}
                </div>
                <button
                  type="button"
                  className="btn-lime"
                  onClick={handleCopyId}>
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      ID Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copiar ID
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="card mb-5 p-5 text-left"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECE4' }}>
              <p className="text-base leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}>
                Copie este ID e envie para o seu personal trainer no WhatsApp para que ele aprove o seu acesso aos treinos.
              </p>
            </div>

            <div className="status-pending-card mb-7">
              <span className="status-pending-dot" />
              Status: Aguardando aprovação do Personal
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                className="btn-link-underline"
                onClick={() => {
                  setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
                  setStep('register');
                }}>
                Voltar para o cadastro
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe flex flex-col" style={{ backgroundColor: '#FCFDF8' }}>
      {toast && <Toast message={toast.msg} type={toast.type} />}
      {renderPublicHeader()}

      <section className="hero-dark">
        <div className="relative z-10 max-w-md mx-auto w-full">
          <span className="hero-eyebrow">VAMOS COMEÇAR</span>
          <h1 className="text-[2rem] leading-[1.1] font-black mb-4 tracking-tight">
            Bem-vindo à sua nova rotina de treinos!
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-hero-muted)' }}>
            Cadastre-se abaixo para gerar seu acesso e enviar ao seu personal.
          </p>
        </div>
      </section>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-7 pb-10 w-full max-w-md mx-auto">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="label">Nome completo</label>
              <input
                type="text" className="input-field" placeholder="Como podemos te chamar?"
                value={name} onChange={(e) => setName(e.target.value)}
                required autoComplete="name" minLength={2}
                style={{ backgroundColor: '#FFFFFF' }}
              />
            </div>

            <div>
              <label className="label">E-mail</label>
              <input
                type="email" className="input-field" placeholder="voce@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" autoCapitalize="none"
                style={{ backgroundColor: '#FFFFFF' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Senha</label>
                <input
                  type="password" className="input-field" placeholder="Min. 8 dígitos"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={8}
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
              <div>
                <label className="label">Confirmar senha</label>
                <input
                  type="password" className="input-field" placeholder="Repita a senha"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  required minLength={8}
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" className="btn-lime" disabled={loading}>
                {loading ? (
                  'Criando conta...'
                ) : (
                  <>
                    Criar Minha Conta
                    <ArrowRight className="w-5 h-5" strokeWidth={2.6} />
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-sm leading-relaxed pt-2 px-3"
              style={{ color: 'var(--color-text-muted)' }}>
              Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { user, logout, fetchTenantTheme } = useAuthStore();
  const navigate = useNavigate();
  const tabs = getTabsForRole(user?.role);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    api.get('/tenants').then((r) => setTenants(r.data.data || []));
  }, []);

  return (
    <MobileShell title="Painel Master" tabs={tabs}
      right={
        <button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={logout}>
          <LogOut className="w-5 h-5" />
        </button>
      }>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card !p-4">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Clientes</p>
          <p className="text-3xl font-black">{tenants.length}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Ativos</p>
          <p className="text-3xl font-black">{tenants.filter((t) => t.isActive).length}</p>
        </div>
      </div>

      <h2 className="font-bold mb-3">Últimos Clientes</h2>
      <div className="space-y-3">
        {tenants.length === 0 && <EmptyState icon={Users} title="Nenhum cliente ainda" subtitle="Clique em + para adicionar um Personal Trainer" />}
        {tenants.map((t) => (
          <div key={t.id} className="card flex items-center justify-between gap-3"
            onClick={() => navigate(`/admin/tenants/${t.id}`)}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: t.primaryColor }}>
                {t.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{t.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{t.slug}</p>
              </div>
            </div>
            <span className={cn('badge', t.isActive ? 'badge-approved' : 'badge-pending')}>
              {t.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => navigate('/admin/tenants/new')}>
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>
    </MobileShell>
  );
}

function AdminTenantsNew() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const tabs = getTabsForRole(user?.role);
  const { toast, show } = useToast();
  const [form, setForm] = useState({
    slug: '', name: '', primaryColor: '#0F3D36', secondaryColor: '#0B2E29',
    accentColor: '#C3F230', backgroundColor: '#FCFDF8',
    trainerEmail: '', trainerName: '', trainerPassword: '', trainerPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        setFetching(true);
        const res = await api.get(`/tenants/${id}`);
        if (cancelled || !res.data.success) return;
        const { tenant, trainer } = res.data.data;
        setForm({
          slug: tenant.slug || '',
          name: tenant.name || '',
          primaryColor: tenant.primaryColor || '#0F3D36',
          secondaryColor: tenant.secondaryColor || '#0B2E29',
          accentColor: tenant.accentColor || '#C3F230',
          backgroundColor: tenant.backgroundColor || '#FCFDF8',
          trainerEmail: trainer?.email || '',
          trainerName: trainer?.name || '',
          trainerPassword: '',
          trainerPhone: trainer?.phone || '',
        });
      } catch (err: any) {
        show(err.response?.data?.error || 'Erro ao carregar dados', 'error');
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isEdit) {
        const payload: any = { ...form };
        if (!form.trainerPassword) delete payload.trainerPassword;
        const res = await api.put(`/tenants/${id}`, payload);
        if (res.data.success) {
          show('Dados atualizados com sucesso!');
          setTimeout(() => navigate('/admin/tenants'), 1200);
        }
      } else {
        const createPayload = { ...form, trainerPassword: form.trainerPassword || 'personal123' };
        const res = await api.post('/tenants', createPayload);
        if (res.data.success) {
          show('Personal criado com sucesso!');
          setTimeout(() => navigate('/admin/tenants'), 1200);
        }
      }
    } catch (err: any) {
      show(err.response?.data?.error || (isEdit ? 'Erro ao salvar' : 'Erro ao criar'), 'error');
    } finally { setLoading(false); }
  };

  if (fetching) {
    return (
      <MobileShell title="Carregando..." tabs={tabs}
        left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/admin/tenants')}><ChevronLeft className="w-6 h-6" /></button>}>
        <EmptyState icon={Clock} title="Carregando dados..." subtitle="Aguarde um momento" />
      </MobileShell>
    );
  }

  return (
    <MobileShell title={isEdit ? 'Editar Cliente' : 'Novo Cliente'} tabs={tabs}
      left={
        <button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/admin/tenants')}>
          <ChevronLeft className="w-6 h-6" />
        </button>
      }>
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <form onSubmit={submit} className="space-y-4 pb-8">
        <div className="card space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-brand" /> Dados do Personal
          </h3>
          <div>
            <label className="label">Nome *</label>
            <input type="text" className="input-field" required value={form.trainerName}
              onChange={(e) => setForm({ ...form, trainerName: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail *</label>
            <input type="email" className="input-field" required value={form.trainerEmail}
              onChange={(e) => setForm({ ...form, trainerEmail: e.target.value.toLowerCase() })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{isEdit ? 'Nova senha (opcional)' : 'Senha inicial *'}</label>
              <input type="text" className="input-field" {...(isEdit ? {} : { required: true, minLength: 6 })} value={form.trainerPassword}
                placeholder={isEdit ? 'Deixe vazio para manter' : 'Mínimo 6 caracteres'}
                onChange={(e) => setForm({ ...form, trainerPassword: e.target.value })} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input type="tel" className="input-field" value={form.trainerPhone}
                onChange={(e) => setForm({ ...form, trainerPhone: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand" /> Identidade Visual (White-Label)
          </h3>
          <div>
            <label className="label">Nome da marca *</label>
            <input type="text" className="input-field" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Slug da URL *</label>
            <div className="flex items-center">
              <span className="px-3 py-3 rounded-l-xl text-sm font-semibold"
                style={{ backgroundColor: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRight: 0 }}>
                /t/
              </span>
              <input type="text" className="input-field !rounded-l-none" required
                pattern="[a-z0-9-]+" minLength={3} value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder="nome-personal" />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Link de cadastro dos alunos
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cor Principal</label>
              <input type="color" className="input-field h-12 p-1 cursor-pointer" value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </div>
            <div>
              <label className="label">Cor Secundária</label>
              <input type="color" className="input-field h-12 p-1 cursor-pointer" value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
            </div>
            <div>
              <label className="label">Cor Destaque</label>
              <input type="color" className="input-field h-12 p-1 cursor-pointer" value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
            </div>
            <div>
              <label className="label">Fundo</label>
              <input type="color" className="input-field h-12 p-1 cursor-pointer" value={form.backgroundColor}
                onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} />
            </div>
          </div>

          <div className="p-4 rounded-xl flex items-center justify-center gap-4 text-white font-bold shadow-mobile-lg"
            style={{ background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})` }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/20">
              {form.name.charAt(0) || '?'}
            </div>
            <span className="text-lg">{form.name || 'Preview'}</span>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? (isEdit ? 'Salvando...' : 'Criando...') : (isEdit ? 'Salvar alterações' : 'Criar Personal Trainer')}
        </button>
      </form>
    </MobileShell>
  );
}

function AdminTenantsList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    api.get('/tenants').then((r) => setTenants(r.data.data || []));
  }, []);

  return (
    <MobileShell title="Clientes" tabs={tabs}
      left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/admin')}><ChevronLeft className="w-6 h-6" /></button>}
      right={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/admin/tenants/new')}><Plus className="w-5 h-5" /></button>}>
      <div className="space-y-3">
        {tenants.length === 0 && <EmptyState icon={Users} title="Sem clientes cadastrados" />}
        {tenants.map((t) => (
          <div key={t.id} className="card flex items-center justify-between gap-3"
            onClick={() => navigate(`/admin/tenants/${t.id}`)}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: t.primaryColor }}>
                {t.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{t.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{t.slug}</p>
              </div>
            </div>
            <span className={cn('badge', t.isActive ? 'badge-approved' : 'badge-pending')}>
              {t.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

function TrainerDashboard() {
  const { user, tenant, logout } = useAuthStore();
  const navigate = useNavigate();
  const tabs = getTabsForRole(user?.role);
  const [stats, setStats] = useState({ pending: 0, approved: 0, workouts: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/students?status=pending'),
      api.get('/students?status=approved'),
    ]).then(([pend, aprov]) => {
      setStats({
        pending: pend.data.data?.length || 0,
        approved: aprov.data.data?.length || 0,
        workouts: 0,
      });
    });
  }, []);

  return (
    <MobileShell title={tenant?.name || 'Painel'} tabs={tabs}
      right={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={logout}><LogOut className="w-5 h-5" /></button>}>
      <div className="card mb-6 !p-5 bg-brand-gradient text-white border-none">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              {tenant?.logoUrl
                ? <img src={tenant.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                : <span className="text-xl font-black">{tenant?.name.charAt(0)}</span>}
            </div>
            <div>
              <p className="text-xs opacity-80">Olá,</p>
              <p className="font-bold text-lg">{user?.name.split(' ')[0]}!</p>
            </div>
          </div>
        </div>
        <p className="text-sm opacity-90">
          Você tem <strong>{stats.pending}</strong> aprovações pendentes hoje.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="card !p-3 text-center !rounded-2xl">
          <Clock className="w-5 h-5 mx-auto mb-1 text-amber-500" />
          <p className="text-2xl font-black">{stats.pending}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pendentes</p>
        </div>
        <div className="card !p-3 text-center !rounded-2xl">
          <Users className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-2xl font-black">{stats.approved}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Alunos</p>
        </div>
        <div className="card !p-3 text-center !rounded-2xl">
          <Dumbbell className="w-5 h-5 mx-auto mb-1 text-brand" />
          <p className="text-2xl font-black">{stats.workouts}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Treinos</p>
        </div>
      </div>

      <h2 className="font-bold mb-3">Ações Rápidas</h2>
      <div className="space-y-3">
        <div className="card flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          onClick={() => navigate('/trainer/approve')}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
              <UserPlus className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <p className="font-bold">Aprovar Aluno por ID</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {stats.pending} aguardando
              </p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 rotate-180" style={{ color: 'var(--color-text-muted)' }} />
        </div>

        <div className="card flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          onClick={() => navigate('/trainer/workouts/new')}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
              <Dumbbell className="w-6 h-6 text-brand" />
            </div>
            <div>
              <p className="font-bold">Criar Ficha de Treino</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Montar treino para aluno</p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 rotate-180" style={{ color: 'var(--color-text-muted)' }} />
        </div>

        <div className="card flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          onClick={() => navigate('/trainer/students')}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-secondary) 15%, transparent)' }}>
              <Users className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} />
            </div>
            <div>
              <p className="font-bold">Lista de Alunos</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ver todos, aprovados e pendentes</p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 rotate-180" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      </div>
    </MobileShell>
  );
}

function TrainerStudents() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const status = filter === 'all' ? '' : filter;
    api.get(`/students${status ? `?status=${status}` : ''}`).then((r) => setStudents(r.data.data || []));
  }, [filter]);

  return (
    <MobileShell title="Alunos" tabs={tabs}
      right={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/trainer/approve')}><UserPlus className="w-5 h-5" /></button>}>
      <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
        {(['pending', 'approved', 'all'] as const).map((f) => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all',
              filter === f ? 'text-white shadow-sm' : ''
            )}
            style={filter === f ? { backgroundColor: 'var(--color-primary)' } : { color: 'var(--color-text-muted)' }}>
            {f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovados' : 'Todos'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {students.length === 0 && (
          <EmptyState icon={Users}
            title={filter === 'pending' ? 'Sem pendências no momento' : filter === 'approved' ? 'Nenhum aluno aprovado ainda' : 'Sem alunos'}
            subtitle="Digite o ID do aluno para aprovar" />
        )}
        {students.map((s) => (
          <div key={s.id} className="card flex items-center justify-between gap-3"
            onClick={() => navigate(`/trainer/students/${s.id}`)}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                style={{ backgroundColor: s.isApproved ? 'var(--color-primary)' : '#F59E0B' }}>
                {s.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold truncate">{s.name}</p>
                  <span className={cn('badge', s.isApproved ? 'badge-approved' : 'badge-pending')}>
                    {s.isApproved ? 'Aprovado' : 'Pendente'}
                  </span>
                </div>
                <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  ID: {formatStudentId(s.studentId)}
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 rotate-180 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

function TrainerApprovePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  const { toast, show } = useToast();
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!studentId.trim()) return;
    try {
      setSearching(true);
      setFound(null);
      const res = await api.get(`/students/by-id/${studentId.trim()}`);
      if (res.data.success) setFound(res.data.data);
    } catch (err: any) {
      show(err.response?.data?.error || 'Aluno não encontrado', 'error');
    } finally { setSearching(false); }
  };

  const approve = async () => {
    if (!found) return;
    try {
      setLoading(true);
      const res = await api.post('/students/approve', { studentId: found.studentId });
      if (res.data.success) {
        show(`${found.name} aprovado com sucesso!`);
        setFound(null);
        setStudentId('');
      }
    } catch (err: any) {
      show(err.response?.data?.error || 'Erro ao aprovar', 'error');
    } finally { setLoading(false); }
  };

  return (
    <MobileShell title="Aprovar Aluno" tabs={tabs}
      left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/trainer')}><ChevronLeft className="w-6 h-6" /></button>}>
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <form onSubmit={search} className="card mb-5 !p-5">
        <label className="label !text-base">Digite o ID do Aluno</label>
        <div className="flex gap-2">
          <input
            type="text" className="input-field !text-xl !font-mono !tracking-widest text-center uppercase"
            placeholder="ABCD-1234"
            value={studentId} onChange={(e) => setStudentId(e.target.value.toUpperCase())}
            maxLength={12} autoFocus
          />
        </div>
        <button type="submit" className="btn-primary w-full mt-4" disabled={searching || !studentId.trim()}>
          {searching ? 'Buscando...' : 'Buscar Aluno'}
        </button>
      </form>

      {found && (
        <div className="card !p-5 shadow-mobile-lg">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-2xl flex-shrink-0"
              style={{ backgroundColor: found.isApproved ? 'var(--color-primary)' : '#F59E0B' }}>
              {found.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg truncate">{found.name}</h3>
                <span className={cn('badge', found.isApproved ? 'badge-approved' : 'badge-pending')}>
                  {found.isApproved ? 'Já aprovado' : 'Pendente'}
                </span>
              </div>
              <p className="font-mono text-sm font-semibold mb-1" style={{ color: 'var(--color-primary)' }}>
                ID: {formatStudentId(found.studentId)}
              </p>
              {(found.email || found.phone) && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {found.email && <>{found.email}<br /></>}
                  {found.phone && <>{found.phone}</>}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Cadastrado em {formatDate(found.createdAt)}
              </p>
            </div>
          </div>

          <div className="divider" />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => { setFound(null); setStudentId(''); }}>
              Buscar outro
            </button>
            <button
              className={cn(found.isApproved ? 'btn-secondary' : 'btn-primary')}
              onClick={approve}
              disabled={loading || found.isApproved}>
              {loading ? 'Aprovando...' : found.isApproved ? 'Já aprovado' : '✓ Aprovar Acesso'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl text-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', border: '1px dashed color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
        <p className="font-bold mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          Como funciona a aprovação?
        </p>
        <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--color-text-muted)' }}>
          <li>O aluno se cadastra no link do seu painel</li>
          <li>O sistema gera um ID único para ele</li>
          <li>O aluno envia o ID para você</li>
          <li>Você aprova aqui e libera os treinos</li>
        </ol>
      </div>
    </MobileShell>
  );
}

function StudentDashboard() {
  const { user, tenant, student, logout } = useAuthStore();
  const navigate = useNavigate();
  const tabs = getTabsForRole(user?.role);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    api.get('/workouts/me').then((r) => setWorkouts(r.data.data || []));
  }, []);

  const today = workouts.find((w) => {
    if (!w.scheduledDate) return w === workouts[0];
    const sd = new Date(w.scheduledDate).toDateString();
    return sd === new Date().toDateString();
  }) || workouts[0];

  return (
    <MobileShell title={tenant?.name || 'Meus Treinos'} tabs={tabs}
      right={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={logout}><LogOut className="w-5 h-5" /></button>}>
      <div className="card mb-6 !p-5 bg-brand-gradient text-white border-none">
        <p className="text-xs opacity-80 mb-1">Olá,</p>
        <h2 className="text-2xl font-black mb-4">{user?.name.split(' ')[0]}!</h2>

        {student && (
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <p className="text-xs opacity-80">Seu ID de Aluno</p>
            <p className="font-mono font-black text-xl tracking-widest">{formatStudentId(student.studentId)}</p>
          </div>
        )}
      </div>

      <h2 className="font-bold mb-3 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-brand" /> Treino de Hoje
      </h2>
      {!today ? (
        <EmptyState icon={Dumbbell} title="Sem treino por enquanto"
          subtitle="Aguarde seu Personal montar sua ficha" />
      ) : (
        <div className="card !p-5 cursor-pointer" onClick={() => navigate(`/student/workouts/${today.id}`)}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">{today.title}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {today.scheduledDate ? formatDate(today.scheduledDate) : 'Treino disponível'}
              </p>
            </div>
            <span className={cn('badge', today.isCompleted ? 'badge-approved' : 'badge-pending')}>
              {today.isCompleted ? '✓ Feito' : 'A fazer'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {(today as any).exercises?.length || 0} exercícios
            </p>
            <span className="btn-ghost !py-2 !px-3 !min-h-0 !text-sm">Iniciar →</span>
          </div>
        </div>
      )}

      {workouts.length > 1 && (
        <>
          <h2 className="font-bold mb-3 mt-8 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand" /> Próximos Treinos
          </h2>
          <div className="space-y-3">
            {workouts.filter((w) => w.id !== today.id).slice(0, 3).map((w) => (
              <div key={w.id} className="card flex items-center justify-between gap-3"
                onClick={() => navigate(`/student/workouts/${w.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{w.title}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {w.scheduledDate ? formatDate(w.scheduledDate) : 'Sem data'}
                    {' · '}{(w as any).exercises?.length || 0} exercícios
                  </p>
                </div>
                <span className={cn('badge', w.isCompleted ? 'badge-approved' : 'badge-pending')}>
                  {w.isCompleted ? 'Feito' : 'Pendente'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </MobileShell>
  );
}

function StudentWorkoutsList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    api.get('/workouts/me').then((r) => setWorkouts(r.data.data || []));
  }, []);

  return (
    <MobileShell title="Treinos" tabs={tabs}>
      <div className="space-y-3">
        {workouts.length === 0 && <EmptyState icon={Dumbbell} title="Sem treinos ainda"
          subtitle="Seu Personal vai montar sua ficha em breve" />}
        {workouts.map((w) => (
          <div key={w.id} className="card" onClick={() => navigate(`/student/workouts/${w.id}`)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold">{w.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {w.scheduledDate ? formatDate(w.scheduledDate) : 'Disponível'}
                </p>
              </div>
              <span className={cn('badge', w.isCompleted ? 'badge-approved' : 'badge-pending')}>
                {w.isCompleted ? '✓ Feito' : 'Pendente'}
              </span>
            </div>
            {(w as any).exercises && (
              <p className="text-sm font-semibold pt-3" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                {(w as any).exercises.length} exercícios
              </p>
            )}
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

function StudentWorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  const { toast, show } = useToast();
  const [workout, setWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/workouts/${id}`).then((r) => {
      setWorkout(r.data.data);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [id]);

  const toggleSet = async (exerciseId: string, delta: number) => {
    if (!workout) return;
    const ex = (workout.exercises || []).find((e: any) => e.id === exerciseId);
    if (!ex) return;
    const newCount = Math.max(0, Math.min(ex.sets, ex.completedSets + delta));
    try {
      const res = await api.post(`/workouts/${workout.id}/exercise/${exerciseId}/toggle`, {
        completedSets: newCount,
      });
      if (res.data.success) {
        setWorkout({
          ...workout,
          exercises: workout.exercises.map((e: any) => e.id === exerciseId ? res.data.data : e),
        });
      }
    } catch {
      show('Erro ao atualizar', 'error');
    }
  };

  const finish = async () => {
    if (!workout) return;
    try {
      setFinishing(true);
      const res = await api.post(`/workouts/${workout.id}/finish`);
      if (res.data.success) {
        setWorkout({ ...workout, isCompleted: true, completedAt: new Date() });
        show('Treino finalizado! Parabéns 💪', 'success');
      }
    } catch {
      show('Erro ao finalizar', 'error');
    } finally { setFinishing(false); }
  };

  if (loading) {
    return <MobileShell title="Treino" tabs={tabs}><div className="skeleton h-64 rounded-2xl" /></MobileShell>;
  }
  if (!workout) {
    return <MobileShell title="Treino" tabs={tabs}><EmptyState icon={Dumbbell} title="Treino não encontrado" /></MobileShell>;
  }

  const totalExercises = (workout.exercises || []).length;
  const doneExercises = (workout.exercises || []).filter((e: any) => e.completedSets >= e.sets).length;
  const progressPct = totalExercises ? Math.round((doneExercises / totalExercises) * 100) : 0;

  return (
    <MobileShell title={workout.title} tabs={tabs}
      left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate(-1 as any)}><ChevronLeft className="w-6 h-6" /></button>}>
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <div className="card mb-5 !p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            Progresso do treino
          </p>
          <p className="font-black text-lg text-brand">{progressPct}%</p>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="h-full rounded-full transition-all duration-500 bg-brand-gradient" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {doneExercises} de {totalExercises} exercícios concluídos
        </p>
        {workout.isCompleted && <span className="badge badge-approved mt-2 inline-flex">✓ Finalizado em {formatDate(workout.completedAt)}</span>}
      </div>

      <div className="space-y-3 mb-6">
        {(workout.exercises || []).map((ex: any, idx: number) => {
          const allDone = ex.completedSets >= ex.sets;
          return (
            <div key={ex.id} className={cn('card !p-4 transition-all', allDone && 'opacity-75')}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ backgroundColor: allDone ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-surface)', color: allDone ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                      {idx + 1}
                    </span>
                    <h3 className={cn('font-bold flex-1', allDone && 'line-through')}>{ex.name}</h3>
                  </div>
                  {ex.muscleGroup && (
                    <p className="text-xs mt-1 ml-9" style={{ color: 'var(--color-text-muted)' }}>{ex.muscleGroup}</p>
                  )}
                </div>
                <label className="flex-shrink-0 pt-1">
                  <input
                    type="checkbox" className="checkbox-large"
                    checked={allDone}
                    onChange={() => toggleSet(ex.id, allDone ? -ex.sets : ex.sets)} />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2 ml-9 mb-3">
                <div className="p-2 rounded-lg text-center" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Séries</p>
                  <p className="font-black">{ex.sets}</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Reps</p>
                  <p className="font-black">{ex.reps}</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Carga</p>
                  <p className="font-black">{ex.loadKg ? `${ex.loadKg}kg` : '-'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between ml-9 mb-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  Séries concluídas
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg"
                    style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                    onClick={() => toggleSet(ex.id, -1)}
                    disabled={ex.completedSets <= 0}>
                    −
                  </button>
                  <span className="font-black text-xl min-w-[3ch] text-center">
                    {ex.completedSets}<span className="text-base font-semibold" style={{ color: 'var(--color-text-muted)' }}>/{ex.sets}</span>
                  </span>
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    onClick={() => toggleSet(ex.id, +1)}
                    disabled={ex.completedSets >= ex.sets}>
                    +
                  </button>
                </div>
              </div>
              {ex.restSeconds && (
                <p className="text-xs ml-9" style={{ color: 'var(--color-text-muted)' }}>
                  Descanso: {ex.restSeconds}s entre séries
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!workout.isCompleted && (
        <button className="btn-primary w-full !py-4 !text-base font-black" onClick={finish} disabled={finishing}>
          {finishing ? 'Finalizando...' : '✓ Finalizar Treino'}
        </button>
      )}
    </MobileShell>
  );
}

function StudentProgressPage() {
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  const { toast, show } = useToast();
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [form, setForm] = useState({ weightKg: '', bodyFatPct: '', chestCm: '', waistCm: '', hipCm: '', armCm: '', thighCm: '', calfCm: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/students/me/progress').then((r) => setProgress(r.data.data || [])); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.post('/students/me/progress', {
        ...form,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : null,
        chestCm: form.chestCm ? Number(form.chestCm) : null,
        waistCm: form.waistCm ? Number(form.waistCm) : null,
        hipCm: form.hipCm ? Number(form.hipCm) : null,
        armCm: form.armCm ? Number(form.armCm) : null,
        thighCm: form.thighCm ? Number(form.thighCm) : null,
        calfCm: form.calfCm ? Number(form.calfCm) : null,
      });
      if (res.data.success) {
        setProgress([res.data.data, ...progress]);
        show('Medições salvas!', 'success');
        setForm({ weightKg: '', bodyFatPct: '', chestCm: '', waistCm: '', hipCm: '', armCm: '', thighCm: '', calfCm: '', notes: '' });
      }
    } catch (e: any) {
      show(e.response?.data?.error || 'Erro ao salvar', 'error');
    } finally { setSaving(false); }
  };

  const latest = progress[0];

  return (
    <MobileShell title="Evolução" tabs={tabs}>
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {latest && (
        <div className="card mb-5 !p-5 bg-brand-gradient text-white border-none">
          <p className="text-xs opacity-80 mb-1">Última medição</p>
          <p className="font-black text-lg mb-3">{formatDate(latest.measuredAt)}</p>
          <div className="grid grid-cols-2 gap-3">
            {latest.weightKg && (
              <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
                <p className="text-xs opacity-80">Peso</p>
                <p className="text-2xl font-black">{latest.weightKg}<span className="text-sm">kg</span></p>
              </div>
            )}
            {latest.bodyFatPct && (
              <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
                <p className="text-xs opacity-80">Gordura</p>
                <p className="text-2xl font-black">{latest.bodyFatPct}<span className="text-sm">%</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card mb-5">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand" /> Nova medição
        </h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Peso (kg)</label>
              <input type="number" step="0.1" className="input-field" placeholder="70.5" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            </div>
            <div>
              <label className="label">Gordura (%)</label>
              <input type="number" step="0.1" className="input-field" placeholder="18" value={form.bodyFatPct} onChange={(e) => setForm({ ...form, bodyFatPct: e.target.value })} />
            </div>
            <div><label className="label">Peito (cm)</label><input type="number" step="0.1" className="input-field" value={form.chestCm} onChange={(e) => setForm({ ...form, chestCm: e.target.value })} /></div>
            <div><label className="label">Cintura (cm)</label><input type="number" step="0.1" className="input-field" value={form.waistCm} onChange={(e) => setForm({ ...form, waistCm: e.target.value })} /></div>
            <div><label className="label">Quadril (cm)</label><input type="number" step="0.1" className="input-field" value={form.hipCm} onChange={(e) => setForm({ ...form, hipCm: e.target.value })} /></div>
            <div><label className="label">Braço (cm)</label><input type="number" step="0.1" className="input-field" value={form.armCm} onChange={(e) => setForm({ ...form, armCm: e.target.value })} /></div>
            <div><label className="label">Coxa (cm)</label><input type="number" step="0.1" className="input-field" value={form.thighCm} onChange={(e) => setForm({ ...form, thighCm: e.target.value })} /></div>
            <div><label className="label">Panturrilha (cm)</label><input type="number" step="0.1" className="input-field" value={form.calfCm} onChange={(e) => setForm({ ...form, calfCm: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input-field min-h-[80px]" placeholder="Como está se sentindo?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar medição'}
          </button>
        </form>
      </div>

      <h3 className="font-bold mb-3">Histórico</h3>
      <div className="space-y-2">
        {progress.length === 0 && <EmptyState icon={TrendingUp} title="Sem medições ainda" subtitle="Registre seu peso e medidas acima" />}
        {progress.map((p) => (
          <div key={p.id} className="card !p-4">
            <p className="font-bold mb-2">{formatDate(p.measuredAt)}</p>
            <div className="flex flex-wrap gap-2">
              {p.weightKg && <span className="badge badge-approved">Peso: {p.weightKg}kg</span>}
              {p.bodyFatPct && <span className="badge" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>BF: {p.bodyFatPct}%</span>}
              {p.chestCm && <span className="badge" style={{ backgroundColor: '#FCE7F3', color: '#9D174D' }}>Peito: {p.chestCm}cm</span>}
              {p.waistCm && <span className="badge" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Cintura: {p.waistCm}cm</span>}
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

function GenericProfilePage() {
  const { user, tenant, student, logout } = useAuthStore();
  const navigate = useNavigate();
  const tabs = getTabsForRole(user?.role);
  const copyLink = async () => {
    if (!tenant) return;
    const link = `${window.location.origin}/t/${tenant.slug}`;
    try { await copyToClipboard(link); show('Link copiado! Envie para seus alunos', 'success'); }
    catch { show('Não foi possível copiar', 'error'); }
  };
  const { toast, show } = useToast();

  return (
    <MobileShell title="Perfil" tabs={tabs}>
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <div className="card mb-5 !p-6 text-center">
        <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-brand-gradient flex items-center justify-center text-white text-3xl font-black shadow-mobile-lg">
          {user?.name.charAt(0)}
        </div>
        <h2 className="text-xl font-black">{user?.name}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
        <span className="badge mt-3"
          style={{
            backgroundColor: user?.role === 'MASTER_ADMIN' ? '#EEF2FF' : user?.role === 'TRAINER' ? '#ECFDF5' : '#FEF3C7',
            color: user?.role === 'MASTER_ADMIN' ? '#3730A3' : user?.role === 'TRAINER' ? '#065F46' : '#92400E',
          }}>
          {user?.role === 'MASTER_ADMIN' ? 'Admin Master' : user?.role === 'TRAINER' ? 'Personal Trainer' : 'Aluno'}
        </span>
      </div>

      {tenant && user?.role === 'TRAINER' && (
        <div className="card mb-5 !p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Home className="w-5 h-5 text-brand" /> Sua marca
          </h3>
          <div className="flex items-center gap-3 mb-4">
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
              : <div className="w-14 h-14 rounded-2xl text-white font-bold text-xl flex items-center justify-center" style={{ backgroundColor: tenant.primaryColor }}>{tenant.name.charAt(0)}</div>}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{tenant.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{tenant.slug}</p>
            </div>
          </div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Link de cadastro dos alunos:</p>
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
            <span className="text-xs font-semibold truncate flex-1">/t/{tenant.slug}</span>
            <button className="btn-ghost !py-2 !px-3 !min-h-0 text-sm" onClick={copyLink}>
              <Copy className="w-4 h-4 mr-1" /> Copiar
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: tenant.primaryColor }} />
            <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: tenant.secondaryColor }} />
            <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: tenant.accentColor }} />
          </div>
        </div>
      )}

      {student && (
        <div className="card mb-5 !p-5">
          <h3 className="font-bold mb-3">Meu ID de Aluno</h3>
          <div className="flex items-center justify-between p-4 rounded-xl mb-2"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
            <span className="font-mono font-black text-xl tracking-widest text-brand">{formatStudentId(student.studentId)}</span>
            <button className="btn-ghost !py-2 !px-3 !min-h-0 text-sm"
              onClick={async () => { try { await copyToClipboard(student.studentId); show('ID copiado'); } catch { show('Erro ao copiar', 'error'); } }}>
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Status: <span className={cn('badge', student.isApproved ? 'badge-approved' : 'badge-pending')} style={{ display: 'inline-flex' }}>
              {student.isApproved ? 'Aprovado' : 'Pendente'}
            </span>
          </p>
        </div>
      )}

      <button className="btn-danger w-full" onClick={() => { logout(); navigate('/login'); }}>
        <LogOut className="w-5 h-5 mr-2" /> Sair da conta
      </button>
    </MobileShell>
  );
}

function TrainerStudentDetail() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  const tabs = getTabsForRole(user?.role);
  const { toast, show } = useToast();
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', birthDate: '', gender: '' as '' | 'M' | 'F' | 'O', heightCm: '' as string | number, password: '',
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setFetching(true);
        const res = await api.get(`/students/${id}`);
        if (cancelled || !res.data.success) return;
        const { student: s, user: u, progress: p } = res.data.data;
        setStudent(s);
        setUserData(u);
        setProgress(p || []);
        setForm({
          name: s?.name || '',
          email: s?.email || '',
          phone: s?.phone || '',
          birthDate: s?.birthDate ? new Date(s.birthDate).toISOString().slice(0, 10) : '',
          gender: s?.gender || '',
          heightCm: s?.heightCm || '',
          password: '',
        });
      } catch (err: any) {
        show(err.response?.data?.error || 'Erro ao carregar aluno', 'error');
      } finally {
          if (!cancelled) setFetching(false);
        }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      const payload: any = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        birthDate: form.birthDate || null,
        gender: (form.gender as any) || null,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
      };
      if (form.password && form.password.length >= 6) payload.password = form.password;
      const res = await api.put(`/students/${id}`, payload);
      if (res.data.success) {
        const { student: s, user: u } = res.data.data;
        setStudent({ ...student, ...s });
        if (u) setUserData(u);
        setForm({ ...form, password: '' });
        setEditing(false);
        show('Dados do aluno atualizados!');
      }
    } catch (err: any) {
      show(err.response?.data?.error || 'Erro ao salvar', 'error');
    } finally { setSaving(false); }
  };

  if (fetching) {
    return (
      <MobileShell title="Carregando..." tabs={tabs}
        left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/trainer/students')}><ChevronLeft className="w-6 h-6" /></button>}>
        <EmptyState icon={Clock} title="Carregando aluno..." subtitle="Aguarde um momento" />
      </MobileShell>
    );
  }

  if (!student) {
    return (
      <MobileShell title="Aluno" tabs={tabs}
        left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/trainer/students')}><ChevronLeft className="w-6 h-6" /></button>}>
        <EmptyState icon={Users} title="Aluno não encontrado" subtitle="Volte para a lista de alunos" />
      </MobileShell>
    );
  }

  return (
    <MobileShell title={editing ? 'Editar Aluno' : 'Detalhes do Aluno'} tabs={tabs}
      left={<button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => navigate('/trainer/students')}><ChevronLeft className="w-6 h-6" /></button>}
      right={!editing ? <button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => setEditing(true)}><Edit3 className="w-5 h-5" /></button> : <button className="btn-ghost !py-2 !px-2 !min-h-0" onClick={() => { setEditing(false); setForm(f => ({ ...f, password: '' })) }}><X className="w-5 h-5" /></button>}>
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <div className="card mb-4 !p-6 text-center">
        <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-brand-gradient flex items-center justify-center text-white text-2xl font-black shadow-mobile-lg">
          {student.name.charAt(0)}
        </div>
        <h2 className="text-lg font-black">{student.name}</h2>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <span className={cn('badge', student.isApproved ? 'badge-approved' : 'badge-pending')}>
            {student.isApproved ? 'Aprovado' : 'Pendente'}
          </span>
          <span className="badge font-mono" style={{ backgroundColor: 'var(--color-surface)' }}>
            ID {formatStudentId(student.studentId)}
          </span>
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-4 pb-8">
          <div className="card space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Users className="w-5 h-5 text-brand" /> Dados Pessoais</h3>
          <div>
            <label className="label">Nome completo *</label>
            <input type="text" className="input-field" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })} />
          </div>
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input type="tel" className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data de Nascimento</label>
              <input type="date" className="input-field" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Gênero</label>
              <select className="input-field" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as any })}>
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Altura (cm)</label>
              <input type="number" min="0" step="1" className="input-field" value={form.heightCm} onChange={e => setForm({ ...form, heightCm: e.target.value })} placeholder="Ex: 170" />
            </div>
            <div>
              <label className="label">Nova senha (opcional)</label>
              <input type="text" minLength={6} className="input-field" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="≥ 6 caracteres" />
            </div>
          </div>
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-ghost flex-1" onClick={() => { setEditing(false); setForm(f => ({ ...f, password: '' })) }}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="card mb-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 mb-1"><Users className="w-5 h-5 text-brand" /> Dados do Aluno</h3>
            {student.email && <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>E-mail</span><span className="font-medium truncate">{student.email}</span></div>}
            {student.phone && <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Telefone</span><span className="font-medium">{student.phone}</span></div>}
            {student.birthDate && <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Nascimento</span><span className="font-medium">{formatDate(student.birthDate)}</span></div>}
            {student.gender && <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Gênero</span><span className="font-medium">{student.gender === 'M' ? 'Masculino' : student.gender === 'F' ? 'Feminino' : 'Outro'}</span></div>}
            {student.heightCm && <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Altura</span><span className="font-medium">{student.heightCm} cm</span></div>}
            {userData?.email && userData.email !== student.email && <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Login (e-mail)</span><span className="font-medium truncate">{userData.email}</span></div>}
            <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Cadastro</span><span className="font-medium">{formatDate(student.createdAt)}</span></div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-brand" /> Evolução recente</h3>
              <button className="btn-ghost !py-2 !px-3 !min-h-0 text-sm" onClick={() => show('Funcionalidade em breve', 'info')}><Plus className="w-4 h-4" /> Medida</button>
            </div>
            {progress.length === 0
              ? <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Sem medições registradas ainda.</p>
              : progress.map((p) => (
                <div key={p.id} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{formatDate(p.measuredAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.weightKg && <span className="badge badge-approved">Peso: {p.weightKg}kg</span>}
                    {p.bodyFatPct && <span className="badge" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>BF: {p.bodyFatPct}%</span>}
                    {p.chestCm && <span className="badge" style={{ backgroundColor: '#FCE7F3', color: '#9D174D' }}>Peito: {p.chestCm}cm</span>}
                    {p.waistCm && <span className="badge" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Cintura: {p.waistCm}cm</span>}
                    {p.hipCm && <span className="badge" style={{ backgroundColor: '#F3E8FF', color: '#6B21A8' }}>Quadril: {p.hipCm}cm</span>}
                  </div>
                  {p.notes && <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{p.notes}</p>}
                </div>
              ))}
          </div>

          <div className="card mt-4 !p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-brand" /> Fichas de Treino</h3>
              <button className="btn-ghost !py-2 !px-3 !min-h-0 text-sm" onClick={() => navigate('/trainer/workouts/new')}><Plus className="w-4 h-4" /> Novo</button>
            </div>
            <EmptyState icon={Dumbbell} title="Nenhum treino atribuído" subtitle="Atribua uma ficha de treino para este aluno" />
          </div>
        </>
      )}
    </MobileShell>
  );
}

function PlaceholderPage({ title, icon: Icon, subtitle }: { title: string; icon: any; subtitle: string }) {
  const { user } = useAuthStore();
  const tabs = getTabsForRole(user?.role);
  return (
    <MobileShell title={title} tabs={tabs}>
      <EmptyState icon={Icon} title={title} subtitle={subtitle} />
    </MobileShell>
  );
}

export default function App() {
  const { applyTheme } = useAuthStore();
  useEffect(() => { applyTheme(null); }, [applyTheme]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/t/:slug" element={<TenantPublicRegisterPage />} />

      <Route path="/admin" element={<ProtectedRoute role="MASTER_ADMIN"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/tenants" element={<ProtectedRoute role="MASTER_ADMIN"><AdminTenantsList /></ProtectedRoute>} />
      <Route path="/admin/tenants/new" element={<ProtectedRoute role="MASTER_ADMIN"><AdminTenantsNew /></ProtectedRoute>} />
      <Route path="/admin/tenants/:id" element={<ProtectedRoute role="MASTER_ADMIN"><AdminTenantsNew /></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute role="MASTER_ADMIN"><GenericProfilePage /></ProtectedRoute>} />

      <Route path="/trainer" element={<ProtectedRoute role="TRAINER"><TrainerDashboard /></ProtectedRoute>} />
      <Route path="/trainer/students" element={<ProtectedRoute role="TRAINER"><TrainerStudents /></ProtectedRoute>} />
      <Route path="/trainer/students/:id" element={<ProtectedRoute role="TRAINER"><TrainerStudentDetail /></ProtectedRoute>} />
      <Route path="/trainer/approve" element={<ProtectedRoute role="TRAINER"><TrainerApprovePage /></ProtectedRoute>} />
      <Route path="/trainer/workouts" element={<ProtectedRoute role="TRAINER"><PlaceholderPage title="Fichas de Treino" icon={Dumbbell} subtitle="Gerencie todos os treinos dos seus alunos" /></ProtectedRoute>} />
      <Route path="/trainer/workouts/new" element={<ProtectedRoute role="TRAINER"><PlaceholderPage title="Criar Ficha" icon={Plus} subtitle="Monte um novo treino para um aluno" /></ProtectedRoute>} />
      <Route path="/trainer/profile" element={<ProtectedRoute role="TRAINER"><GenericProfilePage /></ProtectedRoute>} />

      <Route path="/student" element={<ProtectedRoute role="STUDENT"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/workouts" element={<ProtectedRoute role="STUDENT"><StudentWorkoutsList /></ProtectedRoute>} />
      <Route path="/student/workouts/:id" element={<ProtectedRoute role="STUDENT"><StudentWorkoutDetail /></ProtectedRoute>} />
      <Route path="/student/progress" element={<ProtectedRoute role="STUDENT"><StudentProgressPage /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute role="STUDENT"><GenericProfilePage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
