# Countersign

Countersign is a desktop AI agent app for Windows that runs on your own computer with no account. It is an independent fork of [Cindy](https://github.com/makecindy/cindy) (Apache-2.0). Countersign keeps Cindy's agent work (Claude Code, Codex and local models working on your files and projects) and removes or switches off every feature that needs Cindy's servers. Later versions add checked team work: a second agent reviews a team's result before it reaches you (see [Planned, not built yet](#planned-not-built-yet)).

Countersign is an independent project. It is not affiliated with, endorsed by or supported by the Cindy project or XD Inc.

This is milestone 1 (M1): the renamed, local-only app. Read [Known limits](#known-limits) and [Verification status](#verification-status) before you rely on it.

## What this version does (M1)

- Starts in local mode. There is no sign-in screen and no account.
- Refuses requests to `cindy.app`, `cindy.com.cn`, `tapdb.com`, `tapapis.com` and `log.aliyuncs.com` (and their subdomains) that the app makes through its own network calls and windows. Every other host is allowed; see [Network](#network).
- Does not start upstream's background services: analytics, the usage heartbeat, log upload, the app updater, the engine update check, and the chat-app (IM) bot connectors.
- Starts the bundled Claude Code and Codex engines with the switches each offers for telemetry, error reports, feature flags and self-update turned off. Each switch, and where its name comes from, is in [`docs/countersign/engine-telemetry.md`](docs/countersign/engine-telemetry.md).
- Ships Pi with the app. Settings > About shows the installed Pi version only; the app does not check for or download Pi updates.
- Can write an egress log of the hosts the app itself contacts, for you to check (see [Network](#network)).
- Has its own identity: app id `io.github.tejeshdevdas-py.countersign`, user data in `%APPDATA%\Countersign`, link scheme `countersign://`.

## Planned, not built yet

None of this exists in the code yet.

- M2, checked work: a team run works in a separate copy of the project, and its file changes are applied only after a reviewer agent passes the result.
- M3, cost and schedules: a cache view with an estimated cost of the next message, and scheduled routines with a weekly run cap and a per-run budget.
- M4, documents and review: an index of the pages and reports agents made, and comments pinned on a page that go back to the agent as a follow-up.

## Removed or switched off, and why

These need Cindy's servers, so they are removed or switched off:

- sign-in and accounts;
- TapDB analytics, the usage heartbeat and log upload;
- the app updater (the update service and the updater program) and the engines' self-update;
- endpoint manifests;
- Cindy's hosted model service;
- the plugin market and Skill Hub;
- provider sharing and the phone link (the relay never starts), and the mobile app download;
- cloud chat, cloud file upload and cloud app connections (OAuth broker);
- cloud voice (voice input with your own provider still works);
- the "Recognize my voice" speaker filter for voice input, whose models download only from Cindy's server;
- the Telegram, X and Slack bridges;
- in-app issue reporting, both through Cindy's service and to Cindy's GitHub tracker;
- the beta channel, and moving tasks between computers;
- the build-time fallback to Cindy's download server.

Also off:

- Chat-app bots (Telegram, Discord and the like) are hidden and never connect. Local bots that use your own bot token are planned for later.
- The `.cindy` file association is not registered on Windows.
- The Cindy-character wallpapers are removed, and Cindy's logos and artwork are replaced.

Local Android automation over adb stays; only the cloud phone link is off.

## Build on Windows 10/11 x64

There are no binary releases. You build the installer yourself.

### Prerequisites

- Git and [Git LFS](https://git-lfs.com). A native library is stored in LFS.
- Node.js 22. Version 22.22.3 was used (`.nvmrc`). `package.json` allows newer versions, but they are untested.
- pnpm 10.33.2, the version in `package.json` `packageManager`. pnpm 11 is not supported.
- Rust stable for `x86_64-pc-windows-msvc`, with `cargo` and `rustc` on `PATH`. Packaging builds several small Windows helper programs with cargo. Rust 1.99.1 was used.
- Visual Studio Build Tools with the C++ workload (MSVC x64 tools and a Windows SDK). M1 was built with Build Tools 2026 (18.10) and Windows SDK 10.0.26100.
- Python 3, needed only if a prebuilt native module is not available for your setup. The M1 build used prebuilt downloads.

Use PowerShell or cmd, with Windows' own `tar` (`%SystemRoot%\System32\tar.exe`) first on `PATH`. Git Bash's `tar` cannot unpack Pi's zip: `pnpm install` still finishes with only a warning, and packaging then stops because Pi is missing. If that happens, run `pnpm install:pi` from PowerShell.

### Steps

```powershell
git clone https://github.com/tejeshdevdas-py/countersign
cd countersign
git lfs install
git lfs pull
pnpm install
pnpm release:package -- --platform win32 --allow-unsigned --skip-smoke
```

<!-- owner: default branch pending -->

`pnpm install` also downloads the Claude Code, Codex, Pi and ripgrep engines at the versions pinned in `tools/*/latest.json`. The last command is the packaging command M1 was built with. `--skip-smoke` skips a packaged smoke test that starts the app; that test has not been run on Countersign.

The installer is written to `apps/desktop/release/artifacts/global/unversioned/win32-x64/Countersign-unversioned-Setup.exe`. It is unsigned.

- Do not add `--region dev`: it needs a git-ignored config file and builds a separate CountersignDev identity.
- Do not add `--version`: that is the release path, and it fails on a clean checkout.
- If `CINDY_WIN_SIGN_CMD` is set (in your shell or in `apps/desktop/.env`), packaging signs with it; `--no-sign` skips signing.

### Hosts the build downloads from

- `registry.npmjs.org`: npm packages.
- `downloads.claude.ai`: Claude Code (its release manifest with the checksums, then the program).
- `api.github.com` and `github.com`: Codex, Pi and ripgrep (release data from `api.github.com`, the release file from `github.com`).
- `github.com`: Electron, which `pnpm install` downloads, and the NSIS installer tooling, which packaging downloads.
- `dl.google.com`: Android platform-tools r32.0.0, checked against a pinned sha256.
- crates.io for the Rust helpers: assumed, not seen in the build logs.

When an engine or platform-tools download fails, the build stops and names the host. It does not fall back to another server. A slow download is not stopped for being slow: the Claude Code, Codex, Pi and platform-tools downloads stop only when they cannot connect, receive no data for 15 to 20 seconds, or run past 30 minutes. `pnpm install:claude`, `pnpm install:codex`, `pnpm install:pi` and `pnpm install:ripgrep` retry an engine at its pinned version.

Development mode (`pnpm dev:desktop`) was started once early in M1 and has not been checked since.

## Engines and sign-in

Countersign uses the engines bundled with it: Claude Code 2.1.296, Codex 0.159.2, Pi 1.0.2 and ripgrep 15.1.0. An engine on your `PATH` is used only when the bundled copy is missing. An npm-installed Codex (`codex.cmd`) is never run.

### Claude Code: your Claude Pro or Max subscription

- If Claude Code is already signed in with a subscription on this computer (in its default folder, `%USERPROFILE%\.claude`), Countersign uses that login, unless you disconnected it in Countersign.
- Otherwise Settings > Providers starts Claude Code's own browser sign-in.
- Console and API-key logins are not accepted for the subscription mode.
- Countersign never reads Claude Code's credential store. Disconnect only stops Countersign from using the login; it does not sign Claude Code out.
- At start, Countersign removes `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY` and related variables from its own environment.
- The in-app sign-in has not been tested; M1 used an existing Claude Code login.

### Codex: your ChatGPT login

- Countersign keeps its own Codex home in `%APPDATA%\Countersign\codex-home`.
- When `%USERPROFILE%\.codex\auth.json` exists and Countersign has no other Codex login, Countersign links to that file at start and uses the login without a Connect step, unless you disconnected Codex in Countersign. A custom `CODEX_HOME` is ignored. This is read from the code; it has not been checked on a fresh Windows profile.
- To use another account, use Connect in Settings > Providers (browser or device code).
- Countersign itself uses the Codex login to call `chatgpt.com` for usage figures and chat titles.

### Your own API keys

API keys you add under Settings > Providers are stored on this computer with Electron safeStorage.

### Local models

Local models run through Pi. M1 used LM Studio.

- Load the model with a context larger than 8192 tokens. A 10,849-token prompt failed at 8192; a larger context worked. 16K is a suggestion, not a measured minimum.
- The model picker shows the context size from the model catalog, not the size LM Studio loaded. When a prompt is too long for the loaded context, the error shows the loaded context and the prompt size.
- Ollama and llama.cpp have not been tested.

## Network

What may leave your computer:

- traffic to the model providers you use, for their API and sign-in (for example Anthropic and Claude for Claude Code, OpenAI and ChatGPT for Codex, your own API endpoints, and local servers such as LM Studio);
- traffic a task causes because you asked for it: pages an agent browses, MCP servers you added, packages it installs.

What is refused: the hosts listed in [What this version does](#what-this-version-does-m1), when the request is made by the app itself.

Engine switches: see [`docs/countersign/engine-telemetry.md`](docs/countersign/engine-telemetry.md). Its "Not switchable, or not verified" section lists what the switches cannot cover.

### Checking the app's own traffic

1. Quit Countersign from the tray icon (closing the window can leave it running in the tray). In PowerShell, set a log file, then start Countersign's `Countersign.exe` from that same window:

   ```powershell
   $env:COUNTERSIGN_EGRESS_LOG = "$env:TEMP\countersign-egress.jsonl"
   ```

2. Use the app, quit it from the tray icon, then run from the repository folder:

   ```powershell
   node scripts/countersign/egress-report.mjs "$env:TEMP\countersign-egress.jsonl"
   ```

   Add `--task-hosts example.com,https://example.org/page` for hosts a task was asked to reach.

The log records the protocol, the host and whether the request was refused. It never records a path, a query or credentials, and it writes at most one line per host and outcome per minute. The report sorts hosts into allowed, blocked and unexpected. It exits 0 when entries were recorded and none was blocked, unexpected or malformed; 1 when one was, or when the log is empty; 2 on an input error.

The engines (Claude Code, Codex, Pi) and git run as separate processes. Their traffic is not in this log; checking it needs a capture of the whole process tree.

## Known limits

1. The egress guard is a block list. Every host not on it is allowed.
2. The guard does not cover:
   - raw TCP sockets, including the local tunnel that carries Claude Code traffic through a configured HTTP or SOCKS proxy;
   - direct `undici` calls inside the `browser-control-runtime` and `opencli-vendor` packages;
   - a library that kept its own reference to a network function before the guard was installed;
   - child processes: the engines, git, and the app's own helper processes.
3. On a direct connection (no proxy), a redirect is not checked again. This includes the voice input refiner.
4. Engine telemetry:
   - Model traffic and sign-in cannot be switched off. Codex sends its analytics to the same host as its model traffic, so a capture cannot show that analytics stopped.
   - Your own Claude Code settings can turn its switches back on: Claude Code applies the `env` block of `%USERPROFILE%\.claude\settings.json` itself, after Countersign starts it. Codex's switches are passed as `-c` overrides, which take precedence over `config.toml`, and the bundled Codex reads its configuration from its own home, `%APPDATA%\Countersign\codex-home`, not from `%USERPROFILE%\.codex`.
   - The `codex exec-server` process gets none of the Codex switches. It runs only when another computer drives this one over the device link, which is off in local mode.
   - Actions you ask an engine for, such as installing a plugin or running its own login, still use the network.
5. Countersign itself calls `chatgpt.com` with your Codex login, for usage figures and chat titles.
6. Building downloads from the hosts listed under [Hosts the build downloads from](#hosts-the-build-downloads-from).
7. The automatic helper-model chain (used for titles and similar small tasks) still contains the hosted model service's entries. Local mode cannot use them; only the label shown for the default changed.
8. Model-facing tool and server ids such as `cindy_helper` and `cindy_memory` keep the old name, and a model may repeat them.
9. In app and package source, the old name written with a capital remains only in text that a Windows user in local mode does not normally see, and in stored identifiers kept so existing data keeps working; one of these, the managed browser profile's folder key, reaches the model as a profile name. `scripts/countersign/brand-guard-baseline.json` lists every such text (343 entries, 378 texts) with its reason, and [`FORK-CHANGES.md`](FORK-CHANGES.md) explains the reasons. Lower-case upstream addresses and the upstream company's name are checked only in locale strings and prompt text (see [Checks in this repository](#checks-in-this-repository)), and reviewed exceptions remain there. For example, the home page's stock-briefing suggestion still uses the upstream company's stock as its example, and the built-in plugin-creator Skill still points to the upstream plugin catalog.
10. Cindy's server addresses are still compiled in as build variables. Local mode never reads them, and the egress guard refuses them.
11. The in-app help still describes removed cloud features, such as the hosted model service, sign-in and the `/issue` command.
12. Pi cannot be installed or updated from inside the app. It ships with the app; a new Pi needs a rebuild.
13. A chat's folder is fixed when the chat is created. A chat with no project works in a private per-chat folder under `%APPDATA%\Countersign`.
14. Teammates imported from a pre-release Countersign build keep their old text. Fresh installs are not affected.
15. Pre-release builds wrote `.cindy` file-type keys to the current user's registry. Current builds no longer write them but do not remove them.
16. The installer is unsigned. How Windows SmartScreen treats it has not been checked.
17. Only Windows is built. The mobile app (`apps/mobile`) is in the tree but is not built.
18. The third-party notices in `docs/legal/notices/` were generated for Cindy. They list the updater, which Countersign does not ship, and say the engines are downloaded at runtime, while Countersign bundles them.
19. The installer does not contain this repository's `LICENSE` or `NOTICE`. Add them before you share an installer.
20. `CONTRIBUTING`, `SUPPORT` and the other community files (the issue and pull-request templates, `CODEOWNERS`) are upstream's and describe Cindy's process and services. Only `SECURITY`, `CODE_OF_CONDUCT` and the security link in `.github/ISSUE_TEMPLATE/config.yml` were changed. The root `package.json` still names Cindy's homepage and repository.
21. Not checked live: a start with no network, a build on a clean machine, and a network capture after the final set of engine switches.

## Verification status

Checked on one Windows 11 computer, on intermediate builds:

- The installer was built with the packaging command above and installed; the app opened on its main screen with no sign-in.
- Each engine completed a file-writing task: Claude Code with a subscription login, Codex with a ChatGPT login, and Pi with a model in LM Studio.
- One TCP capture of the app's process tree saw only addresses attributed to `chatgpt.com` and to `api.anthropic.com`/`claude.ai`, apart from local connections. An earlier run, before the Claude Code switches, also saw `downloads.claude.ai` and `github.com`.

Not checked: a build on a clean machine, a start with no network, and a capture after the final engine switches.

## Checks in this repository

- `pnpm check:countersign-brand` looks for the old product name written with a capital (Cindy, CINDY, and their plurals). It fails on it in locale string values; window, dialog and notification titles in desktop source; the in-app help prose (outside code and link targets); renderer `name`, `alt` and `aria-label` values; prompt files and the string literals of the listed prompt and tool-description modules; the app's `.html` entry pages; and the browser recipe and site-guide data sent to models. It also fails on imports of the known Cindy artwork and on shipped image or video files whose name contains the old name. The exceptions there are short lists inside the guard, each with its reason. Separately, it checks every string literal, template part and JSX text in the non-test app and package source (`apps/desktop/src`, `packages/*/src`), apart from logger-call text and the name inside an identifier, a path or a URL. Old-name text left there on purpose is listed in [`scripts/countersign/brand-guard-baseline.json`](scripts/countersign/brand-guard-baseline.json) with its file, text, count, reason category and reason; the check fails on any such text that is not listed and on an entry found fewer times than its count, so the list can only shrink. In locale strings and prompt text (the prompt files and the listed prompt modules) it also fails on the upstream repository owner (`makecindy`), the upstream domains (`cindy.app`, `cindy.cn`, `cindy.com.cn`) and the upstream company's name written in Latin letters, in any case and inside URLs too, apart from reviewed exceptions listed with their reasons and counts in the guard (`UPSTREAM_REF_EXEMPT`); a listed exception found more or fewer times than its count fails. Elsewhere (the in-app help, entry pages, other source string literals and the recipe data sent to models), and for social-account addresses and the company's name in Chinese characters, these are found only by review.
- `pnpm check:scrub` fails on real-shaped keys (Anthropic, OpenAI, GitHub, AWS access key ids, Google API keys, Slack and Hugging Face tokens), private-key blocks and the owner's private words in every tracked file, and on personal paths and email addresses in the lines the fork added (a diff against the base named in [`FORK-CHANGES.md`](FORK-CHANGES.md), with rename detection). Personal paths include Windows user folders (with backslashes or slashes, URL-encoded, or in the Git Bash and WSL forms), any other drive path, Git Bash drive paths, and `/Users/<name>` and `/home/<name>`. An address in a URL passes only as `scheme://user:password@host`. Upstream lines are not checked for paths or emails, so, for example, the addresses in the third-party notices pass. File names are checked too: every tracked path goes through the key rules and the private words, and a hit is reported as `<path>:0`, which prints that file's name. Binary files (by extension) and files marked `filter=lfs` are not read. `LICENSE`, `docs/legal/` and files marked `-diff` skip the built-in rules, but the private words still run on them (on a `-diff` file only when it is text). Every file skipped for a reason other than a binary extension is listed in [`scripts/countersign/scrub-skipped.json`](scripts/countersign/scrub-skipped.json), and the check fails when that list and the files actually skipped differ. A `.scrub-patterns` file that is not UTF-8 text, or a list file without entries, stops the check with exit code 2. `pnpm check:scrub --history` checks the fork's commits, skipping merge commits: the author and committer must be the owner's noreply address, commit messages and added lines go through every rule, and the names of added, renamed or copied files go through the key rules and the private words. Reviewed exceptions pass, each listed by hash with its reason: placeholder paths, one GitHub-token fixture and two key fixtures in an upstream redaction test in [`scripts/countersign/scrub-baseline.json`](scripts/countersign/scrub-baseline.json), and, in `--history` only, email addresses in earlier commits in [`scripts/countersign/scrub-history-baseline.json`](scripts/countersign/scrub-history-baseline.json) (today only the upstream project's public support address). Private words are never accepted. CI runs the built-in rules only. The owner's private words live in a git-ignored `.scrub-patterns` file (format in [`.scrub-patterns.example`](.scrub-patterns.example)) and are checked locally before each push.
- `pnpm check:countersign-egress` fails when a main-process file (`apps/desktop/src/main`) loads `undici` and never calls the egress check. It works per file, so it cannot prove that the check runs before the request. Two files that load `undici` but make no request themselves (one uses only its type, one only builds connection pools) are allowlisted, each with its reason. It does not scan `packages/*`.

## Issues and security

- Report a security problem through GitHub private vulnerability reporting on this repository; see [`SECURITY.en.md`](SECURITY.en.md).
- Report bugs as GitHub issues on this repository. The in-app issue reporter is off.

<!-- owner: enable on GitHub -->

## Credit and licence

Countersign is built on [Cindy](https://github.com/makecindy/cindy). Thanks to the Cindy authors for publishing it under Apache-2.0.

- Licence: Apache License, Version 2.0 ([`LICENSE`](LICENSE)). Except where noted otherwise, the source code is under this licence. Source files carry no per-file licence header; the root `LICENSE` governs.
- [`NOTICE`](NOTICE) keeps Cindy's notice and adds Countersign's modification notice.
- [`FORK-CHANGES.md`](FORK-CHANGES.md) lists the modified areas.
- Model weights, datasets, prompts, trademarks and other separately identified material may have their own terms and are not automatically covered by the repository's Apache-2.0 grant. The Cindy name and logo are not licensed for this project.
- Third-party components keep their own copyright and licences. Their notices and SBOMs are in [`docs/legal/notices/`](docs/legal/notices/) (see limit 18).
- A built installer contains third-party programs under their own terms, including Claude Code and `@anthropic-ai/claude-agent-sdk` under Anthropic's commercial terms, and the Microsoft Visual C++ runtime. Check those terms before you share an installer.
