/**
 * Countersign agent-engine resolver: finds the claude, codex, rg and pi
 * executables without Cindy's CDN manifest.
 *
 * Order: the binary bundled with Countersign (or, in dev, `apps/*-bin`), then
 * the user's own install on PATH. The PATH case is how the user's installed
 * Claude Code / Codex CLI runs with its existing login (design spec, "Calls
 * made" 6). Nothing here downloads or makes a network request.
 */
import fs from 'node:fs';
import path from 'node:path';

export type AgentEngine = 'claude' | 'codex' | 'rg' | 'pi';

export interface AgentBinaryResolverDeps {
  /** Directory of this engine's bundled distribution (may not exist). */
  bundledDir: string;
  /** PATH lookup for a command name; null when it is not installed. */
  which: (cmd: string) => string | null;
  exists: (p: string) => boolean;
}

export type AgentBinaryResolution =
  { path: string; source: 'bundled' | 'path' } | { error: string };

interface EngineSpec {
  /** Command name looked up on PATH. */
  command: string;
  /** Executable inside the bundled directory, without the `.exe` suffix. */
  bundledRelative: string[];
  /** Name shown to the user. */
  displayName: string;
  installHint: string;
}

const ENGINES: Record<AgentEngine, EngineSpec> = {
  claude: {
    command: 'claude',
    bundledRelative: ['claude'],
    displayName: 'Claude Code',
    installHint: 'Install Claude Code (the `claude` CLI) and sign in to it',
  },
  codex: {
    command: 'codex',
    bundledRelative: ['bin', 'codex'],
    displayName: 'Codex CLI',
    installHint: 'Install the Codex CLI (`codex`) and sign in to it',
  },
  rg: {
    command: 'rg',
    bundledRelative: ['rg'],
    displayName: 'ripgrep',
    installHint: 'Install ripgrep (`rg`)',
  },
  pi: {
    command: 'pi',
    bundledRelative: ['pi'],
    displayName: 'pi',
    installHint: 'Install the pi agent (`pi`)',
  },
};

function executableName(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

/** Path of the engine's executable inside its bundled directory. */
export function bundledAgentBinaryPath(engine: AgentEngine, bundledDir: string): string {
  const parts = ENGINES[engine].bundledRelative;
  const last = parts[parts.length - 1];
  return path.join(bundledDir, ...parts.slice(0, -1), executableName(last));
}

export function resolveAgentBinary(
  engine: AgentEngine,
  deps: AgentBinaryResolverDeps,
): AgentBinaryResolution {
  const spec = ENGINES[engine];
  const bundled = bundledAgentBinaryPath(engine, deps.bundledDir);
  if (deps.exists(bundled)) {
    return { path: bundled, source: 'bundled' };
  }
  const onPath = deps.which(spec.command);
  if (onPath) {
    return { path: onPath, source: 'path' };
  }
  // An npm shim is reported, never run: spawning a .cmd needs a shell.
  const shim = deps.which(`${spec.command}.cmd`);
  const notFound = shim
    ? `found ${shim} (an npm shim), which Countersign does not run`
    : `\`${spec.command}\` is not on PATH`;
  return {
    error:
      `${spec.displayName} was not found: it is not bundled with Countersign and ${notFound}. ` +
      `${spec.installHint} (a standalone install, not an npm shim) or use the bundled build, then restart Countersign.`,
  };
}

export interface PathWhichOptions {
  /** The PATH value to search. */
  pathEnv: string | undefined;
  platform: NodeJS.Platform;
  isFile: (p: string) => boolean;
}

/**
 * PATH lookup that searches only the absolute directories listed in PATH, in
 * order. Unlike `where.exe` it never looks in the current directory, and a
 * relative PATH entry (such as `.`) is skipped. On Windows a bare command
 * matches only `<name>.exe`; a name with an extension (`codex.cmd`) matches
 * that exact file.
 */
export function createPathWhich(options: PathWhichOptions): (cmd: string) => string | null {
  const isWindows = options.platform === 'win32';
  const paths = isWindows ? path.win32 : path.posix;
  const dirs = (options.pathEnv ?? '')
    .split(isWindows ? ';' : ':')
    .map((dir) => dir.trim().replace(/^"(.*)"$/, '$1'))
    .filter((dir) => dir.length > 0 && paths.isAbsolute(dir));
  return (cmd) => {
    const name = isWindows && paths.extname(cmd) === '' ? `${cmd}.exe` : cmd;
    for (const dir of dirs) {
      const candidate = paths.join(dir, name);
      if (options.isFile(candidate)) return candidate;
    }
    return null;
  };
}

function isExecutableFile(p: string): boolean {
  try {
    if (!fs.statSync(p).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Production PATH lookup over the live process PATH. */
export function whichOnPath(cmd: string): string | null {
  return createPathWhich({
    pathEnv: process.env.PATH,
    platform: process.platform,
    isFile: isExecutableFile,
  })(cmd);
}
