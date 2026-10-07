import { cn } from '../../utils/cn';

/**
 * Skeleton placeholder with a shimmer sweep (see .animate-shimmer in
 * index.css). `variant="shimmer"` is the default; `variant="pulse"` keeps the
 * calmer pulse for long-lived content regions.
 */
function Skeleton({
  className,
  variant = 'shimmer',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'shimmer' | 'pulse' }) {
  return (
    <div
      className={cn(
        'rounded-md',
        variant === 'shimmer' ? 'animate-shimmer' : 'animate-pulse bg-secondary/60',
        className
      )}
      {...props}
    />
  );
}

/** A stacked set of shimmering lines, sized for card bodies and tables. */
export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** A card-shaped skeleton with a title bar and a few body lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border/60 bg-card/50 p-5', className)} aria-hidden="true">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <SkeletonRows rows={3} />
    </div>
  );
}

export { Skeleton };