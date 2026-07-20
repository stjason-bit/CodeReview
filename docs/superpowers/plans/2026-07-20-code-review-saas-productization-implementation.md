# Code Review SaaS Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing CodeReview AI MVP into a commercial SaaS flow with productized landing copy, subscription/credit-pack pricing, and credit-gated code reviews.

**Architecture:** Keep the existing ShipAny Two architecture: dynamic landing/pricing content in locale JSON, Better Auth for session protection, Drizzle-backed credit records, and the existing code-review pipeline. Add a small `code-review/credits` domain helper for review mode pricing, then use it from the API and upload UI so cost rules live in one place.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, next-intl, Drizzle ORM, Better Auth, Vitest, existing ShipAny pricing/payment/credit models.

## Global Constraints

- Product positioning is code review SaaS for startup teams and small engineering teams.
- Code reviews consume credits.
- Pricing is subscription-first with supplemental credit packs.
- Do not add organization workspaces, team invitations, GitHub/GitLab integrations, PR comments, automatic fixes, vulnerability database scanning, or background queue infrastructure in this pass.
- Reuse existing ShipAny components, payment flow, credit system, auth, RBAC, and dynamic page builder.
- Remove ShipAny boilerplate sales copy from public landing and pricing pages.
- Do not invent fake customer logos or fake customer testimonials.
- Standard Review costs 10 credits.
- Deep Review costs 25 credits.
- Security Review costs 20 credits.
- Review failure must not charge credits.
- Validate with `pnpm test`, `pnpm lint`, and `$env:VERCEL='1'; pnpm build`.
- The normal `pnpm build` can fail in this Windows environment because standalone output needs symlink permission; record this if it remains true.

---

## File Structure

- Create `src/extensions/code-review/credits.ts`: mode normalization, credit cost mapping, credit scene mapping, display metadata.
- Create `src/extensions/code-review/__tests__/credits.test.ts`: domain tests for costs and normalization.
- Modify `src/app/api/code-reviews/route.ts`: check balance before running a review, charge credits after successful report persistence, return structured insufficient-credit errors.
- Create `src/app/api/code-reviews/__tests__/route.test.ts`: API tests with mocked auth, models, archive extraction, provider, and credit functions.
- Modify `src/app/[locale]/(landing)/activity/code-reviews/page.tsx`: fetch current balance server-side and pass credit metadata to the upload form.
- Modify `src/shared/blocks/code-review/upload-form.tsx`: show selected mode cost, current balance, insufficient-credit call-to-action, and structured API error handling.
- Modify `src/config/locale/messages/en/activity/code-reviews.json`: add credit labels and polished SaaS copy.
- Modify `src/config/locale/messages/zh/activity/code-reviews.json`: add credit labels and readable UTF-8 Chinese copy.
- Modify `src/config/locale/messages/en/common.json` and `src/config/locale/messages/zh/common.json`: SEO metadata.
- Modify `src/config/locale/messages/en/landing.json` and `src/config/locale/messages/zh/landing.json`: header/footer/navigation copy.
- Modify `src/config/locale/messages/en/pages/index.json` and `src/config/locale/messages/zh/pages/index.json`: productized landing page sections.
- Modify `src/config/locale/messages/en/pages/pricing.json` and `src/config/locale/messages/zh/pages/pricing.json`: subscription and credit-pack products.
- Create `src/config/locale/messages/__tests__/productization-copy.test.ts`: JSON validity and no-boilerplate/no-mojibake checks.

---

### Task 1: Code Review Credit Cost Domain Helper

**Files:**
- Create: `src/extensions/code-review/credits.ts`
- Create: `src/extensions/code-review/__tests__/credits.test.ts`

**Interfaces:**
- Consumes: `CodeReviewMode` from `src/extensions/code-review/types.ts`
- Produces: `CODE_REVIEW_CREDIT_COSTS: Record<CodeReviewMode, number>`
- Produces: `normalizeCodeReviewMode(value: string): CodeReviewMode`
- Produces: `getCodeReviewCreditCost(mode: CodeReviewMode | string): number`
- Produces: `getCodeReviewCreditScene(mode: CodeReviewMode | string): string`
- Produces: `getCodeReviewModeOptions(): CodeReviewModeOption[]`

- [ ] **Step 1: Write the failing test**

