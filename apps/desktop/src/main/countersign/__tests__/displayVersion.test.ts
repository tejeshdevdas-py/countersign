import { describe, expect, it } from 'vitest';

import { displayVersionLabel } from '../displayVersion';

describe('displayVersionLabel', () => {
  it('shows an unversioned build as dev', () => {
    expect(displayVersionLabel('0.0.0')).toBe('dev');
  });

  it('keeps a release version', () => {
    expect(displayVersionLabel('1.2.3')).toBe('1.2.3');
  });
});
