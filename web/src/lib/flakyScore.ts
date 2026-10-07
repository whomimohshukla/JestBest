/**
 * Badge severity for a flakiness score (0-100, higher = worse).
 *
 * Kept out of the component file so React Fast Refresh keeps working when only
 * the rendering changes, and so the thresholds can be asserted without
 * rendering a table.
 */
export type FlakyScoreVariant = 'success' | 'info' | 'warning'

export const flakyScoreVariant = (score: number): FlakyScoreVariant =>
  score >= 60 ? 'warning' : score >= 30 ? 'info' : 'success'
