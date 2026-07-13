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
