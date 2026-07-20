'use client';

import { FormEvent, useState } from 'react';
import {
  Check,
  Coins,
  Gauge,
  Layers3,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

import { Link, useRouter } from '@/core/i18n/navigation';
import type { CodeReviewModeOption } from '@/extensions/code-review/credits';
import { CodeReviewMode } from '@/extensions/code-review/types';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';

import { CodeReviewWorkflow, ReviewWorkflowStage } from './review-workflow';

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

export function CodeReviewUploadForm({
  labels,
  credits,
}: {
  labels: {
    title: string;
    description: string;
    file: string;
    fileHint: string;
    mode: string;
    modeStandard: string;
    modeDeep: string;
    modeSecurity: string;
    modeStandardHint: string;
    modeDeepHint: string;
    modeSecurityHint: string;
    creditsBalance: string;
    creditsCost: string;
    creditsAfter: string;
    creditsUnit: string;
    insufficientCredits: string;
    buyCredits: string;
    instructions: string;
    instructionsPlaceholder: string;
    submit: string;
    uploading: string;
    fileRequired: string;
    fileTooLarge: string;
    failed: string;
    workflowTitle: string;
    workflowDescription: string;
    workflowWorking: string;
    workflowStages: ReviewWorkflowStage[];
  };
  credits: {
    remaining: number;
    pricingUrl: string;
    modeOptions: CodeReviewModeOption[];
  };
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<string>(
    credits.modeOptions[0]?.mode || CodeReviewMode.Standard
  );
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const selectedMode =
    credits.modeOptions.find((option) => option.mode === mode) ||
    credits.modeOptions[0];
  const selectedCost = selectedMode?.credits || 0;
  const creditsAfterReview = credits.remaining - selectedCost;
  const hasEnoughCredits = creditsAfterReview >= 0;
  const creditStats = [
    {
      label: labels.creditsBalance,
      value: credits.remaining,
      helper: labels.creditsUnit,
      icon: WalletCards,
    },
    {
      label: labels.creditsCost,
      value: selectedMode?.credits || 0,
      helper: labels.creditsUnit,
      icon: Coins,
    },
    {
      label: labels.creditsAfter,
      value: Math.max(creditsAfterReview, 0),
      helper: hasEnoughCredits ? labels.creditsUnit : labels.buyCredits,
      icon: Gauge,
    },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasEnoughCredits) {
      setError(
        formatInsufficientCredits(
          labels.insufficientCredits,
          selectedCost,
          credits.remaining
        )
      );
      router.push(credits.pricingUrl);
      return;
    }
    if (!file) {
      setError(labels.fileRequired);
      return;
    }
    if (file.size > MAX_ARCHIVE_BYTES) {
      setError(labels.fileTooLarge);
      return;
    }

    setLoading(true);
    setError('');
    setActiveStep(0);
    const progressTimer = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, 5));
    }, 1800);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    formData.append('instructions', instructions);

    try {
      const response = await fetch('/api/code-reviews', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        if (result.message === 'insufficient_credits') {
          const required = result.data?.requiredCredits ?? selectedCost;
          const remaining = result.data?.remainingCredits ?? credits.remaining;
          setError(
            formatInsufficientCredits(
              labels.insufficientCredits,
              required,
              remaining
            )
          );
          router.push(result.data?.pricingUrl || credits.pricingUrl);
          return;
        }
        setError(result.message || labels.failed);
        return;
      }

      setActiveStep(6);
      router.push(`/activity/code-reviews/${result.data.job.id}`);
      router.refresh();
    } catch {
      setError(labels.failed);
    } finally {
      window.clearInterval(progressTimer);
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/15 bg-card/95 shadow-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            {creditStats.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="from-primary/10 to-background rounded-lg border bg-linear-to-br p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/25 text-primary-foreground flex size-7 items-center justify-center rounded-md">
                      <Icon className="size-4" />
                    </span>
                    <div className="text-muted-foreground text-xs">
                      {item.label}
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-semibold">{item.value}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {item.helper}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!hasEnoughCredits && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>
                {formatInsufficientCredits(
                  labels.insufficientCredits,
                  selectedCost,
                  credits.remaining
                )}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href={credits.pricingUrl}>{labels.buyCredits}</Link>
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code-review-file">{labels.file}</Label>
            <Input
              id="code-review-file"
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="text-muted-foreground text-xs">{labels.fileHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code-review-mode">{labels.mode}</Label>
            <div
              id="code-review-mode"
              className="grid gap-3 md:grid-cols-3"
              role="radiogroup"
              aria-label={labels.mode}
            >
              {credits.modeOptions.map((option) => {
                const selected = option.mode === mode;
                const ModeIcon = getModeIcon(option.mode);

                return (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      'border-border bg-background/80 hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-ring min-h-32 rounded-lg border p-4 text-left shadow-xs transition outline-none focus-visible:ring-2',
                      selected &&
                        'border-primary bg-primary/10 ring-primary/15 ring-4'
                    )}
                    onClick={() => setMode(option.mode)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="bg-primary/15 text-primary flex size-9 items-center justify-center rounded-md">
                        <ModeIcon className="size-4" />
                      </span>
                      {selected && (
                        <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full">
                          <Check className="size-4" />
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-sm font-semibold">
                      {getModeLabel(option.mode, labels)}
                    </div>
                    <div className="text-primary mt-1 text-sm font-medium">
                      {option.credits} {labels.creditsUnit}
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs leading-5">
                      {getModeHint(option.mode, labels)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code-review-instructions">
              {labels.instructions}
            </Label>
            <Textarea
              id="code-review-instructions"
              value={instructions}
              placeholder={labels.instructionsPlaceholder}
              rows={4}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}

          {loading && (
            <div className="border-primary/15 bg-primary/5 space-y-3 rounded-lg border p-4">
              <CodeReviewWorkflow
                title={labels.workflowTitle}
                description={labels.workflowDescription}
                stages={labels.workflowStages}
                activeStep={activeStep}
              />
              <p className="text-muted-foreground text-xs">
                {labels.workflowWorking}
              </p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading
              ? labels.uploading
              : hasEnoughCredits
                ? labels.submit
                : labels.buyCredits}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function getModeIcon(mode: CodeReviewModeOption['mode']) {
  if (mode === CodeReviewMode.Deep) {
    return Layers3;
  }

  if (mode === CodeReviewMode.Security) {
    return ShieldCheck;
  }

  return Gauge;
}

function getModeLabel(
  mode: CodeReviewModeOption['mode'],
  labels: {
    modeStandard: string;
    modeDeep: string;
    modeSecurity: string;
  }
): string {
  if (mode === CodeReviewMode.Deep) {
    return labels.modeDeep;
  }

  if (mode === CodeReviewMode.Security) {
    return labels.modeSecurity;
  }

  return labels.modeStandard;
}

function getModeHint(
  mode: CodeReviewModeOption['mode'],
  labels: {
    modeStandardHint: string;
    modeDeepHint: string;
    modeSecurityHint: string;
  }
): string {
  if (mode === CodeReviewMode.Deep) {
    return labels.modeDeepHint;
  }

  if (mode === CodeReviewMode.Security) {
    return labels.modeSecurityHint;
  }

  return labels.modeStandardHint;
}

function formatInsufficientCredits(
  template: string,
  required: number,
  remaining: number
) {
  return template
    .replace('{required}', String(required))
    .replace('{remaining}', String(remaining));
}
