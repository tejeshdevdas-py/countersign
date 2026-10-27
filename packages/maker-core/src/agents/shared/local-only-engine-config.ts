/**
 * Countersign: the engine telemetry switches live in maker-shared so the
 * desktop's direct CLI spawns can use them without loading maker-core.
 */
export {
  CLAUDE_LOCAL_ONLY_ENV,
  CLAUDE_LOCAL_ONLY_REMOVED_ENV,
  CODEX_LOCAL_ONLY_CONFIG_ARGS,
  applyClaudeLocalOnlyEnv,
} from '@cindy/maker-shared/local-only';
