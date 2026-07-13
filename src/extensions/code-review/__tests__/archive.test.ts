import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { extractZipProject } from '../archive';
import { shouldIgnoreFile } from '../filters';
import { normalizeArchivePath } from '../path';
import { redactSecrets } from '../secrets';

function createZip(entries: { path: string; content: string }[]): Buffer {
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
  const centralSize = centralDirectory.reduce(
    (sum, chunk) => sum + chunk.length,
    0
  );
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
    expect(
      shouldIgnoreFile({ path: 'node_modules/react/index.js', sizeBytes: 10 })
        .ignored
    ).toBe(true);
    expect(shouldIgnoreFile({ path: 'src/logo.png', sizeBytes: 10 }).ignored)
      .toBe(true);
    expect(shouldIgnoreFile({ path: 'src/app.ts', sizeBytes: 10 }).ignored)
      .toBe(false);
  });

  it('redacts common secrets before model calls', () => {
    const content =
      'DATABASE_URL="postgres://user:pass@example/db"\nOPENAI_API_KEY="sk-live-secret"';
    const redacted = redactSecrets(content);
    expect(redacted).not.toContain('postgres://user:pass@example/db');
    expect(redacted).not.toContain('sk-live-secret');
    expect(redacted).toContain('[REDACTED_SECRET]');
  });

  it('extracts only safe reviewable files from a zip', async () => {
    const buffer = createZip([
      { path: 'src/index.ts', content: 'export const ok = true;\n' },
      { path: '../outside.ts', content: 'bad' },
      { path: 'node_modules/pkg/index.js', content: 'ignored' },
    ]);

    const project = await extractZipProject(buffer, 'sample.zip');

    expect(project.files.map((file) => file.path)).toContain('src/index.ts');
    expect(project.ignoredFiles.some((file) => file.path === '../outside.ts'))
      .toBe(true);
    expect(
      project.ignoredFiles.some(
        (file) => file.path === 'node_modules/pkg/index.js'
      )
    ).toBe(true);
  });
});
