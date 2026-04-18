import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminAuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      initialize: () => {
        const { token, user } = get();
        if (token && user) {
          set({ isAuthenticated: true, isLoading: false });
        } else {
          set({ isAuthenticated: false, isLoading: false });
        }
      },

      login: async (email: string, password: string) => {
        const res = await fetch(`${API_BASE}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Login failed' }));
          throw new Error(err.message || 'Login failed');
        }
        const data = await res.json();
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'crm-admin-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
