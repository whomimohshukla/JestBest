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

const AUTH_STORAGE_KEYS = ['accessToken', 'refreshToken', 'user', 'auth-storage'] as const;

/**
 * The one place a session is torn down.
 *
 * The API client used to keep its own `clearTokens` that only removed the two
 * token keys, leaving this store's persisted record behind — so after a
 * refresh failure the router still believed the user was signed in, bounced
 * them off the login page and back into an app whose every request 401'd.
 */
export const clearAuthSession = () => {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
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
        clearAuthSession();
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
      // The persisted `isAuthenticated` flag is not evidence of a session: the
      // 401 path clears the tokens before it can clear this record, so trusting
      // the flag on rehydrate traps the user in a signed-in UI with no
      // credentials. A live access token is the only thing that counts.
      merge: (persisted, current) => {
        const accessToken = localStorage.getItem('accessToken');
        const merged = { ...current, ...(persisted as Partial<AuthState> | undefined) };
        if (!accessToken) {
          return { ...current, user: null, organization: null, token: null, isAuthenticated: false };
        }
        return { ...merged, token: accessToken, isAuthenticated: true };
      },
    }
  )
);

export const useAuth = () => useAuthStore((state) => state);
