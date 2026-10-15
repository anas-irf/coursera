import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, Info, Trash2, LogOut, X } from 'lucide-react';

// Confirm Dialog Context
const ConfirmContext = createContext();

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

// Confirm Dialog Component
const ConfirmDialog = ({ dialog, onConfirm, onCancel }) => {
  if (!dialog) return null;

  const icons = {
    warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
    danger: <Trash2 className="w-6 h-6 text-red-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
    logout: <LogOut className="w-6 h-6 text-orange-500" />
  };

  const buttonStyles = {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-start p-6">
          <div className="flex-shrink-0">
            {icons[dialog.type] || icons.info}
          </div>
          <div className="ml-3 w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {dialog.title}
            </h3>
            <p className="text-sm text-gray-600">
              {dialog.message}
            </p>
          </div>
          {dialog.showClose && (
            <button
              onClick={onCancel}
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
    </div>
  );
};

// Confirm Provider
export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      const dialogConfig = {
        type: 'info',
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

  const confirmWarning = useCallback((message, title = 'Warning') => {
    return confirm({
      type: 'warning',
      title,
      message,
      confirmText: 'Continue',
      cancelText: 'Cancel'
    });
  }, [confirm]);

  const value = useMemo(
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