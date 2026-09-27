import type { LucideIcon } from 'lucide-react';
import { Badge } from './badge';

export const RunStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'secondary' }> = {
    PASSED: { label: 'Passed', variant: 'success' },
    FAILED: { label: 'Failed', variant: 'destructive' },
    RUNNING: { label: 'Running', variant: 'info' },
    PENDING: { label: 'Pending', variant: 'secondary' },
    CANCELLED: { label: 'Cancelled', variant: 'secondary' },
    QUEUED: { label: 'Queued', variant: 'secondary' },
    ERRORED: { label: 'Errored', variant: 'warning' },
  };
  const config = map[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const BugStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'secondary' }> = {
    OPEN: { label: 'Open', variant: 'destructive' },
    IN_PROGRESS: { label: 'In Progress', variant: 'info' },
    FIXED: { label: 'Fixed', variant: 'success' },
    VERIFIED: { label: 'Verified', variant: 'success' },
    CLOSED: { label: 'Closed', variant: 'secondary' },
    WONT_FIX: { label: "Won't Fix", variant: 'secondary' },
  };
  const config = map[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const SeverityBadge = ({ severity }: { severity: string }) => {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    CRITICAL: { label: 'Critical', variant: 'destructive' },
    HIGH: { label: 'High', variant: 'warning' },
    MEDIUM: { label: 'Medium', variant: 'secondary' },
    LOW: { label: 'Low', variant: 'success' },
  };
  const config = map[severity] ?? { label: severity, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
    P0: { label: 'P0', variant: 'destructive' },
    P1: { label: 'P1', variant: 'warning' },
    P2: { label: 'P2', variant: 'secondary' },
    P3: { label: 'P3', variant: 'success' },
    high: { label: 'High', variant: 'destructive' },
    medium: { label: 'Medium', variant: 'warning' },
    low: { label: 'Low', variant: 'secondary' },
  };
  const config = map[priority] ?? { label: priority, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

interface InfoRowProps {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
}

export function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        <span>{label}</span>
      </div>
      <div className="text-sm text-right font-medium text-foreground">{value}</div>
    </div>
  );
}