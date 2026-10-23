import React, { createContext, useContext, useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';
import { usePopover } from './usePopover';

const MenuContext = createContext<() => void>(() => {});

const ITEMS = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])';

interface MenuProps {
  /** The accessible name of the button and of the menu. */
  label: string;
  /** What the button shows (an avatar, an icon ...). */
  button: ReactNode;
  buttonClassName?: string;
  /** Which edge of the button the menu lines up with. */
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

/**
 * A button that opens a list of actions (``role="menu"``).  The first item takes the focus, the
 * arrow keys move between items, Escape or a click outside closes it.
 */
export function Menu({ label, button, buttonClassName, align = 'end', className, children }: MenuProps) {
  const { open, toggle, close, rootRef, triggerRef } = usePopover();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEMS) || []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') close();
    if (next >= 0) {
      event.preventDefault();
      items[next].focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <MenuContext.Provider value={close}>
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            className={cn(
              'absolute z-50 mt-2 min-w-[14rem] rounded-xl border border-line bg-surface-raised p-1.5 shadow-pop animate-scale-in',
              align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
              className
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: LucideIcon;
  /** Where the item leads (a link of the app), or ... */
  to?: string;
  /** ... what it does. */
  onSelect?: () => void;
  /** Makes it one option of a set (``menuitemradio``) and marks the chosen one. */
  checked?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  children: ReactNode;
}

const itemClasses = (tone: 'default' | 'danger') =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
    'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    tone === 'danger'
      ? 'text-danger-fg hover:bg-danger-soft focus:bg-danger-soft'
      : 'text-fg hover:bg-surface-muted focus:bg-surface-muted'
  );

export function MenuItem({ icon: Icon, to, onSelect, checked, tone = 'default', disabled, children }: MenuItemProps) {
  const close = useContext(MenuContext);
  const radio = checked !== undefined;
  const content = (
    <>
      {Icon && <Icon size={16} aria-hidden="true" className={tone === 'danger' ? '' : 'text-fg-subtle'} />}
      <span className="flex-1">{children}</span>
      {radio && checked && <Check size={16} aria-hidden="true" className="text-primary-fg" />}
    </>
  );

  if (to) {
    return (
      <Link role="menuitem" tabIndex={-1} to={to} onClick={close} className={itemClasses(tone)}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? checked : undefined}
      tabIndex={-1}
      disabled={disabled}
      onClick={() => {
        close();
        if (onSelect) onSelect();
      }}
      className={itemClasses(tone)}
    >
      {content}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1.5 my-1.5 h-px bg-line" />;
}

/** A title or a few lines of context at the top of a menu (not an item). */
export function MenuHeader({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-2 pt-1.5">{children}</div>;
}

/** The name of a group of items. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{children}</div>;
}

export default Menu;
