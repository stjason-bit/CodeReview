# Code Review Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build V1 of the code review feature: authenticated users upload a `.zip` project, the system safely indexes source files, reviews them through Evolink, and displays a structured professional report.

**Architecture:** Add a focused `src/extensions/code-review` domain package for archive safety, repository indexing, prompt construction, Evolink calls, and report assembly. Persist review jobs, files, findings, and reports through Drizzle models, expose authenticated API routes under `src/app/api/code-reviews`, and add an activity workspace UI under `src/app/[locale]/(landing)/activity/code-reviews`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM/Postgres, Vitest, Node `zlib`, Evolink Claude Messages API, existing ShipAny auth via `getUserInfo()`.

## Global Constraints

- V1 input is `.zip` upload only.
- Never execute uploaded code.
- Never install dependencies from uploaded code.
- Prevent zip path traversal with normalized paths.
- Reject symlinks or treat them as metadata only.
- Enforce archive size, extracted size, file count, and single-file size limits.
- Store uploaded archives and extracted content outside `public`.
- Do not expose raw file contents to other users.
- Redact common secret patterns before model calls.
- Default Evolink model is `claude-sonnet-4-6`.
- Use `EVOLINK_API_KEY`, `EVOLINK_BASE_URL`, and `EVOLINK_CODE_REVIEW_MODEL`.
- Standard, Deep, and Security modes all use Sonnet in V1.
- Existing `/api/chat` must not be reused for code review.
- GitHub PR review, quality gates, automatic code edits, and organization policy engine are out of scope for V1.

---

## File Structure

- Create `vitest.config.ts`: Vitest config with `@/` alias.
- Modify `package.json`: add `test` script and `vitest` dev dependency.
- Create `src/extensions/code-review/types.ts`: domain enums, DTOs, and normalized result types.
- Create `src/extensions/code-review/limits.ts`: upload and indexing limits.
- Create `src/extensions/code-review/path.ts`: path normalization and traversal protection.
- Create `src/extensions/code-review/filters.ts`: ignored path, binary, and size filtering.
- Create `src/extensions/code-review/secrets.ts`: secret redaction before model calls.
- Create `src/extensions/code-review/archive.ts`: dependency-free zip extraction and safe file manifest creation.
- Create `src/extensions/code-review/indexer.ts`: stack detection, language stats, file grouping.
- Create `src/extensions/code-review/prompts/*.ts`: versioned prompt builders.
- Create `src/extensions/code-review/evolink.ts`: Evolink Messages API client.
- Create `src/extensions/code-review/report.ts`: finding normalization, dedupe, sorting, Markdown rendering.
- Create `src/extensions/code-review/runner.ts`: orchestration for V1 review stages.
- Modify `src/config/db/schema.postgres.ts`: add code review tables.
- Create `src/shared/models/code_review.ts`: Drizzle CRUD helpers.
- Create API routes:
  - `src/app/api/code-reviews/route.ts`
  - `src/app/api/code-reviews/[id]/route.ts`
  - `src/app/api/code-reviews/[id]/findings/[findingId]/route.ts`
  - `src/app/api/code-reviews/[id]/export/route.ts`
- Create UI:
  - `src/app/[locale]/(landing)/activity/code-reviews/page.tsx`
  - `src/app/[locale]/(landing)/activity/code-reviews/[id]/page.tsx`
  - `src/shared/blocks/code-review/upload-form.tsx`
  - `src/shared/blocks/code-review/report-view.tsx`
  - `src/shared/blocks/code-review/findings-table.tsx`
- Modify locale files:
  - `src/config/locale/messages/en/activity/sidebar.json`
  - `src/config/locale/messages/zh/activity/sidebar.json`
  - `src/config/locale/index.ts`
  - add `src/config/locale/messages/en/activity/code-reviews.json`
  - add `src/config/locale/messages/zh/activity/code-reviews.json`
