import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlakyTestsList } from './FlakyTestsList';
import { flakyScoreVariant } from '../lib/flakyScore';
import type { FlakyTest } from '../types';

const flaky = (overrides: Partial<FlakyTest> = {}): FlakyTest => ({
  testCaseId: 'tc_1',
  testCaseTitle: 'Checkout applies coupon',
  totalRuns: 20,
  passCount: 12,
  failCount: 8,
  flakyScore: 72,
  rootCauseAnalysis: 'Race between cart update and promo render',
  lastOccurred: '2026-10-01T10:00:00.000Z',
  pattern: 'Alternating',
  ...overrides,
});

describe('FlakyTestsList', () => {
  it('renders each flaky test with its title, counts and score', () => {
    render(
      <FlakyTestsList
        tests={[
          flaky(),
          flaky({
            testCaseId: 'tc_2',
            testCaseTitle: 'Login persists session',
            totalRuns: 24,
            passCount: 15,
            failCount: 9,
            flakyScore: 31,
          }),
        ]}
      />
    );

    expect(screen.getByText('Checkout applies coupon')).toBeInTheDocument();
    expect(screen.getByText('Login persists session')).toBeInTheDocument();
    // pass / fail pair plus the "of <total runs>" context, per row
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText(/of 20/)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText(/of 24/)).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  it('keeps the root cause available even when the column truncates it', () => {
    render(<FlakyTestsList tests={[flaky()]} />);

    const cause = screen.getByTitle('Race between cart update and promo render');
    expect(cause).toHaveTextContent('Race between cart update and promo render');
  });

  it('shows a guidance empty state instead of an empty table', () => {
    render(<FlakyTestsList tests={[]} />);

    expect(screen.getByText('No flaky tests detected')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('marks the score severity so a high score is visually alarming', () => {
    expect(flakyScoreVariant(80)).toBe('warning');
    expect(flakyScoreVariant(45)).toBe('info');
    expect(flakyScoreVariant(15)).toBe('success');
  });
});
