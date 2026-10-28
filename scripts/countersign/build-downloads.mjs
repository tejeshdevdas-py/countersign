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
 * Used by scripts/ensure-agent-binaries.mjs (also behind `pnpm install:*`,
 * postinstall and packaging) and apps/desktop/scripts/ensure-android-platform-tools.mjs.
 */

/** False in Countersign: no build-time fallback to the upstream project's CDN. */
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
