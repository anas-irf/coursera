import React, { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Award, BarChart3, BookOpenCheck, GraduationCap, MessagesSquare, Presentation, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { errorBody, errorMessage, fieldErrors } from '../../../shared/api/errors';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { homePathFor } from '../../../shared/auth/paths';
import type { DemoRole } from '../../../shared/auth/types';
import { useDemoAccounts } from '../../../shared/auth/useDemoAccounts';
import { cn } from '../../../shared/lib/cn';
import type { UserType } from '../../../shared/types';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Checkbox } from '../../../shared/ui/Checkbox';
import { Logo } from '../../../shared/ui/Logo';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { Spinner } from '../../../shared/ui/Spinner';
import { ThemeToggle } from '../../../shared/ui/ThemeToggle';
import { DEMO_ROLES } from '../components/DemoSwitcher';
import { PasswordChecklist, PasswordField, TextField } from '../components/FormFields';
import { serverErrors, validateLogin, validateSignup } from '../lib/validation';
import type { FieldErrors, SignupFormValues, SignupRole } from '../types';

const EMPTY_FORM: SignupFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  userType: 'student',
};

const ROLES = [
  { value: 'student' as SignupRole, label: 'Student', description: 'Learn new skills', icon: GraduationCap },
  { value: 'instructor' as SignupRole, label: 'Instructor', description: 'Share knowledge', icon: Presentation },
];

const HIGHLIGHTS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: BookOpenCheck,
    title: 'Courses that teach',
    text: 'Video, readings, timed quizzes and graded assignments, with progress saved to the second.',
  },
  {
    icon: Award,
    title: 'Grades and certificates',
    text: 'Weighted gradebooks, achievements and certificates anyone can verify.',
  },
  {
    icon: BarChart3,
    title: 'Tools for teachers and admins',
    text: 'A curriculum builder, grading, analytics, earnings, moderation and revenue reports.',
  },
  {
    icon: MessagesSquare,
    title: 'Live messaging',
    text: 'Real-time conversations over WebSockets, with typing indicators and notifications.',
  },
];

const STACK = ['React 19', 'TypeScript', 'TanStack Query', 'Tailwind CSS', 'Django 5', 'DRF', 'Channels', 'PostgreSQL', 'Stripe'];

/** What the route guard leaves in the location state when it sends a visitor here. */
interface LoginLocationState {
  from?: { pathname?: string };
}

