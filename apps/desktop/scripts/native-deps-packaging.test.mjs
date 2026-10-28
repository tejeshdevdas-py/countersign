import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preparePackagedNodePty } from '../forge-node-pty';
import { prunePackagedRuntime } from '../forge-prune-runtime';

const windowsFiles = [
  'pty.node',
  'conpty.node',
  'conpty_console_list.node',
  'winpty-agent.exe',
  'winpty.dll',
  path.join('conpty', 'conpty.dll'),
  path.join('conpty', 'OpenConsole.exe'),
];
let root;
let fixtureId = 0;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cindy-pty-package-'));
});
afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(platform = 'win32', arch = 'x64') {
  const buildPath = path.join(root, String(++fixtureId));
  const packageDir = path.join(buildPath, 'node_modules', 'node-pty');
  const prebuildDir = path.join(packageDir, 'prebuilds', `${platform}-${arch}`);
  const files = platform === 'win32' ? windowsFiles : ['pty.node', 'spawn-helper'];
  for (const file of files) {
    const target = path.join(prebuildDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'fixture binary');
  }
  return { buildPath, packageDir, prebuildDir, files };
}

describe('native dependency packaging', () => {
  it.each([
    ['win32', 'x64'],
    ['win32', 'arm64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
  ])('uses the complete %s/%s prebuild without requiring compilation', (platform, arch) => {
    const f = fixture(platform, arch);
    const other = path.join(f.packageDir, 'prebuilds', 'other-platform');
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, 'pty.node'), 'wrong binding');
    const license = path.join(f.packageDir, 'prebuilds', 'LICENSE');
    fs.writeFileSync(license, 'license');
    expect(preparePackagedNodePty(f.buildPath, platform, arch)).toEqual({
      rebuild: false,
      nativePath: path.join(f.prebuildDir, 'pty.node'),
    });
    for (const file of f.files) {
      expect(fs.readFileSync(path.join(f.prebuildDir, file), 'utf8')).toBe('fixture binary');
    }
    expect(fs.existsSync(other)).toBe(false);
    expect(fs.readFileSync(license, 'utf8')).toBe('license');
  });

  it.each(windowsFiles)('rejects a missing Windows runtime file: %s', (file) => {
    const f = fixture();
    fs.unlinkSync(path.join(f.prebuildDir, file));
    expect(() => preparePackagedNodePty(f.buildPath, 'win32', 'x64')).toThrow(
      /prebuild.*incomplete.*Reinstall workspace dependencies/,
    );
  });

  it.each(['empty', 'directory'])('rejects an %s binding instead of compiling it', (kind) => {
    const f = fixture();
    const file = path.join(f.prebuildDir, 'conpty.node');
    fs.unlinkSync(file);
    if (kind === 'empty') fs.writeFileSync(file, '');
    else fs.mkdirSync(file);
    expect(() => preparePackagedNodePty(f.buildPath, 'win32', 'x64')).toThrow('conpty.node');
  });

  it('does not accept prebuilds for another architecture or a stale local build', () => {
    const f = fixture('win32', 'x64');
    const stale = path.join(f.packageDir, 'build', 'Release', 'pty.node');
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, 'local binding');
    expect(() => preparePackagedNodePty(f.buildPath, 'win32', 'arm64')).toThrow('win32-arm64');
    expect(fs.readFileSync(stale, 'utf8')).toBe('local binding');
  });

  it('prevents copied Release and Debug bindings from shadowing valid target prebuilds', () => {
    const f = fixture();
    const stale = ['Release', 'Debug'].flatMap((variant) =>
      ['pty.node', 'conpty.node', 'conpty_console_list.node'].map((file) =>
        path.join(f.packageDir, 'build', variant, file),
      ),
    );
    for (const file of stale) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'local binding');
    }
    const neighbor = path.join(f.packageDir, 'build', 'Release', 'keep.txt');
    fs.writeFileSync(neighbor, 'keep');
    preparePackagedNodePty(f.buildPath, 'win32', 'x64');
    expect(stale.every((file) => !fs.existsSync(file))).toBe(true);
    expect(fs.readFileSync(neighbor, 'utf8')).toBe('keep');
    expect(fs.readFileSync(path.join(f.prebuildDir, 'conpty.node'), 'utf8')).toBe('fixture binary');
  });

  it('rejects a missing macOS spawn-helper before changing the package', () => {
    const f = fixture('darwin', 'arm64');
    fs.unlinkSync(path.join(f.prebuildDir, 'spawn-helper'));
    expect(() => preparePackagedNodePty(f.buildPath, 'darwin', 'arm64')).toThrow('spawn-helper');
  });

  it.each(['x64', 'arm64'])('keeps the existing Linux/%s source build', (arch) => {
    const f = fixture('linux', arch);
    const source = path.join(f.packageDir, 'src', 'unix', 'pty.cc');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, 'build input');
    expect(preparePackagedNodePty(f.buildPath, 'linux', arch)).toEqual({
      rebuild: true,
      nativePath: path.join(f.packageDir, 'build', 'Release', 'pty.node'),
    });
    expect(fs.existsSync(f.prebuildDir)).toBe(false);
    expect(fs.readFileSync(source, 'utf8')).toBe('build input');
  });

  it('prunes build-only SQLite files and ExcelJS browser bundles, retaining runtime and licenses', () => {
    const f = fixture();
    const modules = path.join(f.buildPath, 'node_modules');
    const removed = [
      ['better-sqlite3', 'deps', 'sqlite3', 'sqlite3.c'],
      ['better-sqlite3', 'src', 'better_sqlite3.cpp'],
      ['better-sqlite3', 'build', 'Release', 'obj', 'gen', 'sqlite3.c'],
      ['better-sqlite3', 'build', 'Release', 'obj.target', 'sqlite3.o'],
      ['better-sqlite3', 'build', 'Release', 'sqlite3.a'],
      ['exceljs', 'dist', 'exceljs.js.map'],
    ];
    const kept = [
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.node'],
      ['better-sqlite3', 'lib', 'database.js'],
      ['better-sqlite3', 'LICENSE'],
      ['exceljs', 'excel.js'],
      ['exceljs', 'lib', 'exceljs.nodejs.js'],
      ['exceljs', 'LICENSE'],
    ];
    for (const parts of [...removed, ...kept]) {
      const file = path.join(modules, ...parts);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'fixture');
    }
    prunePackagedRuntime(f.buildPath);
    prunePackagedRuntime(f.buildPath);
    for (const parts of removed) expect(fs.existsSync(path.join(modules, ...parts))).toBe(false);
    for (const parts of kept)
      expect(fs.readFileSync(path.join(modules, ...parts), 'utf8')).toBe('fixture');
  });

  // Countersign (final review M-B1): an MSVC rebuild of better-sqlite3 leaves
  // objects, PDBs, tlogs, project files and config.gypi, which carry the build
  // machine's paths and user name. Only the addon bindings loads is kept.
  it('prunes the Windows better-sqlite3 build to its addon and drops prebuilt PDBs', () => {
    const f = fixture();
    const modules = path.join(f.buildPath, 'node_modules');
    const removed = [
      ['better-sqlite3', 'build', 'config.gypi'],
      ['better-sqlite3', 'build', 'binding.sln'],
      ['better-sqlite3', 'build', 'better_sqlite3.vcxproj'],
      ['better-sqlite3', 'build', 'better_sqlite3.vcxproj.filters'],
      ['better-sqlite3', 'build', 'deps', 'sqlite3.vcxproj'],
      ['better-sqlite3', 'build', 'deps', 'Release', 'obj', 'sqlite3', 'sqlite3.obj'],
      ['better-sqlite3', 'build', 'Release', '.forge-meta'],
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.pdb'],
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.iobj'],
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.ipdb'],
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.lib'],
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.exp'],
      ['better-sqlite3', 'build', 'Release', 'test_extension.node'],
      [
        'better-sqlite3',
        'build',
        'Release',
        'obj',
        'better_sqlite3',
        'better_sqlite3.tlog',
        'CL.read.1.tlog',
      ],
      // @electron/rebuild's copy of the addon; bindings never looks in bin/.
      ['better-sqlite3', 'bin', 'win32-x64-146', 'better-sqlite3.node'],
      ['node-pty', 'prebuilds', 'win32-x64', 'pty.pdb'],
      ['node-pty', 'prebuilds', 'win32-x64', 'conpty', 'conpty.pdb'],
    ];
    const kept = [
      ['better-sqlite3', 'build', 'Release', 'better_sqlite3.node'],
      ['better-sqlite3', 'lib', 'database.js'],
      ['better-sqlite3', 'package.json'],
      ['node-pty', 'prebuilds', 'win32-x64', 'pty.node'],
      ['node-pty', 'prebuilds', 'win32-x64', 'conpty', 'conpty.dll'],
    ];
    for (const parts of [...removed, ...kept]) {
      const file = path.join(modules, ...parts);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'fixture');
    }
    prunePackagedRuntime(f.buildPath);
    prunePackagedRuntime(f.buildPath);
    for (const parts of removed) expect(fs.existsSync(path.join(modules, ...parts))).toBe(false);
    for (const parts of kept)
      expect(fs.readFileSync(path.join(modules, ...parts), 'utf8')).toBe('fixture');
    expect(fs.readdirSync(path.join(modules, 'better-sqlite3', 'build'))).toEqual(['Release']);
    expect(fs.readdirSync(path.join(modules, 'better-sqlite3', 'build', 'Release'))).toEqual([
      'better_sqlite3.node',
    ]);
    expect(fs.existsSync(path.join(modules, 'better-sqlite3', 'bin'))).toBe(false);
  });

  // Countersign (residual round, build-2): every node-gyp package's build folder loses
  // the MSVC leftovers the packaged-output check fails on; addons and DLLs stay.
  it('removes MSVC build leftovers from the build folder of every node-gyp package', () => {
    const f = fixture();
    const modules = path.join(f.buildPath, 'node_modules');
    const removed = [
      ['node-pty', 'build', 'Release', 'pty.ilk'],
      ['node-pty', 'build', 'Release', 'vc143.idb'],
      ['node-pty', 'build', 'Release', 'pty.pch'],
      ['node-pty', 'build', 'Release', 'pty.res'],
      ['node-pty', 'build', 'Release', 'pty.recipe'],
      ['node-pty', 'build', 'Release', '.forge-meta'],
      ['node-pty', 'build', 'Release', 'pty.pdb'],
      ['node-pty', 'build', 'Release', 'obj', 'pty', 'pty.tlog', 'pty.lastbuildstate'],
      ['node-pty', 'build', 'config.gypi'],
      ['@scope', 'addon', 'build', 'Release', 'addon.exp'],
    ];
    const kept = [
      ['node-pty', 'build', 'Release', 'pty.node'],
      ['node-pty', 'build', 'Release', 'conpty', 'conpty.dll'],
      ['node-pty', 'build', 'Release', 'conpty', 'OpenConsole.exe'],
      ['@scope', 'addon', 'build', 'Release', 'addon.node'],
      // Not a node-gyp package: its build folder is ordinary JavaScript output.
      ['plain-js', 'build', 'src', 'index.res'],
    ];
    for (const parts of [
      ['node-pty', 'binding.gyp'],
      ['@scope', 'addon', 'binding.gyp'],
      ...removed,
      ...kept,
    ]) {
      const file = path.join(modules, ...parts);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'fixture');
    }
    prunePackagedRuntime(f.buildPath);
    for (const parts of removed)
      expect(fs.existsSync(path.join(modules, ...parts)), parts.join('/')).toBe(false);
    for (const parts of kept)
      expect(fs.readFileSync(path.join(modules, ...parts), 'utf8')).toBe('fixture');
    expect(fs.existsSync(path.join(modules, 'node-pty', 'build', 'Release', 'obj'))).toBe(false);
  });
});
