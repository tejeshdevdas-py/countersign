import { afterEach, describe, expect, it, vi } from 'vitest';

// Countersign: the .cindy file association writes HKCU registry keys on every
// start and takes the .cindy file type away from an installed Cindy. Under
// LOCAL_ONLY it is not registered. The plugin file picker names the product.
const h = vi.hoisted(() => ({
  localOnly: true,
  execFile: vi.fn(),
}));

vi.mock('@cindy/maker-shared/local-only', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cindy/maker-shared/local-only')>()),
  get LOCAL_ONLY() {
    return h.localOnly;
  },
}));
vi.mock('node:child_process', () => ({ execFile: h.execFile }));
vi.mock('electron', () => ({ app: { isPackaged: true } }));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { PLUGIN_FILE_FILTER, registerCindyFileAssociation } from '../fileAssociation';

const realPlatform = process.platform;

function onWindows(): void {
  Object.defineProperty(process, 'platform', { value: 'win32' });
}

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
  h.localOnly = true;
  h.execFile.mockReset();
});

describe('.cindy file association under LOCAL_ONLY', () => {
  it('does not touch the registry', async () => {
    onWindows();
    registerCindyFileAssociation();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.execFile).not.toHaveBeenCalled();
  });

  it('registers on a packaged Windows build without LOCAL_ONLY', async () => {
    h.localOnly = false;
    onWindows();
    h.execFile.mockImplementation((_file: string, _args: string[], _opts: unknown, callback: (error: Error | null, result?: unknown) => void) => {
      callback(null, { stdout: '', stderr: '' });
    });
    registerCindyFileAssociation();
    await vi.waitFor(() => expect(h.execFile).toHaveBeenCalled());
  });

  it('names the plugin file type after the product in the file picker', () => {
    expect(PLUGIN_FILE_FILTER).toEqual({ name: 'Countersign plugin', extensions: ['cindy'] });
  });
});
