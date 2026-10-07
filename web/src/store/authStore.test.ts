import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore, clearAuthSession } from './authStore';

const persistState = (state: Record<string, unknown>) => {
  localStorage.setItem('auth-storage', JSON.stringify({ state, version: 0 }));
};

const storedUser = { id: 'user_1', email: 'qa@example.com', name: 'QA' };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, organization: null, token: null, isAuthenticated: false });
});

describe('session rehydration', () => {
  it('does not resurrect a signed-in UI when the access token is gone', async () => {
    // This is exactly what the 401 path leaves behind: a cleared token but a
    // persisted record that still says authenticated. Rehydrating that flag
    // bounced the user off the login page and back into an app whose every
    // request failed with 401.
    persistState({ user: storedUser, organization: null, token: 'stale', isAuthenticated: true });

    await useAuthStore.persist.rehydrate();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('restores the session when the access token is still present', async () => {
    localStorage.setItem('accessToken', 'live-token');
    persistState({ user: storedUser, organization: null, token: 'live-token', isAuthenticated: true });

    await useAuthStore.persist.rehydrate();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('live-token');
    expect(useAuthStore.getState().user).toEqual(storedUser);
  });

  it('ignores a persisted authenticated flag that disagrees with the token', async () => {
    localStorage.setItem('accessToken', 'live-token');
    persistState({ user: storedUser, organization: null, token: null, isAuthenticated: false });

    await useAuthStore.persist.rehydrate();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('live-token');
  });
});

describe('clearAuthSession', () => {
  it('removes every credential and record the client keeps', () => {
    localStorage.setItem('accessToken', 'a');
    localStorage.setItem('refreshToken', 'r');
    localStorage.setItem('user', 'u');
    persistState({ user: storedUser, isAuthenticated: true, token: 'a' });

    clearAuthSession();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('auth-storage')).toBeNull();
  });
});
