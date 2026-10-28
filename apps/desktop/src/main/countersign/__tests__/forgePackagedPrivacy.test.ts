/**
 * Countersign packaging (final review M-B1): after packaging, a check fails
 * when app.asar or app.asar.unpacked holds MSVC/node-gyp build intermediates
 * or the build machine's user name. In the real hook the name comes from
 * os.userInfo() at check time and is never written anywhere; here a made-up
 * name stands in, and every fixture is a temporary asar built for the test.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { createPackageWithOptions } from '@electron/asar';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertPackagedOutputClean,
  findPackagedBuildLeaks,
  publicGithubIdentity,
} from '../../../../forge-countersign';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

// A made-up builder name. The public identity below contains it, as the real
// project's GitHub owner name contains its maintainer's Windows user name.
const USER = 'FixtureBuilder';
const APP_IDS = [
  'io.github.fixturebuilder-gh.countersign',
  'io.github.fixturebuilder-gh.countersign.dev',
];
const PUBLIC = publicGithubIdentity(APP_IDS);
// Build-path fixtures are joined at run time so the source holds no path shape.
const winPath = (...parts: string[]) => parts.join('\\');
const PROFILE = ['C:', 'Users', 'fixturebuilder'];

/** Packs `files` (relative path -> content) into resources/app.asar, *.node unpacked. */
async function packaged(files: Record<string, string | Buffer>): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-packaged-'));
  roots.push(root);
  const app = path.join(root, 'app');
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(app, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const resources = path.join(root, 'resources');
  fs.mkdirSync(resources);
  await createPackageWithOptions(app, path.join(resources, 'app.asar'), { unpack: '*.node' });
  return resources;
}

const CLEAN = {
  'package.json': '{"name":"countersign"}',
  '.vite/build/index.js': `const appId = "${APP_IDS[0]}"; const src = "https://github.com/fixturebuilder-gh/countersign";`,
  'node_modules/better-sqlite3/build/Release/better_sqlite3.node': Buffer.alloc(64, 1),
  'node_modules/better-sqlite3/lib/database.js': 'module.exports = {};',
};

