import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, User, GraduationCap } from 'lucide-react';

import { useAuth } from '../../../shared/auth/AuthProvider';
import { homePathFor } from '../../../shared/auth/paths';
import { fieldErrors } from '../../../shared/api/errors';
import { PasswordField, TextField } from '../components/FormFields';
import {
  passwordChecks,
  serverErrors,
  validateLogin,
  validateSignup,
} from '../lib/validation';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  userType: 'student',
};

const ROLES = [
  { value: 'student', label: 'Student', hint: 'Learn new skills', icon: GraduationCap },
  { value: 'instructor', label: 'Instructor', hint: 'Share knowledge', icon: User },
];

const Header = () => (
  <header className="bg-white border-b border-gray-200 px-4 py-4">
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center">
        <svg className="h-8 w-8 text-blue-600 mr-2" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <rect x="0" y="0" width="14" height="14" rx="2" />
          <rect x="18" y="0" width="14" height="14" rx="2" />
          <rect x="0" y="18" width="14" height="14" rx="2" />
          <rect x="18" y="18" width="14" height="14" rx="2" />
        </svg>
        <span className="text-2xl font-semibold text-gray-900">coursera</span>
      </div>
    </div>
  </header>
);

const LoginPage = () => {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // the message goes away once the user starts correcting the field
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) return;

    const problems = isLogin ? validateLogin(formData) : validateSignup(formData, agreedToTerms);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        const response = await login(formData.email, formData.password);
        // back to the page that asked for a login, else to the user's own home
        const from = location.state && location.state.from && location.state.from.pathname;
        navigate(from && from !== '/login' ? from : homePathFor(response.user.user_type), { replace: true });
      } else {
        await signup({
          email: formData.email,
          password: formData.password,
          confirm_password: formData.confirmPassword,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone_number: formData.phoneNumber,
          user_type: formData.userType,
        });
        // registration done: continue with the login form
        const { email } = formData;
        setIsLogin(true);
        setFormData({ ...EMPTY_FORM, email });
        setAgreedToTerms(false);
        setNotice('Account created. Please log in.');
      }
    } catch (error) {
      const data = error.response && error.response.data;
      setErrors(
        data ? serverErrors(fieldErrors(error), data) : { general: 'Network error. Please check your connection.' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setNotice('');
    setFormData(EMPTY_FORM);
    setAgreedToTerms(false);
  };

  const passwordAutocomplete = isLogin ? 'current-password' : 'new-password';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <form onSubmit={handleSubmit} noValidate className="p-8">
              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                {isLogin ? 'Welcome back' : 'Join Coursera'}
              </h1>

              {!isLogin && (
                <p className="text-center text-gray-600 text-sm mb-6">
                  Start learning with unlimited access to courses
                </p>
              )}

              {notice && (
                <div role="status" className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-700">{notice}</p>
                </div>
              )}

              {errors.general && (
                <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </div>
              )}

              {/* User Type Selection - Only for Signup */}
              {!isLogin && (
                <fieldset className="mb-6">
                  <legend className="block text-sm font-medium text-gray-700 mb-2">I want to join as</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {ROLES.map(({ value, label, hint, icon: Icon }) => {
                      const selected = formData.userType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setFormData((prev) => ({ ...prev, userType: value }))}
                          className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
                            selected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <Icon size={24} className={selected ? 'text-blue-600' : 'text-gray-600'} />
                          <span className={`mt-2 font-medium ${selected ? 'text-blue-900' : 'text-gray-700'}`}>
                            {label}
                          </span>
                          <span className="text-xs text-gray-500 mt-1">{hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="space-y-4 mt-6">
                {!isLogin && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label="First name"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        error={errors.firstName}
                        placeholder="First name"
                        autoComplete="given-name"
                      />
                      <TextField
                        label="Last name"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        error={errors.lastName}
                        placeholder="Last name"
                        autoComplete="family-name"
                      />
                    </div>

                    <TextField
                      label="Phone number (optional)"
                      name="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      error={errors.phoneNumber}
                      placeholder="+1234567890"
                      autoComplete="tel"
                    />
                  </>
                )}

                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  error={errors.email}
                  placeholder="name@email.com"
                  autoComplete="email"
                />

                <PasswordField
                  label="Password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  error={errors.password}
                  placeholder={isLogin ? 'Enter your password' : 'Create password'}
                  autoComplete={passwordAutocomplete}
                >
                  {!isLogin && formData.password && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <p className="text-xs font-medium text-gray-700 mb-2">Password must contain:</p>
                      <ul className="space-y-1">
                        {passwordChecks(formData.password).map((check) => (
                          <li key={check.id} className="flex items-center text-xs">
                            <Check size={14} className={`mr-2 ${check.met ? 'text-green-500' : 'text-gray-300'}`} />
                            <span className={check.met ? 'text-green-700' : 'text-gray-500'}>{check.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </PasswordField>

                {!isLogin && (
                  <PasswordField
                    label="Confirm Password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    error={errors.confirmPassword}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                  />
                )}

                {!isLogin && (
                  <div>
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                        }}
                        className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="terms" className="ml-2 text-xs text-gray-600">
                        I accept the Terms of Use and the Privacy Notice of Coursera.
                        {formData.userType === 'instructor' && ' I also agree to the Instructor Terms.'}
                      </label>
                    </div>
                    {errors.terms && <p className="text-xs text-red-600 mt-1">{errors.terms}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white py-3 px-4 rounded-md transition duration-200 font-medium`}
                >
                  {isLoading ? 'Processing...' : isLogin ? 'Log in' : `Sign up as ${formData.userType}`}
                </button>
              </div>

              <div className="mt-6 text-center">
                <span className="text-sm text-gray-600">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    type="button"
                    onClick={switchMode}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {isLogin ? 'Sign up' : 'Log in'}
                  </button>
                </span>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
