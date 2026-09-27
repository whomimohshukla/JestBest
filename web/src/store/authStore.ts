import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization, TokenPair } from '../types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (result: { user: User; organization?: Organization | null; tokens: TokenPair }) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  updateOrganization: (organization: Organization) => void;
}

const clearStorage = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('auth-storage');
};

const restoreUser = (): User | null => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user ?? null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: restoreUser(),
      organization: null,
      token: localStorage.getItem('accessToken'),
      isAuthenticated: Boolean(localStorage.getItem('accessToken')),

      setAuth: ({ user, organization, tokens }) => {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        set({ user, organization: organization ?? null, token: tokens.accessToken, isAuthenticated: true });
      },

      logout: () => {
        clearStorage();
        set({ user: null, organization: null, token: null, isAuthenticated: false });
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      updateOrganization: (organization) => set({ organization }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        const accessToken = localStorage.getItem('accessToken');
        if (state && accessToken) {
          state.isAuthenticated = true;
          state.token = accessToken;
        }
      },
    }
  )
);

export const useAuth = () => useAuthStore((state) => state);