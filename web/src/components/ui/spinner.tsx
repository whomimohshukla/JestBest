import { cn } from '../../utils/cn';

/**
 * Single loading primitive for the whole app. Renders a crisp arc spinner in
 * the current text color, sized by `size` (or overridden per-instance with
 * `className`). Keep every other loading element (Loaders in buttons, page
 * shells, inline rows) pointing back to this so the motion stays consistent.
 */

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-[1.5px]',
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-4',
};

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <span role="status" aria-label={label ?? 'Loading'} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block animate-loader-spin rounded-full border-current border-t-transparent text-red-500',
          SIZES[size],
          className
        )}
      />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
      <Spinner size="lg" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

export function ButtonLoader({ className }: { className?: string }) {
  return <Spinner size="sm" className={className} aria-label="Working" />;
}