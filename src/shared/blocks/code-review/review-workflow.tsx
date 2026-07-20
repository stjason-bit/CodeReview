import { Check } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

export interface ReviewWorkflowStage {
  title: string;
  description: string;
}

export function CodeReviewWorkflow({
  title,
  description,
  stages,
  status,
  activeStep,
  className,
}: {
  title: string;
  description: string;
  stages: ReviewWorkflowStage[];
  status?: string;
  activeStep?: number;
  className?: string;
}) {
  const currentStep =
    activeStep === undefined ? stepFromJobStatus(status) : activeStep;
  const allCompleted =
    status === 'completed' || currentStep >= stages.length - 1;

  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {stages.map((stage, index) => {
          const complete =
            allCompleted || (currentStep >= 0 && index < currentStep);
          const active = !allCompleted && index === currentStep;

          return (
            <li
              key={`${stage.title}-${index}`}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'border-border bg-card/90 relative rounded-lg border p-3 shadow-xs transition-colors',
                complete && 'border-primary/30 bg-primary/5',
                active && 'border-primary bg-primary/10 ring-primary/15 ring-4'
              )}
            >
              <div
                className={cn(
                  'bg-muted text-muted-foreground mb-3 flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                  complete && 'bg-primary text-primary-foreground',
                  active && 'bg-primary text-primary-foreground'
                )}
              >
                {complete ? <Check className="size-4" /> : index + 1}
              </div>
              <h3 className="text-sm font-medium">{stage.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {stage.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function stepFromJobStatus(status?: string): number {
  const steps: Record<string, number> = {
    created: 0,
    uploaded: 0,
    indexing: 1,
    reviewing: 3,
    synthesizing: 4,
    completed: 6,
    failed: -1,
  };

  return status ? (steps[status] ?? -1) : -1;
}
