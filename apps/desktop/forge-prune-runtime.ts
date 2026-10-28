import * as fs from 'node:fs';
import * as path from 'node:path';

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
