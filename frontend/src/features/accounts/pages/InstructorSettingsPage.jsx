import React from 'react';

import { useAuth } from '../../../app/AuthProvider';

const fieldClass =
  'w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700';

/** The instructor's profile as stored; editing is not available yet. */
const InstructorSettingsPage = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Profile editing and payout settings are not available yet. Your current details are shown below.
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input type="text" className={fieldClass} value={(user && user.first_name) || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input type="text" className={fieldClass} value={(user && user.last_name) || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input type="email" className={fieldClass} value={(user && user.email) || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input type="tel" className={fieldClass} value={(user && user.phone_number) || ''} readOnly />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorSettingsPage;
