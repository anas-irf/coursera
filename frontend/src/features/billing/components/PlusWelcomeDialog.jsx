import React from 'react';
import { Crown, Trophy } from 'lucide-react';

/** Congratulations popup shown after a successful Stripe checkout. */
const PlusWelcomeDialog = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full text-center animate-pulse">
      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
        <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">🎉 Congratulations!</h2>
      <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
        Welcome to Coursera Plus! You now have unlimited access to all Plus courses.
      </p>
      <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
        <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
        <span>Your subscription is now active</span>
      </div>
      <button
        onClick={onClose}
        className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl text-sm sm:text-base font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
      >
        Get Started!
      </button>
    </div>
  </div>
);

export default PlusWelcomeDialog;
