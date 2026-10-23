import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

import { errorMessage } from '../api/errors';
import { cn } from '../lib/cn';
import { Button } from './Button';

interface ErrorStateProps {
  /** The failure (an axios error, a query's ``error``); only its message is shown. */
  error?: unknown;
  title?: string;
  /** Usually ``query.refetch``: adds the "Try again" button. */
  onRetry?: () => void;
  className?: string;
}

/**
 * What a page shows when its data could not be loaded.
 *
 * A failed request is not an empty list: "no courses yet" is a statement about the user's
 * data, this is a statement about the server.  ``onRetry`` (usually ``query.refetch``) adds the
 * button.
 */
export function ErrorState({ error, title = 'Something went wrong', onRetry, className = 'py-12' }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-fg ring-8 ring-danger-soft/40">
        <AlertTriangle size={22} aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{errorMessage(error, 'Please try again in a moment.')}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry} className="mt-5">
          Try again
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
