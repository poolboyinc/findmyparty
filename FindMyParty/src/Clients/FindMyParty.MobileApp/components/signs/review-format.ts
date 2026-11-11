// What the platform admin's review screen says about a report. Pure (tested in services/__tests__/signFormat.test.mjs).

import type { AdminReport, ReportReason } from '../../types/api.ts';

const REASONS: Record<ReportReason, string> = {
  harassment: 'Harassment',
  fakeProfile: 'Fake profile',
  spam: 'Spam',
  other: 'Something else',
};

export function reasonText(reason: ReportReason): string {
  return REASONS[reason] ?? 'Something else';
}

/** "Reported by @mila, harassment". */
export function reportedByLine(report: Pick<AdminReport, 'reporter' | 'reason'>): string {
  return `Reported by @${report.reporter.handle}, ${reasonText(report.reason).toLowerCase()}`;
}

/** "3 open reports on this account"; nothing for the only one. */
export function openReportsLine(openReports: number): string | null {
  if (openReports <= 1) return null;
  return `${openReports} open reports on this account`;
}
