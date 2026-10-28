/**
 * Egress imports check: every main-process file that loads the npm `undici`
 * module must also call assertEgressAllowed(...). undici is bundled into the
 * main build, so the egress guard (apps/desktop/src/main/countersign/egressGuard.ts)
 * cannot wrap it from outside; each call site has to check first.
 *
 * Scope: non-test .ts/.tsx files under apps/desktop/src/main (not __tests__,
 * not *.test.* or *.spec.*).
 *
 * A reference is any of these, for 'undici' or an 'undici/...' subpath:
 * a value import or export (`import type` and `export type` do not count),
 * import x = require(...), require(...), createRequire(...)(...) and import(...).
 * The check does not look at which names are imported: Agent, Pool, Client and
 * ProxyAgent all have request() and dispatch(), and WebSocket and EventSource
 * open connections too.
 *
 * Files that load undici without making requests are allowed in ALLOWLIST,
 * each with its reason. An allowlist entry for a file that no longer loads
 * undici, or that now asserts itself, fails as stale.
 *
 * Limits: the check is per file. It cannot prove the assert runs before the
 * request; that order was checked by hand when the allowlist was written. It
 * does not scan packages/* (browser-control-runtime and opencli-vendor call
 * undici directly).
 *
 * Exit codes: 0 every reference is guarded or allowed; 1 an unguarded file or
 * a stale allowlist entry; 2 input error (the source folder is missing).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_ROOT = 'apps/desktop/src/main';

/** Files that load undici but make no request themselves, with the reason. */
export const ALLOWLIST = new Map([
  [
    'apps/desktop/src/main/maker-host/title-one-shot.ts',
    'type-only use (typeof undiciFetch, :83); the default fetch is outboundUndiciFetch (:492), which asserts at outbound-fetch.ts:967',
  ],
  [
    'apps/desktop/src/main/voice-input/refinerHttpDispatcher.ts',
    'constructs Agent pools only (:54); requests are made by the two voice clients, which assert',
  ],
]);

let typescript;

function loadTypeScript() {
  if (!typescript) {
    // typescript is a declared dependency of apps/desktop; resolve it from there.
    typescript = createRequire(path.join(REPO_ROOT, 'apps', 'desktop', 'package.json'))(
      'typescript',
    );
  }
  return typescript;
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

export function isScannedPath(p) {
  const rel = normalize(p);
  if (!rel.startsWith(`${SCAN_ROOT}/`) || !/\.tsx?$/.test(rel) || rel.endsWith('.d.ts')) {
    return false;
  }
  return !/(?:^|\/)__tests__\//.test(rel) && !/\.(?:test|spec)\./.test(rel);
}

function isUndiciSpecifier(node, ts) {
  return (
    node !== undefined &&
    ts.isStringLiteralLike(node) &&
    (node.text === 'undici' || node.text.startsWith('undici/'))
  );
}

function isRequireCallee(expression, ts) {
  if (ts.isIdentifier(expression) && expression.text === 'require') {
    return true;
  }
  // createRequire(import.meta.url)('undici')
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'createRequire'
  );
}

/** Lines (1-based) where a file loads undici as a value. */
export function findUndiciReferences(filePath, text) {
  const ts = loadTypeScript();
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind);
  const lines = [];
  const add = (node) => {
    lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      if (isUndiciSpecifier(node.moduleSpecifier, ts) && !node.importClause?.isTypeOnly) {
        add(node);
      }
    } else if (ts.isExportDeclaration(node)) {
      if (isUndiciSpecifier(node.moduleSpecifier, ts) && !node.isTypeOnly) {
        add(node);
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const ref = node.moduleReference;
      if (
        !node.isTypeOnly &&
        ts.isExternalModuleReference(ref) &&
        isUndiciSpecifier(ref.expression, ts)
      ) {
        add(node);
      }
    } else if (ts.isCallExpression(node) && isUndiciSpecifier(node.arguments[0], ts)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (dynamicImport || isRequireCallee(node.expression, ts)) {
        add(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

/**
 * @param {{path: string, text: string}[]} files
 * @param {Map<string, string>} [allowlist]
 * @returns {{unguarded: {path: string, lines: number[]}[], stale: {path: string, why: string}[], guarded: string[]}}
 */
export function checkEgressImports(files, allowlist = ALLOWLIST) {
  const unguarded = [];
  const guarded = [];
  const referencing = new Map();
  for (const file of files) {
    const rel = normalize(file.path);
    if (!isScannedPath(rel) || !file.text.includes('undici')) {
      continue;
    }
    const lines = findUndiciReferences(rel, file.text);
    if (lines.length === 0) {
      continue;
    }
    const asserts = file.text.includes('assertEgressAllowed(');
    referencing.set(rel, asserts);
    if (asserts) {
      guarded.push(rel);
    } else if (!allowlist.has(rel)) {
      unguarded.push({ path: rel, lines });
    }
  }
  const stale = [];
  for (const rel of allowlist.keys()) {
    if (!referencing.has(rel)) {
      stale.push({ path: rel, why: 'no longer loads undici' });
    } else if (referencing.get(rel)) {
      stale.push({ path: rel, why: 'now calls assertEgressAllowed itself' });
    }
  }
  return { unguarded, stale, guarded };
}

function collect(root, dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(root, full, out);
      continue;
    }
    const rel = normalize(path.relative(root, full));
    if (isScannedPath(rel)) {
      out.push({ path: rel, text: fs.readFileSync(full, 'utf8') });
    }
  }
}

/** Runs the check over `root`; returns the process exit code. */
export function main({
  root = REPO_ROOT,
  allowlist = ALLOWLIST,
  log = (line) => console.log(line),
  error = (line) => console.error(line),
} = {}) {
  const scanDir = path.join(root, SCAN_ROOT);
  if (!fs.existsSync(scanDir)) {
    error(`egress imports: ${SCAN_ROOT} not found under ${normalize(root)}`);
    return 2;
  }
  const files = [];
  collect(root, scanDir, files);
  const { unguarded, stale, guarded } = checkEgressImports(files, allowlist);
  for (const u of unguarded) {
    error(
      `${u.path}:${u.lines[0]}: loads undici but never calls assertEgressAllowed(); check the target first or add an allowlist entry with its reason`,
    );
  }
  for (const s of stale) {
    error(`${s.path}: allowlist entry is stale (${s.why}); remove it`);
  }
  if (unguarded.length + stale.length > 0) {
    error(`egress imports: ${unguarded.length + stale.length} problem(s)`);
    return 1;
  }
  log(
    `egress imports: ok (${files.length} files scanned; ${guarded.length} load undici and assert, ${allowlist.size} allowlisted)`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
