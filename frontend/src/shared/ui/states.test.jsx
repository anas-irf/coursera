import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Bell } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorState } from './ErrorState';

test('an error state names the failure and offers a retry', () => {
  const onRetry = jest.fn();
  const error = { response: { status: 500, data: { error: 'The server had a problem.' } } };

  render(<ErrorState error={error} title="Could not load courses" onRetry={onRetry} />);

  expect(screen.getByRole('alert')).toHaveTextContent('Could not load courses');
  expect(screen.getByText('The server had a problem.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('an empty state says what is missing', () => {
  render(<EmptyState icon={Bell} title="No notifications yet">You are all caught up.</EmptyState>);

  expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  expect(screen.getByText('You are all caught up.')).toBeInTheDocument();
});

describe('error boundary', () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  const Broken = ({ explode }) => {
    if (explode) throw new Error('boom');
    return <p>fine</p>;
  };

  test('a page that throws is replaced, the rest keeps working', () => {
    render(
      <div>
        <p>navigation</p>
        <ErrorBoundary>
          <Broken explode />
        </ErrorBoundary>
      </div>
    );

    expect(screen.getByText('navigation')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This page could not be shown');
  });

  test('another page (a new reset key) recovers', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Broken explode />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="/b">
        <Broken explode={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