Create `src/extensions/code-review/__tests__/credits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  CODE_REVIEW_CREDIT_COSTS,
  getCodeReviewCreditCost,
  getCodeReviewCreditScene,
  getCodeReviewModeOptions,
  normalizeCodeReviewMode,
} from '../credits';
import { CodeReviewMode } from '../types';

describe('code review credit costs', () => {
  it('defines stable costs for each review mode', () => {
    expect(CODE_REVIEW_CREDIT_COSTS[CodeReviewMode.Standard]).toBe(10);
    expect(CODE_REVIEW_CREDIT_COSTS[CodeReviewMode.Deep]).toBe(25);
    expect(CODE_REVIEW_CREDIT_COSTS[CodeReviewMode.Security]).toBe(20);
  });

  it('normalizes unsupported values to standard mode', () => {
    expect(normalizeCodeReviewMode('deep')).toBe(CodeReviewMode.Deep);
    expect(normalizeCodeReviewMode('security')).toBe(CodeReviewMode.Security);
    expect(normalizeCodeReviewMode('unknown')).toBe(CodeReviewMode.Standard);
    expect(getCodeReviewCreditCost('unknown')).toBe(10);
  });

  it('creates credit consumption scenes for reporting', () => {
    expect(getCodeReviewCreditScene(CodeReviewMode.Standard)).toBe(
      'code_review_standard'
    );
    expect(getCodeReviewCreditScene(CodeReviewMode.Deep)).toBe(
      'code_review_deep'
    );
    expect(getCodeReviewCreditScene(CodeReviewMode.Security)).toBe(
      'code_review_security'
    );
  });

  it('returns UI-friendly mode options', () => {
    expect(getCodeReviewModeOptions()).toEqual([
      {
        mode: CodeReviewMode.Standard,
        credits: 10,
        scene: 'code_review_standard',
      },
      {
        mode: CodeReviewMode.Deep,
        credits: 25,
        scene: 'code_review_deep',
      },
      {
        mode: CodeReviewMode.Security,
        credits: 20,
        scene: 'code_review_security',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm test src/extensions/code-review/__tests__/credits.test.ts
```

Expected: FAIL because `src/extensions/code-review/credits.ts` does not exist.

- [ ] **Step 3: Add the implementation**

Create `src/extensions/code-review/credits.ts`:

```ts
import { CodeReviewMode } from './types';

export const CODE_REVIEW_CREDIT_COSTS: Record<CodeReviewMode, number> = {
  [CodeReviewMode.Standard]: 10,
  [CodeReviewMode.Deep]: 25,
  [CodeReviewMode.Security]: 20,
};

export interface CodeReviewModeOption {
  mode: CodeReviewMode;
  credits: number;
  scene: string;
}

export function normalizeCodeReviewMode(value: string): CodeReviewMode {
  if (value === CodeReviewMode.Deep) {
    return CodeReviewMode.Deep;
  }

  if (value === CodeReviewMode.Security) {
    return CodeReviewMode.Security;
  }

  return CodeReviewMode.Standard;
}

export function getCodeReviewCreditCost(
  mode: CodeReviewMode | string
): number {
  return CODE_REVIEW_CREDIT_COSTS[normalizeCodeReviewMode(String(mode))];
}

export function getCodeReviewCreditScene(
  mode: CodeReviewMode | string
): string {
  return `code_review_${normalizeCodeReviewMode(String(mode))}`;
}

export function getCodeReviewModeOptions(): CodeReviewModeOption[] {
  return [
    CodeReviewMode.Standard,
    CodeReviewMode.Deep,
    CodeReviewMode.Security,
  ].map((mode) => ({
    mode,
    credits: getCodeReviewCreditCost(mode),
    scene: getCodeReviewCreditScene(mode),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm test src/extensions/code-review/__tests__/credits.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/extensions/code-review/credits.ts src/extensions/code-review/__tests__/credits.test.ts
git commit -m "feat: add code review credit costs"
```

---

### Task 2: Credit-Gate Code Review API

**Files:**
- Modify: `src/app/api/code-reviews/route.ts`
- Create: `src/app/api/code-reviews/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getCodeReviewCreditCost(mode)`, `getCodeReviewCreditScene(mode)`, `normalizeCodeReviewMode(value)`
- Consumes: `getRemainingCredits(userId)` and `consumeCredits(input)` from `src/shared/models/credit.ts`
- Produces: structured insufficient-credit response `{ code: -1, message: 'insufficient_credits', data: { error, requiredCredits, remainingCredits, pricingUrl } }`
- Produces: successful response data including `{ creditsCost, remainingCredits }`

- [ ] **Step 1: Write the failing API test**

