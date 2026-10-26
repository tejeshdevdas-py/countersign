# Countersign M1 "Runs and is yours" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A renamed fork of Cindy that builds on Windows, starts with no account and no network, runs agents on Claude Code, Codex and a local model, and contacts no Cindy or analytics host.

**Architecture:** One shared switch, `LOCAL_ONLY`, in `packages/maker-shared`; a main-process registry that says which upstream background services must not start; a fail-closed endpoint layer that never fetches the Cindy manifest; and an egress guard that blocks and logs any request to a Cindy, analytics or log-sink host as a second line of defence. Branding changes go through the existing brand constants so upstream merges stay small. Every core edit is listed in `FORK-CHANGES.md`.

**Tech Stack:** Electron Forge (NSIS maker), TypeScript, React renderer, vitest, pnpm 10.33.2, Node 22.22.3.

**Spec:** `docs/countersign/2026-10-26-countersign-design.md`.

**Base:** `makecindy/cindy` main at `0f70b883436cbc31b6f9338c6a304e18a3d72bb6`. All line numbers below are at that commit; re-locate by symbol if they drift.

## Global Constraints

- Product name `Countersign`; repository `github.com/tejeshdevdas-py/countersign`, a public GitHub fork of `makecindy/cindy`.
- Keep `LICENSE`, `NOTICE` ("Cindy, Copyright 2026 XD Inc.") and `docs/legal/notices/`; add a NOTICE line that Countersign is a modified version.
- No Cindy name or logo in anything a user sees; code identifiers and internal log text may keep "cindy" to keep merges small.
- No outbound request to `*.cindy.app`, `*.cindy.com.cn`, TapDB (`*.tapdb.com`, `*.tapapis.com`) or `*.log.aliyuncs.com`.
- Never edit existing `apps/desktop/drizzle/*.sql` migrations (upstream `db:validate` baselines); M1 adds none.
- No employer, customer, personal-machine path, email (other than the owner's public GitHub identity) or key in any committed file. Machine-specific scrub patterns live only in the git-ignored `.scrub-patterns`.
- Every core edit gets one line in `FORK-CHANGES.md`: file, what changed, why.
- Commit locally after each task. Pushing to GitHub needs the owner's explicit approval each time.
- Windows is the only platform built and tested.

## Review Focus

1. **A profile that was signed in to Cindy cloud mode** (persisted `activeMode: 'cloud'`): must start in local mode, not show a login screen or call the auth server. Test in Task 3.
2. **Real Cindy installed on the same machine:** Countersign must not share its app id, executable, user-data folder or `cindy://` deep links. Test in Task 1.
3. **No network at all at start-up:** the app must launch; today `initClientEndpoints()` blocks and exits after a failed manifest fetch. Test in Task 4.
4. **A screen left over from a cloud feature** (plugin market, provider sharing, voice, SkillHub): must show "Not available in Countersign" instead of hanging or crashing. Test in Task 4.
5. **No `claude` or `codex` CLI available:** the engine must report how to install it, never try the Cindy CDN. Test in Task 6.

---

### Task 0: Fork, clone and baseline

**Files:**
- Create: `docs/countersign/2026-10-26-countersign-design.md` (copy of the spec)
- Create: `docs/countersign/2026-10-26-countersign-m1-runs-and-yours.md` (this plan)
- Create: `FORK-CHANGES.md`
- Modify: `.gitignore` (add `.scrub-patterns`, `egress-log.jsonl`)

- [ ] **Step 1: Owner forks on GitHub.** The owner opens `https://github.com/makecindy/cindy/fork`, keeps the owner `tejeshdevdas-py`, names it `countersign` and leaves the other options at their defaults. Claude does not do this step.
- [ ] **Step 2: Check toolchain.** Run `node --version`, `pnpm --version`, `git lfs version`. Expected: `v22.x` (≥22.12), `10.x` (≥10.7 <11), a git-lfs version. Visual Studio C++ build tools and Python must be present for native modules (better-sqlite3, node-pty, sharp). Rust/cargo is **not** needed after Task 5.
- [ ] **Step 3: Clone and pin.** In the owner's workspace folder: `git clone https://github.com/tejeshdevdas-py/countersign.git`, then `git remote add upstream https://github.com/makecindy/cindy.git`, `git lfs pull`, `git switch -c countersign-m1 0f70b883436cbc31b6f9338c6a304e18a3d72bb6`.
- [ ] **Step 4: Baseline install and tests.** `pnpm install` then `pnpm --filter desktop test`. Record pass/fail counts in `FORK-CHANGES.md` under "Baseline at 0f70b88". Failures here are upstream's and are not fixed in M1; they are the reference for later tasks.
- [ ] **Step 5: Add the documents and `FORK-CHANGES.md`** (header: purpose, base commit, one table `| File | Change | Why |`). Add `.scrub-patterns` and `egress-log.jsonl` to `.gitignore`.
- [ ] **Step 6: Commit** `git commit -m "Countersign: design, M1 plan, fork change log"`.

### Task 1: Brand identity

**Files:**
- Modify: `packages/maker-shared/src/branding.ts:18`
- Modify: `packages/maker-shared/src/brandIdentity.ts:149-187`
- Modify: `apps/desktop/forge.config.ts` (l.92-108 identity, l.1687-1760 NSIS maker, l.1800-1822 packager, deb maker `maintainer`)
- Modify: `apps/desktop/package.json` (`productName`, `author`)
- Replace: `apps/desktop/resources/icon.ico`, `icon.png`, `icon-master-1024.png`, `icon-dock.png`, `icon.icns`
- Test: `packages/maker-shared/src/__tests__/countersignBrand.test.ts`

**Interfaces:**
- Produces: `BRAND_NAME === 'Countersign'`; `BRAND_IDENTITY` values below; later tasks read the name only through `BRAND_NAME`.

- [ ] **Step 1: Write the failing test** `countersignBrand.test.ts`:
  - `expect(BRAND_NAME).toBe('Countersign')`
  - for every region key in `BRAND_IDENTITY.appIdByRegion`: value starts with `io.github.tejeshdevdas-py.countersign`
  - every value of `executableNameByRegion` matches `/^Countersign(Dev)?$/`
  - every user-data dir name from `BRAND_IDENTITY` contains `Countersign` and none contains `Cindy`
  - `allDeepLinkSchemes()` equals `['countersign']` (no `cindy`, no `xdt-maker`)
- [ ] **Step 2: Run** `pnpm --filter @cindy/maker-shared exec vitest run src/__tests__/countersignBrand.test.ts` (use the package's real name from its `package.json`). Expected: FAIL.
- [ ] **Step 3: Implement.** `BRAND_NAME = 'Countersign'`. In `BRAND_IDENTITY`: app ids `io.github.tejeshdevdas-py.countersign` (global and cn) and `io.github.tejeshdevdas-py.countersign.dev` (dev); executables `Countersign` / `CountersignDev`; user-data dirs `Countersign` / `CountersignDev`; `primaryScheme: 'countersign'`, `legacySchemes: []`; `dbFilePrefix: 'countersign'`. Mirror the same values in `forge.config.ts` (`productName`, `win32metadata.ProductName`, NSIS `appId`/`productName`/`shortcutName`, protocol name "Countersign Deep Link"), `package.json` (`productName: "Countersign"`, `author: "Countersign contributors"`), deb `maintainer: "Countersign contributors"`. Icons: a simple original mark (builder's choice), exported to the five files at the sizes of the files they replace.
- [ ] **Step 4: Run** the test again. Expected: PASS. Then `pnpm --filter desktop typecheck`. Expected: no new errors versus baseline.
- [ ] **Step 5: Log** each modified file in `FORK-CHANGES.md` and **commit** `"Countersign: brand identity, app id, deep link, icons"`.

### Task 2: User-visible text and the brand guard

**Files:**
- Create: `scripts/countersign/rebrand-locales.mjs`
- Create: `scripts/countersign/brand-guard.mjs`
- Modify: `apps/desktop/src/renderer/i18n/locales/{en,ja,ko,zh-CN,zh-TW}/{common,aiRename}.json`
- Modify: root `package.json` (script `check:countersign-brand`)
- Test: `scripts/countersign/__tests__/brand-guard.test.mjs` (run with the repo's `test:runner`; if the runner only picks up a fixed folder, place it there)

**Interfaces:**
- Produces: `findBrandLeaks(files: {path: string, text: string}[]): {path: string, line: number, match: string}[]`, exported from `brand-guard.mjs`; CLI exits 1 when it returns any leak.

- [ ] **Step 1: Write the failing test:**
  - a locale JSON value `"Open Cindy settings"` → one leak at that line
  - `"Open {{appName}} settings"` → no leak
  - `LICENSE`, `NOTICE`, `docs/legal/**`, `FORK-CHANGES.md` and `docs/countersign/**` are never scanned
  - a `.ts` file under `apps/desktop/src` with `title: 'Cindy'` → one leak; with `const cindyDir = …` (identifier) → no leak
- [ ] **Step 2: Run it.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `findBrandLeaks`.** Scan: `apps/desktop/src/renderer/i18n/locales/**/*.json` (every string value) and, in `.ts/.tsx` under `apps/desktop/src`, only string literals that are window titles, dialog titles or notification titles (match `title:` / `title=` followed by a literal containing `\bCindy\b`). Pattern: `/\bCindy\b/` case-sensitive.
- [ ] **Step 4: Implement `rebrand-locales.mjs`:** in every locale JSON string value replace `\bCindy\b` with `{{appName}}`; leave keys unchanged; write files with the original formatting (2-space JSON, trailing newline). `{{appName}}` is already filled from `BRAND_NAME` at `apps/desktop/src/renderer/i18n/index.ts:110`; confirm it is a global interpolation default, and if it is per-call only, make it global there (one core edit, logged).
- [ ] **Step 5: Run** `node scripts/countersign/rebrand-locales.mjs`, then the guard test (PASS), then `node scripts/countersign/brand-guard.mjs` on the repo (exit 0), then `pnpm check:i18n` and `pnpm check:i18n-glossary`. Expected: all pass; fix glossary rules only if a rule keys on the literal "Cindy".
- [ ] **Step 6: Fix the remaining literal titles** the guard reports (`bootstrap-electron.ts:3973`, `secondary-windows.ts:148`, `right-sidebar-window/window.ts:81` already use `BRAND_NAME`; others it finds) to use `BRAND_NAME`. Re-run the guard: exit 0.
- [ ] **Step 7: Add** `"check:countersign-brand": "node scripts/countersign/brand-guard.mjs"` to root `package.json`, log, **commit** `"Countersign: rebrand user-visible text, add brand guard"`.

### Task 3: Start in local mode, no sign-in

**Files:**
- Create: `packages/maker-shared/src/localOnly.ts`
- Modify: `packages/maker-shared/src/index.ts` (export)
- Modify: `apps/desktop/src/main/appSessionState.ts:106-118`
- Modify: `apps/desktop/src/main/authManager.ts` (sign-in entry points near l.4199 and l.4557)
- Modify: `apps/desktop/src/renderer/hooks/useSignInToCindy.ts`, `apps/desktop/src/renderer/components/settings/UserProfileCard.tsx:68`
- Test: `apps/desktop/src/main/__tests__/countersignLocalMode.test.ts`

**Interfaces:**
- Produces: `export const LOCAL_ONLY = true as const` in `localOnly.ts`; `export class LocalOnlyError extends Error { constructor(feature: string) }` with message `` `${feature} is not available in Countersign: it needs Cindy's cloud service.` ``.

- [ ] **Step 1: Write the failing test** (`countersignLocalMode.test.ts`), using the existing test helpers for `appSessionState` (copy the setup from its current tests):
  - fresh profile: `ensureLoaded()` → mode `'local'`
  - persisted `activeMode: 'cloud'` → mode `'local'`
  - `authManager` cloud sign-in start (the method the login page calls for cloud sign-in) rejects with `LocalOnlyError`
  - `authManager.initialize()` performs no fetch (stub global `fetch` and assert zero calls)
- [ ] **Step 2: Run** `pnpm --filter desktop exec vitest run src/main/__tests__/countersignLocalMode.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `ensureLoaded()` set `initialMode = LOCAL_ONLY ? 'local' : <upstream expression>`; persist `'local'`. In `authManager`, the cloud sign-in entry points throw `new LocalOnlyError('Sign-in')` when `LOCAL_ONLY`. In the renderer, `useSignInToCindy` returns a hidden/no-op action and `UserProfileCard` renders no sign-in button when `LOCAL_ONLY`.
- [ ] **Step 4: Run** the test (PASS) and `pnpm --filter desktop test` (no new failures versus baseline).
- [ ] **Step 5: Log and commit** `"Countersign: always local mode, no sign-in"`.

### Task 4: Endpoints fail closed, offline start, egress guard

**Files:**
- Modify: `apps/desktop/src/main/clientEndpointsService.ts` (`resolveEndpointSource()` l.155, `initClientEndpoints()` l.993, `getClientEndpoint`)
- Create: `apps/desktop/src/main/countersign/egressGuard.ts`
- Modify: `apps/desktop/src/main/bootstrap-electron.ts` (install the guard before `initClientEndpoints()` at l.9189)
- Modify: renderer entry points of removed features to show the `LocalOnlyError` message (plugin market, provider sharing, SkillHub, voice, mobile download dialog, GitHub issue proxy)
- Test: `apps/desktop/src/main/__tests__/countersignEndpoints.test.ts`, `apps/desktop/src/main/countersign/__tests__/egressGuard.test.ts`

**Interfaces:**
- Consumes: `LOCAL_ONLY`, `LocalOnlyError` (Task 3).
- Produces: `getClientEndpoint(key)` throws `LocalOnlyError(<feature for key>)` for every key when `LOCAL_ONLY`; `isBlockedHost(host: string): boolean`; `installEgressGuard(opts: {logFile: string | null}): void`.

- [ ] **Step 1: Write the failing tests.**
  - `countersignEndpoints.test.ts`: with global `fetch` stubbed to throw, `await initClientEndpoints()` resolves (no retry dialog, no `app.exit`) and `fetch` was called 0 times; `getClientEndpoint('pluginApiBaseUrl')` throws `LocalOnlyError` whose message contains `not available in Countersign`.
  - `egressGuard.test.ts`: `isBlockedHost` is true for `auth.cindy.app`, `cindy.app`, `x.cindy.com.cn`, `e.tapdb.com`, `e.tapdb.ap-sg.tapapis.com`, `p.cn-hangzhou.log.aliyuncs.com`, `hotfix.cindy.app`; false for `api.anthropic.com`, `claude.ai`, `chatgpt.com`, `api.openai.com`, `auth.openai.com`, `127.0.0.1`, `localhost`, `github.com`.
- [ ] **Step 2: Run both.** Expected: FAIL.
- [ ] **Step 3: Implement endpoints.** When `LOCAL_ONLY`, `resolveEndpointSource()` returns a new `{kind: 'disabled'}`; `initClientEndpoints()` returns immediately for it; `getClientEndpoint` throws `LocalOnlyError` with a feature name from a key→feature map (e.g. `pluginApiBaseUrl`→`Plugin market`, `deviceLinkApiBaseUrl`→`Phone link and sharing`, `voiceApiBaseUrl`→`Cloud voice`, `modelAccessApiBaseUrl`→`Cindy model service`).
- [ ] **Step 4: Implement the guard.** `isBlockedHost`: suffix match on `cindy.app`, `cindy.com.cn`, `tapdb.com`, `tapapis.com`, `log.aliyuncs.com`. `installEgressGuard`: on `session.defaultSession.webRequest.onBeforeRequest` and on every partition the app creates, cancel blocked hosts; wrap main-process `globalThis.fetch`, `net.request`, `https.request` and `http.request` to throw `LocalOnlyError('Network access to <host>')` for blocked hosts; append `{time, host, url, blocked}` JSON lines for every outbound host (blocked or not) to `logFile` when set (`COUNTERSIGN_EGRESS_LOG` env var gives the path; unset means no log).
- [ ] **Step 5: Run** both tests (PASS) and the full desktop suite (no new failures; update upstream tests that asserted the CDN path only by guarding them with `LOCAL_ONLY` skips, each listed in `FORK-CHANGES.md`).
- [ ] **Step 6: Renderer fallbacks.** Where a removed feature's screen calls an IPC that now throws `LocalOnlyError`, show its message in the existing error/empty-state component. Manually open each listed screen in `pnpm dev:desktop`: each shows the message, none hangs.
- [ ] **Step 7: Log and commit** `"Countersign: endpoints fail closed, offline start, egress guard"`.

### Task 5: Background services off: analytics, heartbeat, log upload, updater

**Files:**
- Create: `apps/desktop/src/main/countersign/services.ts`
- Modify: `apps/desktop/src/main/analytics-settings-store.ts:254` (`isReportingBuild`)
- Modify: `apps/desktop/src/renderer/main-entry.tsx:223` (`initTapdb` call)
- Modify: `apps/desktop/src/main/bootstrap-electron.ts:9900-9923` (`initAnalyticsSettingsService`, `initLogUploadService`, `initUpdateService`, `initHeartbeatService`) and the agent-binary start-up update call
- Modify: `apps/desktop/forge.config.ts` (`buildCindyUpdater()` l.469 and its pre-package call l.1973; extra resource l.821)
- Modify: `apps/desktop/scripts/package-desktop.mjs:50` (no hard requirement on `config/log-upload.json`)
- Test: `apps/desktop/src/main/countersign/__tests__/services.test.ts`

**Interfaces:**
- Produces: `type UpstreamService = 'analytics' | 'heartbeat' | 'logUpload' | 'updater' | 'agentBinaryUpdate'`; `isServiceDisabled(name: UpstreamService): boolean` (true for all when `LOCAL_ONLY`).

- [ ] **Step 1: Write the failing test:** `isServiceDisabled` is true for each of the five names; `isReportingBuild()` is false even when `app.isPackaged` is mocked true.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `services.ts`; make `isReportingBuild()` return false when `LOCAL_ONLY`; guard each of the four `init*` calls and the agent-binary update with `isServiceDisabled`; guard `initTapdb()` in `main-entry.tsx` with `LOCAL_ONLY`; in `forge.config.ts` skip `buildCindyUpdater()` and drop the `cindy-updater.exe` extra resource when `LOCAL_ONLY`; in `package-desktop.mjs` treat a missing `config/log-upload.json` as "log upload off".
- [ ] **Step 4: Run** the test (PASS) and the full desktop suite (no new failures).
- [ ] **Step 5: Log and commit** `"Countersign: analytics, heartbeat, log upload and updater off"`.

### Task 6: Engines without the Cindy CDN

**Files:**
- Modify: `apps/desktop/src/main/agent-binaries/index.ts` (`prepare()` l.349, `isVettedAgentBinaryPath()` l.273)
- Modify: `apps/desktop/forge.config.ts` (ship `claude`, `codex`, `rg` and `pi` binaries from `apps/*-bin` as extra resources)
- Create: `apps/desktop/src/main/countersign/cliResolver.ts`
- Test: `apps/desktop/src/main/countersign/__tests__/cliResolver.test.ts`

**Interfaces:**
- Produces: `resolveAgentBinary(engine: 'claude' | 'codex' | 'rg' | 'pi', deps: {bundledDir: string, which: (cmd: string) => string | null, exists: (p: string) => boolean}): {path: string, source: 'bundled' | 'path'} | {error: string}`.

- [ ] **Step 1: Write the failing test:**
  - bundled file exists → `{source: 'bundled'}` with the bundled path
  - no bundled file, `which('claude')` returns a path → `{source: 'path'}`
  - neither → `{error}` whose text names the engine and says to install it (`claude` → mentions "Claude Code", `codex` → "Codex CLI")
  - the resolver never calls anything network-related (deps have no fetch; assert the returned object for all four engines)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `resolveAgentBinary` (bundled first, then PATH via `where.exe` on Windows, else error). In `prepare()`, when `LOCAL_ONLY` and packaged, use it instead of the CDN download; `isVettedAgentBinaryPath()` accepts exactly the path it returned. In `forge.config.ts` add the four binaries from `apps/claude-code-bin/win32-*`, `apps/codex-package-bin`, `apps/ripgrep-bin`, `apps/pi-bin` as extra resources (paths as created by `scripts/ensure-agent-binaries.mjs`).
- [ ] **Step 4: Run** the test (PASS) and the full desktop suite.
- [ ] **Step 5: Log and commit** `"Countersign: bundled or PATH agent binaries, no CDN"`.

### Task 7: Build, install and the M1 acceptance run

**Files:**
- Create: `scripts/countersign/egress-report.mjs`
- Create: `docs/countersign/m1-acceptance.md` (results)

**Interfaces:**
- Produces: `summarizeEgress(lines: string[]): {allowed: string[], blocked: string[], unexpected: string[]}` where `unexpected` = hosts not blocked and not in the allow-list `anthropic.com`, `claude.ai`, `claude.com`, `openai.com`, `chatgpt.com`, `127.0.0.1`, `localhost` plus hosts the task itself was asked to reach (passed as `--task-hosts`).

- [ ] **Step 1: Test** `summarizeEgress` with three log lines (one `api.anthropic.com`, one blocked `auth.cindy.app`, one `example.org`) → allowed has the first, blocked the second, unexpected the third.
- [ ] **Step 2: Implement** it; CLI reads `egress-log.jsonl` and exits 1 when `unexpected` or `blocked` is non-empty.
- [ ] **Step 3: Build the installer:** `pnpm release:package -- --platform win32 --region dev --allow-unsigned`. Expected: an NSIS installer named Countersign in the packaging output folder; no cargo invocation in the log.
- [ ] **Step 4: Install and run** with `COUNTERSIGN_EGRESS_LOG` set and the network **disconnected**: the app opens to the main screen, no login screen. Reconnect.
- [ ] **Step 5: One task per engine:** Claude Code (signed in with the owner's own `claude` login), Codex (own `codex` login), and a local model through LM Studio. Each completes a small file task in a scratch folder.
- [ ] **Step 6: Run** `node scripts/countersign/egress-report.mjs egress-log.jsonl`. Expected: exit 0, no blocked or unexpected hosts. If Claude Code or Codex telemetry hosts show up, set `DISABLE_TELEMETRY=1` and `DISABLE_ERROR_REPORTING=1` for Claude Code (and Codex's equivalent if it has one) in the engine environment, re-run, and record any host that cannot be switched off.
- [ ] **Step 7: Clean-machine check.** The design's done criterion asks for a build "on a clean Windows machine from the README". Run Steps 3-6 once more in a fresh Windows user account (or a Windows Sandbox / VM) following only the README from Task 8; if Task 8 is not done yet, do this step after it.
- [ ] **Step 8: Record** in `m1-acceptance.md`: installer name and size, which engines ran and how they were signed in, the egress summary, anything that did not work. **Commit** `"Countersign: M1 acceptance run"`.

### Task 8: README, NOTICE, scrub check, CI

**Files:**
- Modify: `README.md` (replace), `README.zh-CN.md` (replace with a short pointer to the English README)
- Modify: `NOTICE` (append the modification line)
- Create: `scripts/countersign/scrub-check.mjs`, `.scrub-patterns.example`
- Modify: `.github/workflows/ci.yml` (add `check:countersign-brand`, `check:scrub`; drop mobile steps if they fail without Cindy's mobile setup); delete `.github/workflows/pr-code-review.yml` (needs a secret the fork does not have)
- Test: `scripts/countersign/__tests__/scrub-check.test.mjs`

**Interfaces:**
- Produces: `scrub(files: {path: string, text: string}[], extraPatterns: RegExp[]): {path: string, line: number, rule: string}[]`.

- [ ] **Step 1: Write the failing test:** built-in rules flag `C:\Users\someone\`, `sk-ant-…`, `sk-proj-…`, `ghp_…`, `-----BEGIN PRIVATE KEY-----`; an extra pattern from `.scrub-patterns` flags its word; `LICENSE` and `docs/legal/**` are skipped.
- [ ] **Step 2: Implement** `scrub`; CLI scans `git ls-files`, reads extra patterns (one regex per line) from `.scrub-patterns` if present, exits 1 on any finding. `.scrub-patterns.example` documents the format with neutral examples only. The owner creates `.scrub-patterns` locally with their own private words; it is git-ignored.
- [ ] **Step 3: Write the README:** what Countersign is (one paragraph), what it adds over Cindy (checked team work, from M2 on), what was removed and why (sign-in, analytics, updater, phone link, plugin store, cloud voice, sharing, Cindy model service), build steps from Task 7, how engines sign in, credit and link to Cindy, license.
- [ ] **Step 4: Append to NOTICE:** "Countersign is a modified version of Cindy. Modifications Copyright 2026 Countersign contributors, licensed under the Apache License, Version 2.0. Modified files are listed in FORK-CHANGES.md."
- [ ] **Step 5: Run** the test (PASS), `node scripts/countersign/scrub-check.mjs` (exit 0 with the owner's `.scrub-patterns` in place), `pnpm check:countersign-brand` (exit 0).
- [ ] **Step 6: Commit** `"Countersign: README, NOTICE, scrub check, CI"`. Then ask the owner to approve pushing `countersign-m1` to their fork; push only on that approval.
