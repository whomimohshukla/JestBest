import { useEffect } from 'react';
import { useBackendStore } from '../../lib/backend';
import { WifiOff, RotateCw } from 'lucide-react';

export function OfflineBanner() {
  const status = useBackendStore((s) => s.status);

  useEffect(() => {
    if (status !== 'offline') return;
    void useBackendStore.getState().check();
    const interval = window.setInterval(() => {
      void useBackendStore.getState().check();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [status]);

  if (status !== 'offline') return null;

  return (
    <div className="sticky top-16 z-40 border-b border-red-500/30 bg-red-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-sm text-red-200">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="font-medium">Cannot reach the server.</span>
        <span className="hidden sm:inline text-red-300/80">Your changes may not be saved. Check that the backend is running.</span>
        <button
          onClick={() => void useBackendStore.getState().check()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-500/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-red-100 transition-colors hover:bg-red-500/20"
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    </div>
  );
}

export default OfflineBanner;