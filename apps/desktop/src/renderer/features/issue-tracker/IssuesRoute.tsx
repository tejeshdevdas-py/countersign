import { Navigate } from 'react-router-dom';
import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { IssueTrackerFeatureLayout } from './IssueTrackerFeatureLayout';

/**
 * Countersign: the issue page reads and links the upstream project's tracker,
 * so under LOCAL_ONLY a visit to /issues goes back to the start page. Its menu
 * entries are hidden too.
 */
export function IssuesRoute() {
  if (LOCAL_ONLY) {
    return <Navigate to="/" replace />;
  }
  return <IssueTrackerFeatureLayout />;
}
