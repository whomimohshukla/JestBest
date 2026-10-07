import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X, TriangleAlert } from 'lucide-react';
import { usePopupStore, type PopupItem, type PopupKind, DEFAULT_DURATIONS } from '../../lib/toast-popup';
import { cn } from '../../utils/cn';

/*
 * Non-blocking corner toast stack (bottom-right). Toasts auto-dismiss with a
 * linear progress bar; hovering freezes both. `loading` toasts persist until
 * the caller resolves them and get an indeterminate shimmer instead of a
 * timer. No backdrop, so the rest of the UI stays usable while a toast is up.
 */

interface KindStyle {
  Icon: typeof CheckCircle2;
  icon: string;
  bar: string;
  border: string;
  label: string;
}

const KIND: Record<PopupKind, KindStyle> = {
  success: {
    Icon: CheckCircle2,
    icon: 'text-emerald-400',
    bar: 'bg-emerald-400/80',
    border: 'border-emerald-500/30',
    label: 'Success',
  },
  error: {
    Icon: XCircle,
    icon: 'text-red-400',
    bar: 'bg-red-400/80',
    border: 'border-red-500/30',
    label: 'Something went wrong',
  },
  warning: {
    Icon: TriangleAlert,
    icon: 'text-amber-400',
    bar: 'bg-amber-400/80',
    border: 'border-amber-500/30',
    label: 'Heads up',
  },
  info: {
    Icon: Info,
    icon: 'text-sky-400',
    bar: 'bg-sky-400/80',
    border: 'border-sky-500/30',
    label: 'Note',
  },
  loading: {
    Icon: CheckCircle2,
    icon: 'text-zinc-300',
    bar: 'bg-zinc-500/50',
    border: 'border-white/10',
    label: 'Working',
  },
};

function ToastCard({ popup, onDismiss }: { popup: PopupItem; onDismiss: (id: string) => void }) {
  const k = KIND[popup.kind] ?? KIND.info;
  const { Icon } = k;
  const dismissible = popup.kind !== 'loading';
  const duration = DEFAULT_DURATIONS[popup.kind];
  const [paused, setPaused] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      onPointerEnter={() => dismissible && setPaused(true)}
      onPointerLeave={() => dismissible && setPaused(false)}
      role={popup.kind === 'error' ? 'alert' : 'status'}
      aria-label={k.label}
      className={cn(
        'pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border bg-zinc-950/95 shadow-xl shadow-black/40 backdrop-blur-xl',
        k.border
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5 shrink-0">
          {popup.kind === 'loading' ? (
            <span aria-hidden="true" className="block h-5 w-5 animate-loader-spin rounded-full border-2 border-current border-t-transparent text-zinc-200" />
          ) : (
            <Icon className={cn('h-5 w-5', k.icon)} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-zinc-100">{popup.message}</p>
        </div>
        {dismissible && (
          <button
            onClick={() => onDismiss(popup.id)}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Linear lifetime bar. Driven entirely by CSS so pausing the animation
          pauses the clock; `animationend` is the actual dismiss trigger. */}
      {dismissible && duration > 0 && (
        <div aria-hidden="true" className="h-0.5 w-full bg-white/[0.04]">
          <div
            className={cn('toast-progress h-full', k.bar)}
            style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
            onAnimationEnd={() => onDismiss(popup.id)}
          />
        </div>
      )}
    </motion.div>
  );
}

export function PopupViewport() {
  const { popups, dismiss } = usePopupStore();

  // Escape clears everything dismissible, matching the previous behaviour.
  useEffect(() => {
    if (popups.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      for (const p of popups) if (p.kind !== 'loading') dismiss(p.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popups, dismiss]);

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-full max-w-sm flex-col gap-2.5"
    >
      <AnimatePresence initial={false}>
        {popups.map((p: PopupItem) => (
          <ToastCard key={p.id} popup={p} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}