import React, { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Home, Link2, Printer, ShieldAlert } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { errorStatus } from '../../../shared/api/errors';
import { cn } from '../../../shared/lib/cn';
import { formatDate } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import ErrorState from '../../../shared/ui/ErrorState';
import { Logo, LogoMark } from '../../../shared/ui/Logo';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { ThemeToggle } from '../../../shared/ui/ThemeToggle';
import { useToast } from '../../../shared/ui/Toast';
import { useCertificateVerification } from '../hooks/useCertificates';
import type { CertificateVerification } from '../types';

// Paper is white: in print the light values of the tokens apply, whatever the theme on screen.
const PRINT_LIGHT = [
  'print:[--canvas:255_255_255]',
  'print:[--surface:255_255_255]',
  'print:[--surface-muted:241_244_249]',
  'print:[--line:227_232_239]',
  'print:[--line-strong:205_213_224]',
  'print:[--fg:15_23_42]',
  'print:[--fg-muted:71_85_105]',
  'print:[--fg-subtle:100_116_139]',
  'print:[--primary:0_86_210]',
  'print:[--primary-fg:0_86_210]',
  'print:[--success-soft:234_247_239]',
  'print:[--success-fg:22_101_52]',
].join(' ');

const Detail = ({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</p>
    <p className={cn('mt-1 text-fg', mono ? 'break-all font-mono text-xs' : 'text-sm font-medium')}>{children}</p>
  </div>
);

/** The certificate itself, laid out to be read on screen and printed. */
const CertificateSheet = ({ certificate }: { certificate: CertificateVerification }) => (
  <section
    aria-labelledby="certificate-holder"
    className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-pop print:rounded-none print:border-0 print:shadow-none"
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-xl border-2 border-primary/20 sm:inset-4" />
    <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-brand-400/15 blur-2xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-plus/10 blur-2xl" />

    <div className="relative px-6 py-10 text-center sm:px-14 sm:py-14">
      <div className="flex justify-center">
        <LogoMark className="h-12 w-12" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-primary-fg">Certificate of Completion</p>

      <p className="mt-8 text-sm text-fg-muted">This certifies that</p>
      <h2 id="certificate-holder" className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
        {certificate.student_name}
      </h2>
      <p className="mt-5 text-sm text-fg-muted">has successfully completed</p>
      <h3 className="mx-auto mt-2 max-w-2xl text-xl font-semibold leading-snug text-fg sm:text-2xl">
        {certificate.course_title}
      </h3>
      <p className="mt-2 text-sm text-fg-muted">
        taught by {certificate.instructor}
        {certificate.course_hours ? ` · about ${certificate.course_hours} hours of study` : ''}
      </p>
      {certificate.grade !== null && (
        <p className="mt-5 inline-flex items-center rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success-fg tabular-nums">
          Final grade: {certificate.grade}%
        </p>
      )}

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 border-t border-line pt-6 text-left sm:grid-cols-3">
        <Detail label="Issued">{formatDate(certificate.issue_date)}</Detail>
        <Detail label="Credential ID" mono>
          {certificate.certificate_number}
        </Detail>
        <Detail label="Issued by">{BRAND.name}</Detail>
      </div>

      <div className="mt-8 flex justify-center">
        <Badge tone="success" icon={BadgeCheck} size="md">
          Verified
        </Badge>
      </div>
    </div>
  </section>
);

/**
 * The public page of a certificate (``/verify/<code>``): anybody with the link sees that it is
 * real, signed in or not, and can print it or save it as a PDF.
 */
const VerifyCertificatePage = () => {
  // the route is "/verify/:code": the parameter is there whenever this page renders
  const code = useParams<{ code: string }>().code!;
  const query = useCertificateVerification(code);
  const toast = useToast();
  const certificate = query.data;

  // the tab says whose certificate it is (and what it was before, once the page is left)
  useEffect(() => {
    if (!certificate) return undefined;
    const previous = document.title;
    document.title = `${certificate.student_name}: ${certificate.course_title} | ${BRAND.name}`;
    return () => {
      document.title = previous;
    };
  }, [certificate]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Anyone with it can check this certificate.', 'Link copied');
    } catch (error) {
      toast.error('The link could not be copied. Copy the address of this page instead.', 'Not copied');
    }
  };

  const notFound = query.isError && errorStatus(query.error) === 404;

  return (
    <div className={cn('min-h-screen bg-canvas print:bg-surface', PRINT_LIGHT)}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8 print:hidden">
        <Link to="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-2 sm:px-8 print:max-w-none print:p-0">
        <h1 className="sr-only">Certificate verification</h1>

        {query.isPending && <PageSpinner className="h-96" />}

        {notFound && (
          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning-fg">
              <ShieldAlert size={22} aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-fg">No certificate has this code</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Check the link: the code may be mistyped, or the certificate does not exist.
            </p>
            <ButtonLink to="/" variant="secondary" icon={Home} className="mt-6">
              Go to the home page
            </ButtonLink>
          </div>
        )}

        {query.isError && !notFound && (
          <ErrorState
            className="py-20"
            title="The certificate could not be checked"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        )}

        {certificate && (
          <div className="space-y-6">
            <Callout tone="success" title="Verified certificate" icon={BadgeCheck} className="print:hidden">
              {BRAND.name} issued this certificate to {certificate.student_name} on {formatDate(certificate.issue_date)} for
              completing {certificate.course_title}.
            </Callout>

            <CertificateSheet certificate={certificate} />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center print:hidden">
              <Button icon={Printer} onClick={() => window.print()}>
                Print or save as PDF
              </Button>
              <Button variant="secondary" icon={Link2} onClick={copyLink}>
                Copy link
              </Button>
            </div>
            <p className="text-center text-xs text-fg-subtle print:hidden">{BRAND.disclaimer}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default VerifyCertificatePage;