- Add tests under `src/extensions/code-review/__tests__`.

---

### Task 1: Test Harness and Domain Types

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/extensions/code-review/types.ts`
- Create: `src/extensions/code-review/limits.ts`
- Test: `src/extensions/code-review/__tests__/types.test.ts`

**Interfaces:**
- Produces `CodeReviewMode`, `CodeReviewJobStatus`, `CodeReviewFindingStatus`, `CodeReviewFinding`, `ReviewableFile`, `RepositoryProfile`, `CodeReviewReport`.
- Produces `CODE_REVIEW_LIMITS`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { CODE_REVIEW_LIMITS } from '../limits';
import {
  CodeReviewFindingStatus,
  CodeReviewJobStatus,
  CodeReviewMode,
} from '../types';

describe('code review domain types', () => {
  it('defines stable V1 modes and statuses', () => {
    expect(CodeReviewMode.Standard).toBe('standard');
    expect(CodeReviewMode.Deep).toBe('deep');
    expect(CodeReviewMode.Security).toBe('security');
    expect(CodeReviewJobStatus.Created).toBe('created');
    expect(CodeReviewJobStatus.Completed).toBe('completed');
    expect(CodeReviewFindingStatus.NeedsReview).toBe('needs_review');
  });

  it('keeps upload limits bounded for V1', () => {
    expect(CODE_REVIEW_LIMITS.maxArchiveBytes).toBe(25 * 1024 * 1024);
    expect(CODE_REVIEW_LIMITS.maxFiles).toBe(1200);
    expect(CODE_REVIEW_LIMITS.maxSingleFileBytes).toBe(256 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/extensions/code-review/__tests__/types.test.ts`

Expected: FAIL because `vitest` script/config and code review modules do not exist.

- [ ] **Step 3: Add Vitest and domain type implementation**

Add script and dependency to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.0.0"
  }
}
```

Create `vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `src/extensions/code-review/types.ts`:

```ts
export enum CodeReviewMode {
  Standard = 'standard',
  Deep = 'deep',
  Security = 'security',
}

export enum CodeReviewJobStatus {
  Created = 'created',
  Uploaded = 'uploaded',
  Indexing = 'indexing',
  Reviewing = 'reviewing',
  Synthesizing = 'synthesizing',
  Completed = 'completed',
  Failed = 'failed',
}

export enum CodeReviewFindingStatus {
  Open = 'open',
  NeedsReview = 'needs_review',
  Ignored = 'ignored',
  Fixed = 'fixed',
}

export type CodeReviewSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export type CodeReviewCategory =
  | 'bug'
  | 'security'
  | 'performance'
  | 'architecture'
  | 'maintainability'
  | 'test'
  | 'dependency';

export type CodeReviewConfidence = 'high' | 'medium' | 'low';

export interface ReviewableFile {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
  lineCount: number;
  hash: string;
  included: boolean;
  ignoredReason?: string;
}

export interface RepositoryProfile {
  stack: string[];
  architectureSummary: string;
  importantPaths: string[];
  riskAreas: string[];
  reviewPlan: string[];
}

export interface CodeReviewFinding {
  title: string;
  severity: CodeReviewSeverity;
  category: CodeReviewCategory;
  confidence: CodeReviewConfidence;
  status: CodeReviewFindingStatus;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  evidence: string;
  recommendation: string;
  suggestedFix?: string;
}

export interface CodeReviewReport {
  executiveSummary: string;
  riskScore: number;
  findings: CodeReviewFinding[];
  optimizationSuggestions: string[];
  needsReview: string[];
  ignored: string[];
  markdown: string;
}
```

Create `src/extensions/code-review/limits.ts`:

```ts
export const CODE_REVIEW_LIMITS = {
  maxArchiveBytes: 25 * 1024 * 1024,
  maxExtractedBytes: 80 * 1024 * 1024,
  maxFiles: 1200,
  maxSingleFileBytes: 256 * 1024,
  maxReviewFiles: 240,
  maxPromptCharsPerChunk: 80_000,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm install && pnpm test src/extensions/code-review/__tests__/types.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/extensions/code-review
git commit -m "test: add code review test harness"
```

