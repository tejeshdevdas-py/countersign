import { describe, expect, it } from 'vitest';

import { shouldInitTapdb } from '../shouldInitTapdb';

describe('shouldInitTapdb', () => {
  it('is false in Countersign (local only)', () => {
    expect(shouldInitTapdb()).toBe(false);
  });
});
