import { useCallback } from 'react';
import { useConfirmStore, type ConfirmSpec } from '../lib/confirm-store';

/**
 * Promise-based confirm dialog hook: `const ok = await confirm({ title, message })`.
 */
export function useConfirm() {
  return useCallback((spec: ConfirmSpec) => {
    return new Promise<boolean>((resolve) => {
      useConfirmStore.getState().open(spec, resolve);
    });
  }, []);
}
