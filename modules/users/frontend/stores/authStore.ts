import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      initialize: () => {
        const { token, user } = get();
        if (token && user) {
          // Sync token to localStorage for HTTP client compatibility
          localStorage.setItem('crm-auth-token', token);
          set({ isAuthenticated: true, isLoading: false });
        } else {
          set({ isAuthenticated: false, isLoading: false });
        }
      },

      login: async (email: string, password: string) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Login failed' }));
          throw new Error(err.message || 'Login failed');
        }
        const data = await res.json();
        
        // Store token in localStorage for HTTP client compatibility
        if (data.token) {
          localStorage.setItem('crm-auth-token', data.token);
        }
        
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        localStorage.removeItem('crm-auth-token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'crm-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
