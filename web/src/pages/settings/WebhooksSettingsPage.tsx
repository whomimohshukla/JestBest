import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksApi } from '../../api';
import { getErrorMessage } from '../../api/client';
import { PageLoader, Badge } from '../../components/ui';
import { ChevronDown, Loader2, Plus, RefreshCw, Trash2, Webhook as WebhookIcon, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Webhook, WebhookDelivery } from '../../types';

const EVENT_OPTIONS = ['test_run.completed', 'test_run.failed', 'bug.created', 'bug.status_changed'];

function WebhookDeliveries({ webhookId }: { webhookId: string }) {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => webhooksApi.deliveries(webhookId),
  });

  const statusColor = (status: WebhookDelivery['status']) => {
    if (status === 'SUCCESS') return 'bg-emerald-500/15 text-emerald-400';
    if (status === 'FAILED') return 'bg-red-500/15 text-red-400';
    return 'bg-yellow-500/15 text-yellow-400';
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-sm text-muted-foreground mb-3">Recent deliveries</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-2">Loading deliveries...</p>
      ) : deliveries && deliveries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Response</th>
                <th className="py-2 pr-4 font-medium">Attempts</th>
                <th className="py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs">{d.event}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(d.status)}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{d.responseCode ?? '—'}</td>
                  <td className="py-2 pr-4">{d.attempts}</td>
                  <td className="py-2">{new Date(d.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No deliveries yet.</p>
      )}
    </div>
  );
}

export default function WebhooksSettingsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ url: '', secret: '', events: [] as string[] });

  const { data: webhooks, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => webhooksApi.list(),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { url: string; events: string[]; secret: string }) => webhooksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook created successfully!');
      setShowModal(false);
      setForm({ url: '', secret: '', events: [] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (webhook: Webhook) =>
      webhooksApi.update(webhook.id, { isActive: !webhook.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.triggerTest(id),
    onSuccess: () => {
      toast.success('Test event sent!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter((e) => e !== event)
        : [...f.events, event],
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) {
      toast.error('Webhook URL is required');
      return;
    }
    if (form.events.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    createWebhookMutation.mutate(form);
  };

  const handleDelete = (webhook: Webhook) => {
    if (window.confirm(`Delete webhook ${webhook.url}?`)) {
      deleteWebhookMutation.mutate(webhook.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">Webhooks</h2>
          <p className="text-sm text-muted-foreground">Forward events to your own endpoints</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-600/90 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Webhook
        </button>
      </div>

      {isLoading && <PageLoader label="Loading webhooks..." />}

      {!isLoading && isError && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-red-500 font-medium mb-4">Failed to load webhooks.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (!webhooks || webhooks.length === 0) && (
        <div className="glass p-12 rounded-xl text-center">
          <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <WebhookIcon className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No webhooks yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create a webhook to get notified when events happen in your workspace.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Webhook
          </button>
        </div>
      )}

      {!isLoading && !isError && webhooks && webhooks.length > 0 && (
        <div className="space-y-4">
          {webhooks.map((webhook, index) => (
            <motion.div
              key={webhook.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass p-4 rounded-xl"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-mono text-sm truncate">{webhook.url}</p>
                    {webhook.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Paused</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleActiveMutation.mutate(webhook)}
                    disabled={toggleActiveMutation.isPending}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      webhook.isActive
                        ? 'bg-secondary hover:bg-secondary/80'
                        : 'bg-red-600 hover:bg-red-600/90 text-white'
                    }`}
                  >
                    {webhook.isActive ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => testWebhookMutation.mutate(webhook.id)}
                    disabled={testWebhookMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium"
                  >
                    <Zap className="w-4 h-4" />
                    Test
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === webhook.id ? null : webhook.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium ${
                      expandedId === webhook.id ? 'text-red-500' : ''
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${expandedId === webhook.id ? 'rotate-180' : ''}`}
                    />
                    Deliveries
                  </button>
                  <button
                    onClick={() => handleDelete(webhook)}
                    disabled={deleteWebhookMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === webhook.id && <WebhookDeliveries webhookId={webhook.id} />}
            </motion.div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass p-8 rounded-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Create Webhook</h2>
            <p className="text-muted-foreground text-sm mb-6">Choose which events to forward</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="https://example.com/hooks/jestbest"
                  disabled={createWebhookMutation.isPending}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Secret</label>
                <input
                  type="password"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Optional signing secret"
                  disabled={createWebhookMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Events</label>
                <div className="space-y-2">
                  {EVENT_OPTIONS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-3 px-3 py-2 bg-secondary/30 border border-border rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-mono">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                  disabled={createWebhookMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWebhookMutation.isPending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-600/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createWebhookMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Webhook'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}