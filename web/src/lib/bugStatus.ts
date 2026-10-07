import type { BugStatus } from '../types'

/**
 * Statuses offered in the bug detail UI.
 *
 * This must be a subset of the Prisma `BugStatus` enum. An earlier version
 * offered `WONT_FIX`, which does not exist, so selecting it produced a 400 on
 * every save. `REJECTED` is the equivalent existing state.
 */
export const BUG_STATUSES: BugStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'FIXED',
  'VERIFIED',
  'CLOSED',
  'REJECTED',
]
