import React, { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { CalendarDays, KeyRound, Mail, MapPin, Palette, Save, UserRound } from 'lucide-react';

import { errorMessage, fieldErrors } from '../../../shared/api/errors';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { useDemoAccounts } from '../../../shared/auth/useDemoAccounts';
import { fullName } from '../../../shared/lib/names';
import { formatDate } from '../../../shared/lib/time';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card, CardBody, CardFooter, CardHeader } from '../../../shared/ui/Card';
import { Field } from '../../../shared/ui/Field';
import { Input, Textarea } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ThemePicker } from '../../../shared/ui/ThemeToggle';
import { useToast } from '../../../shared/ui/Toast';
import { PasswordChecklist, PasswordField } from '../components/FormFields';
import { useChangePassword, useUpdateProfile } from '../hooks/useAccount';
import { profileChanges, profileValues, splitInterests, validateProfile } from '../lib/profile';
import { passwordProblem } from '../lib/validation';
import type { ProfileFormValues } from '../types';

const ROLE_LABEL = { student: 'Student', instructor: 'Instructor', admin: 'Administrator' } as const;

type ProfileErrors = Partial<Record<keyof ProfileFormValues, string>>;

// the server names the fields as the form does, except the two role profile ones it nests
const fromServer = (error: unknown): ProfileErrors => {
  const fields = fieldErrors(error);
  const known: Array<keyof ProfileFormValues> = [
    'first_name', 'last_name', 'phone_number', 'bio', 'country', 'city', 'expertise', 'years_of_experience',
    'website_url', 'linkedin_url', 'payout_email', 'learning_goals', 'interests',
  ];
  return Object.fromEntries(known.filter((key) => fields[key]).map((key) => [key, fields[key]]));
};

