import { Lightbulb, type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface HowToStep {
  title: string;
  text: string;
  icon?: LucideIcon;
}

/**
 * Inline "what to do next" guidance. Shown at the top of a page so a first-time
 * user can follow the flow without leaving the screen.
 */
export function HowToBox({
  title = 'How this works',
  steps,
  className,
}: {
  title?: string;
  steps: HowToStep[];
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'mb-6 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-xs font-semibold text-red-400">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Short inline hint placed above a control that needs explaining. */
export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>;
}
