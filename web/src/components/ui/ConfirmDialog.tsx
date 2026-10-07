import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { useConfirmStore } from '../../lib/confirm-store';
import { cn } from '../../utils/cn';

/**
 * Reusable confirmation modal (component). Hook is at `@/hooks/useConfirm`.
 */
export function ConfirmDialog() {
  const { spec, close } = useConfirmStore();

  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, close]);

  const destructive = spec?.tone !== 'primary';

  return (
    <AnimatePresence>
      {spec && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-zinc-950/95 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  destructive ? 'bg-red-500/10 text-red-400' : 'bg-red-600/10 text-red-500'
                )}
              >
                <TriangleAlert className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-lg font-semibold text-zinc-50">
                  {spec.title}
                </h2>
                <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {spec.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-border bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {spec.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                  destructive
                    ? 'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400'
                    : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus-visible:ring-zinc-300'
                )}
              >
                {spec.confirmLabel ?? (destructive ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}