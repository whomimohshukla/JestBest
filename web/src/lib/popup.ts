import { create } from 'zustand';

export type PopupKind = 'success' | 'error' | 'info' | 'loading';
export interface Popup {
  id: string;
  kind: PopupKind;
  message: string;
}

interface PopupState {
  popups: Popup[];
  push: (kind: PopupKind, message: string) => string;
  dismiss: (id: string) => void;
}

let seq = 0;
export const popupChannel = 'jestbest-popup';

export const usePopupStore = create<PopupState>((set) => ({
  popups: [],
  push: (kind, message) => {
    const id = `pop-${Date.now()}-${seq++}`;
    set((s) => ({ popups: [...s.popups, { id, kind, message }] }));
    window.dispatchEvent(new CustomEvent(popupChannel, { detail: { id, kind, message } }));
    return id;
  },
  dismiss: (id) => set((s) => ({ popups: s.popups.filter((p) => p.id !== id) })),
}));

/** Drop-in replacement for the `toast` object (react-hot-toast surface). */
export const toastCompat = {
  success: (m: string) => usePopupStore.getState().push('success', m),
  error: (m: string) => usePopupStore.getState().push('error', m),
  info: (m: string) => usePopupStore.getState().push('info', m),
  loading: (m: string) => usePopupStore.getState().push('loading', m),
  dismiss: (id?: string) => usePopupStore.getState().dismiss(id || ''),
};
