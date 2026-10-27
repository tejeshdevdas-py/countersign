/**
 * Brand guard: fails when the product's old name appears in text a user sees.
 *
 * Scans (1) the decoded string values of the desktop locale JSON files,
 * (2) literal window, dialog and notification titles in desktop .ts/.tsx source,
 * and (3) the prose of the in-app help sources (apps/desktop/help-knowledge/*.md,
 * outside code spans, code fences and link targets). Code identifiers and
 * internal log text may keep the old name and are not scanned.
 * LICENSE, NOTICE, docs/legal, FORK-CHANGES.md, docs/countersign and generated
 * files are exempt.
 *
 * In renderer source it also scans (4) literal `name`, `alt` and `aria-label`
 * values (theme names, image alt text, teammate names) and (5) imports of the
 * known Cindy artwork files, whose pixels a text scan cannot read. It also
 * fails on (6) any shipped image or video file whose name contains "cindy"
 * (renderer assets and resources), apart from a short exempt list with reasons.
 *
 * Text sent to the engines is user-visible too, because a model repeats it:
 * (7) prompt template files (host/system prompts, MCP prompt rules, built-in
 * Skills, teammate packages, headless profiles) are scanned line by line, and
 * (8) every string literal in a listed set of TS prompt and tool-description
 * modules is scanned. Exemptions there carry their reason (PROMPT_EXEMPT).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The old name, also as a plural ("Cindys") and in capitals ("CINDY"). Tested on decoded text.
const OLD_NAME = /\b(?:Cindys?|CINDYS?)\b/;
const LOCALE_PATH = /^apps\/desktop\/src\/renderer\/i18n\/locales\/.+\.json$/;
const HELP_PATH = /^apps\/desktop\/help-knowledge\/[^/]+\.md$/;
const SOURCE_PATH = /^apps\/desktop\/src\/(?!.*(?:__tests__\/|\.test\.tsx?$)).+\.tsx?$/;
const RENDERER_PATH = /^apps\/desktop\/src\/renderer\//;
const EXEMPT = [
  /\.generated\.tsx?$/,
  /^LICENSE$/,
  /^NOTICE$/,
  /^docs\/legal\//,
  /^FORK-CHANGES\.md$/,
  /^docs\/countersign\//,
];

// A JSON line carrying a string value: `"key": "value"` or an array item `"value"`.
const JSON_VALUE = /^\s*(?:"(?:[^"\x5c]|\x5c.)*"\s*:\s*)?("(?:[^"\x5c]|\x5c.)*")\s*,?\s*$/;
// `title: '...'`, `title="..."`, `title={'...'}` and similar literal titles.
const TITLE_LITERAL = /\btitle\s*[:=]\s*\{?\s*(['"`])(.*?)\1/g;
// Renderer only: `name: '...'`, `alt="..."`, `aria-label="..."` and similar literals.
const LABEL_LITERAL = /(?:\bname|\balt|\baria-label)\s*[:=]\s*\{?\s*(['"`])(.*?)\1/g;
// Upstream's Cindy artwork: wordmarks, the lockup head image and the default teammate portrait.
const CINDY_ARTWORK_IMPORT =
  /\bfrom\s+['"][^'"]*(?:\/cindy-[^'"/]*\.(?:png|jpe?g|webp|gif|svg|mp4|webm)|\/logo-(?:light|dark)\.png|head-image-[a-z]+\.png|bot-presets\/cindy\.png)(?:\?[^'"]*)?['"]/;

function normalize(p) {
  return p.replace(/\x5c/g, '/');
}

function decodeJsonString(token) {
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
}

/** Help prose without inline code spans and link targets. */
function helpProse(line) {
  return line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
}

// Image and video files shipped with the desktop app (renderer assets, resources).
const SHIPPED_ASSET_PATH =
  /^apps\/desktop\/(?:src\/renderer\/assets|resources)\/.+\.(?:png|jpe?g|webp|gif|svg|mp4|webm|ico|icns)$/i;
// Cindy-named artwork that stays, with the reason. Everything else named "cindy" fails.
const ASSET_NAME_EXEMPT = new Map([
  ['apps/desktop/src/renderer/assets/bot-presets/cindy.png', 'test fixture and mobile app path; the desktop no longer imports it'],
  ['apps/desktop/src/renderer/assets/agent-island-cindy.png', 'macOS-only agent-island skin'],
]);

