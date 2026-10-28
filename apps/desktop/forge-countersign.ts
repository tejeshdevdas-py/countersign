/**
 * Countersign packaging steps called from forge.config.ts. They live here,
 * outside the Forge configuration, so each can be tested on a fixture tree
 * without loading the whole configuration (which builds helpers on import).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Bundled agent engines ────────────────────────────────────────────────────

/**
 * Countersign ships the agent engines instead of downloading them from the
 * CDN at first start. Each source directory is what
 * scripts/ensure-agent-binaries.mjs creates (apps/<binDir>/<platform>/...).
 * Staged to resources/agent-bin/<installSubdir>, the layout
 * agent-binaries/index.ts reads (process.resourcesPath/agent-bin).
 * rg is not staged here: stageRipgrep already ships it as resources/tools/ripgrep.
 */
export const COUNTERSIGN_AGENT_BINARIES: ReadonlyArray<{
  /** The kind name scripts/ensure-agent-binaries.mjs and `pnpm install:<kind>` use. */
  kind: string;
  binDir: string;
  installSubdir: string;
  executable: (targetPlatform: string) => string;
}> = [
  {
    kind: 'claude',
    binDir: 'claude-code-bin',
    installSubdir: 'claude-code',
    executable: (p) => (p === 'win32' ? 'claude.exe' : 'claude'),
  },
  {
    kind: 'codex',
    binDir: 'codex-package-bin',
    installSubdir: 'codex-package',
    executable: (p) => path.join('bin', p === 'win32' ? 'codex.exe' : 'codex'),
  },
  {
    // Directory distribution: pi.exe plus theme/, docs/, native/ and other assets.
    kind: 'pi',
    binDir: 'pi-bin',
    installSubdir: 'pi',
    executable: (p) => (p === 'win32' ? 'pi.exe' : 'pi'),
  },
];

export interface EnsureResult {
  status: number | null;
  error?: Error;
}

/** Brings the given engines to their pinned versions for one platform. */
export type EnsureEngines = (kinds: readonly string[], platformKey: string) => EnsureResult;

/** The command that runs scripts/ensure-agent-binaries.mjs for these engines. */
export function ensureAgentBinariesCommand(
  repoRoot: string,
  kinds: readonly string[],
  platformKey: string,
): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [
      path.join(repoRoot, 'scripts', 'ensure-agent-binaries.mjs'),
      `--kinds=${kinds.join(',')}`,
      `--platform=${platformKey}`,
    ],
  };
}

/** The real ensure step: runs the script, its output going to this console. */
export function spawnEnsureAgentBinaries(repoRoot: string): EnsureEngines {
  return (kinds, platformKey) => {
    const { command, args } = ensureAgentBinariesCommand(repoRoot, kinds, platformKey);
    const result = spawnSync(command, args, { stdio: 'inherit' });
    return { status: result.status, error: result.error };
  };
}

/**
 * Stages claude, codex and pi into `destRoot`. First runs `ensure` for all
 * three: it compares each installed `.version` with the pin in
 * tools/<kind>/latest.json, checks the directory manifest of codex and pi,
 * and downloads the pinned version when either is off. Checking only that
 * the executable exists would ship a stale engine after a pin bump.
 */
export function stageAgentBinaries(options: {
  targetPlatform: string;
  platformKey: string;
  /** The repository's apps/ folder, which holds <binDir>/<platformKey>. */
  appsDir: string;
  destRoot: string;
  ensure: EnsureEngines;
}): void {
  const { targetPlatform, platformKey, appsDir, destRoot, ensure } = options;
  const kinds = COUNTERSIGN_AGENT_BINARIES.map((entry) => entry.kind);
  console.log(`[forge:prePackage] ensuring pinned engines ${kinds.join(', ')} ${platformKey}...`);
  const result = ensure(kinds, platformKey);
  if (result.error || result.status !== 0) {
    const retry = kinds.map((kind) => `"pnpm install:${kind}"`).join(', ');
    const reason = result.error ? result.error.message : `exit ${result.status}`;
    throw new Error(
      `[forge] failed to ensure the pinned engines for ${platformKey} (${reason}); ` +
        `the output above names the host. Run ${retry} before packaging`,
    );
  }
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });
  for (const entry of COUNTERSIGN_AGENT_BINARIES) {
    const srcDir = path.join(appsDir, entry.binDir, platformKey);
    const executable = path.join(srcDir, entry.executable(targetPlatform));
    if (!fs.existsSync(executable)) {
      throw new Error(
        `[forge] ${entry.binDir} ${platformKey} missing at ${executable} after ensure; ` +
          `run "pnpm install:${entry.kind}" before packaging`,
      );
    }
    const destDir = path.join(destRoot, entry.installSubdir);
    fs.cpSync(srcDir, destDir, { recursive: true, dereference: true });
    console.log(`[forge:prePackage] ${entry.binDir} ${platformKey} -> ${destDir}`);
  }
}
