import React, { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'danger-soft' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50';

// The hover colour of a button only applies while it is enabled; a link is always "enabled".
// Both spellings are written out: Tailwind only generates the classes it finds in the source.
const VARIANTS: Record<ButtonVariant, { base: string; button: string; link: string }> = {
  primary: {
    base: 'bg-primary text-primary-contrast shadow-sm',
    button: 'enabled:hover:bg-primary-hover',
    link: 'hover:bg-primary-hover',
  },
  secondary: {
    base: 'border border-line-strong bg-surface text-fg shadow-xs',
    button: 'enabled:hover:bg-surface-muted',
    link: 'hover:bg-surface-muted',
  },
  ghost: {
    base: 'text-fg-muted',
    button: 'enabled:hover:bg-surface-muted enabled:hover:text-fg',
    link: 'hover:bg-surface-muted hover:text-fg',
  },
  soft: {
    base: 'bg-primary-soft text-primary-fg',
    button: 'enabled:hover:bg-primary/15',
    link: 'hover:bg-primary/15',
  },
  danger: {
    base: 'bg-danger text-white shadow-sm',
    button: 'enabled:hover:bg-danger/90',
    link: 'hover:bg-danger/90',
  },
  'danger-soft': {
    base: 'bg-danger-soft text-danger-fg',
    button: 'enabled:hover:bg-danger/15',
    link: 'hover:bg-danger/15',
  },
  success: {
    base: 'bg-success text-white shadow-sm',
    button: 'enabled:hover:bg-success/90',
    link: 'hover:bg-success/90',
  },
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const ICON_SIZES: Record<ButtonSize, number> = { xs: 14, sm: 15, md: 16, lg: 18 };

interface StyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  className?: string;
}

/** The classes of a button, for the rare control that cannot be one of the components below. */
export function buttonClasses({ variant = 'primary', size = 'md', block = false, className }: StyleOptions = {},
  element: 'button' | 'link' = 'button'): string {
  const styles = VARIANTS[variant];
  return cn(BASE, styles.base, styles[element], SIZES[size], block && 'w-full', className);
}

interface ContentProps {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  size: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

const Content = ({ icon: Icon, iconRight: IconRight, size, loading, children }: ContentProps) => (
  <>
    {loading ? <Spinner size={ICON_SIZES[size]} className="text-current" label={null} /> : Icon && <Icon size={ICON_SIZES[size]} aria-hidden="true" />}
    {children}
    {IconRight && <IconRight size={ICON_SIZES[size]} aria-hidden="true" />}
  </>
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {
  /** An icon before the label. */
  icon?: LucideIcon;
  /** An icon after the label. */
  iconRight?: LucideIcon;
  /** Shows a spinner in place of the icon and turns the button off while true. */
  loading?: boolean;
}

/** The one button of the app: a variant (what it does) and a size. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = 'md', block, className, icon, iconRight, loading = false, disabled, type = 'button', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      <Content icon={icon} iconRight={iconRight} size={size} loading={loading}>
        {children}
      </Content>
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, StyleOptions {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

/** A link that looks like a button (navigation inside the app). */
export function ButtonLink({ variant, size = 'md', block, className, icon, iconRight, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className }, 'link')} {...rest}>
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </Link>
  );
}

export interface ButtonAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement>, StyleOptions {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

/** A link to another site (or a file) that looks like a button. */
export function ButtonAnchor({ variant, size = 'md', block, className, icon, iconRight, children, ...rest }: ButtonAnchorProps) {
  return (
    <a className={buttonClasses({ variant, size, block, className }, 'link')} {...rest}>
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </a>
  );
}

type IconButtonSize = 'sm' | 'md' | 'lg';

const ICON_BUTTON_SIZES: Record<IconButtonSize, string> = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10' };
const ICON_BUTTON_GLYPHS: Record<IconButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** What the button does: an icon alone has no text, so the label is required. */
  label: string;
  variant?: ButtonVariant;
  size?: IconButtonSize;
  /** A small count drawn on the corner (unread notifications). */
  badge?: ReactNode;
}

/** A square button with an icon and an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', badge, className, type = 'button', title, ...rest },
  ref
) {
  const styles = VARIANTS[variant];
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(BASE, 'relative shrink-0 p-0', styles.base, styles.button, ICON_BUTTON_SIZES[size], className)}
      {...rest}
    >
      <Icon size={ICON_BUTTON_GLYPHS[size]} aria-hidden="true" />
      {badge !== undefined && badge !== null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface">
          {badge}
        </span>
      )}
    </button>
  );
});

export default Button;
