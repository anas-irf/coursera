import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { CircleCheck, CircleSlash, Crown, Layers, Save, Scale, Server } from 'lucide-react';

import { errorMessage, fieldErrors } from '../../../shared/api/errors';
import { formatMoney } from '../../../shared/lib/money';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card, CardBody, CardFooter, CardHeader } from '../../../shared/ui/Card';
import ErrorState from '../../../shared/ui/ErrorState';
import { Field } from '../../../shared/ui/Field';
import { Input, Textarea } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '../../../shared/ui/Table';
import { useToast } from '../../../shared/ui/Toast';
import { usePlans, usePlatform, useUpdatePlan } from '../hooks/useAdmin';
import { planValues, validatePlan } from '../lib/plans';
import type { PlanErrors, PlanValues } from '../lib/plans';
import type { AdminPlan, PlatformEnvironment, PlatformRules } from '../types';

const CYCLE = { monthly: { title: 'Monthly plan', per: 'month' }, yearly: { title: 'Annual plan', per: 'year' } } as const;

const toValues = planValues;

/** One plan, editable: what the checkout page sells. */
const PlanCard = ({ plan }: { plan: AdminPlan }) => {
  const update = useUpdatePlan();
  const toast = useToast();
  const [values, setValues] = useState<PlanValues>(() => toValues(plan));
  const [errors, setErrors] = useState<PlanErrors>({});
  const initial = toValues(plan);
  const dirty = values.name !== initial.name || values.description !== initial.description || values.price !== initial.price;
  const cycle = CYCLE[plan.cycle];

  const set = (name: keyof PlanValues) => (event: { target: { value: string } }) => {
    setValues((prev) => ({ ...prev, [name]: event.target.value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = validatePlan(values);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    update.mutate(
      {
        cycle: plan.cycle,
        changes: { name: values.name.trim(), description: values.description.trim(), price: Number(values.price) },
      },
      {
        onSuccess: (saved) => {
          setValues(toValues(saved));
          toast.success(`${saved.name} now sells at ${formatMoney(saved.price)} per ${cycle.per}.`, 'Plan saved');
        },
        onError: (error) => {
          const fields = fieldErrors(error);
          if (fields.name || fields.description || fields.price) {
            setErrors({ name: fields.name, description: fields.description, price: fields.price });
          } else {
            toast.error(errorMessage(error, 'The plan could not be saved.'), 'Not saved');
          }
        },
      }
    );
  };

  return (
    <Card as="article" aria-label={cycle.title}>
      <form onSubmit={save} noValidate>
        <CardHeader
          title={cycle.title}
          description={`${plan.members} member${plan.members === 1 ? '' : 's'} on this plan`}
          icon={Crown}
          action={plan.configured ? <Badge tone="success">Configured</Badge> : <Badge tone="neutral">Built-in default</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Field label="Name" error={errors.name}>
              <Input value={values.name} onChange={set('name')} maxLength={100} />
            </Field>
            <Field label={`Price per ${cycle.per}`} error={errors.price}>
              <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={values.price} onChange={set('price')} />
            </Field>
          </div>
          <Field label="Description" error={errors.description} hint="Shown on the checkout page.">
            <Textarea rows={2} maxLength={500} value={values.description} onChange={set('description')} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button variant="ghost" onClick={() => { setValues(initial); setErrors({}); }} disabled={!dirty || update.isPending}>
            Reset
          </Button>
          <Button type="submit" icon={Save} loading={update.isPending} disabled={!dirty}>
            Save plan
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

const RULES: Array<{ key: keyof PlatformRules; label: string; unit: string; help: string }> = [
  { key: 'revenue_share_percent', label: 'Instructor revenue share', unit: '%', help: 'of each month of Plus payments, shared among the Plus courses' },
  { key: 'course_passing_grade', label: 'Passing grade', unit: '%', help: 'weighted course grade that earns a certificate' },
  { key: 'quiz_submit_grace_seconds', label: 'Quiz grace period', unit: ' s', help: 'how late a timed quiz may still be handed in' },
  { key: 'access_token_minutes', label: 'Session token lifetime', unit: ' min', help: 'before the browser refreshes it' },
  { key: 'refresh_token_days', label: 'Sign-in lifetime', unit: ' days', help: 'without activity before signing in again' },
];

const EnvironmentRow = ({ label, on, detail }: { label: string; on: boolean; detail?: string }) => (
  <li className="flex items-center justify-between gap-3 py-2.5">
    <span className="text-sm text-fg-muted">{label}</span>
    <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
      {on ? (
        <CircleCheck size={15} aria-hidden="true" className="text-success-fg" />
      ) : (
        <CircleSlash size={15} aria-hidden="true" className="text-fg-subtle" />
      )}
      {detail || (on ? 'On' : 'Off')}
    </span>
  </li>
);

const environmentRows = (environment: PlatformEnvironment) => [
  { label: 'Demo mode', on: environment.demo_mode },
  { label: 'Debug', on: environment.debug },
  { label: 'Database', on: true, detail: environment.database === 'postgresql' ? 'PostgreSQL' : 'SQLite' },
  { label: 'Real-time layer', on: true, detail: environment.realtime === 'redis' ? 'Redis' : 'In memory' },
  { label: 'Stripe payments', on: environment.stripe, detail: environment.stripe ? 'Configured' : 'Not configured' },
  { label: 'API version', on: true, detail: environment.api_version },
];

/** The plans and their prices (editable), the rules and the catalogue (read from the server). */
const SettingsPage = () => {
  const plans = usePlans();
  const platform = usePlatform();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="The Plus plans can be changed here; the rules come from the server's configuration."
      />

      <section aria-labelledby="plans-heading" className="space-y-4">
        <div>
          <h2 id="plans-heading" className="text-lg font-semibold text-fg">Coursera Plus plans</h2>
          <p className="mt-0.5 text-sm text-fg-muted">What the checkout page offers and Stripe charges.</p>
        </div>
        {plans.isPending && <PageSpinner className="h-48" />}
        {plans.isError && <ErrorState title="The plans could not be loaded" error={plans.error} onRetry={() => plans.refetch()} />}
        {plans.isSuccess && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {plans.data.map((plan) => (
                <PlanCard key={plan.cycle} plan={plan} />
              ))}
            </div>
            <Callout tone="info">
              A new price applies to new checkouts. Members keep the price they signed up with until they cancel.
            </Callout>
          </>
        )}
      </section>

      {platform.isPending && <PageSpinner className="h-48" />}
      {platform.isError && (
        <ErrorState title="The configuration could not be loaded" error={platform.error} onRetry={() => platform.refetch()} />
      )}
      {platform.isSuccess && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Rules" description="Set with environment variables (see backend/.env.example)" icon={Scale} />
            <dl className="divide-y divide-line">
              {RULES.map((rule) => (
                <div key={rule.key} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <dt className="text-sm font-medium text-fg">{rule.label}</dt>
                    <p className="text-xs text-fg-subtle">{rule.help}</p>
                  </div>
                  <dd className="text-lg font-semibold text-fg tabular-nums">
                    {platform.data.rules[rule.key]}
                    {rule.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Environment" description="How this server runs" icon={Server} />
            <CardBody className="py-2">
              <ul className="divide-y divide-line">
                {environmentRows(platform.data.environment).map((row) => (
                  <EnvironmentRow key={row.label} {...row} />
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="overflow-hidden lg:col-span-3">
            <CardHeader
              title="Catalogue"
              description={`${platform.data.categories.length} categories and ${platform.data.languages.length} languages instructors can choose from`}
              icon={Layers}
            />
            <Table label="Categories">
              <THead>
                <tr>
                  <TH>Category</TH>
                  <TH>Slug</TH>
                  <TH align="right">Courses</TH>
                  <TH align="right">Published</TH>
                </tr>
              </THead>
              <TBody>
                {platform.data.categories.map((category) => (
                  <TR key={category.id}>
                    <TD className="font-medium text-fg">{category.name}</TD>
                    <TD>
                      <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{category.slug}</code>
                    </TD>
                    <TD align="right">{category.courses}</TD>
                    <TD align="right">{category.published}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
              <span className="text-sm text-fg-muted">Languages:</span>
              {platform.data.languages.map((language) => (
                <Badge key={language.id} tone="primary">
                  {language.name} · {language.courses}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
