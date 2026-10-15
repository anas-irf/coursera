import React from 'react';

interface PageSpinnerProps {
  className?: string;
  /** The Tailwind border colour of the ring. */
  color?: string;
}

/** Centered loading indicator for a page or a panel. */
export function PageSpinner({ className = 'h-96', color = 'border-indigo-600' }: PageSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${color}`}></div>
    </div>
  );
}

export default PageSpinner;