---

### Task 2: Safe Archive and File Filtering

**Files:**
- Create: `src/extensions/code-review/path.ts`
- Create: `src/extensions/code-review/filters.ts`
- Create: `src/extensions/code-review/secrets.ts`
- Create: `src/extensions/code-review/archive.ts`
- Test: `src/extensions/code-review/__tests__/archive.test.ts`

**Interfaces:**
- Consumes `ReviewableFile` and `CODE_REVIEW_LIMITS`.
- Produces `normalizeArchivePath(path: string): string | null`.
- Produces `shouldIgnoreFile(input): { ignored: boolean; reason?: string }`.
- Produces `redactSecrets(content: string): string`.
- Produces `extractZipProject(input): Promise<ExtractedProject>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';

import { extractZipProject } from '../archive';
import { shouldIgnoreFile } from '../filters';
import { normalizeArchivePath } from '../path';
import { redactSecrets } from '../secrets';

function createStoredZip(entries: { path: string; content: string }[]): Buffer {
  const chunks: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path);
    const content = Buffer.from(entry.content);
    const compressed = deflateRawSync(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralDirectory.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralStart = offset;
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, ...centralDirectory, end]);
}

describe('archive safety', () => {
  it('rejects traversal paths', () => {
    expect(normalizeArchivePath('../secret.ts')).toBeNull();
    expect(normalizeArchivePath('app/../../secret.ts')).toBeNull();
    expect(normalizeArchivePath('src/index.ts')).toBe('src/index.ts');
  });

  it('ignores dependency and binary-like files', () => {
    expect(shouldIgnoreFile({ path: 'node_modules/react/index.js', sizeBytes: 10 }).ignored).toBe(true);
    expect(shouldIgnoreFile({ path: 'src/logo.png', sizeBytes: 10 }).ignored).toBe(true);
    expect(shouldIgnoreFile({ path: 'src/app.ts', sizeBytes: 10 }).ignored).toBe(false);
  });

  it('redacts common secrets before model calls', () => {
    const content = 'DATABASE_URL="postgres://user:pass@example/db"\\nOPENAI_API_KEY="sk-live-secret"';
    const redacted = redactSecrets(content);
    expect(redacted).not.toContain('postgres://user:pass@example/db');
    expect(redacted).not.toContain('sk-live-secret');
    expect(redacted).toContain('[REDACTED_SECRET]');
  });

  it('extracts only safe reviewable files from a zip', async () => {
    const buffer = createStoredZip([
      { path: 'src/index.ts', content: 'export const ok = true;\\n' },
      { path: '../outside.ts', content: 'bad' },
      { path: 'node_modules/pkg/index.js', content: 'ignored' },
    ]);

    const project = await extractZipProject(buffer, 'sample.zip');

    expect(project.files.map((file) => file.path)).toContain('src/index.ts');
    expect(project.ignoredFiles.some((file) => file.path === '../outside.ts')).toBe(true);
    expect(project.ignoredFiles.some((file) => file.path === 'node_modules/pkg/index.js')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/extensions/code-review/__tests__/archive.test.ts`

Expected: FAIL because archive modules do not exist.

- [ ] **Step 3: Add implementation**

Implement `path.ts`, `filters.ts`, `secrets.ts`, and `archive.ts` with:

```ts
// path.ts
export function normalizeArchivePath(input: string): string | null {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((part) => part === '..')) return null;
  if (!parts.length) return null;
  return parts.join('/');
}
```

```ts
// filters.ts
import { CODE_REVIEW_LIMITS } from './limits';

const ignoredSegments = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
  'vendor',
]);

const ignoredExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.mp4',
  '.mov',
  '.mp3',
  '.wav',
  '.zip',
  '.gz',
  '.tar',
  '.woff',
  '.woff2',
  '.ttf',
]);

export function shouldIgnoreFile({
  path,
  sizeBytes,
}: {
  path: string;
  sizeBytes: number;
}): { ignored: boolean; reason?: string } {
  const lower = path.toLowerCase();
  const segments = lower.split('/');
  if (segments.some((segment) => ignoredSegments.has(segment))) {
    return { ignored: true, reason: 'ignored_path' };
  }
  if ([...ignoredExtensions].some((extension) => lower.endsWith(extension))) {
    return { ignored: true, reason: 'binary_or_asset' };
  }
  if (sizeBytes > CODE_REVIEW_LIMITS.maxSingleFileBytes) {
    return { ignored: true, reason: 'file_too_large' };
  }
  return { ignored: false };
}
```

```ts
// secrets.ts
const secretPatterns = [
  /(DATABASE_URL\s*=\s*)["']?[^"'\n]+["']?/gi,
  /((?:API|SECRET|TOKEN|KEY)[A-Z0-9_]*\s*=\s*)["']?[^"'\n]+["']?/gi,
  /(sk-[A-Za-z0-9_-]{12,})/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactSecrets(content: string): string {
  return secretPatterns.reduce(
    (result, pattern) => result.replace(pattern, '$1[REDACTED_SECRET]'),
    content
  );
}
```

```ts
// archive.ts
import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

import { CODE_REVIEW_LIMITS } from './limits';
import { shouldIgnoreFile } from './filters';
import { normalizeArchivePath } from './path';
import { redactSecrets } from './secrets';
import { ReviewableFile } from './types';

export interface IgnoredArchiveFile {
  path: string;
  reason: string;
  sizeBytes?: number;
}

export interface ExtractedProject {
  archiveName: string;
  files: ReviewableFile[];
  ignoredFiles: IgnoredArchiveFile[];
  totalBytes: number;
}

export async function extractZipProject(
  buffer: Buffer,
  archiveName: string
): Promise<ExtractedProject> {
  if (buffer.byteLength > CODE_REVIEW_LIMITS.maxArchiveBytes) {
    throw new Error('archive_too_large');
  }

  const entries = readZipEntries(buffer);
  const files: ReviewableFile[] = [];
  const ignoredFiles: IgnoredArchiveFile[] = [];
  let totalBytes = 0;

  for (const entry of entries) {
    if (entry.path.endsWith('/')) continue;
    const normalizedPath = normalizeArchivePath(entry.path);
    if (!normalizedPath) {
      ignoredFiles.push({ path: entry.path, reason: 'unsafe_path' });
      continue;
    }

    const contentBuffer = entry.content;
    totalBytes += contentBuffer.byteLength;
    if (totalBytes > CODE_REVIEW_LIMITS.maxExtractedBytes) {
      throw new Error('extracted_content_too_large');
    }

    const ignore = shouldIgnoreFile({
      path: normalizedPath,
      sizeBytes: contentBuffer.byteLength,
    });
    if (ignore.ignored) {
      ignoredFiles.push({
        path: normalizedPath,
        reason: ignore.reason || 'ignored',
        sizeBytes: contentBuffer.byteLength,
      });
      continue;
    }

    const content = redactSecrets(contentBuffer.toString('utf8'));
    files.push({
      path: normalizedPath,
      content,
      language: detectLanguage(normalizedPath),
      sizeBytes: contentBuffer.byteLength,
      lineCount: content.split('\n').length,
      hash: crypto.createHash('sha256').update(contentBuffer).digest('hex'),
      included: true,
    });
  }

  if (files.length + ignoredFiles.length > CODE_REVIEW_LIMITS.maxFiles) {
    throw new Error('too_many_files');
  }

  return { archiveName, files, ignoredFiles, totalBytes };
}

interface ZipEntry {
  path: string;
  content: Buffer;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  // Parse the ZIP central directory and support methods 0 (stored) and 8 (deflated).
}

function detectLanguage(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    php: 'php',
    rb: 'ruby',
    md: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return extension ? map[extension] || extension : 'text';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm install && pnpm test src/extensions/code-review/__tests__/archive.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/code-review
git commit -m "feat: add safe code archive extraction"
```

---

### Task 3: Repository Indexing and Report Assembly

**Files:**
- Create: `src/extensions/code-review/indexer.ts`
- Create: `src/extensions/code-review/report.ts`
- Test: `src/extensions/code-review/__tests__/indexer-report.test.ts`

**Interfaces:**
- Consumes `ReviewableFile`, `CodeReviewFinding`, `CodeReviewReport`.
- Produces `buildRepositoryProfile(files): RepositoryProfile`.
- Produces `groupFilesForReview(files): ReviewFileGroup[]`.
- Produces `assembleReport(input): CodeReviewReport`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { buildRepositoryProfile, groupFilesForReview } from '../indexer';
import { assembleReport } from '../report';
import { CodeReviewFindingStatus, ReviewableFile } from '../types';

const files: ReviewableFile[] = [
  {
    path: 'package.json',
    content: '{"dependencies":{"next":"16.0.7"}}',
    language: 'json',
    sizeBytes: 40,
    lineCount: 1,
    hash: 'a',
    included: true,
  },
  {
    path: 'src/app/api/users/route.ts',
    content: 'export async function POST() { return Response.json({ ok: true }); }',
    language: 'typescript',
    sizeBytes: 80,
    lineCount: 1,
    hash: 'b',
    included: true,
  },
];

describe('repository indexing and reports', () => {
  it('detects stack and risk areas from repository files', () => {
    const profile = buildRepositoryProfile(files);
    expect(profile.stack).toContain('Next.js');
    expect(profile.importantPaths).toContain('package.json');
    expect(profile.riskAreas).toContain('API routes');
  });

  it('groups files into review chunks', () => {
    const groups = groupFilesForReview(files);
    expect(groups).toHaveLength(1);
    expect(groups[0].files.map((file) => file.path)).toContain('src/app/api/users/route.ts');
  });

  it('deduplicates and sorts report findings', () => {
    const report = assembleReport({
      profile: buildRepositoryProfile(files),
      findings: [
        {
          title: 'Missing auth check',
          severity: 'high',
          category: 'security',
          confidence: 'high',
          status: CodeReviewFindingStatus.Open,
          filePath: 'src/app/api/users/route.ts',
          startLine: 1,
          evidence: 'POST route has no user check',
          recommendation: 'Require authentication before mutation',
        },
        {
          title: 'Missing auth check',
          severity: 'high',
          category: 'security',
          confidence: 'high',
          status: CodeReviewFindingStatus.Open,
          filePath: 'src/app/api/users/route.ts',
          startLine: 1,
          evidence: 'duplicate',
          recommendation: 'duplicate',
        },
      ],
      ignoredFiles: [{ path: 'node_modules/react/index.js', reason: 'ignored_path' }],
    });

    expect(report.findings).toHaveLength(1);
    expect(report.riskScore).toBeGreaterThan(70);
    expect(report.markdown).toContain('Missing auth check');
    expect(report.ignored).toContain('node_modules/react/index.js: ignored_path');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/extensions/code-review/__tests__/indexer-report.test.ts`

Expected: FAIL because indexer and report modules do not exist.

- [ ] **Step 3: Implement indexer and report assembly**

Implement deterministic stack detection and finding normalization. Severity sorting order: `critical`, `high`, `medium`, `low`, `info`. Risk score starts at 0 and adds `35/25/12/5/1` for each unique finding severity, capped at 100.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/extensions/code-review/__tests__/indexer-report.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/code-review
git commit -m "feat: add repository indexing and report assembly"
```

---

### Task 4: Database Schema and Model Helpers

**Files:**
- Modify: `src/config/db/schema.postgres.ts`
- Create: `src/shared/models/code_review.ts`
- Test: `src/shared/models/code_review.test.ts`

**Interfaces:**
- Produces Drizzle tables `codeReviewJob`, `codeReviewFile`, `codeReviewFinding`, `codeReviewReport`.
- Produces model helpers:
  - `createCodeReviewJob(input)`
  - `updateCodeReviewJob(id, input)`
  - `findCodeReviewJobById(id)`
  - `getCodeReviewJobs({ userId, page, limit })`
  - `createCodeReviewFiles(input)`
  - `createCodeReviewFindings(input)`
  - `updateCodeReviewFindingStatus(id, status)`
  - `createCodeReviewReport(input)`

- [ ] **Step 1: Write the failing schema shape test**

```ts
import { describe, expect, it } from 'vitest';

import {
  codeReviewFile,
  codeReviewFinding,
  codeReviewJob,
  codeReviewReport,
} from '@/config/db/schema';

describe('code review schema', () => {
  it('exports code review tables', () => {
    expect(codeReviewJob).toBeDefined();
    expect(codeReviewFile).toBeDefined();
    expect(codeReviewFinding).toBeDefined();
    expect(codeReviewReport).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/shared/models/code_review.test.ts`

Expected: FAIL because schema exports do not exist.

- [ ] **Step 3: Add schema and model helpers**

Add tables to `schema.postgres.ts` using existing conventions: `text` for JSON blobs, `integer` for counts and scores, `timestamp` for dates, indexes on user/status/job.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/shared/models/code_review.test.ts`

Expected: PASS.

- [ ] **Step 5: Generate migration**

Run: `pnpm db:generate`

Expected: Drizzle creates a new migration under `src/config/db/migrations`.

- [ ] **Step 6: Commit**

```bash
git add src/config/db/schema.postgres.ts src/shared/models/code_review.ts src/shared/models/code_review.test.ts src/config/db/migrations
git commit -m "feat: add code review persistence"
```

---

### Task 5: Prompt Registry and Evolink Provider

**Files:**
- Create: `src/extensions/code-review/prompts/repository-profile.ts`
- Create: `src/extensions/code-review/prompts/file-review.ts`
- Create: `src/extensions/code-review/prompts/cross-file-review.ts`
- Create: `src/extensions/code-review/prompts/report-synthesis.ts`
- Create: `src/extensions/code-review/prompts/index.ts`
- Create: `src/extensions/code-review/evolink.ts`
- Test: `src/extensions/code-review/__tests__/evolink-prompts.test.ts`

**Interfaces:**
- Produces prompt builders returning `{ system: string; user: string }`.
- Produces `EvolinkCodeReviewProvider.createMessage(input): Promise<EvolinkMessageResult>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { buildFileReviewPrompt, buildRepositoryProfilePrompt } from '../prompts';
import { EvolinkCodeReviewProvider } from '../evolink';

describe('prompts and evolink provider', () => {
  it('builds JSON-first review prompts', () => {
    const prompt = buildRepositoryProfilePrompt({
      fileTree: ['package.json', 'src/app/api/users/route.ts'],
      importantFiles: [{ path: 'package.json', content: '{}' }],
      mode: 'standard',
      userInstructions: 'Focus on auth.',
    });

    expect(prompt.system).toContain('professional code reviewer');
    expect(prompt.user).toContain('Return JSON only');
    expect(prompt.user).toContain('Focus on auth.');
  });

  it('includes file contents in file review prompt', () => {
    const prompt = buildFileReviewPrompt({
      repositorySummary: 'Next.js app',
      files: [{ path: 'src/a.ts', content: 'export const a = 1;', language: 'typescript' }],
      mode: 'security',
    });
    expect(prompt.user).toContain('src/a.ts');
    expect(prompt.user).toContain('export const a = 1;');
  });

  it('calls Evolink Messages API with configured auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"ok":true}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const provider = new EvolinkCodeReviewProvider({
      apiKey: 'test-key',
      baseUrl: 'https://direct.evolink.ai',
      model: 'claude-sonnet-4-6',
      fetchFn: fetchMock,
    });

    const result = await provider.createMessage({
      system: 'sys',
      user: 'user',
      maxTokens: 1000,
    });

    expect(result.text).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://direct.evolink.ai/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/extensions/code-review/__tests__/evolink-prompts.test.ts`

Expected: FAIL because prompt and provider modules do not exist.

- [ ] **Step 3: Implement prompt builders and provider**

Provider request body:

```ts
{
  model,
  max_tokens: maxTokens,
  temperature: 0.1,
  system,
  messages: [{ role: 'user', content: user }]
}
```

Provider response parsing returns the first text content block and usage.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/extensions/code-review/__tests__/evolink-prompts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/code-review
git commit -m "feat: add evolink code review provider"
```

---

### Task 6: Review Runner and API Routes

**Files:**
- Create: `src/extensions/code-review/runner.ts`
- Create: `src/app/api/code-reviews/route.ts`
- Create: `src/app/api/code-reviews/[id]/route.ts`
- Create: `src/app/api/code-reviews/[id]/findings/[findingId]/route.ts`
- Create: `src/app/api/code-reviews/[id]/export/route.ts`
- Test: `src/extensions/code-review/__tests__/runner.test.ts`

**Interfaces:**
- Consumes archive/indexer/provider/report/model helpers.
- Produces `runCodeReviewJob(input): Promise<CodeReviewReport>`.
- API `POST /api/code-reviews` accepts multipart form data: `file`, `mode`, `instructions`.
- API `GET /api/code-reviews` lists current user's jobs.
- API `GET /api/code-reviews/:id` returns job, files, findings, report for current user.
- API `PATCH /api/code-reviews/:id/findings/:findingId` updates finding status.
- API `GET /api/code-reviews/:id/export?format=markdown|json` exports report.

- [ ] **Step 1: Write the failing runner test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { runCodeReviewJob } from '../runner';

describe('code review runner', () => {
  it('runs a minimal review with mocked provider', async () => {
    const provider = {
      createMessage: vi
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({
            stack: ['Next.js'],
            architecture_summary: 'Small app',
            important_paths: ['package.json'],
            risk_areas: ['API routes'],
            review_plan: ['Review API routes'],
          }),
          usage: { inputTokens: 10, outputTokens: 10 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            findings: [
              {
                title: 'Missing auth check',
                severity: 'high',
                category: 'security',
                confidence: 'high',
                file_path: 'src/app/api/users/route.ts',
                start_line: 1,
                evidence: 'No auth call',
                recommendation: 'Check user session',
              },
            ],
            file_summaries: [],
            needs_cross_file_review: [],
          }),
          usage: { inputTokens: 20, outputTokens: 20 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            executive_summary: 'One high risk issue.',
            optimization_suggestions: [],
            needs_review: [],
            ignored: [],
          }),
          usage: { inputTokens: 10, outputTokens: 10 },
        }),
    };

    const report = await runCodeReviewJob({
      files: [
        {
          path: 'src/app/api/users/route.ts',
          content: 'export async function POST() {}',
          language: 'typescript',
          sizeBytes: 30,
          lineCount: 1,
          hash: 'a',
          included: true,
        },
      ],
      ignoredFiles: [],
      mode: 'standard',
      instructions: '',
      provider,
    });

    expect(report.findings[0].title).toBe('Missing auth check');
    expect(report.markdown).toContain('One high risk issue.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/extensions/code-review/__tests__/runner.test.ts`

Expected: FAIL because runner does not exist.

- [ ] **Step 3: Implement runner and authenticated APIs**

Runner performs:

1. Repository profile call.
2. File review calls by group.
3. Report synthesis call.
4. JSON parse with one repair attempt using the provider when parsing fails.
5. Report assembly.

API routes use `getUserInfo()` and `respData`/`respErr`. V1 may run the job synchronously inside `POST /api/code-reviews` after upload because the archive limit is bounded; return completed job data or a failed job. Persist intermediate status updates.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/extensions/code-review/__tests__/runner.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/code-review src/app/api/code-reviews
git commit -m "feat: add code review APIs"
```

---

### Task 7: Activity UI and Locale Copy

**Files:**
- Create: `src/app/[locale]/(landing)/activity/code-reviews/page.tsx`
- Create: `src/app/[locale]/(landing)/activity/code-reviews/[id]/page.tsx`
- Create: `src/shared/blocks/code-review/upload-form.tsx`
- Create: `src/shared/blocks/code-review/report-view.tsx`
- Create: `src/shared/blocks/code-review/findings-table.tsx`
- Modify: `src/config/locale/messages/en/activity/sidebar.json`
- Modify: `src/config/locale/messages/zh/activity/sidebar.json`
- Modify: `src/config/locale/index.ts`
- Create: `src/config/locale/messages/en/activity/code-reviews.json`
- Create: `src/config/locale/messages/zh/activity/code-reviews.json`

**Interfaces:**
- Consumes API routes from Task 6.
- Produces activity page `/activity/code-reviews`.
- Produces detail page `/activity/code-reviews/:id`.

- [ ] **Step 1: Add the upload UI**

Create a client upload form that posts `FormData` to `/api/code-reviews`, shows loading state, and navigates to `/activity/code-reviews/{id}` on success.

- [ ] **Step 2: Add server list page**

List the current user's jobs with status, mode, model, file counts, created time, and action link to detail page.

- [ ] **Step 3: Add report detail page**

Render executive summary, risk score, top findings, filters, ignored files, and export buttons. Use compact dashboard styling and existing UI components.

- [ ] **Step 4: Add locale entries**

Add English and Chinese copy for sidebar nav, labels, buttons, empty states, statuses, and finding categories. Register `activity/code-reviews` in `src/config/locale/index.ts`.

- [ ] **Step 5: Verify TypeScript and build**

Run: `pnpm lint`

Expected: PASS.

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app src/shared/blocks/code-review src/config/locale
git commit -m "feat: add code review activity UI"
```

---

### Task 8: Final Verification

**Files:**
- Modify only files needed to fix verification failures.

**Interfaces:**
- Confirms the whole feature is usable and safe.

- [ ] **Step 1: Run all unit tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 4: Generate and inspect database migration**

Run: `pnpm db:generate`

Expected: Either no changes if migration already exists, or a valid migration containing the four code review tables.

- [ ] **Step 5: Manual smoke test**

Run: `pnpm dev`

Open `/activity/code-reviews`, upload a tiny zip containing:

```text
package.json
src/app/api/users/route.ts
```

Expected:

- Upload completes.
- Review report appears.
- Findings table renders.
- Finding status can be changed.
- Markdown export returns a file.
- `.env` values are never visible in rendered UI or API response.

- [ ] **Step 6: Commit fixes**

```bash
git status --short
git add <changed-files>
git commit -m "chore: verify code review feature"
```

---

## Self-Review

- Spec coverage: upload, safe extraction, ignored files, repository profile, Evolink review, report synthesis, persistence, findings statuses, export, UI, and tests are covered by Tasks 1-8.
- Out-of-scope protection: execution, dependency install, GitHub PR review, quality gates, automatic fixes, and policy engine are not included in implementation tasks.
- Type consistency: `CodeReviewMode`, `CodeReviewJobStatus`, `CodeReviewFindingStatus`, `ReviewableFile`, and `CodeReviewReport` are defined in Task 1 and reused consistently.
- Placeholder scan: no unresolved marker text or open-ended implementation steps remain.
