import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

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

// Toast Context
const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Component
const Toast = ({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) => {
  const icons: Record<ToastType, ReactElement> = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const bgColors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  };

  return (
    <div className={`flex items-start space-x-3 p-4 rounded-lg border shadow-md ${bgColors[toast.type]}`}>
      <div className="flex-shrink-0">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-sm font-medium text-gray-900 mb-1">
            {toast.title}
          </h4>
        )}
        <p className="text-sm text-gray-700">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast Container
const ToastContainer = ({ toasts, removeToast }: { toasts: ToastItem[]; removeToast: (id: number) => void }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm w-full">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

type NewToast = Pick<ToastItem, 'message'> & Partial<Omit<ToastItem, 'id' | 'message'>>;

// Toast Provider
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: NewToast): number => {
    const id = Date.now() + Math.random();
    const newToast: ToastItem = {
      id,
      type: 'info',
      duration: 5000,
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, [removeToast]);

  // Convenience methods
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
