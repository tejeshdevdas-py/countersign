/**
 * Countersign: the app updater is off, so the model is not told about it. The
 * cindy_helper update tools are not registered and the runtime catalog note
 * leaves out its updater sentence. LOCAL_ONLY is the real value here.
 */
import { describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { appUpdateToolDeps, hostCapabilitiesNote } from '../appUpdateTools';
import { isServiceDisabled } from '../services';

describe('app update text the model reads under LOCAL_ONLY', () => {
  it('runs with LOCAL_ONLY on and the updater off', () => {
    expect(LOCAL_ONLY).toBe(true);
    expect(isServiceDisabled('updater')).toBe(true);
  });

  it('registers no update tools and never builds their callbacks', () => {
    const create = vi.fn(() => ({ check: vi.fn() }));
    expect(appUpdateToolDeps(create)).toEqual({});
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps the general note and drops the updater sentence', () => {
    expect(hostCapabilitiesNote('general.', 'install_app_update sentence.')).toBe('general.');
  });
});