/** Shipped image/video files whose own file name carries the old name. */
export function findBrandAssetNames(paths) {
  return paths
    .map(normalize)
    .filter((p) => SHIPPED_ASSET_PATH.test(p) && !p.includes('/agent-bin/'))
    .filter((p) => /cindy/i.test(p.slice(p.lastIndexOf('/') + 1)) && !ASSET_NAME_EXEMPT.has(p))
    .map((p) => ({ path: p, line: 0, match: p.slice(p.lastIndexOf('/') + 1) }));
}

export function findBrandLeaks(files) {
  const leaks = [];
  for (const file of files) {
    const filePath = normalize(file.path);
    if (EXEMPT.some((re) => re.test(filePath))) {
      continue;
    }
    const isLocale = LOCALE_PATH.test(filePath);
    const isHelp = HELP_PATH.test(filePath);
    const isSource = SOURCE_PATH.test(filePath);
    if (!isLocale && !isSource && !isHelp) {
      continue;
    }
    let inFence = false;
    const lines = file.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const candidates = [];
      if (isLocale) {
        const m = JSON_VALUE.exec(line);
        if (m) {
          candidates.push(decodeJsonString(m[1]));
        }
      } else if (isHelp) {
        if (/^\s*(```|~~~)/.test(line)) {
          inFence = !inFence;
        } else if (!inFence) {
          candidates.push(helpProse(line));
        }
      } else {
        for (const m of line.matchAll(TITLE_LITERAL)) {
          candidates.push(m[2]);
        }
        if (RENDERER_PATH.test(filePath)) {
          for (const m of line.matchAll(LABEL_LITERAL)) {
            candidates.push(m[2]);
          }
          const artwork = CINDY_ARTWORK_IMPORT.exec(line);
          if (artwork) {
            leaks.push({ path: file.path, line: index + 1, match: artwork[0] });
          }
        }
      }
      for (const candidate of candidates) {
        const hit = OLD_NAME.exec(candidate);
        if (hit) {
          leaks.push({ path: file.path, line: index + 1, match: hit[0] });
        }
      }
    });
  }
  return leaks;
}

function collectPaths(root, dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'agent-bin') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPaths(root, full, out);
    } else {
      out.push(normalize(path.relative(root, full)));
    }
  }
}

function collect(root, dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(root, full, out);
      continue;
    }
    const rel = normalize(path.relative(root, full));
    if (LOCALE_PATH.test(rel) || SOURCE_PATH.test(rel) || HELP_PATH.test(rel)) {
      out.push({ path: rel, text: fs.readFileSync(full, 'utf8') });
    }
  }
}

// ---------------------------------------------------------------------------
// (7) Prompt templates and (8) prompt sources: text Countersign sends to the
// engines (Claude Code, Codex, Pi) as system/developer instructions, skills,
// tool descriptions or tool guidance. A model repeats what it reads, so the old
// name here reaches the user. MCP server and tool ids (cindy_helper,
// cindy_memory, ...) are lower-case identifiers and do not match OLD_NAME.
// ---------------------------------------------------------------------------

// Whole files whose every line is prompt text.
const PROMPT_TEMPLATE_PATHS = [
  // Host, business-ownership and skill-precedence prompts (Claude/Codex/Pi system prompt).
  /^apps\/desktop\/src\/main\/maker-host\/[^/]+-prompt\.md$/,
  // maker-core memory / contacts system prompts and the engine append prompts.
  /^packages\/maker-core\/src\/.+\/system-prompt[^/]*\.md$/,
  // MCP tool and rule prompts (browser workflow, Slack, Feishu).
  /^packages\/lizi-mcps\/src\/(?:.+\/)?prompts\/.+\.md$/,
  // Built-in Skills the engines load (SKILL.md, references, Codex agent yaml).
  /^apps\/desktop\/resources\/system-skills\/.+\.(?:md|ya?ml)$/,
  // Teammate packages: persona (manifest identitySource), skills and knowledge.
  /^apps\/desktop\/resources\/bot-packages\/.+\.(?:md|json)$/,
  // Headless profiles; a parity test keeps them equal to the desktop host prompt.
  /^apps\/cindy-headless\/profiles\/[^/]+\/prompt\.md$/,
];

// TS modules whose string literals are all model-facing (prompts, tool
// descriptions, tool guidance). Comments and identifiers are not checked.
// Files that also carry non-prompt strings with the old name (for example
// codex/index.ts error text) are not listed; see FORK-CHANGES.md.
export const PROMPT_SOURCE_FILES = [
  'apps/desktop/src/main/agent-app-update/agentAppUpdateService.ts',
  'apps/desktop/src/main/cindy-make/mcpProvider.ts',
  'apps/desktop/src/main/cindy-media/customVideoProtocol.ts',
  'apps/desktop/src/main/hook-control/outbound.ts',
  'apps/desktop/src/main/im/shared/inboundMessage.ts',
  'apps/desktop/src/main/maker-host/auto-permission-reviewer.ts',
  'apps/desktop/src/main/maker-host/capability-routing.ts',
  'apps/desktop/src/main/maker-host/codex-smart-subagent-routing.ts',
  'apps/desktop/src/main/maker-host/harnessMcpCatalog.ts',
  'apps/desktop/src/main/maker-ipc/agentHandoff.ts',
  'apps/desktop/src/main/maker-ipc/botCapabilityService.ts',
  'apps/desktop/src/main/maker-ipc/botDirectMessageService.ts',
  'apps/desktop/src/main/maker-ipc/botGroupChatService.ts',
  'apps/desktop/src/main/maker-ipc/botGroupDivision.ts',
  'apps/desktop/src/main/maker-ipc/botProfileRuntime.ts',
  'apps/desktop/src/main/maker-ipc/botSkillStore.ts',
  'apps/desktop/src/main/maker-ipc/botSystemPrompt.ts',
  'apps/desktop/src/main/maker-ipc/botWorkbenchTools.ts',
  'apps/desktop/src/main/maker-ipc/chatServer.ts',
  'apps/desktop/src/main/maker-ipc/teammateGuide.ts',
  'apps/desktop/src/main/maker-ipc/workingDirectoryRecovery.ts',
  'apps/desktop/src/main/mcp-integrations/codexHttpBridge.ts',
  'apps/desktop/src/main/mcp-integrations/createProject.ts',
  'apps/desktop/src/main/mcp-integrations/mcp-providers.ts',
  'apps/desktop/src/main/plugin-market/agentTools.ts',
  'apps/desktop/src/main/reviewer/reviewPrompt.ts',
  'apps/desktop/src/main/scheduler-host/script-capability-broker.ts',
  'apps/desktop/src/main/skillhub/agentTools.ts',
  'apps/desktop/src/renderer/cindy-brain/hostCapabilityInvocation.ts',
  'apps/desktop/src/shared/botProfileDefaults.ts',
  'apps/desktop/src/shared/cindyBuiltInSkills.ts',
  'packages/cindy-tools/src/ghost/mcpServer.ts',
  'packages/lizi-mcps/src/browser/tools.ts',
  'packages/lizi-mcps/src/cindy-docs/read_sheet.ts',
  'packages/lizi-mcps/src/cindy-docs/render_pdf.ts',
  'packages/lizi-mcps/src/cindy_feishuBotMcpServer.ts',
  'packages/lizi-mcps/src/cindy_sshMcpServer.ts',
  'packages/lizi-mcps/src/computer/server.ts',
  'packages/lizi-mcps/src/computer/tools.ts',
  'packages/lizi-mcps/src/lizi_xdtHelperMcpServer.ts',
  'packages/lizi-mcps/src/memory/sessionSearch.ts',
  'packages/lizi-mcps/src/ssh/_shared.ts',
  'packages/lizi-mcps/src/xdt-helper/app_update.ts',
  'packages/lizi-mcps/src/xdt-helper/ask_user_question_async.ts',
  'packages/lizi-mcps/src/xdt-helper/bot_workbench.ts',
  'packages/lizi-mcps/src/xdt-helper/capabilities.ts',
  'packages/lizi-mcps/src/xdt-helper/create_project.ts',
  'packages/lizi-mcps/src/xdt-helper/create_teammate.ts',
  'packages/lizi-mcps/src/xdt-helper/grok_login.ts',
  'packages/lizi-mcps/src/xdt-helper/input_handoff.ts',
  'packages/lizi-mcps/src/xdt-helper/move_session.ts',
  'packages/lizi-mcps/src/xdt-helper/project_management.ts',
  'packages/lizi-mcps/src/xdt-helper/session_tags.ts',
  'packages/lizi-mcps/src/xdt-helper/skillhub.ts',
  'packages/lizi-mcps/src/xdt-helper/start_skill_learning.ts',
  'packages/lizi-mcps/src/xdt-helper/submit_github_issue.ts',
  'packages/maker-core/src/agents/claude-code/auto-review-policy.ts',
  'packages/maker-core/src/agents/claude-code/capability-routing.ts',
  'packages/maker-core/src/agents/codex/harness-hooks.ts',
  'packages/maker-core/src/agents/codex/sandbox-init-failure.ts',
  'packages/maker-core/src/agents/pi/cindy-bridge-source.ts',
  'packages/maker-core/src/agents/pi/cindy-subagent-source.ts',
  'packages/maker-core/src/agents/pi/managed-command.ts',
  'packages/maker-core/src/agents/shared/auto-review-decision.ts',
  'packages/maker-shared/src/agentInputProjection.ts',
  'packages/maker-shared/src/richAnswerGuide.ts',
  'packages/voice-input-core/src/DictationRefiner.ts',
];

// Old-name text that stays in prompt files, each with its reason.
const PROMPT_EXEMPT = [
  {
    path: 'packages/lizi-mcps/src/browser/prompts/rules/browser-workflow.md',
    token: /"Cindy"|`Cindy`/g,
    reason: 'names the on-disk managed browser profile (MANAGED_PROFILE), which brandIdentity pins',
  },
];
// CDP method ids of the in-app browser bridge ('Cindy.begin', 'Cindy.end'): protocol, not prose.
const PROMPT_LITERAL_EXEMPT = /^Cindy\.\w+$/;

export function isPromptTemplatePath(p) {
  return PROMPT_TEMPLATE_PATHS.some((re) => re.test(normalize(p)));
}

let typescript;
function loadTypeScript() {
  if (!typescript) {
    // typescript is a declared dependency of apps/desktop; resolve it from there.
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    typescript = createRequire(path.join(root, 'apps', 'desktop', 'package.json'))('typescript');
  }
  return typescript;
}

/** String literals (and template literal parts) in TS source, with their line. */
function stringLiterals(filePath, text) {
  const ts = loadTypeScript();
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const out = [];
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      out.push({ text: node.text, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

export function findPromptLeaks(files, sourceFiles = PROMPT_SOURCE_FILES) {
  const leaks = [];
  const sources = new Set(sourceFiles.map(normalize));
  for (const file of files) {
    const filePath = normalize(file.path);
    if (isPromptTemplatePath(filePath)) {
      const exempt = PROMPT_EXEMPT.filter((e) => e.path === filePath);
      file.text.split(/\r?\n/).forEach((line, index) => {
        const checked = exempt.reduce((acc, e) => acc.replace(e.token, ''), line);
        const hit = OLD_NAME.exec(checked);
        if (hit) {
          leaks.push({ path: file.path, line: index + 1, match: hit[0] });
        }
      });
    } else if (sources.has(filePath)) {
      for (const literal of stringLiterals(filePath, file.text)) {
        if (PROMPT_LITERAL_EXEMPT.test(literal.text)) continue;
        const hit = OLD_NAME.exec(literal.text);
        if (hit) {
          leaks.push({ path: file.path, line: literal.line, match: hit[0] });
        }
      }
    }
  }
  return leaks;
}

function collectPromptFiles(root) {
  const out = [];
  const roots = [
    'apps/desktop/src/main/maker-host',
    'packages/maker-core/src',
    'packages/lizi-mcps/src',
    'apps/desktop/resources/system-skills',
    'apps/desktop/resources/bot-packages',
    'apps/cindy-headless/profiles',
  ];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const rel = normalize(path.relative(root, full));
        if (isPromptTemplatePath(rel)) out.push({ path: rel, text: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  for (const r of roots) walk(path.join(root, r));
  for (const rel of PROMPT_SOURCE_FILES) {
    // A listed file that moved or vanished must fail loudly, not silently drop coverage.
    out.push({ path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') });
  }
  return out;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = [];
  collect(root, path.join(root, 'apps', 'desktop', 'src'), files);
  collect(root, path.join(root, 'apps', 'desktop', 'help-knowledge'), files);
  const assetPaths = [];
  collectPaths(root, path.join(root, 'apps', 'desktop', 'src', 'renderer', 'assets'), assetPaths);
  collectPaths(root, path.join(root, 'apps', 'desktop', 'resources'), assetPaths);
  const promptFiles = collectPromptFiles(root);
  const leaks = [...findBrandLeaks(files), ...findBrandAssetNames(assetPaths)];
  const promptLeaks = findPromptLeaks(promptFiles);
  for (const leak of leaks) {
    console.error(`${leak.path}:${leak.line}: user-visible "${leak.match}"`);
  }
  for (const leak of promptLeaks) {
    console.error(`${leak.path}:${leak.line}: model-visible "${leak.match}" in prompt text`);
  }
  const total = leaks.length + promptLeaks.length;
  if (total > 0) {
    console.error(`brand guard: ${total} leak(s)`);
    process.exit(1);
  }
  console.log(`brand guard: ok (${files.length} files and ${promptFiles.length} prompt files scanned)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
