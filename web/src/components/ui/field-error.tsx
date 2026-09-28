import * as React from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Inline validation message. Rendered directly beneath the control it refers
 * to so the user never loses context, and wired to the field via aria-describedby
 * rather than interrupting them with a modal dialog.
 */
export function FieldError({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn('mt-1.5 flex items-start gap-1.5 text-sm text-red-400', className)}
    >
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default FieldError;
