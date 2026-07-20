import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

export function CodeReviewReportView({
  jobId,
  report,
  files,
  labels,
}: {
  jobId: string;
  report?: {
    executiveSummary: string;
    riskScore: number;
    summaryMarkdown: string;
  };
  files: { included: boolean; ignoredReason?: string | null; path: string }[];
  labels: {
    title: string;
    description: string;
    riskScore: string;
    reviewedFiles: string;
    ignoredFiles: string;
    notReady: string;
    ignoredTitle: string;
    ignoredDescription: string;
    markdown: string;
    json: string;
  };
}) {
  const ignoredFiles = files.filter((file) => !file.included);

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 shadow-primary/5 shadow-sm">
        <CardHeader className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>{labels.title}</CardTitle>
            <CardDescription>{labels.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/code-reviews/${jobId}/export?format=markdown`}>
                {labels.markdown}
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/code-reviews/${jobId}/export?format=json`}>
                {labels.json}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {report ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="from-primary/10 to-background rounded-lg border bg-linear-to-br p-4">
                  <div className="text-muted-foreground text-xs">
                    {labels.riskScore}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {report.riskScore}
                  </div>
                </div>
                <div className="from-primary/10 to-background rounded-lg border bg-linear-to-br p-4">
                  <div className="text-muted-foreground text-xs">
                    {labels.reviewedFiles}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {files.filter((file) => file.included).length}
                  </div>
                </div>
                <div className="from-primary/10 to-background rounded-lg border bg-linear-to-br p-4">
                  <div className="text-muted-foreground text-xs">
                    {labels.ignoredFiles}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {ignoredFiles.length}
                  </div>
                </div>
              </div>
              <p className="text-sm leading-6">{report.executiveSummary}</p>
              <div className="border-border bg-muted/35 rounded-lg border p-4">
                <pre className="text-sm leading-6 whitespace-pre-wrap">
                  {report.summaryMarkdown}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">
              {labels.notReady}
            </div>
          )}
        </CardContent>
      </Card>

      {ignoredFiles.length > 0 && (
        <Card className="border-primary/15 bg-card/95 shadow-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle>{labels.ignoredTitle}</CardTitle>
            <CardDescription>{labels.ignoredDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-2 overflow-auto text-sm">
              {ignoredFiles.map((file) => (
                <div
                  key={file.path}
                  className="border-border bg-background/70 flex gap-2 rounded-lg border p-2"
                >
                  <span className="min-w-0 flex-1 truncate">{file.path}</span>
                  <span className="text-muted-foreground">
                    {file.ignoredReason || 'ignored'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
