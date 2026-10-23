import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from './Button';

interface ErrorBoundaryProps {
  /** Clears the error when it changes (the pathname of the page below, say). */
  resetKey?: string;
  children?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches an error thrown while rendering below it, so one broken page does not blank the whole
 * app: the rest of the shell (navigation, the session) keeps working.
 *
 * ``resetKey`` (e.g. the pathname) clears the error when it changes, so navigating away from a
 * broken page recovers.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // the one place a failure is logged: the browser console is where a developer looks for it
    // eslint-disable-next-line no-console
    console.error('Render error', error, info && info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-fg">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-fg">This page could not be shown</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Something went wrong while drawing it. You can try again, or go to another page.
          </p>
          <Button variant="secondary" onClick={() => this.setState({ error: null })} className="mt-5">
            Try again
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
