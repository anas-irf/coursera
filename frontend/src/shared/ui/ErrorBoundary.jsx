import React from 'react';

/**
 * Catches an error thrown while rendering below it, so one broken page does not blank the whole
 * app: the rest of the shell (navigation, the session) keeps working.
 *
 * ``resetKey`` (e.g. the pathname) clears the error when it changes, so navigating away from a
 * broken page recovers.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // leave a trace for the browser console and for whatever monitors it
    // eslint-disable-next-line no-console
    console.error('Render error', error, info && info.componentStack);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="flex items-center justify-center min-h-[50vh] p-6">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">This page could not be shown</h2>
          <p className="text-gray-500 mb-4">
            Something went wrong while drawing it. You can try again, or go to another page.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
