import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ErrorStateKind = 'network' | 'server' | 'auth' | 'generic';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  kind?: ErrorStateKind;
  className?: string;
  compact?: boolean;
}

const KIND_CONFIG: Record<ErrorStateKind, { icon: typeof AlertTriangle; iconCls: string; ring: string; defaultTitle: string; defaultDescription: string }> = {
  network: {
    icon: WifiOff,
    iconCls: 'text-amber-500',
    ring: 'border-amber-500/30 bg-amber-500/5',
    defaultTitle: 'Connection lost',
    defaultDescription: 'We could not reach the server. Check that the backend is running and try again.',
  },
  server: {
    icon: ServerCrash,
    iconCls: 'text-red-500',
    ring: 'border-red-500/30 bg-red-500/5',
    defaultTitle: 'Server error',
    defaultDescription: 'Something went wrong on our side. Please try again in a moment.',
  },
  auth: {
    icon: ShieldAlert,
    iconCls: 'text-red-500',
    ring: 'border-red-500/30 bg-red-500/5',
    defaultTitle: 'Authentication required',
    defaultDescription: 'Your session may have expired. Please sign in again.',
  },
  generic: {
    icon: AlertTriangle,
    iconCls: 'text-amber-500',
    ring: 'border-amber-500/30 bg-amber-500/5',
    defaultTitle: 'Something went wrong',
    defaultDescription: 'An unexpected error occurred. Please try again.',
  },
};

export function ErrorState({
  title,
  description,
  onRetry,
  isRetrying,
  kind = 'generic',
  className,
  compact,
}: ErrorStateProps) {
  const config = KIND_CONFIG[kind];
  const Icon = config.icon;
  const resolvedTitle = title ?? config.defaultTitle;
  const resolvedDescription = description ?? config.defaultDescription;

  if (compact && !onRetry) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-red-500',
          config.ring,
          className
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{resolvedTitle}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center',
        className
      )}
    >
      <div className={cn('flex h-16 w-16 items-center justify-center rounded-full border', config.ring)}>
        <Icon className={cn('h-8 w-8', config.iconCls)} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">{resolvedTitle}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{resolvedDescription}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
          {isRetrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}

export default ErrorState;