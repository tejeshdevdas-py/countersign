import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUILD_INTERMEDIATE_DIR, BUILD_INTERMEDIATE_FILE } from './forge-countersign';

/** Only call on the disposable package copy, after native rebuild has finished. */
export function prunePackagedRuntime(buildPath: string): void {
  const modules = path.join(buildPath, 'node_modules');
  // bindings loads build/Release/better_sqlite3.node. Keep the addon and its JS
  // loader; source and compiler intermediates are needed only during rebuild.
  const sqlite = path.join(modules, 'better-sqlite3');
  for (const relative of [
    'deps',
    'src',
    path.join('build', 'Release', 'obj'),
    path.join('build', 'Release', 'obj.target'),
    path.join('build', 'Release', 'sqlite3.a'),
  ]) {
    fs.rmSync(path.join(sqlite, relative), { recursive: true, force: true });
  }
  // Countersign: an MSVC rebuild also leaves .obj/.pdb/.iobj/.ipdb/.lib/.exp,
  // .tlog, .vcxproj/.sln and config.gypi, which carry the build machine's paths
  // and user name. Keep only build/Release/better_sqlite3.node, and drop bin/,
  // @electron/rebuild's copy of the addon, which bindings never loads.
  keepOnly(path.join(sqlite, 'build'), ['Release']);
  keepOnly(path.join(sqlite, 'build', 'Release'), ['better_sqlite3.node']);
  fs.rmSync(path.join(sqlite, 'bin'), { recursive: true, force: true });
  // node-pty's prebuilt debug symbols are never loaded at run time.
  removeFilesWithExtension(path.join(modules, 'node-pty', 'prebuilds'), '.pdb');
  // Countersign (residual round, build-2): any other node-gyp package rebuilt for
  // Electron keeps its addon and DLLs, but loses the same MSVC leftovers that the
  // packaged-output check fails on (forge-countersign.ts).
  for (const pkg of nodeGypPackages(modules)) {
    removeBuildIntermediates(path.join(pkg, 'build'));
  }
  // The externalized Node entry is excel.js -> lib/exceljs.nodejs.js. dist
  // contains browser/ES5 bundles and maps, not files used by that entry.
  fs.rmSync(path.join(modules, 'exceljs', 'dist'), { recursive: true, force: true });
}

function keepOnly(dir: string, names: readonly string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (!names.includes(entry)) fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

/** Top-level packages (scoped ones included) that build a native addon with node-gyp. */
function nodeGypPackages(modules: string): string[] {
  if (!fs.existsSync(modules)) return [];
  const packages: string[] = [];
  for (const entry of fs.readdirSync(modules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(modules, entry.name);
    const candidates = entry.name.startsWith('@')
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((child) => child.isDirectory())
          .map((child) => path.join(dir, child.name))
      : [dir];
    for (const pkg of candidates) {
      if (fs.existsSync(path.join(pkg, 'binding.gyp'))) packages.push(pkg);
    }
  }
  return packages;
}

function removeBuildIntermediates(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (BUILD_INTERMEDIATE_DIR.test(entry.name)) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      } else {
        removeBuildIntermediates(entryPath);
      }
    } else if (BUILD_INTERMEDIATE_FILE.test(entry.name)) {
      fs.rmSync(entryPath, { force: true });
    }
  }
}

function removeFilesWithExtension(dir: string, extension: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) removeFilesWithExtension(entryPath, extension);
    else if (entry.name.toLowerCase().endsWith(extension)) fs.rmSync(entryPath, { force: true });
  }
}

/** Drizzle snapshots are generator inputs; preserve journal, SQL and companions verbatim. */
export function prunePackagedMigrationSnapshots(resourcesPath: string): void {
  const meta = path.join(resourcesPath, 'drizzle', 'meta');
  for (const entry of fs.readdirSync(meta, { withFileTypes: true })) {
    if (entry.isFile() && /^\d{4}_snapshot\.json$/.test(entry.name)) {
      fs.unlinkSync(path.join(meta, entry.name));
    }
  }
}
