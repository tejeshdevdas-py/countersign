import { describe, expect, it } from 'vitest';
import { BRAND_NAME } from '../branding.js';
import { BRAND_IDENTITY, allDeepLinkSchemes, brandHomeStateName } from '../brandIdentity.js';

describe('Countersign brand identity', () => {
  it('uses Countersign as the display name', () => {
    expect(BRAND_NAME).toBe('Countersign');
  });

  it('gives every region a Countersign app id', () => {
    const ids = Object.values(BRAND_IDENTITY.appIdByRegion);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id.startsWith('io.github.tejeshdevdas-py.countersign')).toBe(true);
    }
  });

  it('gives every region a Countersign executable name', () => {
    for (const name of Object.values(BRAND_IDENTITY.executableNameByRegion)) {
      expect(name).toMatch(/^Countersign(Dev)?$/);
    }
  });

  it('names every user-data directory Countersign and never Cindy', () => {
    const names = [
      BRAND_IDENTITY.userDataDirName,
      ...Object.values(BRAND_IDENTITY.userDataDirNameByRegion),
    ];
    for (const name of names) {
      expect(name).toContain('Countersign');
      expect(name).not.toContain('Cindy');
    }
  });

  it('names app-owned state outside userData countersign, derived from the identity', () => {
    expect(brandHomeStateName()).toBe('countersign');
    expect(brandHomeStateName()).not.toMatch(/cindy/i);
    // The same rule gives upstream's own name for upstream's identity.
    expect(brandHomeStateName({ ...BRAND_IDENTITY, userDataDirName: 'Cindy' })).toBe('cindy');
  });

  it('registers only the countersign deep-link scheme', () => {
    expect(allDeepLinkSchemes()).toEqual(['countersign']);
  });
});
