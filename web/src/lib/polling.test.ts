import { describe, expect, it } from 'vitest'
import { BUG_STATUSES } from './bugStatus'
import { isActiveStatus, hasActiveItems, isActiveRecord, pollWhileActive, ACTIVE_STATUSES } from './polling'

describe('BUG_STATUSES', () => {
  // The Prisma `BugStatus` enum. If a member is renamed upstream the UI must
  // fail here, not at runtime with a 400 the user cannot act on.
  const PRISMA_BUG_STATUSES = [
    'OPEN',
    'IN_PROGRESS',
    'FIXED',
    'VERIFIED',
    'CLOSED',
    'REJECTED',
    'DUPLICATE',
  ]

  it('contains only states the API actually accepts', () => {
    expect(BUG_STATUSES.every((s) => PRISMA_BUG_STATUSES.includes(s))).toBe(true)
  })

  it('does not offer WONT_FIX, which the API rejects with a 400', () => {
    expect(BUG_STATUSES).not.toContain('WONT_FIX' as never)
  })

  it('offers the terminal "not fixing" state', () => {
    expect(BUG_STATUSES).toContain('REJECTED')
  })

  it('has no duplicates', () => {
    expect(new Set(BUG_STATUSES).size).toBe(BUG_STATUSES.length)
  })
})

describe('polling', () => {
  it('treats in-flight statuses as active and terminal ones as idle', () => {
    expect(isActiveStatus('PENDING')).toBe(true)
    expect(isActiveStatus('QUEUED')).toBe(true)
    expect(isActiveStatus('RUNNING')).toBe(true)
    expect(isActiveStatus('IN_PROGRESS')).toBe(true)

    expect(isActiveStatus('PASSED')).toBe(false)
    expect(isActiveStatus('FAILED')).toBe(false)
    expect(isActiveStatus('CANCELLED')).toBe(false)
    expect(isActiveStatus(null)).toBe(false)
    expect(isActiveStatus(undefined)).toBe(false)
    expect(isActiveStatus('')).toBe(false)
  })

  it('keeps polling while any item is still running', () => {
    expect(hasActiveItems([{ status: 'PASSED' }, { status: 'RUNNING' }])).toBe(true)
    expect(hasActiveItems([{ status: 'PASSED' }, { status: 'FAILED' }])).toBe(false)
    expect(hasActiveItems([])).toBe(false)
    expect(hasActiveItems(undefined)).toBe(false)
  })

  it('stops polling once a record is terminal', () => {
    expect(isActiveRecord({ status: 'RUNNING' })).toBe(true)
    expect(isActiveRecord({ status: 'FAILED' })).toBe(false)
    expect(isActiveRecord(undefined)).toBe(false)
  })

  it('returns the interval while active and false once idle', () => {
    // Returning `false` is what ends a TanStack Query interval: an idle page
    // must make no further requests instead of polling every 4s forever.
    expect(pollWhileActive(() => true)).toBe(4_000)
    expect(pollWhileActive(() => false)).toBe(false)
    expect(pollWhileActive(() => true, 2_500)).toBe(2_500)
  })

  it('ignores items whose status field is absent', () => {
    expect(hasActiveItems([{}])).toBe(false)
    expect(hasActiveItems([{ status: null }])).toBe(false)
  })

  it('only ever reports the statuses it declares', () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(['IN_PROGRESS', 'PENDING', 'QUEUED', 'RUNNING'])
  })
})
