import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Compass,
  Cpu,
  Flag,
  PlayCircle,
  RotateCw,
  Sparkles,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

type Tone = 'muted' | 'info' | 'pass' | 'warn' | 'fail';

interface RunStep {
  icon: LucideIcon;
  label: string;
  message: string;
  tone: Tone;
}

const runSteps: RunStep[] = [
  { icon: Compass, label: 'explore', message: 'mapping routes on app.jestbest.ai', tone: 'muted' },
  { icon: Compass, label: 'explore', message: '48 routes · 12 flows discovered', tone: 'info' },
  { icon: Sparkles, label: 'generate', message: 'authoring 6 cases from 3 flows', tone: 'muted' },
  { icon: PlayCircle, label: 'run', message: 'chromium · 3 workers', tone: 'info' },
  { icon: CheckCircle2, label: 'passed', message: 'checkout flow · 4 passed', tone: 'pass' },
  { icon: RotateCw, label: 'flaky', message: 'search filters · retry 1/2', tone: 'warn' },
  { icon: XCircle, label: 'failed', message: 'payment redirect · timeout 30s', tone: 'fail' },
  { icon: Cpu, label: 'triage', message: 'root cause: stale #pay-btn selector', tone: 'info' },
  { icon: Flag, label: 'done', message: '12 passed · 1 failed · 87%', tone: 'pass' },
];

const toneClass: Record<Tone, { text: string; ring: string; dot: string }> = {
  muted: { text: 'text-zinc-500', ring: 'border-white/10', dot: 'bg-zinc-600' },
  info: { text: 'text-zinc-300', ring: 'border-white/12', dot: 'bg-red-500' },
  pass: { text: 'text-emerald-400', ring: 'border-emerald-500/25', dot: 'bg-emerald-500' },
  warn: { text: 'text-amber-400', ring: 'border-amber-500/25', dot: 'bg-amber-500' },
  fail: { text: 'text-red-400', ring: 'border-red-500/30', dot: 'bg-red-500' },
};

const VISIBLE = 4;
const STEP_MS = 900;

function useLoopingStep(length: number, intervalMs: number) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [length, intervalMs]);

  return step;
}

/**
 * Hero visual: a looping, animated "test run" console.
 *
 * Log lines stream in one at a time, the progress bar advances in step with
 * them, and the whole sequence wraps so it reads as a live run rather than a
 * static screenshot. Paused for users who ask for reduced motion.
 */
export function RunConsole() {
  const step = useLoopingStep(runSteps.length, STEP_MS);
  const progress = ((step + 1) / runSteps.length) * 100;

  const visible = runSteps
    .slice(0, step + 1)
    .slice(-VISIBLE);

  return (
    <div className="relative">
      {/* red glow behind the panel */}
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-red-600/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-black/60 backdrop-blur-xl">
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <p className="font-mono text-[11px] text-zinc-500">jestbest run --live</p>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-red-400">live</span>
          </div>
        </div>

        {/* log stream */}
        <div className="relative h-[248px] overflow-hidden px-4 py-4">
          {/* scanning sweep */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-red-500/[0.07] to-transparent"
            animate={{ y: [-64, 248] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          />

          <div className="relative flex h-full flex-col justify-end gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((entry, i) => {
                const Icon = entry.icon;
                const tone = toneClass[entry.tone];
                const isLast = i === visible.length - 1;

                return (
                  <motion.div
                    key={`${step}-${i}`}
                    layout
                    initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${tone.ring} bg-white/[0.03]`}
                    >
                      <Icon className={`h-3 w-3 ${tone.text}`} />
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">$</span>
                    <span className={`font-mono text-[11px] ${tone.text} ${isLast ? '' : 'opacity-80'}`}>
                      <span className="text-zinc-600">{entry.label}</span>
                      <span className="text-zinc-700"> · </span>
                      {entry.message}
                    </span>
                    {isLast ? (
                      <motion.span
                        className="inline-block h-3.5 w-[6px] bg-red-500"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* progress */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-600">
            <span>
              step {Math.min(step + 1, runSteps.length)}/{runSteps.length}
            </span>
            <span className="text-zinc-500">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* floating stat chips */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="pointer-events-none absolute -bottom-6 -left-4 hidden items-center gap-2 rounded-xl border border-white/12 bg-black/80 px-3 py-2 backdrop-blur-md sm:flex"
      >
        <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />
        <span className="font-mono text-[10px] text-zinc-400">flaky</span>
        <span className="font-mono text-[10px] text-zinc-600">#search-filters</span>
      </motion.div>
    </div>
  );
}

export default RunConsole;
