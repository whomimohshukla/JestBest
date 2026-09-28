/**
 * Drop-in replacement for `react-hot-toast`, aliased in vite/tsconfig so every
 * existing `import toast from 'react-hot-toast'` renders as a large centred
 * dialog instead of a small corner toast. See PopupViewport.
 *
 * The API surface mirrors react-hot-toast (success/error/info/loading plus
 * dismiss/dismissAll) so no call site needs changing.
 */
import toastLib from './toast-popup';

export interface ToastOptions {
  id?: string;
  duration?: number;
}

type Emitter = (message: string, options?: ToastOptions) => string;

export interface ToastApi extends Record<string, unknown> {
  (message: string, options?: ToastOptions): string;
  success: Emitter;
  error: Emitter;
  warning: Emitter;
  info: Emitter;
  loading: Emitter;
  custom: Emitter;
  promise: <T>(
    promise: Promise<T>,
    messages: { loading?: string; success?: string; error?: string }
  ) => Promise<T>;
  /** With no id, clears every open popup, matching react-hot-toast. */
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}

const emitters = {
  success: toastLib.success as Emitter,
  error: toastLib.error as Emitter,
  warning: toastLib.warning as Emitter,
  info: toastLib.info as Emitter,
  loading: toastLib.loading as Emitter,
  custom: toastLib.info as Emitter,
  promise: async <T>(
    promise: Promise<T>,
    messages: { loading?: string; success?: string; error?: string }
  ): Promise<T> => {
    const id = messages.loading ? toastLib.loading(messages.loading) : null;
    try {
      const result = await promise;
      if (id) toastLib.dismiss(id);
      if (messages.success) toastLib.success(messages.success);
      return result;
    } catch (error) {
      if (id) toastLib.dismiss(id);
      toastLib.error(messages.error ?? (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  },
  dismiss: (id?: string) => (id ? toastLib.dismiss(id) : toastLib.dismissAll()),
  dismissAll: () => toastLib.dismissAll(),
} as ToastApi;

// react-hot-toast's default export is callable, and two call sites rely on it.
const callable = ((message: string, options?: ToastOptions) =>
  toastLib.info(message, options)) as ToastApi;

export const toast = Object.assign(callable, emitters);
export default toast;
export const Toaster = () => null;
