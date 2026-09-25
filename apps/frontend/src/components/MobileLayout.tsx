import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Settings,
  Home,
  ClipboardList,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../utils';

type TabItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const TRAINER_TABS: TabItem[] = [
  { to: '/trainer', label: 'Início', icon: Home },
  { to: '/trainer/students', label: 'Alunos', icon: Users },
  { to: '/trainer/workouts', label: 'Treinos', icon: Dumbbell },
  { to: '/trainer/profile', label: 'Perfil', icon: User },
];

const STUDENT_TABS: TabItem[] = [
  { to: '/student', label: 'Início', icon: Home },
  { to: '/student/workouts', label: 'Treinos', icon: ClipboardList },
  { to: '/student/progress', label: 'Evolução', icon: TrendingUp },
  { to: '/student/profile', label: 'Perfil', icon: User },
];

const ADMIN_TABS: TabItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/tenants', label: 'Clientes', icon: Users },
  { to: '/admin/tenants/new', label: 'Novo', icon: Settings },
  { to: '/admin/profile', label: 'Perfil', icon: User },
];

export function getTabsForRole(role?: string): TabItem[] {
  switch (role) {
    case 'MASTER_ADMIN': return ADMIN_TABS;
    case 'TRAINER': return TRAINER_TABS;
    case 'STUDENT': return STUDENT_TABS;
    default: return [];
  }
}

export function TopBar({ title, right, left }: { title: string; right?: ReactNode; left?: ReactNode }) {
  return (
    <header className="top-bar">
      <div className="flex items-center gap-2 w-1/4 justify-start min-h-[32px]">
        {left}
      </div>
      <h1 className="text-base font-bold truncate px-2">{title}</h1>
      <div className="flex items-center gap-2 w-1/4 justify-end min-h-[32px]">
        {right}
      </div>
    </header>
  );
}

export function BottomTabBar({ tabs }: { tabs: TabItem[] }) {
  return (
    <nav className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to.split('/').length <= 2}
          className={({ isActive }) => cn('tab-item', isActive && 'active')}
        >
          <tab.icon className="tab-icon" strokeWidth={2.2} />
          <span className="tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function MobileShell({
  title,
  right,
  left,
  tabs,
  children,
}: {
  title: string;
  right?: ReactNode;
  left?: ReactNode;
  tabs?: TabItem[];
  children: ReactNode;
}) {
  return (
    <div className="page-container relative flex flex-col min-h-screen-safe">
      <TopBar title={title} right={right} left={left} />
      <main className="flex-1 scroll-area px-4 pt-4">
        {children}
      </main>
      {tabs && <BottomTabBar tabs={tabs} />}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
        <Icon className="w-10 h-10" style={{ color: 'var(--color-primary)' }} strokeWidth={1.8} />
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {subtitle && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

export function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' | 'info' | 'warning' }) {
  const bg = type === 'success' ? '#16A34A' : type === 'error' ? '#DC2626' : type === 'warning' ? '#D97706' : '#0369A1';
  return (
    <div className="fixed top-safe-top left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-mobile-lg text-white font-semibold text-sm animate-in slide-in-from-top"
      style={{ backgroundColor: bg, marginTop: '1rem' }}>
      {message}
    </div>
  );
}
