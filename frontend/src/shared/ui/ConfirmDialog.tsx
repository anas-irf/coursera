import React, { createContext, useContext, useId, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Info, LogOut, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button, IconButton } from './Button';
import type { ButtonVariant } from './Button';
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

const ConfirmContext = createContext<ConfirmApi | null>(null);

export const useConfirm = (): ConfirmApi => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

// how each kind of question looks: its icon, the tint behind it and the confirming button
const LOOKS: Record<ConfirmType, { icon: LucideIcon; tint: string; button: ButtonVariant }> = {
  info: { icon: Info, tint: 'bg-primary-soft text-primary-fg', button: 'primary' },
  warning: { icon: AlertTriangle, tint: 'bg-warning-soft text-warning-fg', button: 'primary' },
  danger: { icon: Trash2, tint: 'bg-danger-soft text-danger-fg', button: 'danger' },
  logout: { icon: LogOut, tint: 'bg-surface-muted text-fg-muted', button: 'primary' },
};

interface ConfirmDialogProps {
  dialog: DialogState | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ dialog, onConfirm, onCancel }: ConfirmDialogProps) => {
  const titleId = useId();
  if (!dialog) return null;

  const look = LOOKS[dialog.type] || LOOKS.info;
  const Icon = look.icon;

  return (
    <Modal bare layer="top" size="sm" labelledBy={titleId} onClose={onCancel}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', look.tint)}>
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 id={titleId} className="text-base font-semibold text-fg">
              {dialog.title}
            </h3>
            <p className="mt-1 text-sm text-fg-muted">{dialog.message}</p>
          </div>
          {dialog.showClose && <IconButton icon={X} label="Close" size="sm" onClick={onCancel} className="-mr-2 -mt-1" />}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {dialog.cancelText || 'Cancel'}
          </Button>
          <Button variant={look.button} onClick={onConfirm}>
            {dialog.confirmText || 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback((options?: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'info',
        title: 'Confirm',
        message: 'Are you sure?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        showClose: true,
        ...options,
        resolve,
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
