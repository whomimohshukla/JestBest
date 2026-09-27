import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home, Eraser } from 'lucide-react';
import { useBackendStore } from '../lib/backend';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('JestBest UI crash:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null }, () => {
      this.props.onReset?.();
      window.location.reload();
    });
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'An unexpected error occurred in the UI.';

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md space-y-6 rounded-2xl border border-red-500/30 bg-card p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <AlertOctagon className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Something crashed</h1>
              <p className="text-sm text-muted-foreground">
                The interface hit an unexpected error. Your data is safe — reload to continue.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-black/40 px-4 py-3 text-left">
              <p className="text-xs font-mono text-red-400">{message}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                <RotateCcw className="h-4 w-4" />
                Reload application
              </button>
              <button
                onClick={() => {
                  useBackendStore.setState({ status: 'connecting' });
                  this.handleReset();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Eraser className="h-4 w-4" />
                Retry after clearing state
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                Go to landing page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;