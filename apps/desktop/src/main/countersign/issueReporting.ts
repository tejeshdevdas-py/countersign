import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/**
 * Countersign: the in-app issue reporter and the "my issues" tracker post to
 * and read the upstream project's GitHub repository, under the user's own
 * GitHub account. Countersign reports must not land there, so under
 * LOCAL_ONLY every entry point is hidden and the handlers refuse.
 */
export const ISSUE_REPORTING_DISABLED_MESSAGE =
  'ISSUE_REPORTING_DISABLED: issue reporting is not available in this local-only build; do not retry';

/** The cindy_helper deps that register submit_github_issue; none under LOCAL_ONLY. */
export function issueReportingToolDeps<Submit>(submit: Submit): { githubIssue?: Submit } {
  if (LOCAL_ONLY) {
    return {};
  }
  return { githubIssue: submit };
}
