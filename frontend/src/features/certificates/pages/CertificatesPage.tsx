import React from 'react';
import { Award, BookOpen, Copy, ExternalLink } from 'lucide-react';

import { formatDate } from '../../../shared/lib/time';
import { Button, ButtonAnchor, ButtonLink } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import { useCertificates } from '../hooks/useCertificates';
import type { Certificate } from '../types';

const HEADER = (
  <PageHeader
    title="My Certificates"
    description="Credentials you earned by completing and passing courses. Anyone with the link can verify them."
  />
);

/** One certificate, drawn like one: the course, the grade, the credential and its public link. */
const CertificateCard = ({ certificate }: { certificate: Certificate }) => {
  const toast = useToast();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(certificate.verification_url);
      toast.success('Anyone can open it to check the certificate.', 'Link copied');
    } catch (error) {
      toast.error('The link could not be copied. Open the certificate and copy its address instead.', 'Not copied');
    }
  };

  return (
    <Card as="article" aria-label={certificate.course_title} className="flex flex-col overflow-hidden">
      <div className="relative h-24 shrink-0 overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900">
        <div className="bg-dots absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10" aria-hidden="true" />
        <p className="relative px-5 pt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100">
          Certificate of completion
        </p>
        <span className="absolute bottom-3 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-warning-fg shadow-card ring-4 ring-white/20">
          <Award size={24} aria-hidden="true" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold leading-snug text-fg">{certificate.course_title}</h3>
        <p className="mt-0.5 text-sm text-fg-muted">by {certificate.instructor}</p>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-muted">Issued</dt>
            <dd className="font-medium text-fg">{formatDate(certificate.issue_date)}</dd>
          </div>
          {certificate.grade !== null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-muted">Grade</dt>
              <dd className="font-semibold text-success-fg tabular-nums">{certificate.grade}%</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-muted">Credential ID</dt>
            <dd className="truncate font-mono text-xs text-fg">{certificate.certificate_id}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
          <ButtonAnchor
            href={certificate.verification_url}
            target="_blank"
            rel="noopener noreferrer"
            icon={ExternalLink}
            className="flex-1"
          >
            Verify Certificate
          </ButtonAnchor>
          <Button variant="secondary" icon={Copy} onClick={copyLink}>
            Copy link
          </Button>
        </div>
      </div>
    </Card>
  );
};

const CertificatesPage = () => {
  const query = useCertificates();

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {HEADER}
        <PageSpinner className="h-64" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {HEADER}
        <ErrorState
          title="Your certificates could not be loaded"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  const certificates = query.data;

  return (
    <div className="space-y-6">
      {HEADER}

      {certificates.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          className="rounded-xl border border-dashed border-line-strong py-16"
          action={
            <ButtonLink to="/student/my-learning" variant="secondary" icon={BookOpen}>
              Go to My Learning
            </ButtonLink>
          }
        >
          Complete courses to earn your first certificate!
        </EmptyState>
      )}
    </div>
  );
};

export default CertificatesPage;
