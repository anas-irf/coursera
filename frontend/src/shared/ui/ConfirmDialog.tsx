import React, { createContext, useContext, useId, useState, useCallback, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { AlertTriangle, Info, Trash2, LogOut, X } from 'lucide-react';

import Modal from './Modal';

export type ConfirmType = 'info' | 'warning' | 'danger' | 'logout';

/** What a confirmation says; whatever is left out has a default ("Confirm" / "Are you sure?"). */
export interface ConfirmOptions {
  type?: ConfirmType;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showClose?: boolean;
}

/** Every method answers ``true`` when the user confirmed and ``false`` when they did not. */
export interface ConfirmApi {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
  confirmDelete: (message?: string, title?: string) => Promise<boolean>;
  confirmLogout: (message?: string, title?: string) => Promise<boolean>;
  confirmWarning: (message: string, title?: string) => Promise<boolean>;
}

interface DialogState extends ConfirmOptions {
  type: ConfirmType;
  resolve: (confirmed: boolean) => void;
}

// Confirm Dialog Context
const ConfirmContext = createContext<ConfirmApi | null>(null);

export const useConfirm = (): ConfirmApi => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

interface ConfirmDialogProps {
  dialog: DialogState | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirm Dialog Component
const ConfirmDialog = ({ dialog, onConfirm, onCancel }: ConfirmDialogProps) => {
  const titleId = useId();
  if (!dialog) return null;

  const icons: Record<ConfirmType, ReactElement> = {
    warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
    danger: <Trash2 className="w-6 h-6 text-red-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
    logout: <LogOut className="w-6 h-6 text-orange-500" />
  };

  const buttonStyles: Record<ConfirmType, { confirm: string; cancel: string }> = {
    warning: {
      confirm: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      cancel: 'bg-gray-300 hover:bg-gray-400 text-gray-700'
    },
    danger: {
      confirm: 'bg-red-600 hover:bg-red-700 text-white',
      cancel: 'bg-gray-300 hover:bg-gray-400 text-gray-700'
    },
    info: {
      confirm: 'bg-blue-600 hover:bg-blue-700 text-white',
      cancel: 'bg-gray-300 hover:bg-gray-400 text-gray-700'
    },
    logout: {
      confirm: 'bg-orange-600 hover:bg-orange-700 text-white',
      cancel: 'bg-gray-300 hover:bg-gray-400 text-gray-700'
    }
  };

  return (
    <Modal bare layer="top" size="sm" labelledBy={titleId} onClose={onCancel}>
      <div>
        <div className="flex items-start p-6">
          <div className="flex-shrink-0">
            {icons[dialog.type] || icons.info}
          </div>
          <div className="ml-3 w-full">
            <h3 id={titleId} className="text-lg font-medium text-gray-900 mb-2">
              {dialog.title}
            </h3>
            <p className="text-sm text-gray-600">
              {dialog.message}
            </p>
          </div>
          {dialog.showClose && (
            <button
              onClick={onCancel}
              aria-label="Close"
              className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex justify-end space-x-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              buttonStyles[dialog.type]?.cancel || buttonStyles.info.cancel
            }`}
          >
            {dialog.cancelText || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              buttonStyles[dialog.type]?.confirm || buttonStyles.info.confirm
            }`}
          >
            {dialog.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Confirm Provider
export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback((options?: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const dialogConfig = {
        type: 'info' as ConfirmType,
        title: 'Confirm',
        message: 'Are you sure?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        showClose: true,
        ...options
      };

      setDialog({
        ...dialogConfig,
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialog?.resolve) {
      dialog.resolve(true);
    }
    setDialog(null);
  }, [dialog]);

  const handleCancel = useCallback(() => {
    if (dialog?.resolve) {
      dialog.resolve(false);
    }
    setDialog(null);
  }, [dialog]);

  // Convenience methods
  const confirmDelete = useCallback((message = 'This action cannot be undone.', title = 'Delete Item') => {
    return confirm({
      type: 'danger',
      title,
      message,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
  }, [confirm]);

  const confirmLogout = useCallback((message = 'You will need to login again.', title = 'Logout') => {
    return confirm({
      type: 'logout',
      title,
      message,
      confirmText: 'Logout',
      cancelText: 'Stay'
    });
  }, [confirm]);

  const confirmWarning = useCallback((message: string, title = 'Warning') => {
    return confirm({
      type: 'warning',
      title,
      message,
      confirmText: 'Continue',
      cancelText: 'Cancel'
    });
  }, [confirm]);

  const value = useMemo<ConfirmApi>(
    () => ({ confirm, confirmDelete, confirmLogout, confirmWarning }),
    [confirm, confirmDelete, confirmLogout, confirmWarning]
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        dialog={dialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};
