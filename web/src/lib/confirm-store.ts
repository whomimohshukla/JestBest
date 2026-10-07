import { create } from 'zustand';

export interface ConfirmSpec {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'primary';
}

interface ConfirmState {
  spec: ConfirmSpec | null;
  resolve: ((value: boolean) => void) | null;
  open: (spec: ConfirmSpec, resolve: (value: boolean) => void) => void;
  close: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  spec: null,
  resolve: null,
  open: (spec, resolve) => set({ spec, resolve }),
  close: (result) => {
    const { resolve } = useConfirmStore.getState();
    set({ spec: null, resolve: null });
    // Any previously pending promise (superseded by a newer confirm) resolves
    // as rejected-so-cancelled so a caller awaiting it never hangs forever.
    if (resolve) resolve(result);
  },
}));