import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

const emptyStateVariants = cva('text-muted-foreground', {
  variants: {
    icon: { default: 'h-12 w-12', sm: 'h-8 w-8', lg: 'h-16 w-16' },
  },
  defaultVariants: { icon: 'default' },
});

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  iconSize?: 'default' | 'sm' | 'lg';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconSize,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center',
        className
      )}
    >
      {Icon && (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/50">
          <Icon className={cn(emptyStateVariants({ icon: iconSize }))} />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm max-w-md mx-auto">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

const accentMap: Record<NonNullable<StatCardProps['accent']>, string> = {
  default: 'text-foreground',
  success: 'text-emerald-500',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  info: 'text-sky-400',
};

export function StatCard({ label, value, icon: Icon, hint, accent = 'default', isLoading }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      {isLoading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-secondary/60" />
      ) : (
        <p className={cn('mt-2 text-2xl font-bold tracking-tight', accentMap[accent])}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}