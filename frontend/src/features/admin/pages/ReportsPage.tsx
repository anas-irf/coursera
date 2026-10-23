import React, { useState } from 'react';
import { Award, BookOpen, CreditCard, Download, FileSpreadsheet, GraduationCap, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import { useDownloadReport, useReports } from '../hooks/useAdmin';
import type { ReportId } from '../types';

const ICONS: Record<ReportId, LucideIcon> = {
  users: Users,
  courses: BookOpen,
  enrollments: GraduationCap,
  payments: CreditCard,
  earnings: Wallet,
  certificates: Award,
};

/** The platform's data as CSV files, generated when they are asked for. */
const ReportsPage = () => {
  const reports = useReports();
  const download = useDownloadReport();
  const toast = useToast();
  const [busy, setBusy] = useState<ReportId | null>(null);

  const fetchReport = (id: ReportId) => {
    setBusy(id);
    download.mutate(id, {
      onSuccess: (filename) => toast.success(`${filename} was downloaded.`, 'Report ready'),
      onError: (error) => toast.error(errorMessage(error, 'The report could not be generated.'), 'Download failed'),
      onSettled: () => setBusy(null),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download the platform's data as CSV files, generated from the live database when you ask."
      />

      {reports.isPending && <PageSpinner />}
      {reports.isError && (
        <ErrorState title="The reports could not be listed" error={reports.error} onRetry={() => reports.refetch()} />
      )}
      {reports.isSuccess && reports.data.length === 0 && (
        <Card>
          <EmptyState icon={FileSpreadsheet} title="No reports available" />
        </Card>
      )}
      {reports.isSuccess && reports.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.data.map((report) => {
            const Icon = ICONS[report.id] || FileSpreadsheet;
            return (
              <Card as="article" key={report.id} aria-label={report.name} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-fg">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <Badge tone="neutral">
                    {report.rows.toLocaleString()} row{report.rows === 1 ? '' : 's'}
                  </Badge>
                </div>
                <h2 className="mt-4 text-base font-semibold text-fg">{report.name}</h2>
                <p className="mt-1 flex-1 text-sm text-fg-muted">{report.description}</p>
                <Button
                  variant="secondary"
                  icon={Download}
                  className="mt-5"
                  loading={busy === report.id}
                  disabled={busy !== null && busy !== report.id}
                  onClick={() => fetchReport(report.id)}
                >
                  Download CSV
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Callout tone="neutral">
        The files open in any spreadsheet. A cell that starts with a formula character is escaped, so a name or a title
        can never run as a formula.
      </Callout>
    </div>
  );
};

export default ReportsPage;
