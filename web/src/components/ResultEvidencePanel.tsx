import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Brain,
  Camera,
  FileText,
  Lightbulb,
  Loader2,
  Target,
  Terminal,
} from 'lucide-react';
import { testRunsApi } from '../api';
import type { TestResult } from '../types';

interface ResultEvidencePanelProps {
  runId: string;
  result: TestResult;
}

function Section({
  icon: Icon,
  title,
  children,
  accent = 'text-muted-foreground',
}: {
  icon: typeof Brain;
  title: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className={`flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide ${accent}`}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

export default function ResultEvidencePanel({ runId, result }: ResultEvidencePanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['result-screenshot', runId, result.id],
    queryFn: () => testRunsApi.resultScreenshot(runId, result.id),
    enabled: !!result.screenshotUrl,
    staleTime: 5 * 60 * 1000,
  });

  const analysis = result.failureAnalysis;
  const dom = result.domSnapshot;
  const consoleLog = result.consoleLog ?? [];
  const dataUrl = data?.dataUrl ?? null;

  const toList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((v) => String(v)).filter(Boolean)
      : typeof value === 'string' && value.trim()
        ? [value.trim()]
        : [];
  const evidenceList = toList(analysis?.evidence);
  const selectorList = toList(analysis?.relatedSelectors);
  const confidence =
    analysis && typeof analysis.confidence === 'number'
      ? analysis.confidence > 1
        ? Math.round(analysis.confidence)
        : Math.round(analysis.confidence * 100)
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
      {analysis && (
        <Section icon={Brain} title="AI Failure Analysis" accent="text-violet-400">
          <div className="flex items-center gap-2 mb-2">
            {analysis.category && (
              <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300 uppercase">
                {analysis.category}
              </span>
            )}
            {typeof analysis.confidence === 'number' && (
              <span className="text-[11px] text-muted-foreground">
                confidence {confidence}%
              </span>
            )}
          </div>
          {analysis.rootCause && (
            <p className="text-xs text-foreground/90 mb-2">
              <span className="font-semibold">Root cause: </span>
              {analysis.rootCause}
            </p>
          )}
          {analysis.suggestedFix && (
            <p className="flex items-start gap-1.5 text-xs text-emerald-300 mb-2">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {analysis.suggestedFix}
            </p>
          )}
          {evidenceList.length > 0 && (
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5 mb-2">
              {evidenceList.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {selectorList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectorList.map((sel, i) => (
                <code key={i} className="text-[11px] bg-background/60 border border-border rounded px-1.5 py-0.5">
                  {sel}
                </code>
              ))}
            </div>
          )}
        </Section>
      )}

      {result.errorMessage && (
        <Section icon={AlertTriangle} title="Error" accent="text-red-400">
          <pre className="text-xs text-red-300/90 whitespace-pre-wrap break-words font-mono max-h-40 overflow-auto">
            {result.errorMessage}
          </pre>
        </Section>
      )}

      {dom && (
        <Section icon={FileText} title="DOM Snapshot">
          <div className="text-xs text-muted-foreground space-y-1 mb-2">
            <p className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{dom.title || '(no title)'}</span>
            </p>
            {dom.locationUrl && (
              <p className="truncate">
                <span className="font-semibold">URL: </span>
                <span className="text-foreground/80">{dom.locationUrl}</span>
              </p>
            )}
          </div>
          {dom.text && (
            <details>
              <summary className="text-xs text-muted-foreground cursor-pointer">View rendered text</summary>
              <pre className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono max-h-40 overflow-auto bg-background/40 rounded p-2">
                {dom.text}
              </pre>
            </details>
          )}
        </Section>
      )}

      {consoleLog.length > 0 && (
        <Section icon={Terminal} title="Browser Console">
          <pre className="text-[11px] text-amber-200/80 whitespace-pre-wrap break-words font-mono max-h-40 overflow-auto">
            {consoleLog.join('\n')}
          </pre>
        </Section>
      )}

      {result.screenshotUrl && (
        <Section icon={Camera} title="Screenshot" accent="text-sky-400">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading screenshot…
            </div>
          ) : dataUrl ? (
            <a href={dataUrl} target="_blank" rel="noreferrer" title="Open full size">
              <img
                src={dataUrl}
                alt="Failure screenshot"
                className="rounded-lg border border-border max-h-64 w-auto"
              />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Screenshot unavailable.</p>
          )}
        </Section>
      )}

      {!analysis && !result.errorMessage && !dom && consoleLog.length === 0 && !result.screenshotUrl && (
        <p className="text-xs text-muted-foreground">
          No additional evidence was captured for this test case.
        </p>
      )}
    </div>
  );
}
