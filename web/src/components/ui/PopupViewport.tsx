
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
import { usePopupStore, type PopupItem } from '../../lib/toast-popup';

const KIND_ICON: Record<string, { Icon: typeof CheckCircle2; cls: string }> = {
  success: { Icon: CheckCircle2, cls: 'text-red-400' },
  error: { Icon: XCircle, cls: 'text-red-500' },
  info: { Icon: Info, cls: 'text-red-400' },
  loading: { Icon: Loader2, cls: 'text-zinc-300' },
};

export function PopupViewport() {
  const { popups, dismiss } = usePopupStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[120] flex flex-col items-center gap-3 px-4">
      <AnimatePresence>
        {popups.map((p: PopupItem) => {
          const { Icon, cls } = KIND_ICON[p.kind] ?? KIND_ICON.info;
          return (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: -18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.95 }}
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-white/15 bg-black/95 px-4 py-3 shadow-2xl shadow-red-900/20 backdrop-blur-xl">
              {p.kind === 'loading'
                ? <Loader2 className={`mt-0.5 h-5 w-5 shrink-0 animate-spin ${cls}`} />
                : <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} />}
              <p className="flex-1 text-sm font-medium text-white">{p.message}</p>
              <button onClick={() => dismiss(p.id)} className="text-zinc-500 transition-colors hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
