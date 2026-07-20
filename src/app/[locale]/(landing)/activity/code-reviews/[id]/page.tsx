import { getTranslations } from 'next-intl/server';

import { rebuildLiveReport } from '@/extensions/code-review/live-report';
import { CodeReviewFindingsTable } from '@/shared/blocks/code-review/findings-table';
import { CodeReviewReportView } from '@/shared/blocks/code-review/report-view';
import { CodeReviewWorkflow } from '@/shared/blocks/code-review/review-workflow';
import { Empty } from '@/shared/blocks/common';
import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  findCodeReviewJobById,
  findCodeReviewReportByJobId,
  getCodeReviewFiles,
  getCodeReviewFindings,
} from '@/shared/models/code_review';
import { getUserInfo } from '@/shared/models/user';

export default async function CodeReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('activity.code-reviews');
  const { id } = await params;
  const job = await findCodeReviewJobById(id);
  if (!job || job.userId !== user.id) {
    return <Empty message={t('detail.not_found')} />;
  }

  const [files, findings, report] = await Promise.all([
    getCodeReviewFiles({ jobId: job.id }),
    getCodeReviewFindings({ jobId: job.id }),
    findCodeReviewReportByJobId(job.id),
  ]);
  const liveReport = report
    ? rebuildLiveReport({
        reportJson: report.reportJson,
        fallbackExecutiveSummary: report.executiveSummary,
        findings,
        files,
      })
    : undefined;

  return (
    <div className="space-y-6">
      <CodeReviewWorkflow
        title={t('pipeline.title')}
        description={t('pipeline.description')}
        stages={t.raw('pipeline.stages')}
        status={job.status}
      />

      <Card className="border-primary/15 bg-card/95 shadow-primary/5 shadow-sm">
        <CardHeader className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>{job.archiveName}</CardTitle>
            <CardDescription>
              {t(`list.mode_${job.mode}`)} - {job.model}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-foreground">
            {t(`status.${job.status}`)}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Metric label={t('detail.files')} value={String(job.fileCount)} />
          <Metric
            label={t('detail.reviewed')}
            value={String(job.includedFileCount)}
          />
          <Metric
            label={t('detail.stack')}
            value={formatDetectedStack(job.detectedStack)}
          />
          <Metric
            label={t('detail.ignored')}
            value={String(job.ignoredFileCount)}
          />
          <Metric
            label={t('detail.tokens')}
            value={String(job.inputTokens + job.outputTokens)}
          />
        </CardContent>
      </Card>

      <CodeReviewReportView
        jobId={job.id}
        files={files}
        report={
          liveReport
            ? {
                executiveSummary: liveReport.executiveSummary,
                riskScore: liveReport.riskScore,
                summaryMarkdown: liveReport.markdown,
              }
            : undefined
        }
        labels={{
          title: t('report.title'),
          description: t('report.description'),
          riskScore: t('report.risk_score'),
          reviewedFiles: t('report.reviewed_files'),
          ignoredFiles: t('report.ignored_files'),
          notReady: t('report.not_ready'),
          ignoredTitle: t('report.ignored_title'),
          ignoredDescription: t('report.ignored_description'),
          markdown: t('report.markdown'),
          json: t('report.json'),
        }}
      />

      <CodeReviewFindingsTable
        jobId={job.id}
        findings={findings}
        labels={t.raw('findings')}
      />
    </div>
  );
}

function formatDetectedStack(value: string | null): string {
  if (!value) return '-';
  try {
    const stack = JSON.parse(value);
    return Array.isArray(stack) && stack.length ? stack.join(', ') : '-';
  } catch {
    return value;
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="from-primary/10 to-background rounded-lg border bg-linear-to-br p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
