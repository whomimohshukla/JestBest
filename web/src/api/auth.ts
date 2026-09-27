import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { AuthResult, AuthResponse, RegisterInput, User, Organization, Membership, OrganizationInvite, AuditLogEntry } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    apiPost<AuthResponse>('/auth/login', { email, password }),
  verify2fa: (token: string, code: string) =>
    apiPost<AuthResult>('/auth/verify-2fa', { token, code }),
  register: (data: RegisterInput) =>
    apiPost<AuthResult>('/auth/register', data),
  refreshToken: (refreshToken: string) =>
    apiPost<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh-token', { refreshToken }),
  logout: () => apiPost<{ message: string }>('/auth/logout', {}),
  verifyEmail: (token: string) =>
    apiPost<{ message: string }>('/auth/verify-email', { token }),
  resendVerification: (email: string) =>
    apiPost<{ message: string }>('/auth/resend-verification', { email }),
  requestPasswordReset: (email: string) =>
    apiPost<{ message: string }>('/auth/request-password-reset', { email }),
  resetPassword: (token: string, password: string) =>
    apiPost<{ message: string }>('/auth/reset-password', { token, password }),
  oauthAuthorize: (provider: string) =>
    apiGet<{ url: string; state: string }>(`/auth/oauth/${provider}/authorize`),
  oauthCallback: (provider: string, code: string, state?: string) =>
    apiGet<AuthResult>(`/auth/oauth/${provider}/callback`, { code, state }),
  getMe: () => apiGet<User>('/users/me'),
};

export const organizationApi = {
  get: (organizationId: string) =>
    apiGet<Organization>(`/organizations/${organizationId}`),
  update: (organizationId: string, data: Record<string, unknown>) =>
    apiPatch<Organization>(`/organizations/${organizationId}`, data),
  members: (organizationId: string) =>
    apiGet<Membership[]>(`/organizations/${organizationId}/members`),
  inviteMember: (organizationId: string, email: string, role: string) =>
    apiPost<OrganizationInvite>(`/organizations/${organizationId}/invitations`, { email, role }),
  changeRole: (organizationId: string, userId: string, role: string) =>
    apiPatch<{ message: string }>(`/organizations/${organizationId}/members/${userId}/role`, { role }),
  removeMember: (organizationId: string, userId: string) =>
    apiDelete<{ message: string }>(`/organizations/${organizationId}/members/${userId}`),
  auditLogs: (organizationId: string, params?: Record<string, unknown>) =>
    apiGet<AuditLogEntry[]>(`/organizations/${organizationId}/audit-logs`, params),
};