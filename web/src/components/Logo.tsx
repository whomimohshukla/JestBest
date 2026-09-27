import { useId } from 'react';

import { cn } from '../utils/cn';

export type LogoVariant = 'full' | 'short' | 'mark';

interface LogoProps {
  /** `full` = mark + "JestBest", `short` = mark + "JB", `mark` = symbol only. */
  variant?: LogoVariant;
  /** Rendered height of the mark in pixels. Text scales proportionally. */
  size?: number;
  className?: string;
}

/**
 * JestBest brand lockup.
 *
 * The mark is inlined (rather than an <img>) so the gradient ids stay unique per
 * instance and the wordmark inherits the surrounding text colour / font stack.
 * `short` renders the "JB" monogram for compact spots like the app icon and
 * narrow toolbars.
 */
export function Logo({ variant = 'full', size = 32, className }: LogoProps) {
  const gradientId = useId();
  const showText = variant !== 'mark';

  return (
    <span
      className={cn('inline-flex select-none items-center gap-2.5', className)}
      role="img"
      aria-label="JestBest"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#EF4444" />
            <stop offset="0.5" stopColor="#DC2626" />
            <stop offset="1" stopColor="#991B1B" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${gradientId})`} />
        <path
          d="M17.5 33.5 26.5 42.5 46.5 21.5"
          stroke="#fff"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {size >= 20 ? (
          <path
            d="M47.5 10.5l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z"
            fill="#FECACA"
          />
        ) : null}
      </svg>
      {showText ? (
        <span
          className="font-extrabold tracking-tight text-foreground"
          style={{ fontSize: Math.round(size * 0.78), lineHeight: 1 }}
        >
          Jest
          <span className="text-red-500">Best</span>
          {variant === 'short' ? <span className="sr-only"> JestBest</span> : null}
        </span>
      ) : null}
    </span>
  );
}

export default Logo;
