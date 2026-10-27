/**
 * Egress report: reads the JSON-lines file written when COUNTERSIGN_EGRESS_LOG
 * is set and sorts every host the app contacted into allowed, blocked and
 * unexpected. A corrupted log never passes.
 *
 * Usage: node scripts/countersign/egress-report.mjs <egress-log.jsonl> [--task-hosts a.com,https://b.org/x]
 *
 * Exit codes:
 *   0  at least one entry recorded; none blocked, unexpected or malformed
 *   1  a blocked or unexpected host, a malformed line, or no entries at all
 *      (an empty log usually means COUNTERSIGN_EGRESS_LOG was not set)
 *   2  input error: no file argument, unreadable or missing file, bad --task-hosts
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ALLOWED_HOSTS = [
  'anthropic.com',
  'claude.ai',
  'claude.com',
  'openai.com',
  'chatgpt.com',
  '127.0.0.1',
  'localhost',
];

function matchesHost(host, suffixes) {
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

/**
 * @param {string[]} lines JSON log lines `{host, blocked, ...}`. Blank lines are ignored;
 *   non-blank lines that are not JSON objects with a string `host` are counted as malformed.
 * @param {string[]} [taskHosts] hosts the task itself was asked to reach.
 * @returns {{allowed: string[], blocked: string[], unexpected: string[], malformed: number, entries: number}}
 */
export function summarizeEgress(lines, taskHosts = []) {
  const allowList = [...ALLOWED_HOSTS, ...taskHosts.map((h) => h.trim().toLowerCase()).filter(Boolean)];
  const allowed = new Set();
  const blocked = new Set();
  const unexpected = new Set();
  let malformed = 0;
  let entries = 0;
  for (const raw of lines) {
    if (raw.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      malformed += 1;
      continue;
    }
    if (!entry || typeof entry.host !== 'string' || entry.host.trim() === '') {
      malformed += 1;
      continue;
    }
    entries += 1;
    const host = entry.host.trim().toLowerCase().replace(/\.$/, '');
    if (entry.blocked === true) blocked.add(host);
    else if (matchesHost(host, allowList)) allowed.add(host);
    else unexpected.add(host);
  }
  return {
    allowed: [...allowed].sort(),
    blocked: [...blocked].sort(),
    unexpected: [...unexpected].sort(),
    malformed,
    entries,
  };
}

/** Accepts `host` or a full URL; returns the lower-case hostname, '' when empty, null when unusable. */
export function parseTaskHost(raw) {
  const text = raw.trim();
  if (text === '') return '';
  try {
    if (text.includes('://')) return new URL(text).hostname.toLowerCase() || null;
    if (/[/\s?#@]/.test(text)) return null;
    return text.toLowerCase();
  } catch {
    return null;
  }
}

function main(argv) {
  const args = argv.slice(2);
  let file = null;
  const taskHosts = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--task-hosts') {
      for (const raw of (args[(i += 1)] ?? '').split(',')) {
        const host = parseTaskHost(raw);
        if (host === null) {
          console.error(`egress-report: cannot read a host from --task-hosts entry "${raw}"`);
          return 2;
        }
        if (host) taskHosts.push(host);
      }
    } else {
      file = args[i];
    }
  }
  if (!file) {
    console.error('usage: egress-report.mjs <egress-log.jsonl> [--task-hosts a.com,b.org]');
    return 2;
  }
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`egress-report: cannot read ${file}: ${error.message}`);
    return 2;
  }
  const result = summarizeEgress(text.split(/\r?\n/), taskHosts);
  console.log(JSON.stringify(result, null, 2));
  if (result.malformed > 0) {
    console.error(`egress-report: ${result.malformed} malformed log line(s); the log cannot be trusted`);
    return 1;
  }
  if (result.entries === 0) {
    console.error('egress-report: no egress recorded: was COUNTERSIGN_EGRESS_LOG set?');
    return 1;
  }
  return result.blocked.length > 0 || result.unexpected.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv);
}
