import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => '' } }));
vi.mock('../logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import { __testing } from '../folderContextMenu';

// M-J10: the Explorer right-click label is English. The installer and the start-up check
// must write the same text, or the start-up check sees drift and rewrites the label.
const installer = readFileSync(
  resolve(__dirname, '..', '..', '..', 'resources', 'installer.nsh'),
  'utf8',
);

/** The (Default) value of every shell key the installer writes under the product name. */
function installerMenuLabels(): string[] {
  const pattern =
    /^\s*WriteRegStr HKCU "Software\\Classes\\[^"]+\\shell\\\$\{PRODUCT_FILENAME\}" "" "([^"]*)"/gm;
  return Array.from(installer.matchAll(pattern), (match) => match[1]);
}

describe('Explorer "Open with" label', () => {
  it('is English and names Countersign', () => {
    expect(__testing.MENU_LABEL).toBe('Open with Countersign');
  });

  it('is written with the same template by the installer for all four keys', () => {
    const labels = installerMenuLabels();
    expect(labels).toHaveLength(4);
    expect(new Set(labels)).toEqual(new Set(['Open with ${PRODUCT_FILENAME}']));
  });
});
