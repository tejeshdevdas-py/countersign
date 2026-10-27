import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseTaskHost, summarizeEgress } from '../egress-report.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'egress-report.mjs');
const line = (host, blocked) => JSON.stringify({ time: 1, protocol: 'https:', host, blocked });

function runCli(content, extraArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-'));
  const file = path.join(dir, 'egress-log.jsonl');
  if (content !== null) fs.writeFileSync(file, content);
  const result = spawnSync(process.execPath, [SCRIPT, file, ...extraArgs], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

test('sorts hosts into allowed, blocked and unexpected', () => {
  const result = summarizeEgress([
    line('api.anthropic.com', false),
    line('auth.cindy.app', true),
    line('example.org', false),
  ]);
  assert.deepEqual(result, {
    allowed: ['api.anthropic.com'],
    blocked: ['auth.cindy.app'],
    unexpected: ['example.org'],
    malformed: 0,
    entries: 3,
  });
});

test('localhost and 127.0.0.1 are allowed; task hosts are allowed; repeats collapse', () => {
  const result = summarizeEgress(
    [
      line('localhost', false),
      line('127.0.0.1', false),
      line('docs.example.org', false),
      line('docs.example.org', false),
      '',
    ],
    ['example.org'],
  );
  assert.deepEqual(result.allowed, ['127.0.0.1', 'docs.example.org', 'localhost']);
  assert.deepEqual(result.unexpected, []);
});

test('the blocked flag wins even on an allow-listed host', () => {
  const result = summarizeEgress([line('api.anthropic.com', true)]);
  assert.deepEqual(result.blocked, ['api.anthropic.com']);
  assert.deepEqual(result.allowed, []);
});

test('a suffix lookalike is not allowed', () => {
  const result = summarizeEgress([line('notanthropic.com', false)]);
  assert.deepEqual(result.unexpected, ['notanthropic.com']);
});

test('malformed lines and lines without a host are counted, blank lines are not', () => {
  const result = summarizeEgress([line('localhost', false), '{"host":"trunc', '{"time":1}', '[]', '   ']);
  assert.equal(result.malformed, 3);
  assert.equal(result.entries, 1);
});

test('parseTaskHost takes a host or the hostname of a URL and rejects junk', () => {
  assert.equal(parseTaskHost(' Example.ORG '), 'example.org');
  assert.equal(parseTaskHost('https://Docs.Example.org:8080/a?b=1'), 'docs.example.org');
  assert.equal(parseTaskHost('example.org/path'), null);
  assert.equal(parseTaskHost('http://'), null);
});

test('CLI exits 0 for a clean log', () => {
  const r = runCli(`${line('api.anthropic.com', false)}\n${line('localhost', false)}\n`);
  assert.equal(r.status, 0);
});

test('CLI exits 1 for a blocked host and for an unexpected host', () => {
  assert.equal(runCli(`${line('auth.cindy.app', true)}\n`).status, 1);
  assert.equal(runCli(`${line('example.org', false)}\n`).status, 1);
});

test('CLI --task-hosts makes a host expected, also from a full URL', () => {
  const log = `${line('docs.example.org', false)}\n`;
  assert.equal(runCli(log, ['--task-hosts', 'example.org']).status, 0);
  assert.equal(runCli(log, ['--task-hosts', 'https://example.org/page']).status, 0);
  assert.equal(runCli(log, ['--task-hosts', 'a/b']).status, 2);
});

test('CLI exits 1 on a malformed line even when the rest is clean', () => {
  const r = runCli(`${line('localhost', false)}\n{"host":"trunc\n`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /malformed/);
});

test('CLI exits 1 with a clear message for an empty log', () => {
  for (const content of ['', '\n\n']) {
    const r = runCli(content);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no egress recorded: was COUNTERSIGN_EGRESS_LOG set\?/);
  }
});

test('CLI exits 2 for a missing file and for no argument', () => {
  const missing = runCli(null);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /cannot read/);
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
});
