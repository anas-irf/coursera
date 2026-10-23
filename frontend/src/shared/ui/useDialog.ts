import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// the dialogs that are open, the newest last: only that one answers Escape and Tab
const openDialogs: object[] = [];
let savedOverflow = '';

/**
 * What every popup of the app does (``Modal``, ``Drawer``): while it is open Escape closes the
 * top-most one, Tab stays inside it, the page behind does not scroll; focus moves in when it
 * opens (to the element marked ``data-autofocus``, else the panel) and back where it was when it
 * closes.
 */
export function useDialog(panelRef: RefObject<HTMLElement | null>, onClose?: () => void): void {
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
    // the panel is mounted once with the dialog; onClose is read through the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useDialog;
