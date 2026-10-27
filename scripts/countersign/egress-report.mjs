/**
 * Egress report: reads the JSON-lines file written when COUNTERSIGN_EGRESS_LOG
 * is set and sorts every host the app contacted into allowed, blocked and
 * unexpected. Exits 1 when any host is blocked or unexpected.
 *
 * Usage: node scripts/countersign/egress-report.mjs <egress-log.jsonl> [--task-hosts a.com,b.org]
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
 * @param {string[]} lines JSON log lines `{host, blocked, ...}`; blank or malformed lines are skipped.
 * @param {string[]} [taskHosts] hosts the task itself was asked to reach.
 * @returns {{allowed: string[], blocked: string[], unexpected: string[]}}
 */
export function summarizeEgress(lines, taskHosts = []) {
  const allowList = [...ALLOWED_HOSTS, ...taskHosts.map((h) => h.trim().toLowerCase()).filter(Boolean)];
  const allowed = new Set();
  const blocked = new Set();
  const unexpected = new Set();
  for (const raw of lines) {
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!entry || typeof entry.host !== 'string' || entry.host === '') continue;
    const host = entry.host.toLowerCase().replace(/\.$/, '');
    if (entry.blocked === true) blocked.add(host);
    else if (matchesHost(host, allowList)) allowed.add(host);
    else unexpected.add(host);
  }
  return {
    allowed: [...allowed].sort(),
    blocked: [...blocked].sort(),
    unexpected: [...unexpected].sort(),
  };
}

function main(argv) {
  const args = argv.slice(2);
  let file = null;
  let taskHosts = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--task-hosts') {
      taskHosts = (args[(i += 1)] ?? '').split(',');
    } else {
      file = args[i];
    }
  }
  if (!file) {
    console.error('usage: egress-report.mjs <egress-log.jsonl> [--task-hosts a.com,b.org]');
    return 2;
  }
  const result = summarizeEgress(fs.readFileSync(file, 'utf8').split(/\r?\n/), taskHosts);
  console.log(JSON.stringify(result, null, 2));
  return result.blocked.length > 0 || result.unexpected.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv);
}
