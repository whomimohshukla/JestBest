import { create } from 'zustand';

export const DEFAULT_API_URL = 'http://localhost:4000';

export function envApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && raw.trim()) return raw.trim();
  return DEFAULT_API_URL;
}

export function portFrom(url: string): string {
  try {
    const u = new URL(url);
    return u.port || (u.protocol === 'https:' ? '443' : '80');
  } catch {
    return '4000';
  }
}

export function hostFrom(url: string): string {
  try { return new URL(url).hostname; } catch { return 'localhost'; }
}

export type BackendStatus = 'connecting' | 'online' | 'offline';

interface BackendState {
  status: BackendStatus;
  checkedAt: number | null;
  check: () => Promise<void>;
}

let inflight: Promise<void> | null = null;

async function probe(url: string, timeoutMs = 3500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const origin = (() => {
      try { return new URL(url).origin; } catch { return DEFAULT_API_URL; }
    })();
    const candidates = [`${origin}/api/v1/health`, origin];
    for (const c of candidates) {
      try {
        const r = await fetch(c, { signal: ctrl.signal });
        if (r.ok) { clearTimeout(t); return true; }
      } catch { /* try next */ }
    }
    clearTimeout(t);
    return false;
  } catch {
    return false;
  }
}

export const useBackendStore = create<BackendState>((set) => ({
  status: 'connecting',
  checkedAt: null,
  check: async () => {
    if (inflight) return inflight;
    set({ status: 'connecting' });
    inflight = (async () => {
      const ok = await probe(envApiUrl());
      set({ status: ok ? 'online' : 'offline', checkedAt: Date.now() });
    })();
    try { await inflight; } finally { inflight = null; }
  },
}));
