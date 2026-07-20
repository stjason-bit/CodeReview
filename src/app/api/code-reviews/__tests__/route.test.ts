import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractZipProject } from '@/extensions/code-review/archive';
import { runCodeReviewJob } from '@/extensions/code-review/runner';
import {
  CodeReviewJobStatus,
  CodeReviewMode,
} from '@/extensions/code-review/types';
import {
  createCodeReviewFiles,
  createCodeReviewFindings,
  createCodeReviewJob,
  createCodeReviewReport,
  updateCodeReviewJob,
} from '@/shared/models/code_review';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

import { POST } from '../route';

vi.mock('ai', () => ({
  generateId: vi.fn(() => 'generated-id'),
}));

vi.mock('@/shared/models/user', () => ({
  getUserInfo: vi.fn(),
}));

vi.mock('@/shared/models/credit', () => ({
  consumeCredits: vi.fn(),
  getRemainingCredits: vi.fn(),
}));

vi.mock('@/shared/models/code_review', () => ({
  createCodeReviewFiles: vi.fn(),
  createCodeReviewFindings: vi.fn(),
  createCodeReviewJob: vi.fn(),
  createCodeReviewReport: vi.fn(),
  getCodeReviewJobs: vi.fn(),
  getCodeReviewJobsCount: vi.fn(),
  updateCodeReviewJob: vi.fn(),
}));

vi.mock('@/extensions/code-review/archive', () => ({
  extractZipProject: vi.fn(),
}));

vi.mock('@/extensions/code-review/evolink', () => ({
  EvolinkCodeReviewProvider: class {
    createMessage = vi.fn();
  },
}));

vi.mock('@/extensions/code-review/runner', () => ({
  runCodeReviewJob: vi.fn(),
}));

describe('POST /api/code-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserInfo).mockResolvedValue({
      id: 'user_1',
      email: 'founder@example.com',
    } as any);
    vi.mocked(createCodeReviewJob).mockResolvedValue({
      id: 'job_1',
      userId: 'user_1',
      status: CodeReviewJobStatus.Created,
      mode: CodeReviewMode.Standard,
      archiveName: 'project.zip',
      archiveSize: 128,
    } as any);
    vi.mocked(updateCodeReviewJob).mockImplementation(
      async (id, patch) =>
        ({
          id,
          userId: 'user_1',
          archiveName: 'project.zip',
          status: patch.status,
          ...patch,
        }) as any
    );
    vi.mocked(extractZipProject).mockResolvedValue({
      files: [
        {
          path: 'src/app/page.tsx',
          content: 'export default function Page() { return null; }',
          language: 'typescript',
          sizeBytes: 48,
          lineCount: 1,
          hash: 'hash_1',
          included: true,
        },
      ],
      ignoredFiles: [],
    });
    vi.mocked(createCodeReviewFiles).mockResolvedValue([
      {
        id: 'file_1',
        path: 'src/app/page.tsx',
      },
    ] as any);
    vi.mocked(runCodeReviewJob).mockResolvedValue({
      executiveSummary: 'The project is healthy.',
      riskScore: 30,
      findings: [],
      optimizationSuggestions: [],
      needsReview: [],
      ignored: [],
      markdown: '# Report',
      profile: {
        stack: ['Next.js'],
        architectureSummary: 'Small SaaS app',
        importantPaths: ['src/app/page.tsx'],
        riskAreas: [],
        reviewPlan: [],
      },
      ruleFindingCount: 0,
      usage: {
        inputTokens: 100,
        outputTokens: 80,
      },
    });
  });

  it('returns a structured insufficient credits response before creating a job', async () => {
    vi.mocked(getRemainingCredits).mockResolvedValue(5);

    const response = await POST(buildCodeReviewRequest({ mode: 'standard' }));
    const body = await response.json();

    expect(body).toEqual({
      code: -1,
      message: 'insufficient_credits',
      data: {
        error: 'insufficient_credits',
        requiredCredits: 10,
        remainingCredits: 5,
        mode: CodeReviewMode.Standard,
        pricingUrl: '/pricing',
      },
    });
    expect(createCodeReviewJob).not.toHaveBeenCalled();
    expect(consumeCredits).not.toHaveBeenCalled();
  });

  it('consumes credits after a successful deep review', async () => {
    vi.mocked(getRemainingCredits)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(5);
    vi.mocked(consumeCredits).mockResolvedValue({ id: 'credit_tx_1' } as any);

    const response = await POST(buildCodeReviewRequest({ mode: 'deep' }));
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data.creditsCost).toBe(25);
    expect(body.data.remainingCredits).toBe(5);
    expect(createCodeReviewReport).toHaveBeenCalledOnce();
    expect(createCodeReviewFindings).toHaveBeenCalledWith([]);
    expect(consumeCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        credits: 25,
        scene: 'code_review_deep',
        description: 'Code review: project.zip (deep)',
      })
    );
  });
});

function buildCodeReviewRequest({ mode }: { mode: string }): Request {
  const formData = new FormData();
  formData.append(
    'file',
    new File(['export default {}'], 'project.zip', {
      type: 'application/zip',
    })
  );
  formData.append('mode', mode);
  formData.append('instructions', 'Focus on billing and auth paths.');

  return new Request('https://codereview.ai/api/code-reviews', {
    method: 'POST',
    body: formData,
  });
}
