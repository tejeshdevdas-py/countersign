/**
 * Countersign packaging steps called from forge.config.ts. They live here,
 * outside the Forge configuration, so each can be tested on a fixture tree
 * without loading the whole configuration (which builds helpers on import).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getRawHeader } from '@electron/asar';

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

// ── Packaged output: no build intermediates, no builder user name ────────────

/** File names only a node-gyp/MSVC build leaves behind (objects, symbols, logs, projects). */
const BUILD_INTERMEDIATE_FILE =
  /\.(?:obj|iobj|pdb|ipdb|lib|exp|tlog|sln)$|\.vcxproj(?:\.[^\\/]+)?$|^config\.gypi$/i;
/** Compiler output folders. */
const BUILD_INTERMEDIATE_DIR = /^obj(?:\.target)?$/i;
const USER_NAME_MASK = '<user name>';
const REPORT_LIMIT = 20;

/**
 * Text the app ships on purpose that may contain the builder's name: each app
 * ID (`io.github.<owner>.<name>`) and the owner's `github.com/<owner>/` URLs.
 * The project's public GitHub owner name can contain the maintainer's Windows
 * user name; inside these texts it is public, anywhere else it is a leak.
 */
export function publicGithubIdentity(appIds: readonly string[]): string[] {
  const texts = new Set<string>();
  for (const appId of appIds) {
    texts.add(appId);
    const owner = /^io\.github\.([^.]+)\./.exec(appId)?.[1];
    if (owner) texts.add(`github.com/${owner}/`);
  }
  return [...texts];
}

export interface PackagedLeakFindings {
  /** Build intermediates, as `app.asar/<path>` or `app.asar.unpacked/<path>`. */
  intermediates: string[];
  /** Files whose name or content holds the user name outside the public identity (name masked). */
  userName: string[];
  filesChecked: number;
}

interface NameMatcher {
  lowerName: string;
  needles: Buffer[];
  allowed: Buffer[];
}

/** ASCII-lowercased copy, so a name matches in any case, in UTF-8 and in UTF-16LE. */
function asciiLower(bytes: Buffer): Buffer {
  const lower = Buffer.from(bytes);
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (c >= 0x41 && c <= 0x5a) lower[i] = c + 0x20;
  }
  return lower;
}

function encodings(text: string): Buffer[] {
  return [Buffer.from(text, 'utf8'), Buffer.from(text, 'utf16le')];
}

function nameMatcher(userName: string, publicIdentity: readonly string[]): NameMatcher | null {
  const lowerName = userName.trim().toLowerCase();
  if (!lowerName) return null;
  return {
    lowerName,
    needles: encodings(lowerName),
    allowed: publicIdentity.flatMap((text) => encodings(text.toLowerCase())),
  };
}

function rangesOf(haystack: Buffer, needle: Buffer): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    ranges.push([at, at + needle.length]);
  }
  return ranges;
}

/** True when the name occurs anywhere except inside an allowed public text. */
function holdsName(content: Buffer, matcher: NameMatcher): boolean {
  const lower = asciiLower(content);
  let allowed: Array<[number, number]> | null = null;
  for (const needle of matcher.needles) {
    for (const [start, end] of rangesOf(lower, needle)) {
      allowed ??= matcher.allowed.flatMap((text) => rangesOf(lower, text));
      if (!allowed.some(([from, to]) => from <= start && end <= to)) return true;
    }
  }
  return false;
}

function maskName(shownPath: string, matcher: NameMatcher | null): string {
  if (!matcher) return shownPath;
  let out = '';
  let rest = shownPath;
  let at = rest.toLowerCase().indexOf(matcher.lowerName);
  while (at !== -1) {
    out += rest.slice(0, at) + USER_NAME_MASK;
    rest = rest.slice(at + matcher.lowerName.length);
    at = rest.toLowerCase().indexOf(matcher.lowerName);
  }
  return out + rest;
}

type AsarNode = {
  files?: Record<string, AsarNode>;
  link?: string;
  unpacked?: boolean;
  offset?: string;
  size?: number;
};

