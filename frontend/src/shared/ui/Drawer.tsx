import React, { useRef } from 'react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { useDialog } from './useDialog';

interface DrawerProps {
  onClose: () => void;
  /** The name of the panel for screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * A panel that slides in from the left over a dimmed page (the navigation on a phone, the outline
 * of the course player).  It behaves like every dialog of the app (``useDialog``); the caller
 * renders it only while it is open.
 */
export function Drawer({ onClose, label, className, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 left-0 flex w-80 max-w-[86vw] flex-col border-r border-line bg-surface shadow-pop',
          'animate-slide-in-left focus:outline-none',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default Drawer;