/** The product, beside the form on a large screen. */
const BrandPanel = () => (
  <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-white lg:flex lg:flex-col">
    <div className="bg-dots absolute inset-0 opacity-50" aria-hidden="true" />
    <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" aria-hidden="true" />
    <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-plus/25 blur-3xl" aria-hidden="true" />

    <div className="relative flex flex-1 flex-col justify-between gap-10 p-10 xl:px-14 xl:py-12">
      <Logo inverted />

      <div className="max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Full-stack learning platform</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          From the first lesson to the certificate, in one place.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-100">
          Students learn, instructors teach and earn, administrators keep the catalogue in shape. Every role has its
          own workspace, and every figure comes from real data.
        </p>

        <ul className="mt-8 grid gap-5 xl:grid-cols-2">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-brand-100">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <ul className="flex flex-wrap gap-2" aria-label="Built with">
          {STACK.map((item) => (
            <li key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-50 ring-1 ring-white/10">
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-brand-200">{BRAND.disclaimer}</p>
      </div>
    </div>
  </aside>
);

interface DemoPanelProps {
  onPick: (role: DemoRole) => void;
  busy: DemoRole | null;
}

/** One click into each role of the demo (only when the server runs in demo mode). */
const DemoPanel = ({ onPick, busy }: DemoPanelProps) => {
  const demo = useDemoAccounts();
  if (!demo.enabled) return null;

  return (
    <section aria-labelledby="demo-heading" className="mb-6">
      <div className="rounded-2xl border border-primary/25 bg-primary-soft/50 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} aria-hidden="true" className="text-primary-fg" />
          <h2 id="demo-heading" className="text-sm font-semibold text-fg">
            Explore the live demo
          </h2>
        </div>
        <p className="mt-1 text-xs text-fg-muted">One click, no password. Each role comes with seeded courses and activity.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {demo.accounts.map((account) => {
            const role = DEMO_ROLES[account.role];
            const Icon = role.icon;
            const loading = busy === account.role;
            return (
              <button
                key={account.role}
                type="button"
                onClick={() => onPick(account.role)}
                disabled={busy !== null}
                aria-label={`Explore as ${role.label}`}
                title={account.headline}
                className={cn(
                  'group flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left shadow-xs transition',
                  'hover:border-primary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-60 sm:flex-col sm:items-start sm:gap-2 sm:py-3'
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-fg">
                  {loading ? <Spinner size={16} label={null} /> : <Icon size={16} aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">{role.label}</span>
                  <span className="block truncate text-xs text-fg-subtle">{account.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative mt-6 text-center">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden="true" />
        <span className="relative bg-canvas px-3 text-xs font-medium uppercase tracking-wider text-fg-subtle">
          or sign in with email
        </span>
      </div>
    </section>
  );
};

const LoginPage = () => {
  const { login, loginAsDemo, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState<SignupFormValues>(EMPTY_FORM);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState<DemoRole | null>(null);

  // back to the page that asked for a login, else to the user's own home (the route guards send
  // a user who asked for another role's page home anyway)
  const goOn = (role: UserType) => {
    const state = location.state as LoginLocationState | null;
    const from = state && state.from && state.from.pathname;
    navigate(from && from !== '/login' ? from : homePathFor(role), { replace: true });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    // the inputs are the form's own: their names are the keys of its values
    const name = event.target.name as keyof SignupFormValues;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // the message goes away once the user starts correcting the field
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        goOn(response.user.user_type);
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
      const data = errorBody(error);
      setErrors(
        data ? serverErrors(fieldErrors(error), data) : { general: 'Network error. Please check your connection.' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const enterDemo = async (role: DemoRole) => {
    setDemoBusy(role);
    setErrors({});
    try {
      await loginAsDemo(role);
      navigate(homePathFor(role), { replace: true });
    } catch (error) {
      setErrors({ general: errorMessage(error, 'The demo account could not be opened. Please try again.') });
      setDemoBusy(null);
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
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <span className="lg:invisible">
            <Logo />
          </span>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="mt-1.5 text-sm text-fg-muted">
                {isLogin
                  ? 'Sign in to continue to your courses, students or the admin console.'
                  : 'Start learning, or start teaching, in a couple of minutes.'}
              </p>
            </div>

            {isLogin && <DemoPanel onPick={enterDemo} busy={demoBusy} />}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {notice && (
                <Callout tone="success" role="status">
                  {notice}
                </Callout>
              )}

              {errors.general && (
                <Callout tone="danger" role="alert">
                  {errors.general}
                </Callout>
              )}

              {!isLogin && (
                <div>
                  <p className="mb-2 text-sm font-medium text-fg">I want to join as</p>
                  <SegmentedControl
                    label="I want to join as"
                    variant="cards"
                    options={ROLES}
                    value={formData.userType}
                    onChange={(userType) => setFormData((prev) => ({ ...prev, userType }))}
                  />
                </div>
              )}

              {!isLogin && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField
                      label="First name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      error={errors.firstName}
                      placeholder="Ada"
                      autoComplete="given-name"
                    />
                    <TextField
                      label="Last name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      error={errors.lastName}
                      placeholder="Lovelace"
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
                placeholder="name@example.com"
                autoComplete="email"
              />

              <PasswordField
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                error={errors.password}
                placeholder={isLogin ? 'Enter your password' : 'Create a password'}
                autoComplete={passwordAutocomplete}
              >
                {!isLogin && formData.password && <PasswordChecklist password={formData.password} />}
              </PasswordField>

              {!isLogin && (
                <PasswordField
                  label="Confirm Password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  error={errors.confirmPassword}
                  placeholder="Repeat the password"
                  autoComplete="new-password"
                />
              )}

              {!isLogin && (
                <div>
                  <Checkbox
                    checked={agreedToTerms}
                    onChange={(event) => {
                      setAgreedToTerms(event.target.checked);
                      if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                    }}
                    label={
                      <span className="font-normal text-fg-muted">
                        I accept the Terms of Use and the Privacy Notice.
                        {formData.userType === 'instructor' && ' I also agree to the Instructor Terms.'}
                      </span>
                    }
                  />
                  {errors.terms && <p className="mt-1.5 text-xs font-medium text-danger-fg">{errors.terms}</p>}
                </div>
              )}

              <Button type="submit" size="lg" block loading={isLoading}>
                {isLoading ? 'Please wait...' : isLogin ? 'Log in' : `Sign up as ${formData.userType}`}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-fg-muted">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-primary-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>
        </main>

        <footer className="px-4 pb-6 text-center text-xs text-fg-subtle lg:hidden">{BRAND.disclaimer}</footer>
      </div>
    </div>
  );
};

export default LoginPage;