/**
 * Lists what a packaged app must not carry: node-gyp/MSVC build
 * intermediates, and the build machine's user name (outside the public
 * identity) in any file name or content. Scans resources/app.asar (packed
 * files are read from the archive) and resources/app.asar.unpacked.
 */
export function findPackagedBuildLeaks(
  resourcesDir: string,
  options: { userName: string; publicIdentity: readonly string[] },
): PackagedLeakFindings {
  const matcher = nameMatcher(options.userName, options.publicIdentity);
  const findings: PackagedLeakFindings = { intermediates: [], userName: [], filesChecked: 0 };
  const visit = (shown: string, name: string, read: (() => Buffer) | null) => {
    const pattern = read ? BUILD_INTERMEDIATE_FILE : BUILD_INTERMEDIATE_DIR;
    if (pattern.test(name)) findings.intermediates.push(maskName(shown, matcher));
    if (!read) return;
    findings.filesChecked++;
    if (!matcher) return;
    if (shown.toLowerCase().includes(matcher.lowerName) || holdsName(read(), matcher)) {
      findings.userName.push(maskName(shown, matcher));
    }
  };

  const archive = path.join(resourcesDir, 'app.asar');
  const { header, headerSize } = getRawHeader(archive);
  const fd = fs.openSync(archive, 'r');
  try {
    const walk = (node: AsarNode, relative: string) => {
      for (const [name, child] of Object.entries(node.files ?? {})) {
        const childPath = relative ? `${relative}/${name}` : name;
        const shown = `app.asar/${childPath}`;
        if (child.files) {
          visit(shown, name, null);
          walk(child, childPath);
        } else if (child.link === undefined && !child.unpacked) {
          visit(shown, name, () => {
            const bytes = Buffer.alloc(child.size ?? 0);
            if (bytes.length > 0) {
              fs.readSync(fd, bytes, 0, bytes.length, 8 + headerSize + Number(child.offset));
            }
            return bytes;
          });
        }
        // Unpacked files are checked on disk below.
      }
    };
    walk(header as AsarNode, '');
  } finally {
    fs.closeSync(fd);
  }

  const walkDisk = (dir: string, relative: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childPath = relative ? `${relative}/${entry.name}` : entry.name;
      const shown = `app.asar.unpacked/${childPath}`;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(shown, entry.name, null);
        walkDisk(full, childPath);
      } else if (entry.isFile()) {
        visit(shown, entry.name, () => fs.readFileSync(full));
      }
    }
  };
  const unpacked = path.join(resourcesDir, 'app.asar.unpacked');
  if (fs.existsSync(unpacked)) walkDisk(unpacked, '');
  return findings;
}

function listed(paths: string[]): string {
  const shown = paths.slice(0, REPORT_LIMIT).map((entry) => `\n  ${entry}`);
  if (paths.length > REPORT_LIMIT) shown.push(`\n  ... and ${paths.length - REPORT_LIMIT} more`);
  return shown.join('');
}

/**
 * Fails the package when app.asar or app.asar.unpacked holds build
 * intermediates or the build machine's user name. The name is compared in
 * lower case; the report masks it and never prints it.
 */
export function assertPackagedOutputClean(
  resourcesDir: string,
  options: { userName: string; publicIdentity: readonly string[] },
): PackagedLeakFindings {
  const findings = findPackagedBuildLeaks(resourcesDir, options);
  const problems: string[] = [];
  if (findings.intermediates.length > 0) {
    problems.push(
      `${findings.intermediates.length} build intermediates (compiler objects, debug symbols, ` +
        `build logs or project files):${listed(findings.intermediates)}`,
    );
  }
  if (findings.userName.length > 0) {
    problems.push(
      `${findings.userName.length} files that hold this machine's user name ` +
        `(shown as ${USER_NAME_MASK}), usually in a build path:${listed(findings.userName)}`,
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `[forge:postPackage] the packaged app must not carry details of the build machine. ` +
        `Found ${problems.join('\nand ')}\nSee forge-countersign.ts.`,
    );
  }
  return findings;
}
