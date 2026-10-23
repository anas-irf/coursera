import React, { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '../lib/cn';
import { IconButton } from './Button';
import { useDialog } from './useDialog';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
type ModalLayer = 'base' | 'top';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

const LAYERS: Record<ModalLayer, string> = {
  base: 'z-50',
  top: 'z-[9999]', // a confirmation asked from inside another dialog
};

interface ModalProps {
  title?: ReactNode;
  /** A line under the title. */
  description?: ReactNode;
  onClose?: () => void;
  size?: ModalSize;
  layer?: ModalLayer;
  headerExtra?: ReactNode;
  bare?: boolean;
  labelledBy?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * A dialog: dimmed backdrop, titled panel, close button.
 *
 * It is what the app's modals are made of, so they all behave the same (``useDialog``):
 * ``role="dialog"`` with a name, Escape closes the top-most one, Tab stays inside it, focus moves
 * in when it opens and back to where it was when it closes, and the page behind does not scroll.
 *
 * ``title`` is the heading (``headerExtra`` goes under it, in the sticky header: tabs).  ``bare``
 * leaves out the header for a caller that lays out its own content and names it with
 * ``labelledBy``.
 */
export function Modal({
  title,
  description,
  onClose,
  size = 'md',
  layer = 'base',
  headerExtra = null,
  bare = false,
  labelledBy,
  className = '',
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(panelRef, onClose);

  return (
    <div
      className={cn(
        'fixed inset-0 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4',
        LAYERS[layer]
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={bare ? labelledBy : titleId}
        tabIndex={-1}
        className={cn(
          'w-full overflow-y-auto border border-line bg-surface-raised shadow-pop animate-slide-up focus:outline-none',
          'max-h-[92vh] rounded-t-2xl sm:max-h-[90vh] sm:rounded-2xl',
          SIZES[size],
          className
        )}
      >
        {!bare && (
          <div className="sticky top-0 z-10 border-b border-line bg-surface-raised">
            <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold text-fg">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
              </div>
              {onClose && <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" />}
            </div>
            {headerExtra}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** The row of buttons at the bottom of a dialog. */
export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export default Modal;
