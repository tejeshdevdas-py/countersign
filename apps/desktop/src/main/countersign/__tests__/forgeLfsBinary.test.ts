/**
 * Countersign packaging (final review M-B6): sqlite-vec's vec0.dll is kept
 * in Git LFS. A checkout without `git lfs pull` holds a pointer of about 130
 * bytes in its place, and packaging copied whatever was there. The check now
 * throws for a missing, tiny or pointer file and says to run git lfs pull,
 * as the Android platform-tools path already does.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { assertRealLfsBinary } from '../../../../forge-countersign';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fileWith(content: string | Buffer | null): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-lfs-binary-'));
  roots.push(root);
  const file = path.join(root, 'vec0.dll');
  if (content !== null) fs.writeFileSync(file, content);
  return file;
}

const POINTER = [
  'version https://git-lfs.github.com/spec/v1',
  `oid sha256:${'0'.repeat(64)}`,
  'size 289280',
  '',
].join('\n');

describe('Countersign bundled LFS binary check', () => {
  it('accepts a real binary', () => {
    const file = fileWith(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(8192, 1)]));
    expect(() => assertRealLfsBinary(file, 'sqlite-vec win32-x64/vec0.dll')).not.toThrow();
  });

  it('rejects a missing file and says to run git lfs pull', () => {
    expect(() => assertRealLfsBinary(fileWith(null), 'sqlite-vec win32-x64/vec0.dll')).toThrow(
      /sqlite-vec win32-x64\/vec0\.dll missing .*git lfs pull/,
    );
  });

  it('rejects a directory in its place', () => {
    const file = fileWith(null);
    fs.mkdirSync(file);
    expect(() => assertRealLfsBinary(file, 'vec0.dll')).toThrow(/missing .*git lfs pull/);
  });

  it('rejects a Git LFS pointer', () => {
    expect(POINTER.length).toBeLessThan(200);
    expect(() => assertRealLfsBinary(fileWith(POINTER), 'vec0.dll')).toThrow(
      /Git LFS pointer.*git lfs pull/,
    );
  });

  it('rejects a tiny placeholder that is not a pointer', () => {
    expect(() => assertRealLfsBinary(fileWith('placeholder'), 'vec0.dll')).toThrow(
      /unexpectedly small \(11 bytes\).*git lfs pull/,
    );
  });
});
