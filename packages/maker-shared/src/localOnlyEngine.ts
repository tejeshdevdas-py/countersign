/**
 * Countersign (LOCAL_ONLY): switches that turn off the engines' own
 * nonessential traffic — telemetry, error reporting, feature flags,
 * auto-update and plugin-marketplace sync. Model traffic and the user's
 * own sign-in are left alone.
 *
 * Every name below was read from the bundled engine itself, not guessed:
 * see docs/countersign/engine-telemetry.md (re-exported by maker-core) for the evidence per switch.
 */

/**
 * Claude Code 2.1.296 environment switches.
 *
 * - CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: the CLI's traffic level becomes
 *   "essential-traffic"; it gates feature-flag fetches, auto-update and
 *   claude.ai downloads.
 * - DISABLE_TELEMETRY / DO_NOT_TRACK: traffic level "no-telemetry".
 * - DISABLE_ERROR_REPORTING: error-sample uploads.
 * - DISABLE_GROWTHBOOK: feature-flag (GrowthBook) evaluation.
 * - DISABLE_AUTOUPDATER: CLI self-update and plugin auto-update (git pulls of
 *   installed marketplaces).
 * - CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: the first-run
 *   install of anthropics/claude-plugins-official, fetched from
 *   downloads.claude.ai with a git fallback to github.com.
 * - OTEL_SDK_DISABLED: kept from upstream's env builder; the 2.1.296 binary
 *   does not read it (its own switch is CLAUDE_CODE_ENABLE_TELEMETRY, which
 *   applyClaudeLocalOnlyEnv removes).
 */
export const CLAUDE_LOCAL_ONLY_ENV: Readonly<Record<string, string>> = Object.freeze({
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  DISABLE_TELEMETRY: '1',
  DO_NOT_TRACK: '1',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_GROWTHBOOK: '1',
  DISABLE_AUTOUPDATER: '1',
  CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
  OTEL_SDK_DISABLED: 'true',
});

/** Opt-in telemetry switches that must not survive from the user's shell. */
export const CLAUDE_LOCAL_ONLY_REMOVED_ENV: readonly string[] = Object.freeze([
  'CLAUDE_CODE_ENABLE_TELEMETRY',
  'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA',
  'ENABLE_ENHANCED_TELEMETRY_BETA',
]);

/**
 * Force the Claude Code switches; a value inherited from the user's shell does
 * not win, and opt-in telemetry from the shell is removed. Used by every
 * Countersign spawn of the claude binary (sessions and the native auth/usage CLI).
 */
export function applyClaudeLocalOnlyEnv(env: Record<string, string | undefined>): void {
  Object.assign(env, CLAUDE_LOCAL_ONLY_ENV);
  for (const key of CLAUDE_LOCAL_ONLY_REMOVED_ENV) delete env[key];
}

/**
 * Codex 0.159.2 `-c key=value` overrides, passed to every local
 * `codex app-server`.
 *
 * - analytics.enabled=false: usage analytics.
 * - feedback.enabled=false: the feedback upload.
 * - otel.metrics_exporter="none": the metrics exporter, whose `statsig`
 *   kind posts to ab.chatgpt.com.
 * - otel.exporter / otel.trace_exporter="none": log and trace export.
 * - check_for_update_on_startup=false: the update check.
 */
export const CODEX_LOCAL_ONLY_CONFIG_ARGS: readonly string[] = Object.freeze([
  '-c', 'analytics.enabled=false',
  '-c', 'feedback.enabled=false',
  '-c', 'otel.metrics_exporter="none"',
  '-c', 'otel.exporter="none"',
  '-c', 'otel.trace_exporter="none"',
  '-c', 'check_for_update_on_startup=false',
]);