/** The signed-in user's details, editable. */
const ProfileForm = () => {
  const { user, profile, userType } = useAuth();
  const toast = useToast();
  const update = useUpdateProfile();
  const initial = useMemo(() => profileValues(user, profile), [user, profile]);
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});

  const dirty = (Object.keys(values) as Array<keyof ProfileFormValues>).some((key) => values[key] !== initial[key]);

  const bind = (name: keyof ProfileFormValues) => ({
    name,
    value: values[name],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [name]: event.target.value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = validateProfile(values, userType);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    try {
      const identity = await update.mutateAsync(profileChanges(values, userType));
      setValues(profileValues(identity.user, identity.profile));
      toast.success('Your profile was saved.', 'Profile updated');
    } catch (error) {
      const fields = fromServer(error);
      setErrors(fields);
      if (Object.keys(fields).length === 0) {
        toast.error(errorMessage(error, 'Your profile could not be saved.'), 'Not saved');
      }
    }
  };

  const interests = splitInterests(values.interests);

  return (
    <Card as="section" aria-labelledby="profile-title">
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader title={<span id="profile-title">Profile</span>} description="How you appear to students, instructors and admins." icon={UserRound} />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.first_name}>
              <Input autoComplete="given-name" {...bind('first_name')} />
            </Field>
            <Field label="Last name" error={errors.last_name}>
              <Input autoComplete="family-name" {...bind('last_name')} />
            </Field>
            <Field label="Email" hint="The address you sign in with cannot be changed here.">
              <Input type="email" value={user?.email || ''} disabled readOnly />
            </Field>
            <Field label="Phone" error={errors.phone_number}>
              <Input type="tel" autoComplete="tel" placeholder="+1234567890" {...bind('phone_number')} />
            </Field>
            <Field label="Country" error={errors.country}>
              <Input autoComplete="country-name" {...bind('country')} />
            </Field>
            <Field label="City" error={errors.city}>
              <Input autoComplete="address-level2" {...bind('city')} />
            </Field>
          </div>

          <Field
            label="Bio"
            error={errors.bio}
            aside={<span className="text-xs text-fg-subtle tabular-nums">{values.bio.length}/500</span>}
          >
            <Textarea rows={3} maxLength={500} placeholder="A few words about you" {...bind('bio')} />
          </Field>

          {userType === 'instructor' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expertise" error={errors.expertise} className="sm:col-span-2">
                <Input placeholder="Python, data visualisation, statistics" {...bind('expertise')} />
              </Field>
              <Field label="Years of experience" error={errors.years_of_experience}>
                <Input type="number" min={0} max={80} {...bind('years_of_experience')} />
              </Field>
              <Field label="Payout email" error={errors.payout_email} hint="Where earnings statements would be sent.">
                <Input type="email" {...bind('payout_email')} />
              </Field>
              <Field label="Website" error={errors.website_url}>
                <Input type="url" placeholder="https://" {...bind('website_url')} />
              </Field>
              <Field label="LinkedIn" error={errors.linkedin_url}>
                <Input type="url" placeholder="https://www.linkedin.com/in/..." {...bind('linkedin_url')} />
              </Field>
            </div>
          )}

          {userType === 'student' && (
            <div className="space-y-4">
              <Field label="Learning goals" error={errors.learning_goals}>
                <Textarea rows={3} maxLength={1000} placeholder="What do you want to be able to do?" {...bind('learning_goals')} />
              </Field>
              <Field label="Interests" error={errors.interests} hint="Separate them with commas (at most ten).">
                <Input placeholder="Python, Design, Marketing" {...bind('interests')} />
              </Field>
              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Your interests">
                  {interests.map((interest) => (
                    <Badge key={interest} tone="primary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardBody>
        <CardFooter>
          <Button variant="ghost" onClick={() => { setValues(initial); setErrors({}); }} disabled={!dirty || update.isPending}>
            Discard changes
          </Button>
          <Button type="submit" icon={Save} loading={update.isPending} disabled={!dirty}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' };

/** Change the password; the demo accounts keep theirs so every visitor can use them. */
const PasswordForm = () => {
  const { user } = useAuth();
  const demo = useDemoAccounts();
  const toast = useToast();
  const change = useChangePassword();
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_PASSWORDS, string>>>({});
  const isDemo = Boolean(user && demo.accounts.some((account) => account.email === user.email));

  const set = (name: keyof typeof EMPTY_PASSWORDS) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [name]: event.target.value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!values.current) problems.current = 'Enter your current password';
    const weak = values.next ? passwordProblem(values.next) : 'Choose a new password';
    if (weak) problems.next = weak;
    if (values.next !== values.confirm) problems.confirm = 'Passwords do not match';
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    try {
      await change.mutateAsync({ current_password: values.current, new_password: values.next });
      setValues(EMPTY_PASSWORDS);
      toast.success('Use the new password the next time you sign in.', 'Password changed');
    } catch (error) {
      const fields = fieldErrors(error);
      if (fields.current_password || fields.new_password) {
        setErrors({ current: fields.current_password, next: fields.new_password });
      } else {
        toast.error(errorMessage(error, 'Your password could not be changed.'), 'Not changed');
      }
    }
  };

  return (
    <Card as="section" aria-labelledby="password-title">
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader title={<span id="password-title">Password</span>} description="Use at least 8 characters with a capital letter and a number." icon={KeyRound} />
        <CardBody className="space-y-4">
          {isDemo && (
            <Callout tone="info" title="This is a shared demo account">
              Its password stays as it is so every visitor can sign in. Create your own account to try this form.
            </Callout>
          )}
          <PasswordField
            label="Current password"
            name="current"
            value={values.current}
            onChange={set('current')}
            error={errors.current}
            autoComplete="current-password"
            disabled={isDemo}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              label="New password"
              name="next"
              value={values.next}
              onChange={set('next')}
              error={errors.next}
              autoComplete="new-password"
              disabled={isDemo}
            />
            <PasswordField
              label="Confirm new password"
              name="confirm"
              value={values.confirm}
              onChange={set('confirm')}
              error={errors.confirm}
              autoComplete="new-password"
              disabled={isDemo}
            />
          </div>
          {values.next && <PasswordChecklist password={values.next} />}
        </CardBody>
        <CardFooter>
          <Button type="submit" variant="secondary" loading={change.isPending} disabled={isDemo}>
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

interface SummaryRowProps {
  icon: typeof Mail;
  children: ReactNode;
}

const SummaryRow = ({ icon: Icon, children }: SummaryRowProps) => (
  <li className="flex items-center gap-2.5 text-sm text-fg-muted">
    <Icon size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
    <span className="min-w-0 truncate">{children}</span>
  </li>
);

interface AccountPageProps {
  /** More sections of the role (the student's membership). */
  children?: ReactNode;
}

/** Account settings of every role: the profile, the password and the appearance. */
const AccountPage = ({ children }: AccountPageProps) => {
  const { user, userType } = useAuth();
  const name = fullName(user, 'Your account');
  const place = [user?.city, user?.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" description="Your profile, your password and how the app looks." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card padded>
            <div className="flex items-center gap-4">
              <Avatar name={name} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-fg">{name}</p>
                {userType && <Badge tone="primary" className="mt-1">{ROLE_LABEL[userType]}</Badge>}
              </div>
            </div>
            {user?.bio && <p className="mt-4 text-sm text-fg-muted">{user.bio}</p>}
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              <SummaryRow icon={Mail}>{user?.email}</SummaryRow>
              {place && <SummaryRow icon={MapPin}>{place}</SummaryRow>}
              {user?.date_joined && <SummaryRow icon={CalendarDays}>Member since {formatDate(user.date_joined)}</SummaryRow>}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="appearance-title">
            <CardHeader title={<span id="appearance-title">Appearance</span>} description="Light, dark, or follow your system." icon={Palette} />
            <CardBody>
              <ThemePicker />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {children}
          <ProfileForm />
          <PasswordForm />
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
