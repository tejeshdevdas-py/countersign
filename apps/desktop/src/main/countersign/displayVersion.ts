/**
 * Countersign: an unversioned build (`pnpm release:package` without
 * `--version`) is stamped with the placeholder 0.0.0 by forge.config.ts.
 * Show it as "dev" so nobody mistakes it for a release.
 */
export const UNVERSIONED_BUILD_VERSION = '0.0.0';

export function displayVersionLabel(version: string): string {
  return version === UNVERSIONED_BUILD_VERSION ? 'dev' : version;
}
