import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast }));

import { checkForUpdateWithToast } from '../checkForUpdateWithToast';

const t = (key: string) => key;

describe('checkForUpdateWithToast (Countersign: no update service)', () => {
  const checkForUpdate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { window: unknown }).window = { electronAPI: { checkForUpdate } };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('never calls the missing handler and never rejects', async () => {
    await expect(checkForUpdateWithToast(t)).resolves.toBeUndefined();
    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});

describe('checkForUpdateWithToast (upstream behaviour: a rejected check is caught)', () => {
  it('shows an error toast instead of rejecting', async () => {
    // reset-modules: reload checkForUpdateWithToast with LOCAL_ONLY mocked off for the upstream case.
    vi.resetModules();
    vi.doMock('@cindy/maker-shared/local-only', async (orig) => ({
      ...(await orig<typeof import('@cindy/maker-shared/local-only')>()),
      LOCAL_ONLY: false,
    }));
    const { checkForUpdateWithToast: upstream } = await import('../checkForUpdateWithToast');
    const reject = vi.fn().mockRejectedValue(new Error('No handler registered'));
    (globalThis as unknown as { window: unknown }).window = {
      electronAPI: { checkForUpdate: reject },
    };
    await expect(upstream(t)).resolves.toBeUndefined();
    expect(reject).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('titleBar.updateCheckToast.manifestFailed');
    vi.doUnmock('@cindy/maker-shared/local-only');
    delete (globalThis as { window?: unknown }).window;
  });
});
