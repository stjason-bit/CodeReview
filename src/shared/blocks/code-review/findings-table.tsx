'use client';

import { useState } from 'react';

import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

interface Finding {
  id: string;
  title: string;
  severity: string;
  category: string;
  confidence: string;
  status: string;
  filePath?: string | null;
  startLine?: number | null;
  evidence: string;
  recommendation: string;
}

interface FindingsLabels {
  title: string;
  description: string;
  empty: string;
  evidence: string;
  recommendation: string;
  update_failed: string;
  statuses: Record<string, string>;
  categories: Record<string, string>;
  confidence: Record<string, string>;
}

const statuses = ['open', 'needs_review', 'ignored', 'fixed'];

export function CodeReviewFindingsTable({
  jobId,
  findings,
  labels,
}: {
  jobId: string;
  findings: Finding[];
  labels: FindingsLabels;
}) {
  const [items, setItems] = useState(findings);
  const [error, setError] = useState('');

  async function updateStatus(findingId: string, status: string) {
    setError('');
    const response = await fetch(
      `/api/code-reviews/${jobId}/findings/${findingId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );
    const result = await response.json();
    if (result.code === 0) {
      setItems((current) =>
        current.map((item) =>
          item.id === findingId ? { ...item, status } : item
        )
      );
    } else {
      setError(labels.update_failed);
    }
  }

  return (
    <Card className="border-primary/15 bg-card/95 shadow-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-destructive text-sm">{error}</div>}
        {items.length === 0 ? (
          <div className="text-muted-foreground text-sm">{labels.empty}</div>
        ) : (
          items.map((finding) => (
            <div
              key={finding.id}
              className="border-border bg-background/70 hover:border-primary/35 relative overflow-hidden rounded-lg border p-4 transition-colors"
            >
              <span
                aria-hidden
                className="from-primary/60 to-accent absolute inset-y-4 left-0 w-1 rounded-r-full bg-linear-to-b"
              />
              <div className="flex flex-wrap items-start gap-2 pl-2">
                <Badge variant="secondary">{finding.severity}</Badge>
                <Badge variant="outline">
                  {labels.categories[finding.category] || finding.category}
                </Badge>
                <Badge variant="outline">
                  {labels.confidence[finding.confidence] || finding.confidence}
                </Badge>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{finding.title}</h3>
                  {finding.filePath && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {finding.filePath}
                      {finding.startLine ? `:${finding.startLine}` : ''}
                    </p>
                  )}
                </div>
                <select
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={finding.status}
                  onChange={(event) =>
                    updateStatus(finding.id, event.target.value)
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {labels.statuses[status] || status}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-3 pl-2 text-sm">
                <span className="font-medium">{labels.evidence}: </span>
                {finding.evidence}
              </p>
              <p className="text-muted-foreground mt-2 pl-2 text-sm">
                <span className="font-medium">{labels.recommendation}: </span>
                {finding.recommendation}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
