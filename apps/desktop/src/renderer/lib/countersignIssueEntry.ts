import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/**
 * Countersign: opens the /issues page for the application menu's `open-issues`
 * command and the WorkLouder keypad's `feedback` key. Under LOCAL_ONLY it does
 * nothing, because that page lists and links to the upstream project's tracker
 * (ruling O13). Returns true when it navigated.
 */
export function openIssuesPage(navigate: (to: string) => void): boolean {
  if (LOCAL_ONLY) {
    return false;
  }
  navigate('/issues');
  return true;
}
