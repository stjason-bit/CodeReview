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

export function getCodeReviewCreditCost(mode: CodeReviewMode | string): number {
  return CODE_REVIEW_CREDIT_COSTS[normalizeCodeReviewMode(mode)];
}

export function getCodeReviewCreditScene(
  mode: CodeReviewMode | string
): string {
  return `code_review_${normalizeCodeReviewMode(mode)}`;
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