describe('Countersign packaged output check', () => {
  it('derives the public GitHub identity from the app IDs', () => {
    expect(PUBLIC).toEqual([
      'io.github.fixturebuilder-gh.countersign',
      'github.com/fixturebuilder-gh/',
      'io.github.fixturebuilder-gh.countersign.dev',
    ]);
  });

  it('passes a clean package, including the name inside the public identity', async () => {
    const resources = await packaged(CLEAN);
    const findings = findPackagedBuildLeaks(resources, { userName: USER, publicIdentity: PUBLIC });
    expect(findings).toMatchObject({ intermediates: [], userName: [] });
    expect(findings.filesChecked).toBe(4);
    expect(() =>
      assertPackagedOutputClean(resources, { userName: USER, publicIdentity: PUBLIC }),
    ).not.toThrow();
  });

  it('finds build intermediates in the archive and in the unpacked folder', async () => {
    const resources = await packaged({
      ...CLEAN,
      'node_modules/better-sqlite3/build/config.gypi': '{}',
      'node_modules/better-sqlite3/build/binding.sln': 'x',
      'node_modules/better-sqlite3/build/better_sqlite3.vcxproj.filters': 'x',
      'node_modules/better-sqlite3/build/Release/better_sqlite3.pdb': 'x',
      'node_modules/better-sqlite3/build/Release/better_sqlite3.IOBJ': 'x',
      'node_modules/better-sqlite3/build/Release/better_sqlite3.ipdb': 'x',
      'node_modules/better-sqlite3/build/Release/better_sqlite3.lib': 'x',
      'node_modules/better-sqlite3/build/Release/better_sqlite3.exp': 'x',
      'node_modules/better-sqlite3/build/Release/obj/sqlite3/sqlite3.obj': 'x',
      'node_modules/better-sqlite3/build/Release/x.tlog/CL.read.1.tlog': 'x',
      'node_modules/better-sqlite3/build/Release/test_extension.node': Buffer.alloc(8, 2),
    });
    // The unpacked copy of an intermediate is found on disk as well.
    const unpackedPdb = path.join(resources, 'app.asar.unpacked', 'native', 'vec0.pdb');
    fs.mkdirSync(path.dirname(unpackedPdb), { recursive: true });
    fs.writeFileSync(unpackedPdb, 'x');

    const { intermediates } = findPackagedBuildLeaks(resources, {
      userName: USER,
      publicIdentity: PUBLIC,
    });
    const asar = (relative: string) => `app.asar/node_modules/better-sqlite3/build/${relative}`;
    expect(intermediates).toEqual(
      expect.arrayContaining([
        asar('config.gypi'),
        asar('binding.sln'),
        asar('better_sqlite3.vcxproj.filters'),
        asar('Release/better_sqlite3.pdb'),
        asar('Release/better_sqlite3.IOBJ'),
        asar('Release/better_sqlite3.ipdb'),
        asar('Release/better_sqlite3.lib'),
        asar('Release/better_sqlite3.exp'),
        asar('Release/obj'),
        asar('Release/obj/sqlite3/sqlite3.obj'),
        asar('Release/x.tlog/CL.read.1.tlog'),
        'app.asar.unpacked/native/vec0.pdb',
      ]),
    );
    // A .node addon is not an intermediate.
    expect(intermediates.some((entry) => entry.endsWith('.node'))).toBe(false);
  });

  it('finds the user name in packed and unpacked content, any case, UTF-8 or UTF-16', async () => {
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/main.js': `const p = ${JSON.stringify(winPath(...PROFILE, 'AppData', 'Local', 'Temp'))};`,
      'node_modules/addon/build/Release/addon.node': Buffer.concat([
        Buffer.alloc(16),
        Buffer.from(winPath(...PROFILE, 'src', 'addon.cc').toUpperCase(), 'utf16le'),
      ]),
    });
    const { userName } = findPackagedBuildLeaks(resources, {
      userName: USER,
      publicIdentity: PUBLIC,
    });
    expect(userName.sort()).toEqual([
      'app.asar.unpacked/node_modules/addon/build/Release/addon.node',
      'app.asar/.vite/build/main.js',
    ]);
  });

  it('allows the name only inside the public identity, not elsewhere in the same file', async () => {
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/index.js': `const id = "${APP_IDS[0]}"; const home = ${JSON.stringify(winPath(...PROFILE, 'x'))};`,
    });
    expect(
      findPackagedBuildLeaks(resources, { userName: USER, publicIdentity: PUBLIC }).userName,
    ).toEqual(['app.asar/.vite/build/index.js']);
  });

  it('finds the user name in a profile folder of a file path and masks it in the report', async () => {
    const resources = await packaged({
      ...CLEAN,
      'docs/FixtureBuilder-notes.txt': 'x',
      'docs/Users/FixtureBuilder/notes.txt': 'x',
    });
    const findings = findPackagedBuildLeaks(resources, { userName: USER, publicIdentity: PUBLIC });
    expect(findings.userName).toEqual(['app.asar/docs/Users/<user name>/notes.txt']);
  });

  // build-1 / regression-2: a first name or a common word is ordinary app text.
  // Only a Windows profile folder (a drive, Users, then the name) names the builder.
  it.each([
    ['Mark', 'const doc = "markdown"; // Mark the item as done'],
    ['max', 'const n = Math.max(a, b); const maxSize = 4;'],
    ['User', 'const label = "User settings"; const u = "username";'],
    ['dev', 'const env = "development"; const d = "/dev/null";'],
    ['Mark', `const p = ${JSON.stringify(winPath('C:', 'Users', 'Markus', 'x'))};`],
    ['Mark', `const p = "${['C:', 'Users', 'mark.smith', 'x'].join('/')}";`],
    ['User', `// The full path such as '${['', 'home', 'user', 'dir'].join('/')}'`],
    ['Peter', `Peter <${['http:', '', 'example.org', 'users', 'peter', ''].join('/')}>`],
  ])('passes ordinary text that contains the short name %s', async (userName, text) => {
    const resources = await packaged({ ...CLEAN, '.vite/build/main.js': text });
    const findings = findPackagedBuildLeaks(resources, { userName, publicIdentity: PUBLIC });
    expect(findings.userName).toEqual([]);
  });

  it.each([
    ['Mark', winPath('C:', 'Users', 'Mark', 'src')],
    ['Mark', winPath('c:', 'users', 'MARK')],
    ['Mark', ['', 'c', 'Users', 'mark', 'src'].join('/')],
    ['max', winPath('', '', '?', 'D:', 'Documents and Settings', 'Max', '.cargo')],
    ['max', ['C:', 'Users', 'max', 'AppData'].join('/')],
  ])('fails a profile path that holds the short name %s', async (userName, profilePath) => {
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/main.js': `const p = ${JSON.stringify(profilePath)};`,
      'node_modules/addon/build/Release/addon.node': Buffer.concat([
        Buffer.alloc(16),
        Buffer.from(profilePath, 'utf16le'),
      ]),
    });
    const findings = findPackagedBuildLeaks(resources, { userName, publicIdentity: PUBLIC });
    expect(findings.userName.sort()).toEqual([
      'app.asar.unpacked/node_modules/addon/build/Release/addon.node',
      'app.asar/.vite/build/main.js',
    ]);
  });

  it('also checks the profile folder name when it differs from the user name', async () => {
    // A Microsoft-account profile folder can be shorter than the account's user name.
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/main.js': `const p = ${JSON.stringify(winPath('C:', 'Users', 'fixtu', 'x'))};`,
    });
    const options = { userName: USER, profileName: 'fixtu', publicIdentity: PUBLIC };
    const findings = findPackagedBuildLeaks(resources, options);
    expect(findings.userName).toEqual(['app.asar/.vite/build/main.js']);
    expect(
      findPackagedBuildLeaks(resources, { userName: USER, publicIdentity: PUBLIC }).userName,
    ).toEqual([]);
  });

  it('fails with both kinds of finding and never prints the name', async () => {
    const resources = await packaged({
      ...CLEAN,
      'node_modules/better-sqlite3/build/config.gypi': JSON.stringify({
        x: winPath('C:', 'Users', 'FixtureBuilder'),
      }),
    });
    let message = '';
    try {
      assertPackagedOutputClean(resources, { userName: USER, publicIdentity: PUBLIC });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/build intermediates/);
    expect(message).toMatch(/user name/);
    expect(message).toContain('app.asar/node_modules/better-sqlite3/build/config.gypi');
    expect(message.toLowerCase()).not.toContain(USER.toLowerCase());
  });

  it('still checks intermediates when no user name is available', async () => {
    const resources = await packaged({ ...CLEAN, 'build/x.pdb': 'x' });
    const findings = findPackagedBuildLeaks(resources, { userName: '', publicIdentity: PUBLIC });
    expect(findings).toMatchObject({ intermediates: ['app.asar/build/x.pdb'], userName: [] });
  });

  // Residual round, build-2: more MSVC/node-gyp leftovers seen in a real package build.
  it('finds incremental-link, precompiled-header, resource and rebuild-marker files', async () => {
    const resources = await packaged({
      ...CLEAN,
      'node_modules/addon/build/Release/addon.ilk': 'x',
      'node_modules/addon/build/Release/vc143.idb': 'x',
      'node_modules/addon/build/Release/addon.pch': 'x',
      'node_modules/addon/build/Release/addon.res': 'x',
      'node_modules/addon/build/Release/addon.tlog/addon.lastbuildstate': 'x',
      'node_modules/addon/build/Release/addon.recipe': 'x',
      'node_modules/addon/build/Release/.forge-meta': 'x',
    });
    const { intermediates } = findPackagedBuildLeaks(resources, {
      userName: USER,
      publicIdentity: PUBLIC,
    });
    const asar = (relative: string) => `app.asar/node_modules/addon/build/Release/${relative}`;
    expect(intermediates).toEqual(
      expect.arrayContaining([
        asar('addon.ilk'),
        asar('vc143.idb'),
        asar('addon.pch'),
        asar('addon.res'),
        asar('addon.tlog/addon.lastbuildstate'),
        asar('addon.recipe'),
        asar('.forge-meta'),
      ]),
    );
  });

  // Residual round, build-3: a short (8.3) profile folder holds only the first letters of
  // the name, so it is found by its shape, whatever the user name is.
  it.each([
    winPath('C:', 'Users', 'FIXTUR~1', 'AppData', 'Local', 'Temp'),
    winPath('c:', 'users', 'ab~2'),
    ['', 'c', 'Users', 'FIXTUR~1', 'src'].join('/'),
    winPath('D:', 'Documents and Settings', 'FIXT~12', 'x'),
  ])('fails a short (8.3) profile folder in %s', async (profilePath) => {
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/main.js': `const p = ${JSON.stringify(profilePath)};`,
      'node_modules/addon/build/Release/addon.node': Buffer.concat([
        Buffer.alloc(16),
        Buffer.from(profilePath, 'utf16le'),
      ]),
    });
    const findings = findPackagedBuildLeaks(resources, {
      userName: 'unrelated',
      publicIdentity: PUBLIC,
    });
    expect(findings.userName.sort()).toEqual([
      'app.asar.unpacked/node_modules/addon/build/Release/addon.node',
      'app.asar/.vite/build/main.js',
    ]);
  });

  it('finds a short profile folder in a packaged file path, and no user name is needed', async () => {
    const resources = await packaged({ ...CLEAN, 'Users/FIXTUR~1/x.txt': 'x' });
    expect(
      findPackagedBuildLeaks(resources, { userName: '', publicIdentity: PUBLIC }).userName,
    ).toEqual(['app.asar/Users/FIXTUR~1/x.txt']);
  });

  it('does not count a tilde elsewhere in a path as a short profile folder', async () => {
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/main.js': `const a = ${JSON.stringify(winPath('C:', 'Users', 'Public', 'a~1'))}; const b = "~/.config"; const c = ${JSON.stringify(winPath('C:', 'Users', 'longername~1'))};`,
    });
    expect(
      findPackagedBuildLeaks(resources, { userName: 'unrelated', publicIdentity: PUBLIC }).userName,
    ).toEqual([]);
  });

  it('names the short profile folder in the failure message', async () => {
    const resources = await packaged({
      ...CLEAN,
      '.vite/build/main.js': `const p = ${JSON.stringify(winPath('C:', 'Users', 'FIXTUR~1'))};`,
    });
    expect(() =>
      assertPackagedOutputClean(resources, { userName: 'unrelated', publicIdentity: PUBLIC }),
    ).toThrow(/short \(8\.3\) profile folder/);
  });
  // Residual round, build-4/build-5/docs-4: the helper programs in resources/tools are
  // built outside this repository's packaging. The check reports which of them hold the
  // user name or a short profile folder, and does not stop the package for them.
  it('reports helper programs in resources/tools that hold the name, without failing', async () => {
    const resources = await packaged(CLEAN);
    const tools = path.join(resources, 'tools');
    const write = (relative: string, content: Buffer) => {
      const file = path.join(tools, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    write(
      'helper/named.exe',
      Buffer.concat([Buffer.alloc(32), Buffer.from(winPath(...PROFILE, '.cargo'))]),
    );
    write('helper/short.exe', Buffer.from(winPath('C:', 'Users', 'FIXTUR~1', '.cargo'), 'utf16le'));
    write('helper/clean.exe', Buffer.alloc(64, 3));

    const options = { userName: USER, publicIdentity: PUBLIC };
    const findings = assertPackagedOutputClean(resources, options);
    expect(findings.tools.sort()).toEqual(['tools/helper/named.exe', 'tools/helper/short.exe']);
    expect(findings.toolFilesChecked).toBe(3);
    expect(findings.userName).toEqual([]);
    expect(findings.intermediates).toEqual([]);
  });

  it('reports no helper programs when resources/tools is missing', async () => {
    const resources = await packaged(CLEAN);
    const findings = findPackagedBuildLeaks(resources, { userName: USER, publicIdentity: PUBLIC });
    expect(findings).toMatchObject({ tools: [], toolFilesChecked: 0 });
  });
});
