import { useId } from 'react';

import { cn } from '../utils/cn';

export type LogoVariant = 'full' | 'mark';

interface LogoProps {
  /** `full` = mark + "JestBest" wordmark, `mark` = monogram only. */
  variant?: LogoVariant;
  /** Rendered height of the mark in pixels. Text scales proportionally. */
  size?: number;
  /** Renders a small uppercase "JestBest" caption underneath the mark. */
  showCaption?: boolean;
  className?: string;
}

/** Shared brand tones. The split sits at the seam between the two letters. */
const TONE_LIGHT = '#FCEAE8';
const TONE_DEEP = '#8A2E3A';

/**
 * JestBest brand lockup.
 *
 * The badge is split vertically into two brand tones ("half half"): a light
 * blush left half and a deep red right half, with the divide running through
 * the seam between the two letters so the JB monogram reads as joined. The
 * "J" is drawn in the deep tone on the light half and the "B" in white on the
 * deep half, which keeps both letters at roughly 7:1 and 8:1 contrast instead
 * of letting them dissolve into their own background.
 *
 * The letterforms are hand-authored paths rather than <text>, so the mark is
 * pixel-identical everywhere and needs no webfont. Everything is inlined so
 * the clip id stays unique per instance and the wordmark inherits the
 * surrounding colour.
 */
export function Logo({ variant = 'full', size = 32, showCaption = false, className }: LogoProps) {
  const clipId = useId();
  const wordSize = Math.round(size * 0.78);

  return (
    <span
      className={cn('inline-flex select-none flex-col items-center', className)}
      role="img"
      aria-label="JestBest"
    >
      <span className="inline-flex items-center gap-2.5">
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="2" y="2" width="60" height="60" rx="18" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="2" y="2" width="60" height="60" fill={TONE_LIGHT} />
            <path d="M32 2h30v60H32z" fill={TONE_DEEP} />
          </g>
          <g
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={5.5}
          >
            <path d="M28 18v22a6 6 0 0 1-12 0" stroke={TONE_DEEP} />
            <path d="M35.25 18v28" stroke="#FFFFFF" />
            <path d="M35.25 18h5.25a5.25 7 0 0 1 0 14h-5.25" stroke="#FFFFFF" />
            <path d="M35.25 32h6.75a6.75 7 0 0 1 0 14h-6.75" stroke="#FFFFFF" />
          </g>
        </svg>

        {variant === 'full' ? (
          <span
            className="font-extrabold tracking-tight text-foreground"
            style={{ fontSize: wordSize, lineHeight: 1 }}
          >
            Jest
            <span className="text-red-500">Best</span>
          </span>
        ) : null}
      </span>

      {showCaption ? (
        <span
          className="mt-1 font-semibold uppercase tracking-[0.22em] text-muted-foreground"
          style={{ fontSize: Math.max(8, Math.round(size * 0.27)), lineHeight: 1 }}
        >
          JestBest
        </span>
      ) : null}
    </span>
  );
}

export default Logo;
