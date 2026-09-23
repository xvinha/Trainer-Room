import { create } from 'zustand';
import type { Tenant, User, Student } from '@trainer-room/shared-types';
import api from '../services/api';

export interface AppTenantTheme {
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

interface AuthState {
  token: string | null;
  user: Omit<User, 'passwordHash'> | null;
  tenant: Tenant | null;
  student: Student | null;
  tenantTheme: AppTenantTheme | null;
  loading: boolean;
  error: string | null;
  setAuth: (data: any) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  fetchTenantTheme: (slug: string) => Promise<AppTenantTheme | null>;
  applyTheme: (theme: AppTenantTheme | null) => void;
  clearError: () => void;
}

const LIGHTEN = (hex: string, amount = 0.08): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor(((num >> 16) & 0xFF) + 255 * amount));
  const g = Math.min(255, Math.floor(((num >> 8) & 0xFF) + 255 * amount));
  const b = Math.min(255, Math.floor((num & 0xFF) + 255 * amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

const DARKEN = (hex: string, amount = 0.1): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xFF) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xFF) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xFF) * (1 - amount)));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

const HEX_TO_RGB = (hex: string): string => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return `${r}, ${g}, ${b}`;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('tr_token') : null,
  user: null,
  tenant: null,
  student: null,
  tenantTheme: null,
  loading: false,
  error: null,

  setAuth: (data) => {
    const { token, user, tenant, student } = data;
    if (token) localStorage.setItem('tr_token', token);
    if (user) localStorage.setItem('tr_user', JSON.stringify(user));
    if (tenant) localStorage.setItem('tr_tenant', JSON.stringify(tenant));
    if (student) localStorage.setItem('tr_student', JSON.stringify(student));
    const state: Partial<AuthState> = { user, tenant, student };
    if (token) state.token = token;
    set({ ...state, error: null });
    if (tenant) {
      const theme: AppTenantTheme = {
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        backgroundColor: tenant.backgroundColor,
      };
      set({ tenantTheme: theme });
      get().applyTheme(theme);
    }
  },

  logout: () => {
    localStorage.removeItem('tr_token');
    localStorage.removeItem('tr_user');
    localStorage.removeItem('tr_tenant');
    localStorage.removeItem('tr_student');
    get().applyTheme(null);
    set({ token: null, user: null, tenant: null, student: null, tenantTheme: null, error: null });
  },

  fetchMe: async () => {
    try {
      set({ loading: true });
      const res = await api.get('/auth/me');
      if (res.data.success) {
        get().setAuth(res.data.data);
      }
    } catch (e: any) {
      set({ error: e.response?.data?.error || 'Falha ao carregar perfil' });
    } finally {
      set({ loading: false });
    }
  },

  fetchTenantTheme: async (slug) => {
    try {
      const res = await api.get(`/tenants/slug/${slug}`);
      if (res.data.success) {
        const theme = res.data.data as AppTenantTheme;
        set({ tenantTheme: theme });
        get().applyTheme(theme);
        return theme;
      }
      return null;
    } catch {
      return null;
    }
  },

  applyTheme: (theme) => {
    const root = document.documentElement;
    if (!theme) {
      root.style.setProperty('--color-primary', '#6366F1');
      root.style.setProperty('--color-primary-rgb', HEX_TO_RGB('#6366F1'));
      root.style.setProperty('--color-primary-hover', '#4F46E5');
      root.style.setProperty('--color-secondary', '#8B5CF6');
      root.style.setProperty('--color-secondary-rgb', HEX_TO_RGB('#8B5CF6'));
      root.style.setProperty('--color-accent', '#EC4899');
      root.style.setProperty('--color-accent-rgb', HEX_TO_RGB('#EC4899'));
      root.style.setProperty('--color-bg', '#FFFFFF');
      root.style.setProperty('--color-surface', '#F8FAFC');
      root.style.setProperty('--color-border', '#E2E8F0');
      root.style.setProperty('--color-text', '#0F172A');
      root.style.setProperty('--color-text-muted', '#64748B');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#6366F1');
      document.title = 'Trainer Room';
      return;
    }
    root.style.setProperty('--color-primary', theme.primaryColor);
    root.style.setProperty('--color-primary-rgb', HEX_TO_RGB(theme.primaryColor));
    root.style.setProperty('--color-primary-hover', DARKEN(theme.primaryColor, 0.1));
    root.style.setProperty('--color-secondary', theme.secondaryColor);
    root.style.setProperty('--color-secondary-rgb', HEX_TO_RGB(theme.secondaryColor));
    root.style.setProperty('--color-accent', theme.accentColor);
    root.style.setProperty('--color-accent-rgb', HEX_TO_RGB(theme.accentColor));
    root.style.setProperty('--color-bg', theme.backgroundColor);
    root.style.setProperty('--color-surface', LIGHTEN(theme.backgroundColor, 0.02));
    root.style.setProperty('--color-border', LIGHTEN(theme.backgroundColor, 0.06));
    root.style.setProperty('--color-text', '#0F172A');
    root.style.setProperty('--color-text-muted', '#64748B');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.primaryColor);
    document.title = theme.name;
  },

  clearError: () => set({ error: null }),
}));