Create `src/app/api/code-reviews/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({
  generateId: vi.fn(() => 'generated-id'),
}));

vi.mock('@/shared/models/user', () => ({
  getUserInfo: vi.fn(),
}));

vi.mock('@/shared/models/credit', () => ({
  getRemainingCredits: vi.fn(),
  consumeCredits: vi.fn(),
}));

vi.mock('@/extensions/code-review/archive', () => ({
  extractZipProject: vi.fn(),
}));

vi.mock('@/extensions/code-review/evolink', () => ({
  EvolinkCodeReviewProvider: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/extensions/code-review/runner', () => ({
  runCodeReviewJob: vi.fn(),
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

function createReviewRequest(mode = 'standard') {
  const formData = new FormData();
  formData.append(
    'file',
    new File(['PK'], 'project.zip', { type: 'application/zip' })
  );
  formData.append('mode', mode);
  formData.append('instructions', 'Focus on release blockers.');

  return new Request('http://localhost/api/code-reviews', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/code-reviews credit gate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns a structured insufficient credit error before creating a job', async () => {
    const { getUserInfo } = await import('@/shared/models/user');
    const { getRemainingCredits, consumeCredits } = await import(
      '@/shared/models/credit'
    );
    const codeReviewModel = await import('@/shared/models/code_review');
    const { POST } = await import('../route');

    vi.mocked(getUserInfo).mockResolvedValue({
      id: 'user-1',
      email: 'cto@example.com',
      name: 'CTO',
    } as any);
    vi.mocked(getRemainingCredits).mockResolvedValue(5);

    const response = await POST(createReviewRequest('deep'));
    const body = await response.json();

    expect(body).toEqual({
      code: -1,
      message: 'insufficient_credits',
      data: {
        error: 'insufficient_credits',
        requiredCredits: 25,
        remainingCredits: 5,
        pricingUrl: '/pricing',
      },
    });
    expect(codeReviewModel.createCodeReviewJob).not.toHaveBeenCalled();
    expect(consumeCredits).not.toHaveBeenCalled();
  });

  it('charges credits only after a review completes successfully', async () => {
    const { getUserInfo } = await import('@/shared/models/user');
    const { getRemainingCredits, consumeCredits } = await import(
      '@/shared/models/credit'
    );
    const { extractZipProject } = await import('@/extensions/code-review/archive');
    const { runCodeReviewJob } = await import('@/extensions/code-review/runner');
    const codeReviewModel = await import('@/shared/models/code_review');
    const { POST } = await import('../route');

    vi.mocked(getUserInfo).mockResolvedValue({
      id: 'user-1',
      email: 'cto@example.com',
      name: 'CTO',
    } as any);
    vi.mocked(getRemainingCredits)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(20);
    vi.mocked(codeReviewModel.createCodeReviewJob).mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      status: 'created',
      mode: 'standard',
      archiveName: 'project.zip',
      archiveSize: 2,
      model: 'claude-sonnet-4-6',
    } as any);
    vi.mocked(codeReviewModel.updateCodeReviewJob).mockImplementation(
      async (_id, update) => ({ id: 'job-1', ...update }) as any
    );
    vi.mocked(extractZipProject).mockResolvedValue({
      archiveName: 'project.zip',
      files: [
        {
          path: 'src/app/api/users/route.ts',
          content: 'export async function POST() {}',
          language: 'typescript',
          sizeBytes: 31,
          lineCount: 1,
          hash: 'hash',
          included: true,
        },
      ],
      ignoredFiles: [],
      totalBytes: 31,
    });
    vi.mocked(codeReviewModel.createCodeReviewFiles).mockResolvedValue([
      { id: 'file-1', path: 'src/app/api/users/route.ts' },
    ] as any);
    vi.mocked(runCodeReviewJob).mockResolvedValue({
      executiveSummary: 'One high risk issue.',
      riskScore: 80,
      findings: [],
      optimizationSuggestions: [],
      needsReview: [],
      ignored: [],
      markdown: '# Report',
      profile: { stack: ['Next.js'] },
      usage: { inputTokens: 10, outputTokens: 5 },
    } as any);
    vi.mocked(codeReviewModel.createCodeReviewFindings).mockResolvedValue([]);
    vi.mocked(codeReviewModel.createCodeReviewReport).mockResolvedValue({
      id: 'report-1',
    } as any);
    vi.mocked(consumeCredits).mockResolvedValue({ id: 'credit-1' } as any);

    const response = await POST(createReviewRequest('standard'));
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data.creditsCost).toBe(10);
    expect(body.data.remainingCredits).toBe(20);
    expect(consumeCredits).toHaveBeenCalledWith({
      userId: 'user-1',
      credits: 10,
      scene: 'code_review_standard',
      description: 'Code review: project.zip (standard)',
      metadata: JSON.stringify({
        type: 'code-review',
        jobId: 'job-1',
        mode: 'standard',
        archiveName: 'project.zip',
        includedFileCount: 1,
        model: 'claude-sonnet-4-6',
      }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm test src/app/api/code-reviews/__tests__/route.test.ts
```

