/**
 * Countersign build-time download policy.
 *
 * The build fetches the engine binaries (claude, codex, ripgrep, pi) and the
 * Android platform-tools from their upstream hosts. Upstream Cindy then falls
 * back to its own CDN (hotfix.cindy.app or hotfix.cindy.com.cn) when the
 * upstream download fails or is slow. Countersign never does: the design
 * forbids any request to *.cindy.app, and a build is part of what a stranger
 * runs. When the upstream download fails, the build stops and names the
 * upstream host.
 *
 * With no other host to try, a slow download is not cut off for being slow:
 * ensure-agent-binaries passes throughputGuard = BUILD_CDN_FALLBACK to each
 * tools/<kind>/update.mjs, so only the connect, stall (no bytes) and hard total
 * timeouts of tools/shared/fetch-with-timeout.mjs apply. Platform-tools already
 * turns the speed limit off for its last (here: only) source.
 *
 * Used by scripts/ensure-agent-binaries.mjs (also behind `pnpm install:*`,
 * postinstall and packaging) and apps/desktop/scripts/ensure-android-platform-tools.mjs.
 */

/**
 * False in Countersign: no build-time fallback to the upstream project's CDN.
 * This mirrors LOCAL_ONLY (packages/maker-shared/src/localOnly.ts): it is the
 * build-time side of the same rule, kept as a plain constant so the download
 * scripts stay independent of the switch's source. build-downloads.test.mjs
 * fails if the two disagree; flip them together.
 */
export const BUILD_CDN_FALLBACK = false;

/**
 * The error text for an upstream download that failed with no fallback host.
 *
 * @param {{ what: string, host: string, reason: string, retry?: string }} failure
 */
export function upstreamDownloadFailure({ what, host, reason, retry }) {
  const retryHint = retry ? `, or run "${retry}"` : '';
  return (
    `Failed to download ${what} from ${host}: ${reason}. ` +
    `Countersign builds download only from the upstream host and do not fall back to another one. ` +
    `Check network access to ${host} and retry${retryHint}.`
  );
}
