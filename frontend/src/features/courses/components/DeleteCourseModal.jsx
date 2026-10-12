import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const DeleteCourseModal = ({ course, currentUser, onClose, onConfirm }) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const expectedConfirmation = `${currentUser?.email}/${course?.title}`;

  const handleDelete = async () => {
    if (confirmationInput !== expectedConfirmation) {
      setError(`Please type "${expectedConfirmation}" to confirm.`);
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await onConfirm(confirmationInput);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete course');
      setIsDeleting(false);
    }
  };

  const isConfirmationValid = confirmationInput === expectedConfirmation;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Delete Course</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>

          {/* Warning Content */}
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700 font-medium mb-2">
                ⚠️ This will permanently delete the course:
              </p>
              <p className="text-sm text-red-600 font-mono bg-red-100 px-2 py-1 rounded">
                {course?.title}
              </p>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p>This action will:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Permanently delete the course and all its content</li>
                <li>Remove all sections and lectures</li>
                <li>Delete course analytics and data</li>
                <li>Cannot be recovered once deleted</li>
              </ul>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono text-red-600">{expectedConfirmation}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => {
                setConfirmationInput(e.target.value);
                setError('');
              }}
              disabled={isDeleting}
              placeholder={expectedConfirmation}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:opacity-50"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!isConfirmationValid || isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Deleting...
                </div>
              ) : (
                'Delete Course'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteCourseModal;