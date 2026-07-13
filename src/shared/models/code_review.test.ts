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
