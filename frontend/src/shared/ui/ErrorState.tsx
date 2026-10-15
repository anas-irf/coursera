import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { errorMessage } from '../api/errors';

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
    <div role="alert" className={`text-center ${className}`}>
      <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 mb-4">{errorMessage(error, 'Please try again in a moment.')}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
