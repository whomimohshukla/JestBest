import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X, TriangleAlert } from 'lucide-react';
import { usePopupStore, type PopupItem, type PopupKind } from '../../lib/toast-popup';

interface KindStyle {
  Icon: typeof CheckCircle2;
  icon: string;
  glow: string;
  ring: string;
  accent: string;
  action: string;
  label: string;
}

const KIND: Record<PopupKind, KindStyle> = {
  success: {
    Icon: CheckCircle2,
    icon: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    ring: 'from-emerald-500/25',
    accent: 'border-emerald-500/40',
    action: 'bg-emerald-600 hover:bg-emerald-500',
    label: 'Success',
  },
  error: {
    Icon: XCircle,
    icon: 'text-red-400',
    glow: 'shadow-red-500/10',
    ring: 'from-red-500/25',
    accent: 'border-red-500/40',
    action: 'bg-red-600 hover:bg-red-500',
    label: 'Something went wrong',
  },
  warning: {
    Icon: TriangleAlert,
    icon: 'text-amber-400',
    glow: 'shadow-amber-500/10',
    ring: 'from-amber-500/25',
    accent: 'border-amber-500/40',
    action: 'bg-amber-600 hover:bg-amber-500',
    label: 'Heads up',
  },
  info: {
    Icon: Info,
    icon: 'text-sky-400',
    glow: 'shadow-sky-500/10',
    ring: 'from-sky-500/25',
    accent: 'border-sky-500/40',
    action: 'bg-sky-600 hover:bg-sky-500',
    label: 'Note',
  },
  loading: {
    Icon: CheckCircle2,
    icon: 'text-zinc-300',
    glow: 'shadow-white/5',
    ring: 'from-white/10',
    accent: 'border-white/15',
    action: 'bg-zinc-700 hover:bg-zinc-600',
    label: 'Working',
  },
};

export function PopupViewport() {
  const { popups, dismiss } = usePopupStore();

  // Escape clears everything dismissible, matching the backdrop-click behaviour.
  useEffect(() => {
    if (popups.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      for (const p of popups) if (p.kind !== 'loading') dismiss(p.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popups, dismiss]);

  if (popups.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        // Backdrop click clears everything that is dismissible. `loading` has no
        // close affordance, so a blocking spinner must not be click-dismissed.
        if (e.target !== e.currentTarget) return;
        for (const p of popups) if (p.kind !== 'loading') dismiss(p.id);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="pointer-events-none flex max-h-[85vh] w-full max-w-md flex-col items-center gap-4 overflow-y-auto p-6"
      >
        <AnimatePresence initial={false}>
          {popups.map((p: PopupItem) => {
            const k = KIND[p.kind] ?? KIND.info;
            const { Icon } = k;
            const dismissible = p.kind !== 'loading';
            const spin = p.kind === 'loading';

            return (
              <motion.div
                key={p.id}
                layout
                role={dismissible ? 'alertdialog' : 'status'}
                aria-label={k.label}
                initial={{ opacity: 0, scale: 0.94, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`pointer-events-auto relative w-full shrink-0 overflow-hidden rounded-2xl border ${k.accent} bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-xl ${k.glow}`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r ${k.ring} to-transparent`}
                  aria-hidden="true"
                />

                <div className="flex items-start gap-4 px-7 pt-7">
                  <div className="shrink-0 rounded-xl bg-white/[0.04] p-2.5">
                    {spin ? (
                      <svg
                        className={`h-6 w-6 animate-spin ${k.icon}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-20"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="opacity-90"
                          fill="currentColor"
                          d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
                        />
                      </svg>
                    ) : (
                      <Icon className={`h-6 w-6 ${k.icon}`} aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {k.label}
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-zinc-100">
                      {p.message}
                    </p>
                  </div>

                  {dismissible && (
                    <button
                      onClick={() => dismiss(p.id)}
                      aria-label="Dismiss notification"
                      className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {dismissible && (
                  <div className="px-7 pb-7 pt-5">
                    <button
                      onClick={() => dismiss(p.id)}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${k.action} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
