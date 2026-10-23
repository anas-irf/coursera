import React from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

type CalloutTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

const STYLES: Record<CalloutTone, { box: string; icon: string; glyph: LucideIcon }> = {
  info: { box: 'border-info-fg/25 bg-info-soft', icon: 'text-info-fg', glyph: Info },
  primary: { box: 'border-primary-fg/25 bg-primary-soft', icon: 'text-primary-fg', glyph: Info },
  success: { box: 'border-success-fg/25 bg-success-soft', icon: 'text-success-fg', glyph: CheckCircle2 },
  warning: { box: 'border-warning-fg/25 bg-warning-soft', icon: 'text-warning-fg', glyph: AlertTriangle },
  danger: { box: 'border-danger-fg/25 bg-danger-soft', icon: 'text-danger-fg', glyph: XCircle },
  neutral: { box: 'border-line bg-surface-muted', icon: 'text-fg-subtle', glyph: Info },
};

interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  /** Another icon, or ``null`` for none. */
  icon?: LucideIcon | null;
  /** A button or link on the right. */
  action?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
  children?: ReactNode;
}

/** A tinted box with an icon: a note, a warning, a confirmation. */
export function Callout({ tone = 'info', title, icon, action, role, className, children }: CalloutProps) {
  const style = STYLES[tone];
  const Icon = icon === undefined ? style.glyph : icon;
  return (
    <div role={role} className={cn('flex gap-3 rounded-xl border p-4 text-sm', style.box, className)}>
      {Icon && <Icon size={18} aria-hidden="true" className={cn('mt-0.5 shrink-0', style.icon)} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className={cn('text-fg-muted', title ? 'mt-0.5' : null)}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export default Callout;