Expected: FAIL because the current route does not return insufficient-credit data and never calls `consumeCredits`.

- [ ] **Step 3: Implement credit gating in the route**

Modify imports in `src/app/api/code-reviews/route.ts`:

```ts
import {
  getCodeReviewCreditCost,
  getCodeReviewCreditScene,
  normalizeCodeReviewMode,
} from '@/extensions/code-review/credits';
import { respData, respErr, respJson } from '@/shared/lib/resp';
import {
  consumeCredits,
  getRemainingCredits,
} from '@/shared/models/credit';
```

Replace the current mode parsing line:

```ts
const mode = normalizeMode(String(formData.get('mode') || 'standard'));
```

with:

```ts
const mode = normalizeCodeReviewMode(String(formData.get('mode') || 'standard'));
const creditsCost = getCodeReviewCreditCost(mode);
```

After validation of `file`, archive size, and instructions length, add:

```ts
const remainingCredits = await getRemainingCredits(user.id);
if (remainingCredits < creditsCost) {
  return respJson(-1, 'insufficient_credits', {
    error: 'insufficient_credits',
    requiredCredits: creditsCost,
    remainingCredits,
    pricingUrl: '/pricing',
  });
}
```

After `createCodeReviewReport(...)` and before the final `updateCodeReviewJob(...)`, add:

```ts
await consumeCredits({
  userId: user.id,
  credits: creditsCost,
  scene: getCodeReviewCreditScene(mode),
  description: `Code review: ${file.name} (${mode})`,
  metadata: JSON.stringify({
    type: 'code-review',
    jobId: job.id,
    mode,
    archiveName: file.name,
    includedFileCount: project.files.length,
    model,
  }),
});
```

After `completedJob` is created, replace:

```ts
return respData({ job: completedJob, report });
```

with:

```ts
const remainingCreditsAfterReview = await getRemainingCredits(user.id);

return respData({
  job: completedJob,
  report,
  creditsCost,
  remainingCredits: remainingCreditsAfterReview,
});
```

Remove the local `normalizeMode()` function at the bottom of the file because `normalizeCodeReviewMode()` replaces it.

- [ ] **Step 4: Run the API test**

Run:

```powershell
pnpm test src/app/api/code-reviews/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the existing code-review tests**

Run:

```powershell
pnpm test src/extensions/code-review src/shared/models/code_review.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/code-reviews/route.ts src/app/api/code-reviews/__tests__/route.test.ts
git commit -m "feat: gate code reviews by credits"
```

---

### Task 3: Show Credit Cost and Balance in the Upload Workspace

**Files:**
- Modify: `src/app/[locale]/(landing)/activity/code-reviews/page.tsx`
- Modify: `src/shared/blocks/code-review/upload-form.tsx`
- Modify: `src/config/locale/messages/en/activity/code-reviews.json`
- Modify: `src/config/locale/messages/zh/activity/code-reviews.json`

**Interfaces:**
- Consumes: `getRemainingCredits(user.id)` from `src/shared/models/credit.ts`
- Consumes: `getCodeReviewModeOptions()` from `src/extensions/code-review/credits.ts`
- Produces: `CodeReviewUploadForm` prop `credits`

- [ ] **Step 1: Update locale labels first**

In `src/config/locale/messages/en/activity/code-reviews.json`, add these keys under `upload`:

```json
{
  "balance": "Current balance: {credits} credits",
  "mode_cost": "{credits} credits",
  "mode_standard_hint": "Balanced repository review for routine release checks.",
  "mode_deep_hint": "More cross-file context for larger changes and architecture risks.",
  "mode_security_hint": "Focused pass over auth, payment, API, data exposure, and permissions.",
  "insufficient_credits": "This review requires {required} credits. You have {remaining} credits.",
  "buy_credits": "Buy credits"
}
```

In `src/config/locale/messages/zh/activity/code-reviews.json`, add these keys under `upload`:

```json
{
  "balance": "当前余额：{credits} 积分",
  "mode_cost": "{credits} 积分",
  "mode_standard_hint": "适合常规发版检查的平衡型仓库审查。",
  "mode_deep_hint": "为较大改动和架构风险提供更多跨文件上下文。",
  "mode_security_hint": "重点审查鉴权、支付、API、数据暴露和权限边界。",
  "insufficient_credits": "本次审查需要 {required} 积分，你当前有 {remaining} 积分。",
  "buy_credits": "购买积分"
}
```

- [ ] **Step 2: Pass credit data from the server page**

Modify `src/app/[locale]/(landing)/activity/code-reviews/page.tsx` imports:

```ts
import { getCodeReviewModeOptions } from '@/extensions/code-review/credits';
import { getRemainingCredits } from '@/shared/models/credit';
```

Change the data loading block from:

```ts
const [jobs, total] = await Promise.all([
  getCodeReviewJobs({ userId: user.id, page, limit }),
  getCodeReviewJobsCount({ userId: user.id }),
]);
```

to:

```ts
const [jobs, total, remainingCredits] = await Promise.all([
  getCodeReviewJobs({ userId: user.id, page, limit }),
  getCodeReviewJobsCount({ userId: user.id }),
  getRemainingCredits(user.id),
]);
const modeOptions = getCodeReviewModeOptions();
```

Add this prop to `CodeReviewUploadForm`:

```tsx
credits={{
  remainingCredits,
  pricingUrl: '/pricing',
  modeOptions,
}}
```

Add these labels to the existing `labels` object:

```ts
balance: t('upload.balance', { credits: remainingCredits }),
modeCost: (credits: number) => t('upload.mode_cost', { credits }),
modeStandardHint: t('upload.mode_standard_hint'),
modeDeepHint: t('upload.mode_deep_hint'),
modeSecurityHint: t('upload.mode_security_hint'),
insufficientCredits: (required: number, remaining: number) =>
  t('upload.insufficient_credits', { required, remaining }),
