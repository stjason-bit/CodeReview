import { describe, expect, it } from 'vitest';

import {
  CODE_REVIEW_CREDIT_COSTS,
  getCodeReviewCreditCost,
  getCodeReviewCreditScene,
  getCodeReviewModeOptions,
  normalizeCodeReviewMode,
} from '@/extensions/code-review/credits';
import { CodeReviewMode } from '@/extensions/code-review/types';

describe('code review credits', () => {
  it('defines the credit cost for each review mode', () => {
    expect(CODE_REVIEW_CREDIT_COSTS).toEqual({
      [CodeReviewMode.Standard]: 10,
      [CodeReviewMode.Deep]: 25,
      [CodeReviewMode.Security]: 20,
    });
  });

  it('normalizes unknown modes to standard review', () => {
    expect(normalizeCodeReviewMode(CodeReviewMode.Deep)).toBe(
      CodeReviewMode.Deep
    );
    expect(normalizeCodeReviewMode(CodeReviewMode.Security)).toBe(
      CodeReviewMode.Security
    );
    expect(normalizeCodeReviewMode('anything-else')).toBe(
      CodeReviewMode.Standard
    );
  });

  it('resolves credit costs and transaction scenes from normalized modes', () => {
    expect(getCodeReviewCreditCost('deep')).toBe(25);
    expect(getCodeReviewCreditCost('unknown')).toBe(10);
    expect(getCodeReviewCreditScene('security')).toBe('code_review_security');
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
