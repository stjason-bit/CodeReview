import { getTranslations } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { getCodeReviewModeOptions } from '@/extensions/code-review/credits';
import { CodeReviewWorkflow } from '@/shared/blocks/code-review/review-workflow';
import { CodeReviewUploadForm } from '@/shared/blocks/code-review/upload-form';
import { Empty } from '@/shared/blocks/common';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  getCodeReviewJobs,
  getCodeReviewJobsCount,
} from '@/shared/models/code_review';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

export default async function CodeReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('activity.code-reviews');
  const { page: pageNum, pageSize } = await searchParams;
  const page = Number(pageNum || 1);
  const limit = Number(pageSize || 20);
  const [jobs, total, remainingCredits] = await Promise.all([
    getCodeReviewJobs({ userId: user.id, page, limit }),
    getCodeReviewJobsCount({ userId: user.id }),
    getRemainingCredits(user.id),
  ]);
  const modeOptions = getCodeReviewModeOptions();

  return (
    <div className="space-y-8">
      <section className="from-primary/20 via-background to-accent/40 shadow-primary/5 relative overflow-hidden rounded-xl border bg-linear-to-br p-5 shadow-sm md:p-6">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-border)_1px,transparent_1px),linear-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20"
        />
        <div className="relative grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div className="space-y-3">
            <Badge variant="secondary" className="bg-background/80">
              {t('workspace.badge')}
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {t('workspace.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('workspace.description')}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <WorkspaceMetric
              label={t('workspace.credits')}
              value={String(remainingCredits)}
              helper={t('workspace.credits_unit')}
            />
            <WorkspaceMetric
              label={t('workspace.reviews')}
              value={String(total)}
              helper={t('list.title')}
            />
            <WorkspaceMetric
              label={t('workspace.modes')}
              value={String(modeOptions.length)}
              helper={t('workspace.modes_value')}
            />
          </div>
        </div>
      </section>

      <CodeReviewWorkflow
        title={t('pipeline.title')}
        description={t('pipeline.description')}
        stages={t.raw('pipeline.stages')}
        activeStep={-1}
      />

      <CodeReviewUploadForm
        labels={{
          title: t('upload.title'),
          description: t('upload.description'),
          file: t('upload.file'),
          fileHint: t('upload.file_hint'),
          mode: t('upload.mode'),
          modeStandard: t('upload.mode_standard'),
          modeDeep: t('upload.mode_deep'),
          modeSecurity: t('upload.mode_security'),
          modeStandardHint: t('upload.mode_standard_hint'),
          modeDeepHint: t('upload.mode_deep_hint'),
          modeSecurityHint: t('upload.mode_security_hint'),
          creditsBalance: t('upload.credits_balance'),
          creditsCost: t('upload.credits_cost'),
          creditsAfter: t('upload.credits_after'),
          creditsUnit: t('upload.credits_unit'),
          insufficientCredits: t.raw('upload.insufficient_credits'),
          buyCredits: t('upload.buy_credits'),
          instructions: t('upload.instructions'),
          instructionsPlaceholder: t('upload.instructions_placeholder'),
          submit: t('upload.submit'),
          uploading: t('upload.uploading'),
          fileRequired: t('upload.file_required'),
          fileTooLarge: t('upload.file_too_large'),
          failed: t('upload.failed'),
          workflowTitle: t('pipeline.title'),
          workflowDescription: t('pipeline.description'),
          workflowWorking: t('pipeline.working'),
          workflowStages: t.raw('pipeline.stages'),
        }}
        credits={{
          remaining: remainingCredits,
          pricingUrl: '/pricing',
          modeOptions,
        }}
      />

      <Card className="border-primary/15 bg-card/95 shadow-primary/5 shadow-sm">
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>{t('list.description', { total })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              {t('list.empty')}
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="border-border bg-background/70 hover:border-primary/35 flex flex-wrap items-center gap-3 rounded-lg border p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {job.archiveName}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {t(`list.mode_${job.mode}`)} - {job.model} -{' '}
                    {t('list.files', {
                      reviewed: job.includedFileCount,
                      total: job.fileCount,
                    })}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-foreground"
                >
                  {t(`status.${job.status}`)}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/activity/code-reviews/${job.id}`}>
                    {t('list.open')}
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="bg-background/75 rounded-lg border p-3 shadow-xs backdrop-blur">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        <span className="text-muted-foreground truncate text-xs">{helper}</span>
      </div>
    </div>
  );
}
