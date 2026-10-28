/**
 * Countersign guard contract (final review I-10): the login brand stage, which also draws
 * the startup splash, imports no upstream portrait or slogan art. The brand guard matches
 * file names that contain the upstream name, so it cannot see `login/hero.png` or
 * `login/slogan.png`; this test pins the imports instead. The rendered stage is tested in
 * components/login/__tests__/LoginBrandStage.countersign.test.tsx.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'components', 'login', 'LoginBrandStage.tsx'),
  'utf8',
);

function importSpecifiers(text: string): string[] {
  return Array.from(text.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm), (m) => m[1]);
}

describe('LoginBrandStage art in Countersign', () => {
  it('reads real import lines', () => {
    expect(importSpecifiers(source)).toContain('@/lib/countersignBrandAssets');
  });

  it('imports no upstream portrait or slogan asset', () => {
    const upstreamArt = importSpecifiers(source).filter((specifier) =>
      /(^|\/)login\/(hero|slogan)/.test(specifier),
    );
    expect(upstreamArt).toEqual([]);
  });

  it('names no portrait or slogan asset anywhere in the file', () => {
    expect(source).not.toMatch(/assets\/login\/(hero|slogan)/);
  });
});
