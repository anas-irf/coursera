import React from 'react';

/** Centered loading indicator for a page or a panel. */
export function PageSpinner({ className = 'h-96', color = 'border-indigo-600' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${color}`}></div>
    </div>
  );
}

export default PageSpinner;