buyCredits: t('upload.buy_credits'),
```

- [ ] **Step 3: Update the upload form props and behavior**

Modify `src/shared/blocks/code-review/upload-form.tsx` imports:

```ts
import type { CodeReviewModeOption } from '@/extensions/code-review/credits';
```

Extend the component props:

```ts
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
    instructions: string;
    instructionsPlaceholder: string;
    submit: string;
    uploading: string;
    fileRequired: string;
    fileTooLarge: string;
    failed: string;
    balance: string;
    modeCost: (credits: number) => string;
    insufficientCredits: (required: number, remaining: number) => string;
    buyCredits: string;
    workflowTitle: string;
    workflowDescription: string;
    workflowWorking: string;
    workflowStages: ReviewWorkflowStage[];
  };
  credits: {
    remainingCredits: number;
    pricingUrl: string;
    modeOptions: CodeReviewModeOption[];
  };
}) {
```

After the state declarations, add:

```ts
const selectedModeOption =
  credits.modeOptions.find((option) => option.mode === mode) ||
  credits.modeOptions[0];
const selectedCost = selectedModeOption?.credits || 0;
const hasEnoughCredits = credits.remainingCredits >= selectedCost;
```

At the top of `handleSubmit`, before file validation, add:

```ts
if (!hasEnoughCredits) {
  setError(labels.insufficientCredits(selectedCost, credits.remainingCredits));
  router.push(credits.pricingUrl);
  return;
}
```

In the API error handling block, replace:

```ts
setError(result.message || labels.failed);
return;
```

with:

```ts
if (result.message === 'insufficient_credits' && result.data) {
  setError(
    labels.insufficientCredits(
      result.data.requiredCredits,
      result.data.remainingCredits
    )
  );
  router.push(result.data.pricingUrl || credits.pricingUrl);
  return;
}

setError(result.message || labels.failed);
return;
```

Replace the mode `<select>` block with this richer mode selector:

```tsx
<div className="space-y-2">
  <Label htmlFor="code-review-mode">{labels.mode}</Label>
  <select
    id="code-review-mode"
    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    value={mode}
    onChange={(event) => setMode(event.target.value)}
  >
    <option value="standard">
      {labels.modeStandard} · {labels.modeCost(10)}
    </option>
    <option value="deep">
      {labels.modeDeep} · {labels.modeCost(25)}
    </option>
    <option value="security">
      {labels.modeSecurity} · {labels.modeCost(20)}
    </option>
  </select>
  <div className="grid gap-2 text-xs sm:grid-cols-3">
    <div className={mode === 'standard' ? 'text-foreground' : 'text-muted-foreground'}>
      {labels.modeStandardHint}
    </div>
    <div className={mode === 'deep' ? 'text-foreground' : 'text-muted-foreground'}>
      {labels.modeDeepHint}
    </div>
    <div className={mode === 'security' ? 'text-foreground' : 'text-muted-foreground'}>
      {labels.modeSecurityHint}
    </div>
  </div>
</div>
```

Before the submit button, add:

```tsx
<div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
  <span>{labels.balance}</span>
  <span className={hasEnoughCredits ? 'text-muted-foreground' : 'text-destructive'}>
    {labels.modeCost(selectedCost)}
  </span>
</div>
```

Replace the submit button content:

```tsx
<Button type="submit" disabled={loading} className="w-full sm:w-auto">
  {loading ? labels.uploading : labels.submit}
</Button>
```

with:

```tsx
<Button type="submit" disabled={loading} className="w-full sm:w-auto">
  {loading ? labels.uploading : hasEnoughCredits ? labels.submit : labels.buyCredits}
</Button>
```

- [ ] **Step 4: Run type/lint check for touched UI**

Run:

```powershell
pnpm lint
```

Expected: PASS with existing warnings only; no new errors.

- [ ] **Step 5: Commit**

```powershell
git add src/app/[locale]/(landing)/activity/code-reviews/page.tsx src/shared/blocks/code-review/upload-form.tsx src/config/locale/messages/en/activity/code-reviews.json src/config/locale/messages/zh/activity/code-reviews.json
git commit -m "feat: show code review credit costs"
```

---

### Task 4: Productize Landing and Pricing Copy

**Files:**
- Modify: `src/config/locale/messages/en/common.json`
- Modify: `src/config/locale/messages/zh/common.json`
- Modify: `src/config/locale/messages/en/landing.json`
- Modify: `src/config/locale/messages/zh/landing.json`
- Modify: `src/config/locale/messages/en/pages/index.json`
- Modify: `src/config/locale/messages/zh/pages/index.json`
- Modify: `src/config/locale/messages/en/pages/pricing.json`
- Modify: `src/config/locale/messages/zh/pages/pricing.json`
- Create: `src/config/locale/messages/__tests__/productization-copy.test.ts`

**Interfaces:**
- Consumes: existing dynamic page block fields from `src/shared/types/blocks/landing.d.ts`
- Consumes: existing Pricing block fields from `src/shared/types/blocks/pricing.d.ts`
- Produces: public marketing copy that contains CodeReview AI positioning and no ShipAny boilerplate sales copy

- [ ] **Step 1: Write the copy validation test**

Create `src/config/locale/messages/__tests__/productization-copy.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(root, relativePath), 'utf8')
  ) as T;
}

