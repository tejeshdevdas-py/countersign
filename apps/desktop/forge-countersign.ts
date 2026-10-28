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

// ── Bundled binaries kept in Git LFS ─────────────────────────────────────────

const LFS_POINTER_SPEC = 'git-lfs.github.com/spec/v1';
/** A real bundled binary is far larger; an LFS pointer is about 130 bytes. */
const MIN_BUNDLED_BINARY_BYTES = 4096;

/**
 * Throws unless `filePath` holds the real binary: present, a file, at least
 * 4 KB and not a Git LFS pointer. A checkout without `git lfs pull` has the
 * pointer in its place, which would otherwise be packaged as the binary.
 */
export function assertRealLfsBinary(filePath: string, what: string): void {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat || !stat.isFile()) {
    throw new Error(`[forge] ${what} missing at ${filePath}; run "git lfs pull"`);
  }
  if (stat.size >= MIN_BUNDLED_BINARY_BYTES) return;
  const prefix = fs.readFileSync(filePath).subarray(0, 128).toString('utf8');
  if (prefix.includes(LFS_POINTER_SPEC)) {
    throw new Error(
      `[forge] ${what} is a Git LFS pointer, not the binary; run "git lfs pull": ${filePath}`,
    );
  }
  throw new Error(
    `[forge] ${what} is unexpectedly small (${stat.size} bytes); run "git lfs pull": ${filePath}`,
  );
}

// ── Build folder kept out of the rebuilt native addon ────────────────────────

/** link.exe expands %_PDB% itself to the PDB file name, without its folder. */
const PDB_FILE_NAME_ONLY = '/PDBALTPATH:%_PDB%';

function withoutTrailingSeparator(folder: string): string {
  return folder.replace(/[\/]+$/, '');
}

/**
 * Extra MSVC options for a node-gyp rebuild inside `buildPath`. cl.exe and
 * link.exe read them from the _CL_ and _LINK_ environment variables:
 * - `/d1trimfile:<folder>` trims the build folder from __FILE__, which Node's
 *   module registration records in the addon;
 * - `/PDBALTPATH:%_PDB%` writes only the PDB file name into the debug
 *   directory instead of its full path.
 * Forge builds under the packager's temporary folder in the user profile, so
 * both paths would otherwise carry the builder's user name. MSBuild may use
 * the long form of a short (8.3) folder name, so both forms are trimmed.
 */
export function msvcPathFreeBuildEnv(
  buildPath: string,
  env: Record<string, string | undefined> = process.env,
  realpath: (folder: string) => string = (folder) => fs.realpathSync.native(folder),
): { _CL_: string; _LINK_: string } {
  const given = withoutTrailingSeparator(path.resolve(buildPath));
  let resolved = given;
  try {
    resolved = withoutTrailingSeparator(realpath(given));
  } catch {
    // Not resolvable: trim the folder as given.
  }
  const trims = [...new Set([given, resolved])].map((folder) => `"/d1trimfile:${folder}"`);
  return {
    _CL_: [env._CL_, ...trims].filter(Boolean).join(' '),
    _LINK_: [env._LINK_, PDB_FILE_NAME_ONLY].filter(Boolean).join(' '),
  };
}

/** Runs `run` with `vars` set in process.env (child processes inherit them), then restores it. */
export async function withEnv<T>(vars: Record<string, string>, run: () => Promise<T>): Promise<T> {
  const saved = Object.keys(vars).map((name) => [name, process.env[name]] as const);
  Object.assign(process.env, vars);
  try {
    return await run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
