/**
 * Polling helpers for long-running work.
 *
 * Test runs, application scans and agent runs are queued and executed in the
 * background, so the list a user is watching has to refresh itself. Polling is
 * gated on "is anything still active" so a completed run stops hitting the API
 * instead of polling forever at the global 5-minute staleTime.
 */

/** Statuses that mean a run is still in flight. */
export const ACTIVE_STATUSES = new Set(['PENDING', 'QUEUED', 'RUNNING', 'IN_PROGRESS']);

export function isActiveStatus(status: string | null | undefined): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}

/** True when any item in the list is still running. */
export function hasActiveItems<T extends { status?: string | null }>(items: T[] | undefined): boolean {
  return (items ?? []).some((i) => isActiveStatus(i.status));
}

/** True when a single record is still running. */
export function isActiveRecord(record: { status?: string | null } | undefined): boolean {
  return !!record && isActiveStatus(record.status);
}

/**
 * `refetchInterval` callback: poll every 4s while work is active, then stop.
 * Returning `false` ends the interval, so idle pages make no further requests.
 */
export function pollWhileActive(isActive: () => boolean, intervalMs = 4000): number | false {
  return isActive() ? intervalMs : false;
}
