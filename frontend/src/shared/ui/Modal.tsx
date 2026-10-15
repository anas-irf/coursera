import React, { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

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

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// the dialogs that are open, the newest last: only that one answers Escape and Tab
const openDialogs: object[] = [];
let savedOverflow = '';

interface ModalProps {
  title?: ReactNode;
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
 * It is what the app's modals are made of, so they all behave the same: ``role="dialog"`` with a
 * name, Escape closes the top-most one, Tab stays inside it, focus moves in when it opens and
 * back to where it was when it closes, and the page behind does not scroll.
 *
 * ``title`` is the heading (``headerExtra`` goes under it, in the sticky header: tabs).  ``bare``
 * leaves out the header for a caller that lays out its own content and names it with
 * ``labelledBy``.
 */
export function Modal({
  title,
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
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const entry = {};
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (openDialogs.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogs.push(entry);

    const first = panel.querySelector<HTMLElement>('[data-autofocus]');
    (first || panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== entry) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        if (closeRef.current) closeRef.current();
        return;
      }

      if (event.key === 'Tab') {
        const targets = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (targets.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const firstTarget = targets[0];
        const lastTarget = targets[targets.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === firstTarget || active === panel)) {
          event.preventDefault();
          lastTarget.focus();
        } else if (!event.shiftKey && active === lastTarget) {
          event.preventDefault();
          firstTarget.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(entry), 1);
      if (openDialogs.length === 0) document.body.style.overflow = savedOverflow;
      if (previouslyFocused && document.contains(previouslyFocused) && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 ${LAYERS[layer]}`}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={bare ? labelledBy : titleId}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-xl w-full ${SIZES[size]} max-h-[90vh] overflow-y-auto focus:outline-none ${className}`}
      >
        {!bare && (
          <div className="sticky top-0 bg-white border-b z-10">
            <div className="p-6 flex items-center justify-between">
              <h2 id={titleId} className="text-xl font-bold text-gray-900">{title}</h2>
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              )}
            </div>
            {headerExtra}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default Modal;
