import { apiGet, apiPost, apiPatch, apiDelete, apiPaginated } from './client';
import type { AgentRun, Integration, Webhook, WebhookDelivery, ApiKey, Billing, BillingUsage, User } from '../types';

export const usersApi = {
  me: () =>
    apiGet<
      User & {
        notificationPreferences?: { channels?: string[]; events?: string[] };
      }
    >('/users/me'),
  updateMe: (data: Record<string, unknown>) =>
    apiPatch<User>('/users/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiPost<{ message: string }>('/users/me/change-password', data),
  setup2fa: (data: { password: string }) =>
    apiPost<{ secret: string; otpauthUrl: string; qrDataUrl: string }>('/users/me/2fa/setup', data),
  enable2fa: (data: { code: string }) =>
    apiPost<User>('/users/me/2fa/enable', data),
  disable2fa: (data: { password: string; code?: string }) =>
    apiPost<User>('/users/me/2fa/disable', data),
  suspendAccount: (data: { days: number }) =>
    apiPost<User>('/users/me/suspend', data),
  reactivateAccount: () =>
    apiPost<User>('/users/me/reactivate', {}),
  deleteMe: () => apiDelete<{ message: string }>('/users/me'),
};

export const agentsApi = {
  trigger: (data: { agentType: string; projectId?: string; applicationId?: string; config?: Record<string, unknown> }) =>
    apiPost<AgentRun>('/agents/trigger', data),
  runs: (params?: Record<string, unknown>) =>
    apiPaginated<AgentRun>('/agents/runs', params),
  run: (id: string) => apiGet<AgentRun>(`/agents/runs/${id}`),
  cancelRun: (id: string) =>
    apiPost<{ message: string }>(`/agents/runs/${id}/cancel`),
};

export const integrationsApi = {
  list: () => apiGet<Array<Integration & { availability?: { configured: boolean; metadata?: Record<string, unknown> } }>>('/integrations'),
  connect: (data: { type: string; config: Record<string, unknown> }) =>
    apiPost<Integration>('/integrations', data),
  test: (id: string) =>
    apiPost<{ ok: boolean; message: string }>(`/integrations/${id}/test`),
  disconnect: (id: string) => apiDelete<{ message: string }>(`/integrations/${id}`),
};

export const webhooksApi = {
  list: () => apiGet<Webhook[]>('/webhooks'),
  get: (id: string) => apiGet<Webhook>(`/webhooks/${id}`),
  create: (data: { url: string; eventTypes: string[]; secret?: string }) =>
    apiPost<Webhook>('/webhooks', data),
  update: (id: string, data: Record<string, unknown>) =>
    apiPatch<Webhook>(`/webhooks/${id}`, data),
  remove: (id: string) => apiDelete<{ message: string }>(`/webhooks/${id}`),
  triggerTest: (id: string) =>
    apiPost<{ message: string }>(`/webhooks/${id}/test`),
  deliveries: (id: string) =>
    apiGet<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),
};

export const apiKeysApi = {
  list: () => apiGet<ApiKey[]>('/api-keys'),
  create: (data: { name: string; scopes?: string[] }) =>
    apiPost<ApiKey & { plainKey: string }>('/api-keys', data),
  revoke: (id: string) => apiDelete<{ message: string }>(`/api-keys/${id}`),
};

export const billingApi = {
  subscription: () => apiGet<Billing>('/billing/subscription'),
  updatePlan: (plan: string) =>
    apiPatch<Billing>('/billing/subscription', { plan }),
  usage: () => apiGet<BillingUsage>('/billing/usage'),
};

export { apiGet, apiPost, apiPatch, apiDelete, apiPaginated };