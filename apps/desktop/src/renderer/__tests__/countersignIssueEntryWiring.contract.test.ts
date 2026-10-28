/**
 * Countersign guard contract (ruling O13): in MainLayout, the application
 * menu's `open-issues` command and the WorkLouder keypad's `feedback` command
 * open the /issues page only through openIssuesPage
 * (src/renderer/lib/countersignIssueEntry.ts), which does nothing under
 * LOCAL_ONLY. MainLayout has too many dependencies to mount in a unit test, so
 * this guard-tier test pins the wiring in its source; the helper's behaviour is
 * tested in lib/__tests__/countersignIssueEntry.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'components', 'layout', 'MainLayout.tsx'),
  'utf8',
);

/** The text of one `case '<id>':` up to its first `break;` or `return true;`. */
function caseBody(id: string): string {
  const label = `case '${id}':`;
  const start = source.indexOf(label);
  expect(start, `${label} is in MainLayout`).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(label, start + 1), `${label} appears once`).toBe(-1);
  const rest = source.slice(start);
  const end = rest.search(/\b(?:break|return true);/);
  expect(end, `${label} ends with break or return true`).toBeGreaterThan(0);
  return rest.slice(0, end);
}

describe('MainLayout issue-page commands in Countersign', () => {
  it.each(['open-issues', 'feedback'])(
    '%s opens the issue page only through openIssuesPage',
    (id) => {
      const body = caseBody(id);
      expect(body).toContain('openIssuesPage(navigate);');
      expect(body.replace('openIssuesPage(navigate);', '')).not.toMatch(/\bnavigate\s*\(/);
    },
  );

  it('imports the gate from the fork module and never navigates to /issues directly', () => {
    expect(source).toContain("import { openIssuesPage } from '@/lib/countersignIssueEntry';");
    expect(source).not.toMatch(/\bnavigate\s*\(\s*['"`]\/issues/);
  });
});
