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

// ── The project's own licence in the package ─────────────────────────────────

/**
 * The repository's LICENSE (Apache 2.0) and NOTICE, shipped beside the
 * third-party notices. Apache 2.0 section 4(d) asks a derivative work to carry
 * the NOTICE text. `.txt` so Windows opens them with a double click.
 */
export const PROJECT_LICENSE_FILES: ReadonlyArray<{ source: string; packaged: string }> = [
  { source: 'LICENSE', packaged: 'LICENSE.txt' },
  { source: 'NOTICE', packaged: 'NOTICE.txt' },
];

/** Copies the project LICENSE and NOTICE from `repoRoot` into the packaged resources. */
export function stageProjectLicense(resourcesDir: string, repoRoot: string): void {
  if (!fs.existsSync(resourcesDir)) {
    throw new Error(`[forge:postPackage] packaged resources missing: ${resourcesDir}`);
  }
  for (const { source, packaged } of PROJECT_LICENSE_FILES) {
    const from = path.join(repoRoot, source);
    if (!fs.existsSync(from)) {
      throw new Error(`[forge:postPackage] project ${source} missing at ${from}`);
    }
    fs.copyFileSync(from, path.join(resourcesDir, packaged));
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

/**
 * File names only a node-gyp/MSVC build leaves behind: objects, symbols, logs,
 * projects, incremental-link and precompiled-header files, compiled resources,
 * build-state and recipe files, and @electron/rebuild's `.forge-meta` marker.
 */
export const BUILD_INTERMEDIATE_FILE =
  /\.(?:obj|iobj|pdb|ipdb|lib|exp|tlog|sln|ilk|idb|pch|res|lastbuildstate|recipe|forge-meta)$|\.vcxproj(?:\.[^\\/]+)?$|^config\.gypi$/i;
/** Compiler output folders. */
export const BUILD_INTERMEDIATE_DIR = /^obj(?:\.target)?$/i;
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
  /** Files whose name or content holds the user name in a profile path outside the public identity (name masked). */
  userName: string[];
  filesChecked: number;
}

export interface PackagedLeakOptions {
  /** The builder's account name (`os.userInfo().username`). */
  userName: string;
  /** The builder's profile folder name (basename of `os.userInfo().homedir`), when it differs. */
  profileName?: string;
  publicIdentity: readonly string[];
}

interface NameMatcher {
  /** Lower-case names, longest first. */
  names: string[];
  /** Quick pre-check: a file without any of these bytes cannot hold a profile path with the name. */
  needles: Buffer[];
  allowed: Buffer[];
  /** A profile path with the name, over the latin1 view of UTF-8 bytes. */
  utf8Profile: RegExp;
  /** The same over a UTF-16LE-decoded string. */
  utf16Profile: RegExp;
  /** A `Users/<name>` folder in a packaged file path. */
  profileFolder: RegExp;
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A Windows profile path that names the builder: a drive, then `Users` (or
 * `Documents and Settings`), then the name as a whole path segment. Any slash
 * direction, escaped backslashes and the MSYS form (a slash, the drive letter,
 * a slash, then Users) count. A first name or a common word elsewhere in app
 * text (`markdown`, `Math.max`, `User settings`) is not a finding, and neither
 * are the home-folder placeholders in documentation or a web address with a
 * users folder in it: none of them identifies the builder. The check
 * runs on Windows packages only, where build paths take this shape.
 */
function profilePattern(names: readonly string[]): RegExp {
  const alternatives = names.map(escapeRegExp).join('|');
  return new RegExp(
    `(?:^|[^a-z0-9])[a-z](?::[\\\\/]+|[\\\\/]+)(?:users|documents and settings)[\\\\/]+` +
      `(?:${alternatives})(?![a-z0-9_.-])`,
    'g',
  );
}

/** A packaged file path (relative, `/`-separated) with a `Users/<name>` folder in it. */
function profileFolderPattern(names: readonly string[]): RegExp {
  const alternatives = names.map(escapeRegExp).join('|');
  return new RegExp(`(?:^|/)(?:users|documents and settings)/(?:${alternatives})(?:/|$)`);
}

function nameMatcher(options: PackagedLeakOptions): NameMatcher | null {
  const names = [
    ...new Set([options.userName, options.profileName ?? ''].map((n) => n.trim().toLowerCase())),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  return {
    names,
    needles: names.flatMap(encodings),
    allowed: options.publicIdentity.flatMap((text) => encodings(text.toLowerCase())),
    // UTF-8 bytes seen as latin1, one character per byte, so match offsets are byte offsets.
    utf8Profile: profilePattern(names.map((n) => Buffer.from(n, 'utf8').toString('latin1'))),
    utf16Profile: profilePattern(names),
    profileFolder: profileFolderPattern(names),
  };
}

function rangesOf(haystack: Buffer, needle: Buffer): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    ranges.push([at, at + needle.length]);
  }
  return ranges;
}

/** Byte ranges of every profile-path match: UTF-8, then UTF-16LE at both byte alignments. */
function profileMatches(lower: Buffer, matcher: NameMatcher): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of lower.toString('latin1').matchAll(matcher.utf8Profile)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  for (const alignment of [0, 1]) {
    const text = lower.subarray(alignment).toString('utf16le').toLowerCase();
    for (const m of text.matchAll(matcher.utf16Profile)) {
      const start = alignment + 2 * m.index;
      ranges.push([start, start + 2 * m[0].length]);
    }
  }
  return ranges;
}

/** True when a profile path with the name occurs anywhere except inside an allowed public text. */
function holdsName(content: Buffer, matcher: NameMatcher): boolean {
  const lower = asciiLower(content);
  if (!matcher.needles.some((needle) => lower.includes(needle))) return false;
  let allowed: Array<[number, number]> | null = null;
  for (const [start, end] of profileMatches(lower, matcher)) {
    allowed ??= matcher.allowed.flatMap((text) => rangesOf(lower, text));
    if (!allowed.some(([from, to]) => from <= start && end <= to)) return true;
  }
  return false;
}

function pathHoldsName(shownPath: string, matcher: NameMatcher): boolean {
  return matcher.profileFolder.test(shownPath.toLowerCase());
}

function maskName(shownPath: string, matcher: NameMatcher | null): string {
  if (!matcher) return shownPath;
  let out = shownPath;
  for (const name of matcher.names) {
    let masked = '';
    let rest = out;
    let at = rest.toLowerCase().indexOf(name);
    while (at !== -1) {
      masked += rest.slice(0, at) + USER_NAME_MASK;
      rest = rest.slice(at + name.length);
      at = rest.toLowerCase().indexOf(name);
    }
    out = masked + rest;
  }
  return out;
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
  options: PackagedLeakOptions,
): PackagedLeakFindings {
  const matcher = nameMatcher(options);
  const findings: PackagedLeakFindings = { intermediates: [], userName: [], filesChecked: 0 };
  const visit = (shown: string, name: string, read: (() => Buffer) | null) => {
    const pattern = read ? BUILD_INTERMEDIATE_FILE : BUILD_INTERMEDIATE_DIR;
    if (pattern.test(name)) findings.intermediates.push(maskName(shown, matcher));
    if (!read) return;
    findings.filesChecked++;
    if (!matcher) return;
    if (pathHoldsName(shown, matcher) || holdsName(read(), matcher)) {
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
  options: PackagedLeakOptions,
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