function flattenStrings(value: any): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenStrings);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(flattenStrings);
  }

  return [];
}

describe('productized CodeReview AI copy', () => {
  it('uses CodeReview AI metadata in both locales', () => {
    const enCommon = readJson('en/common.json');
    const zhCommon = readJson('zh/common.json');

    expect(enCommon.metadata.title).toContain('CodeReview AI');
    expect(enCommon.metadata.description).toContain('code review');
    expect(zhCommon.metadata.title).toContain('CodeReview AI');
    expect(zhCommon.metadata.description).toContain('代码审查');
  });

  it('removes ShipAny boilerplate sales copy from landing and pricing', () => {
    const files = [
      'en/pages/index.json',
      'zh/pages/index.json',
      'en/pages/pricing.json',
      'zh/pages/pricing.json',
      'en/landing.json',
      'zh/landing.json',
    ];
    const allText = files
      .flatMap((file) => flattenStrings(readJson(file)))
      .join('\n');

    expect(allText).toContain('CodeReview AI');
    expect(allText).not.toMatch(/ShipAny Boilerplate/i);
    expect(allText).not.toMatch(/NextJS boilerplate/i);
    expect(allText).not.toMatch(/Build unlimited projects/i);
  });

  it('keeps Chinese public copy readable UTF-8', () => {
    const zhFiles = [
      'zh/common.json',
      'zh/landing.json',
      'zh/pages/index.json',
      'zh/pages/pricing.json',
      'zh/activity/code-reviews.json',
    ];
    const zhText = zhFiles
      .flatMap((file) => flattenStrings(readJson(file)))
      .join('\n');

    expect(zhText).toContain('代码审查');
    expect(zhText).toContain('积分');
    expect(zhText).not.toMatch(/�|锛|鐨|妯℃|绋|浠锋|鍥㈤槦/);
  });

  it('defines subscription products and supplemental credit packs', () => {
    const enPricing = readJson('en/pages/pricing.json');
    const pricing = enPricing.page.sections.pricing;

    expect(pricing.groups.map((group: any) => group.name)).toEqual([
      'monthly',
      'yearly',
      'credits',
    ]);
    expect(pricing.items.map((item: any) => item.product_id)).toEqual([
      'starter-monthly',
      'team-monthly',
      'pro-monthly',
      'starter-yearly',
      'team-yearly',
      'pro-yearly',
      'credits-100',
      'credits-300',
      'credits-1000',
    ]);
    expect(
      pricing.items.every((item: any) =>
        String(item.product_name).startsWith('CodeReview AI')
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm test src/config/locale/messages/__tests__/productization-copy.test.ts
```

Expected: FAIL because current pricing still contains ShipAny boilerplate copy and current Chinese files contain mojibake.

- [ ] **Step 3: Update common metadata**

Set `src/config/locale/messages/en/common.json` metadata to:

```json
{
  "metadata": {
    "title": "CodeReview AI - Repository code review SaaS",
    "description": "Upload a repository snapshot and get a structured code review report with rule evidence, cross-file AI reasoning, human triage, and exportable findings.",
    "keywords": "AI code review, repository review, code quality, release risk, engineering SaaS"
  }
}
```

Set `src/config/locale/messages/zh/common.json` metadata to:

```json
{
  "metadata": {
    "title": "CodeReview AI - 仓库级代码审查 SaaS",
    "description": "上传仓库快照，生成包含规则证据、跨文件 AI 推理、人工确认和可导出结论的结构化代码审查报告。",
    "keywords": "AI 代码审查, 仓库审查, 代码质量, 发布风险, 研发团队 SaaS"
  }
}
```

- [ ] **Step 4: Update pricing products**

Replace both pricing files with three groups:

```json
[
  { "name": "monthly", "title": "Monthly", "is_featured": true, "label": "Best for teams" },
  { "name": "yearly", "title": "Annually", "label": "Save 20%" },
  { "name": "credits", "title": "Credit Packs" }
]
```

Use these English products in `src/config/locale/messages/en/pages/pricing.json`:

| product_id | group | title | amount | price | credits | valid_days | interval | featured |
| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |
| starter-monthly | monthly | Starter | 2900 | $29 | 120 | 30 | month | false |
| team-monthly | monthly | Team | 7900 | $79 | 420 | 30 | month | true |
| pro-monthly | monthly | Pro | 19900 | $199 | 1200 | 30 | month | false |
| starter-yearly | yearly | Starter | 27800 | $23 | 1440 | 365 | year | false |
| team-yearly | yearly | Team | 75800 | $63 | 5040 | 365 | year | true |
| pro-yearly | yearly | Pro | 191000 | $159 | 14400 | 365 | year | false |
| credits-100 | credits | 100 Credits | 1900 | $19 | 100 | 365 | one-time | false |
| credits-300 | credits | 300 Credits | 4900 | $49 | 300 | 365 | one-time | true |
| credits-1000 | credits | 1000 Credits | 14900 | $149 | 1000 | 365 | one-time | false |

For English features:

- Starter monthly/yearly:
  - "120 review credits included"
  - "Standard and Security reviews"
  - "ZIP repository upload"
  - "Structured report with findings"
  - "Markdown and JSON export"
- Team monthly/yearly:
  - "420 review credits included"
  - "Standard, Security, and Deep reviews"
  - "Cross-file reasoning for critical paths"
  - "Finding status workflow"
  - "Billing and credit history"
- Pro monthly/yearly:
  - "1200 review credits included"
  - "Designed for frequent release checks"
  - "Higher monthly review capacity"
  - "Priority product support"
  - "Longer report-retention positioning"
- Credit packs:
  - "Supplemental credits for extra repository reviews"
  - "Valid for 12 months"
  - "Works with any active account"

Use equivalent readable Chinese products in `src/config/locale/messages/zh/pages/pricing.json`. Chinese group titles are:

```json
[
  { "name": "monthly", "title": "按月订阅", "is_featured": true, "label": "团队首选" },
  { "name": "yearly", "title": "按年订阅", "label": "节省 20%" },
  { "name": "credits", "title": "补充积分包" }
]
```

Chinese plan titles are `Starter`、`Team`、`Pro`、`100 积分`、`300 积分`、`1000 积分`; product names all start with `CodeReview AI`.

- [ ] **Step 5: Update landing navigation**

Update `src/config/locale/messages/en/landing.json`:

- Brand title: `CodeReview AI`
- Header nav:
  - `How it works` -> `/#workflow`
  - `Pricing` -> `/pricing`
  - `Review workspace` -> `/activity/code-reviews`
- Header primary button:
  - `Start review` -> `/activity/code-reviews`
- Footer description:
  - `Repository code review SaaS for startup teams shipping fast.`

Update `src/config/locale/messages/zh/landing.json`:

- Brand title: `CodeReview AI`
- Header nav:
  - `工作流程` -> `/#workflow`
  - `价格` -> `/pricing`
  - `审查工作台` -> `/activity/code-reviews`
- Header primary button:
  - `开始审查` -> `/activity/code-reviews`
- Footer description:
  - `为快速发版的创业团队打造的仓库级代码审查 SaaS。`

- [ ] **Step 6: Update landing page sections**

In both `pages/index.json` files, set `show_sections` to:

```json
[
  "hero",
  "logos",
  "stats",
  "introduce",
  "workflow",
  "benefits",
  "features",
  "testimonials",
  "faq",
  "cta"
]
```

Use this English section outline:

- Hero title: `Ship safer code reviews before every release`
- Hero highlight: `safer code reviews`
- Hero description: `Upload a repository snapshot and get a structured review report with rule evidence, cross-file AI reasoning, human triage, and exportable findings.`
- Hero primary button: `Start a code review` -> `/activity/code-reviews`
- Hero secondary button: `View pricing` -> `/pricing`
- Logos title: `Built for modern engineering stacks`
- Stats:
  - `3` / `Review modes`
  - `7` / `Pipeline stages`
  - `0` / `Uploaded-code execution`
- Introduce title: `From repository snapshot to release-ready decisions`
- Workflow title: `A controlled review loop your team can trust`
- Benefits title: `Professional signal without running user code`
- Features title: `Coverage for real engineering risk`
- Testimonials title: `Built around the jobs small teams actually need done`
- FAQ title: `Questions teams ask before trusting an AI reviewer`
- CTA title: `Review one repository before your next release`

Use this Chinese section outline:

- Hero title: `让每次发版前都有一份可信代码审查`
- Hero highlight: `可信代码审查`
- Hero description: `上传仓库快照，生成包含规则证据、跨文件 AI 推理、人工确认状态和可导出结论的结构化报告。`
- Hero primary button: `开始代码审查` -> `/activity/code-reviews`
- Hero secondary button: `查看价格` -> `/pricing`
- Logos title: `适配现代研发团队常见技术栈`
- Stats:
  - `3` / `审查模式`
  - `7` / `流水线阶段`
  - `0` / `上传代码执行`
- Introduce title: `从仓库快照到可执行的发布决策`
- Workflow title: `团队可以信任的受控审查闭环`
- Benefits title: `不运行用户代码，也能给出专业信号`
- Features title: `覆盖真实研发风险`
- Testimonials title: `围绕小团队真实工作场景设计`
- FAQ title: `团队在信任 AI Reviewer 前会问的问题`
- CTA title: `在下一次发版前审查一个仓库`

- [ ] **Step 7: Run the copy validation test**

Run:

```powershell
pnpm test src/config/locale/messages/__tests__/productization-copy.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/config/locale/messages
git commit -m "feat: productize code review marketing copy"
```

---

### Task 5: Final Verification and Polish

**Files:**
- Modify only files needed to fix verification failures.

**Interfaces:**
- Confirms the whole productization pass is usable and safe.

- [ ] **Step 1: Run all tests**

Run:

```powershell
pnpm test
```

Expected: PASS for all test files, including new credit and copy tests.

- [ ] **Step 2: Run lint**

Run:

```powershell
pnpm lint
```

Expected: PASS. Existing warnings may remain, but no new errors.

- [ ] **Step 3: Run Vercel-style build**

Run:

```powershell
$env:VERCEL='1'; pnpm build
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff for accidental scope creep**

Run:

```powershell
git status --short
git diff --stat
```

Expected: changed files are limited to code-review credits/API/UI, locale copy, tests, and this plan. `.codex-dev-server.err.log` may remain dirty from earlier local logs and should not be committed.

- [ ] **Step 5: Optional local smoke test**

Run:

```powershell
pnpm dev
```

Open:

- `/`
- `/zh`
- `/pricing`
- `/zh/pricing`
- `/activity/code-reviews`

Expected:

- Home page reads as CodeReview AI, not ShipAny boilerplate.
- Chinese copy is readable.
- Pricing has Monthly, Annually, and Credit Packs groups.
- Upload workspace shows credit balance and per-mode costs.
- Low-balance accounts are sent to `/pricing` before submitting.

- [ ] **Step 6: Commit verification fixes**

If fixes were needed:

```powershell
git add <fixed-files>
git commit -m "chore: verify code review SaaS productization"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Landing page productization is covered in Task 4.
- Pricing subscription and credit packs are covered in Task 4.
- Credit costs are covered in Task 1.
- API balance check and successful-review charge are covered in Task 2.
- Upload UI balance/cost display is covered in Task 3.
- Chinese mojibake prevention is covered in Task 4 tests.
- Verification commands are covered in Task 5.

Scope check:

- No task adds organizations, teams, GitHub/GitLab integrations, PR write-back, automatic fixes, SBOM scanning, or queues.

Type consistency:

- `CodeReviewModeOption` is produced by Task 1 and consumed by Task 3.
- `normalizeCodeReviewMode()` replaces the route-local `normalizeMode()`.
- `getCodeReviewCreditCost()` and `getCodeReviewCreditScene()` are used by the API and tested independently.
