import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeEgress } from '../egress-report.mjs';

const line = (host, blocked) => JSON.stringify({ time: 1, protocol: 'https:', host, blocked });

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
  });
});

test('task hosts are allowed, loopback is allowed, repeats collapse', () => {
  const result = summarizeEgress(
    [line('127.0.0.1', false), line('docs.example.org', false), line('docs.example.org', false), ''],
    ['example.org'],
  );
  assert.deepEqual(result.allowed, ['127.0.0.1', 'docs.example.org']);
  assert.deepEqual(result.unexpected, []);
});

test('a suffix lookalike is not allowed', () => {
  const result = summarizeEgress([line('notanthropic.com', false)]);
  assert.deepEqual(result.unexpected, ['notanthropic.com']);
});
