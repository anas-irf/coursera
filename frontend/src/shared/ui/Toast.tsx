import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  duration: number;
  message: string;
  title?: string;
}

/** What may be said besides the message and the title. */
export interface ToastOptions {
  /** Milliseconds on screen (0 keeps it until it is closed). */
  duration?: number;
}

type ShowToast = (message: string, title?: string, options?: ToastOptions) => number;

/** One method per kind; each answers the id of the toast it showed. */
export interface ToastApi {
  success: ShowToast;
  error: ShowToast;
  warning: ShowToast;
  info: ShowToast;
}

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const LOOKS: Record<ToastType, { icon: LucideIcon; tint: string; bar: string }> = {
  success: { icon: CheckCircle2, tint: 'bg-success-soft text-success-fg', bar: 'bg-success' },
  error: { icon: AlertCircle, tint: 'bg-danger-soft text-danger-fg', bar: 'bg-danger' },
  warning: { icon: AlertTriangle, tint: 'bg-warning-soft text-warning-fg', bar: 'bg-warning' },
  info: { icon: Info, tint: 'bg-primary-soft text-primary-fg', bar: 'bg-primary' },
};

const Toast = ({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) => {
  const look = LOOKS[toast.type];
  const Icon = look.icon;
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface-raised p-4 pl-5 shadow-pop animate-slide-up"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', look.bar)} aria-hidden="true" />
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', look.tint)}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && <h4 className="text-sm font-semibold text-fg">{toast.title}</h4>}
        <p className="whitespace-pre-line text-sm text-fg-muted">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }: { toasts: ToastItem[]; removeToast: (id: number) => void }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[10000] flex flex-col items-center gap-3 p-4 sm:inset-x-auto sm:right-0 sm:w-96 sm:items-end">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};

type NewToast = Pick<ToastItem, 'message'> & Partial<Omit<ToastItem, 'id' | 'message'>>;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: NewToast): number => {
    const id = Date.now() + Math.random();
    const newToast: ToastItem = {
      id,
      type: 'info',
      duration: 5000,
      ...toast
    };

    setToasts((prev) => [...prev, newToast]);

    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, [removeToast]);

  const success = useCallback<ShowToast>((message, title, options = {}) => {
    return addToast({ type: 'success', message, title, ...options });
  }, [addToast]);

  const error = useCallback<ShowToast>((message, title, options = {}) => {
    return addToast({ type: 'error', message, title, duration: 7000, ...options });
  }, [addToast]);

  const warning = useCallback<ShowToast>((message, title, options = {}) => {
    return addToast({ type: 'warning', message, title, ...options });
  }, [addToast]);

  const info = useCallback<ShowToast>((message, title, options = {}) => {
    return addToast({ type: 'info', message, title, ...options });
  }, [addToast]);

  // stable, so the many components that call useToast() do not render again for every toast
  const value = useMemo<ToastApi>(
    () => ({ success, error, warning, info }),
    [success, error, warning, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
