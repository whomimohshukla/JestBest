import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunStatusBadge, BugStatusBadge, SeverityBadge, PriorityBadge } from './status'

describe('RunStatusBadge', () => {
  it('labels every status in the Prisma TestStatus enum', () => {
    const expected: Record<string, string> = {
      PENDING: 'Pending',
      RUNNING: 'Running',
      PASSED: 'Passed',
      FAILED: 'Failed',
      SKIPPED: 'Skipped',
      CANCELLED: 'Cancelled',
    }

    for (const [status, label] of Object.entries(expected)) {
      render(<RunStatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('falls back to the raw value for a status it does not know', () => {
    render(<RunStatusBadge status="SOMETHING_NEW" />)
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument()
  })
})

describe('BugStatusBadge', () => {
  it('labels every status in the Prisma BugStatus enum', () => {
    const expected: Record<string, string> = {
      OPEN: 'Open',
      IN_PROGRESS: 'In Progress',
      FIXED: 'Fixed',
      VERIFIED: 'Verified',
      CLOSED: 'Closed',
      REJECTED: 'Rejected',
      DUPLICATE: 'Duplicate',
    }

    for (const [status, label] of Object.entries(expected)) {
      render(<BugStatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('never labels a bug WONT_FIX, which the API rejects', () => {
    render(<BugStatusBadge status="WONT_FIX" />)
    // Unknown values render as their own raw string; there is no pretty label
    // pretending this is a supported state.
    expect(screen.queryByText("Won't Fix")).not.toBeInTheDocument()
  })
})

describe('SeverityBadge', () => {
  it('labels all four severities', () => {
    const expected: Record<string, string> = {
      CRITICAL: 'Critical',
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low',
    }

    for (const [severity, label] of Object.entries(expected)) {
      render(<SeverityBadge severity={severity} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('falls back to the raw severity', () => {
    render(<SeverityBadge severity="BLOCKER" />)
    expect(screen.getByText('BLOCKER')).toBeInTheDocument()
  })
})

describe('PriorityBadge', () => {
  it('supports both P-notation and lowercase API values', () => {
    for (const priority of ['P0', 'P1', 'P2', 'P3']) {
      render(<PriorityBadge priority={priority} />)
      expect(screen.getByText(priority)).toBeInTheDocument()
    }
    render(<PriorityBadge priority="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })
})
