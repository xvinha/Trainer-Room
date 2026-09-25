import { create } from 'zustand';
import type { Tenant, User, Student } from '@trainer-room/shared-types';
import api from '../services/api';

export interface AppTenantTheme {
  slug: string;
  name: string;
  logoUrl: string | null;
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
  clearError: () => void;
}

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
    if (tenant) {
      state.tenantTheme = {
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
      };
    }
    set({ ...state, error: null });
    if (tenant && typeof document !== 'undefined') {
      document.title = tenant.name;
    }
  },

  logout: () => {
    localStorage.removeItem('tr_token');
    localStorage.removeItem('tr_user');
    localStorage.removeItem('tr_tenant');
    localStorage.removeItem('tr_student');
    if (typeof document !== 'undefined') {
      document.title = 'Trainer Room';
    }
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
        const raw = res.data.data as any;
        const theme: AppTenantTheme = {
          slug: raw.slug,
          name: raw.name,
          logoUrl: raw.logoUrl,
        };
        set({ tenantTheme: theme });
        return theme;
      }
      return null;
    } catch {
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
