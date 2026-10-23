import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

type CardElement = 'div' | 'article' | 'section' | 'li';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  /** Adds the inner padding (for a card without header or sections). */
  padded?: boolean;
  /** Lifts the card on hover (a card that is a link or a button). */
  interactive?: boolean;
}

/** The surface everything sits on: a bordered, rounded panel. */
export function Card({ as: Element = 'div', padded = false, interactive = false, className, children, ...rest }: CardProps) {
  return (
    <Element
      className={cn(
        'rounded-xl border border-line bg-surface shadow-card',
        padded && 'p-5',
        interactive && 'transition-shadow duration-200 hover:shadow-pop',
        className
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** A button or a link on the right. */
  action?: ReactNode;
  icon?: LucideIcon;
  /** The heading level of the title (h2 inside a page, h3 inside a section). */
  as?: 'h2' | 'h3';
  className?: string;
  /** Drops the line under the header (a header followed by a chart). */
  plain?: boolean;
}

export function CardHeader({ title, description, action, icon: Icon, as: Heading = 'h2', className, plain = false }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-5 pt-4',
        plain ? 'pb-1' : 'border-b border-line pb-4',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-fg">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <Heading className="text-base font-semibold text-fg">{title}</Heading>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3', className)}>
      {children}
    </div>
  );
}

export default Card;
