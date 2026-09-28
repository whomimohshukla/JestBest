
import { create } from 'zustand';

export type PopupKind = 'success' | 'error' | 'warning' | 'info' | 'loading';
export interface PopupItem { id: string; kind: PopupKind; message: string; }

interface PopupState {
  popups: PopupItem[];
  push: (kind: PopupKind, message: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}
let seq = 0;
export const usePopupStore = create<PopupState>((set) => ({
  popups: [],
  push: (kind, message) => { const id = `pop-${++seq}-${Date.now()}`; set((s) => ({ popups: [...s.popups, { id, kind, message }] })); return id; },
  dismiss: (id) => set((s) => ({ popups: s.popups.filter((p) => p.id !== id) })),
  clear: () => set({ popups: [] }),
}));

interface ToastOpts { id?: string; duration?: number; }

/*
 * Popups render as centred dialogs that are dismissed deliberately, so they no
 * longer auto-close. `loading` is the exception: it stays until the caller
 * dismisses it or emits a terminal kind.
 */
function emit(kind: PopupKind, message: string, opts?: ToastOpts): string {
  const id = usePopupStore.getState().push(kind, message);
  const d = opts?.duration ?? 0;
  if (d > 0) setTimeout(() => usePopupStore.getState().dismiss(id), d);
  return id;
}

export const toast = {
  success: (m: string, o?: ToastOpts) => emit('success', m, o),
  error: (m: string, o?: ToastOpts) => emit('error', m, o),
  warning: (m: string, o?: ToastOpts) => emit('warning', m, o),
  info: (m: string, o?: ToastOpts) => emit('info', m, o),
  loading: (m: string, o?: ToastOpts) => emit('loading', m, o),
  dismiss: (id: string) => usePopupStore.getState().dismiss(id),
  dismissAll: () => usePopupStore.getState().clear(),
};
export default toast;
