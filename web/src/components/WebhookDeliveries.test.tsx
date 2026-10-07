import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebhookDeliveries } from './WebhookDeliveries';
import { webhooksApi } from '../api';
import type { Paginated, WebhookDelivery } from '../types';

vi.mock('../api', () => ({
  webhooksApi: {
    deliveries: vi.fn(),
    redeliver: vi.fn(),
  },
}));

const deliveriesMock = vi.mocked(webhooksApi.deliveries);
const redeliverMock = vi.mocked(webhooksApi.redeliver);

const delivery = (overrides: Partial<WebhookDelivery> = {}): WebhookDelivery => ({
  id: 'del_1',
  webhookId: 'wh_1',
  eventType: 'TEST_COMPLETED',
  payload: {},
  responseStatus: 500,
  responseBody: 'upstream error',
  attempts: 1,
  nextRetryAt: null,
  succeededAt: null,
  failedAt: '2026-10-01T10:05:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

const deliveryPage = (items: WebhookDelivery[]): Paginated<WebhookDelivery> => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 10,
  totalPages: 1,
});

const renderList = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <WebhookDeliveries webhookId="wh_1" />
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WebhookDeliveries', () => {
  it('replays a delivery and refreshes the log', async () => {
    deliveriesMock.mockResolvedValue(deliveryPage([delivery()]));
    redeliverMock.mockResolvedValue({ queued: true });

    renderList();
    expect(await screen.findByText('TEST_COMPLETED')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Redeliver TEST_COMPLETED delivery' }));

    await waitFor(() =>
      expect(redeliverMock).toHaveBeenCalledWith('wh_1', 'del_1')
    );
    // The replay is recorded as a new row, so the list must refetch itself.
    await waitFor(() => expect(deliveriesMock).toHaveBeenCalledTimes(2));
  });

  it('disables the action while a replay is in flight', async () => {
    deliveriesMock.mockResolvedValue(deliveryPage([delivery()]));
    let release!: (value: { queued: boolean }) => void;
    redeliverMock.mockImplementation(
      () => new Promise<{ queued: boolean }>((resolve) => (release = resolve))
    );

    renderList();
    const button = await screen.findByRole('button', {
      name: 'Redeliver TEST_COMPLETED delivery',
    });

    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    release({ queued: true });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('shows the empty state when nothing has been delivered', async () => {
    deliveriesMock.mockResolvedValue(deliveryPage([]));

    renderList();

    expect(await screen.findByText('No deliveries yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /redeliver/i })).not.toBeInTheDocument();
  });
});
