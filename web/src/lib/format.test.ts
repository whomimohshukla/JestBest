import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('renders a missing duration as an em dash rather than 0', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
  })

  it('renders sub-second durations in milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(250)).toBe('250ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('renders seconds for a run that took a few seconds', () => {
    // This is the regression: the value is milliseconds, and the old formatter
    // printed a 2.5 second run as "2500.00s".
    expect(formatDuration(2_500)).toBe('2.50s')
    expect(formatDuration(1_000)).toBe('1.00s')
    expect(formatDuration(59_999)).toBe('60.00s')
  })

  it('renders minutes and seconds past a minute', () => {
    expect(formatDuration(60_000)).toBe('1m 0s')
    expect(formatDuration(90_500)).toBe('1m 31s')
    expect(formatDuration(600_000)).toBe('10m 0s')
  })

  it('is monotonically increasing in rendered precision', () => {
    const rendered = [250, 2_500, 62_000].map(formatDuration)
    expect(rendered).toEqual(['250ms', '2.50s', '1m 2s'])
  })
})
