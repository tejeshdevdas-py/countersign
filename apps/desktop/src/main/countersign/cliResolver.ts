/**
 * Countersign agent-engine resolver: finds the claude, codex, rg and pi
 * executables without Cindy's CDN manifest.
 *
 * Order: the binary bundled with Countersign (or, in dev, `apps/*-bin`), then
 * the user's own install on PATH. The PATH case is how the user's installed
 * Claude Code / Codex CLI runs with its existing login (design spec, "Calls
 * made" 6). Nothing here downloads or makes a network request.
 */
import { execFileSync } from 'node:child_process';
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
  return {
    error:
      `${spec.displayName} was not found: it is not bundled with Countersign and \`${spec.command}\` is not on PATH. ` +
      `${spec.installHint}, then restart Countersign.`,
  };
}

/**
 * PATH lookup through `where.exe` (Windows) or `which`. On Windows only an
 * `.exe` match is returned: npm `.cmd` shims cannot be spawned without a shell.
 */
export function whichOnPath(cmd: string): string | null {
  const isWindows = process.platform === 'win32';
  let output: string;
  try {
    output = execFileSync(isWindows ? 'where.exe' : 'which', [cmd], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const match = isWindows ? lines.find((line) => line.toLowerCase().endsWith('.exe')) : lines[0];
  return match ?? null;
}
