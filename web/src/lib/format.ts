/** Milliseconds below which a duration is rendered in ms rather than seconds. */
const SECOND = 1_000
const MINUTE = 60_000

/**
 * Render a run duration.
 *
 * `TestRun.duration` and `TestResult.duration` are milliseconds
 * (`Date.now() - startedAt`). The previous formatter treated them as seconds
 * and displayed a 2.5-second run as "2500.00s".
 */
export function formatDuration(duration: number | null | undefined): string {
  if (duration == null) return '—'
  if (duration < SECOND) return `${Math.round(duration)}ms`
  if (duration < MINUTE) return `${(duration / SECOND).toFixed(2)}s`
  const minutes = Math.floor(duration / MINUTE)
  return `${minutes}m ${Math.round((duration % MINUTE) / SECOND)}s`
}
