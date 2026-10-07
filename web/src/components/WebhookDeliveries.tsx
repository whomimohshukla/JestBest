import { Spinner } from './ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksApi } from '../api';
import { getErrorMessage } from '../api/client';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { WebhookDelivery } from '../types';

/**
 * Delivery log for one webhook, with the operator escape hatch: a failed or
 * stuck delivery can be replayed against the original payload without
 * re-triggering the event that produced it.
 */
export function WebhookDeliveries({ webhookId }: { webhookId: string }) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId, page],
    queryFn: () => webhooksApi.deliveries(webhookId, { page, pageSize: 10 }),
  });

  const redeliverMutation = useMutation({
    mutationFn: (deliveryId: string) => webhooksApi.redeliver(webhookId, deliveryId),
    onSuccess: () => {
      toast.success('Redelivery queued.');
      // The replay is recorded as a *new* delivery row, so every page of this
      // list is stale, not just the one that was open.
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', webhookId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const items = deliveries?.items ?? [];

  // The API records HTTP outcome (succeededAt/failedAt/nextRetryAt), not a
  // status enum, so delivery state is derived from those timestamps.
  const deliveryStatus = (d: WebhookDelivery) => {
    if (d.succeededAt) return 'Delivered';
    if (d.failedAt && d.nextRetryAt) return 'Retrying';
    if (d.failedAt) return 'Failed';
    return 'Pending';
  };

  const deliveryStatusColor = (d: WebhookDelivery) => {
    const s = deliveryStatus(d);
    if (s === 'Delivered') return 'bg-emerald-500/15 text-emerald-400';
    if (s === 'Failed') return 'bg-red-500/15 text-red-400';
    return 'bg-yellow-500/15 text-yellow-400';
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-sm text-muted-foreground mb-3">Recent deliveries</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-2">Loading deliveries...</p>
      ) : items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Response</th>
                  <th className="py-2 pr-4 font-medium">Attempts</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{d.eventType}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${deliveryStatusColor(d)}`}
                      >
                        {deliveryStatus(d)}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{d.responseStatus ?? '—'}</td>
                    <td className="py-2 pr-4">{d.attempts}</td>
                    <td className="py-2 pr-4">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => redeliverMutation.mutate(d.id)}
                        disabled={redeliverMutation.isPending}
                        aria-label={`Redeliver ${d.eventType} delivery`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {redeliverMutation.isPending &&
                        redeliverMutation.variables === d.id ? (
                          <Spinner size="xs" />
                        ) : (
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        )}
                        Redeliver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(deliveries?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between gap-3 mt-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span>
                Page {deliveries?.page ?? 1} of {deliveries?.totalPages ?? 1} ·{' '}
                {deliveries?.total ?? items.length} deliveries
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(deliveries?.totalPages ?? 1, p + 1))}
                disabled={page >= (deliveries?.totalPages ?? 1)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No deliveries yet.</p>
      )}
    </div>
  );
}
