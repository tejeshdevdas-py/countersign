// Countersign build downloads: there is no fallback host (build-downloads.mjs), so a slow but
// progressing upstream download must complete instead of being cut off by the speed limit
// that upstream applies only where a fallback exists. When a download fails, the error names
// the upstream host and suggests only a command that exists.
//
// The fetch stub serves downloads.claude.ai in-process: no network. The claude case uses the
// linux-arm64 slot (not this machine's platform) and is skipped if that slot already holds
// anything, so no real binary is touched.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureBinary } from '../../ensure-agent-binaries.mjs';
import { BUILD_CDN_FALLBACK } from '../build-downloads.mjs';
import { readLocalOnlySwitch } from '../local-only.mjs';
import {
  TimeoutError,
  downloadToFileWithTimeout,
} from '../../../tools/shared/fetch-with-timeout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLAUDE_PIN = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tools', 'claude', 'latest.json'), 'utf8'),
).version;
const ROOT_SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;

const SLOW_PLATFORM = 'linux-arm64';
const BIN = Buffer.alloc(4096, 7);
const CHUNK = 256;
const CHUNK_GAP_MS = 40;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** A body that sends BIN in small chunks with a pause between them: slow, but never stalled. */
function trickleResponse(signal) {
  let sent = 0;
  let timer = null;
  const body = new ReadableStream({
    start(controller) {
      const push = () => {
        controller.enqueue(BIN.subarray(sent, sent + CHUNK));
        sent += CHUNK;
        if (sent >= BIN.length) {
          controller.close();
          return;
        }
        timer = setTimeout(push, CHUNK_GAP_MS);
      };
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.error(signal.reason);
      });
      push();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-length': String(BIN.length) } });
}

/** Sets env and a fetch stub for one test; the returned restore puts both back. */
function slowUpstream(t) {
  const savedFetch = globalThis.fetch;
  const savedEnv = {
    window: process.env.XDT_AGENTBIN_THROUGHPUT_WINDOW_MS,
    min: process.env.XDT_AGENTBIN_MIN_THROUGHPUT_BPS,
  };
  // A 200 ms window and a 10 MB/s floor: the trickle (about 6 KB/s) fails any speed check
  // within half a second, while it never stalls.
  process.env.XDT_AGENTBIN_THROUGHPUT_WINDOW_MS = '200';
  process.env.XDT_AGENTBIN_MIN_THROUGHPUT_BPS = '10000000';
  const requested = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    requested.push(href);
    const releases = `https://downloads.claude.ai/claude-code-releases/${CLAUDE_PIN}`;
    if (href === `${releases}/manifest.json`) {
      return Response.json({ platforms: { [SLOW_PLATFORM]: { checksum: sha256(BIN) } } });
    }
    if (href === `${releases}/${SLOW_PLATFORM}/claude` || href.startsWith('http://slow.invalid/')) {
      return trickleResponse(init.signal);
    }
    return new Response('not found', { status: 404 });
  };
  t.after(() => {
    globalThis.fetch = savedFetch;
    for (const [name, value] of [
      ['XDT_AGENTBIN_THROUGHPUT_WINDOW_MS', savedEnv.window],
      ['XDT_AGENTBIN_MIN_THROUGHPUT_BPS', savedEnv.min],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  return requested;
}

test('control: the speed limit upstream uses where a fallback exists cuts this trickle off', async (t) => {
  slowUpstream(t);
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'countersign-slow-')), 'file');
  t.after(() => fs.rmSync(path.dirname(dest), { recursive: true, force: true }));
  await assert.rejects(downloadToFileWithTimeout('http://slow.invalid/file', dest), (err) => {
    assert.ok(err instanceof TimeoutError);
    assert.equal(err.kind, 'throughput');
    return true;
  });
});

test('ensureBinary(claude): a slow but progressing download completes (no fallback, no speed limit)', async (t) => {
  const binDir = path.join(ROOT, 'apps', 'claude-code-bin', SLOW_PLATFORM);
  const updatesDir = path.join(ROOT, 'tools', 'claude', 'updates', CLAUDE_PIN, SLOW_PLATFORM);
  if (fs.existsSync(binDir) || fs.existsSync(updatesDir)) {
    t.skip(`${SLOW_PLATFORM} claude slot already exists; not touching it`);
    return;
  }
  t.after(() => {
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(updatesDir, { recursive: true, force: true });
  });
  const requested = slowUpstream(t);
  const binPath = await ensureBinary('claude', SLOW_PLATFORM, { force: true });
  assert.equal(sha256(fs.readFileSync(binPath)), sha256(BIN));
  assert.equal(fs.readFileSync(path.join(binDir, '.version'), 'utf8').trim(), CLAUDE_PIN);
  assert.deepEqual(
    [...new Set(requested.map((url) => new URL(url).host))],
    ['downloads.claude.ai'],
  );
});

// A fake platform makes each kind's upstream step fail at once, with no network.
const FAILURE_CASES = [
  ['claude', 'claude-code-bin', /downloads\.claude\.ai/],
  ['ripgrep', 'ripgrep-bin', /api\.github\.com and github\.com/],
  ['codex', 'codex-package-bin', /api\.github\.com and github\.com/],
  ['pi', 'pi-bin', /api\.github\.com and github\.com/],
];

for (const [kind, binDir, host] of FAILURE_CASES) {
  test(`ensureBinary(${kind}): an upstream failure names the host and an existing retry command`, async () => {
    await assert.rejects(ensureBinary(kind, 'test-fallback-platform', { force: true }), (err) => {
      assert.match(err.message, host);
      assert.match(err.message, /do not fall back/);
      assert.doesNotMatch(err.message, /cindy|CDN/i);
      const commands = [...err.message.matchAll(/"pnpm ([\w:-]+)"/g)].map((m) => m[1]);
      assert.deepEqual(commands, [`install:${kind}`]);
      for (const command of commands) {
        assert.equal(typeof ROOT_SCRIPTS[command], 'string', `package.json has ${command}`);
      }
      return true;
    });
    assert.equal(fs.existsSync(path.join(ROOT, 'apps', binDir, 'test-fallback-platform')), false);
  });
}

// Final review M-F7: the build switch mirrors the app's LOCAL_ONLY switch. Build scripts keep
// their own constant (they never import app code), so this pins that the two agree.
test('BUILD_CDN_FALLBACK is the opposite of LOCAL_ONLY', () => {
  assert.equal(BUILD_CDN_FALLBACK, !readLocalOnlySwitch());
});
