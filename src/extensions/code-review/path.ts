export function normalizeArchivePath(input: string): string | null {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);

  if (!parts.length) {
    return null;
  }

  if (parts.some((part) => part === '..')) {
    return null;
  }

  return parts.join('/');
}
