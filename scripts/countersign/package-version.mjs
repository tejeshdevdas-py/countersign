/**
 * Countersign: desktop packaging is versionless.
 *
 * Upstream's `release:package --version x.y.z|major|minor|patch` makes a
 * build for its own release channel: it writes the version into the app,
 * adds an update package (`<name>-<version>-hotfix.zip`) for its in-app
 * updater, and for major/minor/patch reads the current version from its
 * release CDN. Countersign has no updater and no release channel, so under
 * LOCAL_ONLY apps/desktop/scripts/package-desktop.mjs refuses --version before
 * any packaging step.
 */
import { readLocalOnlySwitch } from './local-only.mjs';

export const VERSIONED_PACKAGING_REFUSED =
  '--version is not available in Countersign: a versioned build makes an update package ' +
  '(-hotfix.zip) for the upstream in-app updater and, for major/minor/patch, reads the ' +
  'upstream release CDN. Countersign has no updater and no release channel. Omit --version ' +
  'to build the versionless installer.';

/**
 * Throws when a version was asked for under LOCAL_ONLY.
 *
 * @param {string | null} versionSpec the parsed --version value, or null
 * @param {boolean} [localOnly] the LOCAL_ONLY switch (read from the app's source by default)
 */
export function refuseVersionedPackaging(versionSpec, localOnly = readLocalOnlySwitch()) {
  if (versionSpec !== null && versionSpec !== undefined && localOnly) {
    throw new Error(VERSIONED_PACKAGING_REFUSED);
  }
}
