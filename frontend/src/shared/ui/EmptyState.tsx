import React from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** "Nothing here yet": an icon, a title, a line of help and, optionally, the way to fill it. */
export function EmptyState({ icon: Icon, title, children, action, className = 'py-12' }: EmptyStateProps) {
  return (
    <div className={`text-center ${className}`}>
      {Icon && <Icon size={48} className="mx-auto text-gray-300 mb-4" />}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {children && <p className="text-gray-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
