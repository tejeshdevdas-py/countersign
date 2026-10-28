/**
 * Countersign: the commands that open the /issues page (the macOS application
 * menu's `open-issues` and the WorkLouder keypad's `feedback` key, both handled
 * in MainLayout through openIssuesPage) do nothing under LOCAL_ONLY: the page
 * lists and links to the upstream project's tracker.
 * LOCAL_ONLY is the real value here (true in this build).
 */
import { describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { openIssuesPage } from '../countersignIssueEntry';

describe('issue page entry points in Countersign', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('does not navigate to /issues', () => {
    const navigate = vi.fn();
    expect(openIssuesPage(navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
