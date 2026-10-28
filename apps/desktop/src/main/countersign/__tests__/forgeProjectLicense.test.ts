/**
 * Countersign packaging (final review M-L2): the installer carries the
 * project's own LICENSE and NOTICE, not only the third-party notices. Apache
 * 2.0 section 4(d) asks a derivative work to ship the NOTICE text.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PROJECT_LICENSE_FILES, stageProjectLicense } from '../../../../forge-countersign';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-license-'));
  roots.push(root);
  const repoRoot = path.join(root, 'repo');
  const resources = path.join(root, 'out', 'resources');
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(repoRoot, name), text);
  }
  return { repoRoot, resources };
}

describe('Countersign project licence in the package', () => {
  it('names the root LICENSE and NOTICE and their packaged names', () => {
    expect(PROJECT_LICENSE_FILES).toEqual([
      { source: 'LICENSE', packaged: 'LICENSE.txt' },
      { source: 'NOTICE', packaged: 'NOTICE.txt' },
    ]);
  });

  it('copies both files into the packaged resources unchanged', () => {
    const f = fixture({ LICENSE: 'Apache License\r\nVersion 2.0\n', NOTICE: 'Countersign\n' });
    stageProjectLicense(f.resources, f.repoRoot);
    expect(fs.readFileSync(path.join(f.resources, 'LICENSE.txt'), 'utf8')).toBe(
      'Apache License\r\nVersion 2.0\n',
    );
    expect(fs.readFileSync(path.join(f.resources, 'NOTICE.txt'), 'utf8')).toBe('Countersign\n');
  });

  it.each(['LICENSE', 'NOTICE'])('stops when %s is missing from the repository', (missing) => {
    const files: Record<string, string> = { LICENSE: 'l', NOTICE: 'n' };
    delete files[missing];
    const f = fixture(files);
    expect(() => stageProjectLicense(f.resources, f.repoRoot)).toThrow(
      new RegExp(`project ${missing} missing`),
    );
  });

  it('stops when the packaged resources folder is missing', () => {
    const f = fixture({ LICENSE: 'l', NOTICE: 'n' });
    fs.rmSync(f.resources, { recursive: true });
    expect(() => stageProjectLicense(f.resources, f.repoRoot)).toThrow(/resources missing/);
  });
});
