import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { authApi, organizationApi } from '../api';
import { useAuthStore } from '../store/authStore';
import type { AuthResult, Organization, User } from '../types';

vi.mock('../api', () => ({
  authApi: {
    switchOrganization: vi.fn(),
  },
  organizationApi: {
    listMine: vi.fn(),
    create: vi.fn(),
  },
}));

const switchMock = vi.mocked(authApi.switchOrganization);
const listMock = vi.mocked(organizationApi.listMine);
const createMock = vi.mocked(organizationApi.create);

const currentUser: User = {
  id: 'usr_1',
  email: 'owner@acme.test',
  name: 'Owner',
  avatar: null,
  emailVerified: true,
  twoFactorEnabled: false,
  suspendedUntil: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const organizations: Organization[] = [
  { id: 'org_1', name: 'Acme', slug: 'acme' },
  { id: 'org_2', name: 'Beta Labs', slug: 'beta-labs' },
];

const authResultFor = (organization: Organization): AuthResult => ({
  user: currentUser,
  organization: { ...organization, requireTwoFactor: false },
  tokens: {
    accessToken: `at_${organization.id}`,
    refreshToken: `rt_${organization.id}`,
    expiresIn: 900,
    tokenType: 'Bearer',
  },
});

const renderSwitcher = (currentOrganizationId = 'org_1') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <WorkspaceSwitcher currentOrganizationId={currentOrganizationId} />
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('accessToken', 'at_org_1');
  localStorage.setItem('refreshToken', 'rt_org_1');
  useAuthStore.setState({
    user: currentUser,
    organization: organizations[0],
    token: 'at_org_1',
    isAuthenticated: true,
  });
  listMock.mockResolvedValue(organizations);
});

describe('WorkspaceSwitcher', () => {
  it('marks the active workspace and switches the session to another one', async () => {
    switchMock.mockResolvedValue(authResultFor(organizations[1]));

    renderSwitcher();
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch to Acme' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Beta Labs' }));

    await waitFor(() => expect(switchMock).toHaveBeenCalledWith('org_2'));
    // The returned token pair replaces the session, and the persisted record
    // has to follow it or the next refresh would wake up in the old workspace.
    await waitFor(() =>
      expect(useAuthStore.getState().organization?.id).toBe('org_2')
    );
    expect(localStorage.getItem('accessToken')).toBe('at_org_2');
    expect(localStorage.getItem('refreshToken')).toBe('rt_org_2');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('creates a workspace and lands in it', async () => {
    const created: Organization = { id: 'org_3', name: 'Gamma', slug: 'gamma' };
    createMock.mockResolvedValue(created);
    switchMock.mockResolvedValue(authResultFor(created));

    renderSwitcher();
    fireEvent.change(await screen.findByLabelText('New workspace'), {
      target: { value: 'Gamma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith({ name: 'Gamma' }));
    await waitFor(() => expect(switchMock).toHaveBeenCalledWith('org_3'));
    await waitFor(() =>
      expect(useAuthStore.getState().organization?.id).toBe('org_3')
    );
  });

  it('keeps the current session when the switch is refused', async () => {
    switchMock.mockRejectedValue(new Error('You are not an active member of this organization.'));

    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to Beta Labs' }));

    await waitFor(() => expect(switchMock).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().organization?.id).toBe('org_1');
    expect(localStorage.getItem('accessToken')).toBe('at_org_1');
    expect(localStorage.getItem('refreshToken')).toBe('rt_org_1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
