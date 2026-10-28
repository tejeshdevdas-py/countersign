# Countersign

Countersign is a desktop AI agent app for Windows that runs on your own computer with no account. It is an independent fork of [Cindy](https://github.com/makecindy/cindy) (Apache-2.0). Countersign keeps Cindy's agent work (Claude Code, Codex and local models working on your files and projects) and removes or switches off every feature that needs Cindy's servers. Later versions add checked team work: a second agent reviews a team's result before it reaches you (see [Planned, not built yet](#planned-not-built-yet)).

Countersign is an independent project. It is not affiliated with, endorsed by or supported by the Cindy project or XD Inc.

This is milestone 1 (M1): the renamed, local-only app. Read [Known limits](#known-limits) and [Verification status](#verification-status) before you rely on it.

## What this version does (M1)

- Starts in local mode. There is no sign-in screen and no account.
- Refuses requests to `cindy.app`, `cindy.cn`, `cindy.com.cn`, `tapdb.com`, `tapapis.com` and `log.aliyuncs.com` (and their subdomains) that the app makes through its own network calls and windows. Every other host is allowed; see [Network](#network).
- Does not start upstream's background services: analytics, the usage heartbeat, log upload, the app updater, the engine update check, and the chat-app (IM) bot connectors.
- Starts the bundled Claude Code and Codex engines with the switches each offers for telemetry, error reports, feature flags and self-update turned off. Each switch, and where its name comes from, is in [`docs/countersign/engine-telemetry.md`](docs/countersign/engine-telemetry.md).
- Ships Pi with the app. Settings > About shows the installed Pi version only; the app does not check for or download Pi updates.
- Can write an egress log of the hosts the app itself contacts, for you to check (see [Network](#network)).
- Has its own identity: app id `io.github.tejeshdevdas-py.countersign`, user data in `%APPDATA%\Countersign`, link scheme `countersign://`. What its own profiles share (the skill bundle, skill locks and worktree records) is in `%APPDATA%\Countersign` too, and its files outside that folder carry its own name: `%USERPROFILE%\.countersign\` (local themes and a skill-folder lock), `%USERPROFILE%\.ssh\countersign.conf` for the SSH hosts it manages (adding a host also adds an `Include ~/.ssh/countersign.conf` line to `%USERPROFILE%\.ssh\config`), and new SSH keys default to `%USERPROFILE%\.ssh\countersign`. Inside your project folders it uses Cindy's folder names on purpose (see [Known limits](#known-limits)).

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
- Cindy's hosted model service (Settings > Providers does not offer it);
- the plugin market and Skill Hub: the Skills page shows only local skills, and agents get no Skill Hub or plugin-market tools;
- provider sharing (no Remote & Sharing row or page) and the phone link (the relay never starts), and the mobile app download;
- task sharing: there is no Share Task item or Shared tasks tab, and a shared-task invitation link says task sharing is not available;
- cloud chat (there is no "Enter Invite Link", and a chat invitation link says cloud chat is not available), cloud file upload and cloud app connections (OAuth broker);
- cloud voice (voice input with your own provider still works);
- the "Recognize my voice" speaker filter for voice input, whose models download only from Cindy's server;
- the Telegram, X and Slack bridges;
- in-app issue reporting, both through Cindy's service and to Cindy's GitHub tracker;
- the beta channel, and moving or copying tasks to another computer: the Move menu lists only local projects, and the agents' history tools read only this computer;
- the build-time fallback to Cindy's download server.

Also off:

- Chat-app bots (Telegram, Discord and the like) are hidden and never connect. Settings > Tools does not list the Feishu bot, personal WeChat or Slack tools, and a teammate imported with a chat-app connection comes without it. Local bots that use your own bot token are planned for later.
- The `.cindy` file association is not registered on Windows.
- Artwork: Countersign's own artwork replaces Cindy's in the app icon, the wordmarks, the default teammate's avatar and the startup splash, which draws the Countersign avatar and wordmark. Cindy's logo files, the account and share-card character images and the eight Cindy-character wallpapers are removed. Still in the repository but imported by nothing: the upstream splash portrait and slogan images and the source images of the sign-in result page's characters (`apps/desktop/src/renderer/assets/login/`). Still in the installer but not shown on Windows in local mode: a macOS-only agent-island image of Cindy, the sign-in result page's character images (that page follows a browser sign-in, which local mode refuses), and the upstream company's mark, used only for the hosted model service.

Also changed:

- The built-in wallpapers ship with the app (eight images, about 3.4 MB) and are never downloaded.
- The Explorer right-click entry on folders reads "Open with Countersign", in English for every language.
- If the app cannot open its local session at start, it shows "Local data cannot be opened yet" with a "Reopen Local Data" button.

Local Android automation over adb stays; only the cloud phone link is off.

## Build on Windows 11 x64 (Windows 10 untested)

There are no binary releases. You build the installer yourself.

### Prerequisites

- Git and [Git LFS](https://git-lfs.com). A native library is stored in LFS.
- Node.js 22. Version 22.22.3 was used (`.nvmrc`). `package.json` allows newer versions, but they are untested.
- pnpm 10.33.2, the version in `package.json` `packageManager`. pnpm 11 is not supported. M1 installed it with `npm install -g pnpm@10.33.2`.
- Rust stable for `x86_64-pc-windows-msvc`, with `cargo` and `rustc` on `PATH`. Packaging builds several small Windows helper programs with cargo. Rust 1.99.1 was used.
- Visual Studio Build Tools with the C++ workload (MSVC x64 tools and a Windows SDK). M1 was built with Build Tools 2026 (18.10) and Windows SDK 10.0.26100.
- Python 3. Packaging compiles the `better-sqlite3` native module for Electron from source with node-gyp, which needs Python 3 and the MSVC C++ build tools above; without them packaging stops. The M1 build machine had Python 3.14.7.
- About 12 GB of free disk space. On the M1 build machine the checkout measured about 11 GB after a package build, about 5 GB of it `node_modules`. The pnpm store added about 0.3 GB more, because pnpm hard-links packages when its store is on the same drive; on another drive it copies them, which needs about 5 GB more. The Electron and cargo download caches in the user profile added about 0.6 GB.

If PowerShell refuses to run `pnpm` because running scripts is disabled on the system, run `pnpm.cmd` instead, or allow local scripts for your account with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`: `npm install -g` puts a `pnpm.ps1` next to `pnpm.cmd`, and PowerShell's default policy on Windows 11 (`Restricted`) refuses `.ps1` files.

Behind an HTTP proxy (not tested): set `HTTPS_PROXY`, which pnpm, node-gyp and cargo read. The Electron download reads it only when `ELECTRON_GET_USE_PROXY=true` is also set. The engine downloads use Node's built-in `fetch`, which reads it only when `NODE_USE_ENV_PROXY=1` is set; that was not tried with these scripts.

Use PowerShell or cmd, with Windows' own `tar` (`%SystemRoot%\System32\tar.exe`) first on `PATH`. Git Bash's `tar` cannot unpack Pi's zip: `pnpm install` still finishes with only a warning, and packaging, which tries Pi again, stops with the same error while that `tar` comes first. If that happens, run `pnpm install:pi` from PowerShell.

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
- `--version` is refused: a versioned build makes an update package (`-hotfix.zip`) for the upstream in-app updater and, with `major`, `minor` or `patch`, reads the upstream release CDN. Countersign has neither. Leave it out to build the unversioned installer.
- If `CINDY_WIN_SIGN_CMD` is set (in your shell or in `apps/desktop/.env`), packaging signs with it; `--no-sign` skips signing.

Packaging also checks what it ships:

- Before it copies the engines (Claude Code, Codex, Pi, ripgrep) and Android platform-tools, it checks each against its pin and downloads the pinned version when the copy on disk is missing or differs (see below).
- It stops when `vec0.dll` is missing or is still a Git LFS pointer, and says to run `git lfs pull`.
- It copies this repository's `LICENSE` and `NOTICE` into the installer's `resources` folder as `LICENSE.txt` and `NOTICE.txt`.
- It fails when the packaged app (`app.asar` and `app.asar.unpacked`) holds compiler intermediates (`.obj`, `.pdb`, `.lib`, `.tlog`, `.vcxproj`, `config.gypi` and similar) or this computer's user name. The name is allowed only inside the project's own app IDs and GitHub address. To keep it out, the build compiles `better-sqlite3` with two MSVC options (`/d1trimfile` and `/PDBALTPATH`) that it sets itself.

These checks were added after the last package build, so none of them has run in a real package build yet.

### Hosts the build downloads from

- `registry.npmjs.org`: npm packages.
- `downloads.claude.ai`: Claude Code (its release manifest with the checksums, then the program).
- `api.github.com` and `github.com`: Codex, Pi and ripgrep (release data from `api.github.com`, the release file from `github.com`).
- `github.com`: Electron and the `better-sqlite3` prebuilt binary for Node, which `pnpm install` downloads, and the NSIS installer tooling, which packaging downloads.
- `release-assets.githubusercontent.com`: GitHub redirects release downloads to this host (seen on 2026-10-28), so every download from `github.com` above also reaches it.
- `www.electronjs.org`: the Electron headers that packaging needs to compile `better-sqlite3` (cached in `%USERPROFILE%\.electron-gyp`).
- `dl.google.com`: Android platform-tools r32.0.0, checked against a pinned sha256.
- `index.crates.io` and `static.crates.io`: the Rust crates for the helper programs (seen in the cargo registry of the M1 build machine).

`pnpm install` fetches the engines on a best-effort basis: when one fails, it prints a warning that names the host, and `pnpm install` still finishes. Packaging checks them again, as above; when an engine or platform-tools download fails there, packaging stops and its output names the host. No build download falls back to another server. A slow download is not stopped for being slow: the Claude Code, Codex, Pi and platform-tools downloads stop only when they cannot connect, receive no data for 15 to 20 seconds, or run past 30 minutes. `pnpm install:claude`, `pnpm install:codex`, `pnpm install:pi` and `pnpm install:ripgrep` retry an engine at its pinned version.

Some build messages come from upstream scripts and are in Chinese only. The ones on this path, and what to do:

- After `pnpm install`, "agent 二进制未就位（best-effort，不阻断）": an engine did not download. The English line above it names the engine and the host; run `pnpm install:<engine>`.
- "Electron zip 下载失败", "系统 tar 解压失败" or "Electron 修复后仍不完整": Electron did not download or unpack. Put Windows' own `tar` first on `PATH`, delete the Electron download cache (`%LOCALAPPDATA%\electron\Cache`), and run `pnpm install` again with Node 22.
- "关键依赖损坏" or "核弹清理后依然损坏": the dependency check that `pnpm release:package` runs first found broken packages and reinstalled them. If it still fails, run `pnpm install` yourself and read its error.
- "root Node ABI 修复后仍不可用": `better-sqlite3` could not be rebuilt for Node. Check Python 3 and the MSVC build tools, then run `pnpm install` again.
- "需要一个值" or "未知参数": a `pnpm release:package` option has no value or is unknown; compare with the command under Steps.
- "Android platform-tools … 未能就位": the platform-tools download failed. The English lines above it name `dl.google.com` and two offline routes; retry with `pnpm --filter desktop install:android-platform-tools`.
- "注意: 版本无关包(0.0.0)不参与热更新…" at the end of packaging is a note, not an error.

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
- traffic a task causes because you asked for it: pages an agent browses, MCP servers you added, packages it installs;
- git traffic to your project's own remote: before a task gets its own worktree (for example a handoff to a new worktree, or a scheduled task's temporary worktree), git asks the remote (`upstream`, else `origin`) for its default branch and fetches it, within 15 seconds;
- images in an answer that point to a web address: they load as soon as the answer is shown. A YouTube link shows its poster image from `i.ytimg.com`; the player loads only when you click it. The egress log records these hosts;
- downloads and checks you start yourself:
  - Settings > Providers, Ollama: installing Ollama asks `api.github.com` for the latest release and downloads it from GitHub. Downloading a model makes Ollama itself contact its model registry (`registry.ollama.ai`), or Hugging Face for an `hf.co/...` model;
  - Settings > Providers, llama.cpp: installing it asks `api.github.com` and downloads from GitHub; its models come from `huggingface.co` and Hugging Face's download hosts;
  - Settings > Computer Use: installing or updating the cua-driver runs the project's install script from `raw.githubusercontent.com` in PowerShell, and that script downloads the driver. "Check for updates" there asks `api.github.com`, and so does the check after an update you started. Opening the tab checks nothing;
  - Android automation: if the bundled adb cannot run, preparing it downloads the latest platform-tools from `dl.google.com`;
  - connecting GitHub from a task's git status downloads the GitHub CLI (`gh`) from GitHub and signs in to GitHub with it.

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

The engines (Claude Code, Codex, Pi), git and the other programs the app starts (such as Ollama, the cua-driver install script and `gh`) run as separate processes. Their traffic is not in this log; checking it needs a capture of the whole process tree.

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
9. In app and package source, the old name written with a capital remains only in text that a Windows user in local mode does not normally see, and in stored identifiers kept so existing data keeps working; one of these, the managed browser profile's folder key, reaches the model as a profile name. `scripts/countersign/brand-guard-baseline.json` lists every such text (337 entries, 372 texts) with its reason, and [`FORK-CHANGES.md`](FORK-CHANGES.md) explains the reasons. Lower-case upstream addresses and the upstream company's name are checked only in locale strings and prompt text (see [Checks in this repository](#checks-in-this-repository)), and reviewed exceptions remain there. For example, the home page's stock-briefing suggestion still uses the upstream company's stock as its example, and the built-in plugin-creator Skill still points to the upstream plugin catalog.
10. Cindy's server addresses are still compiled in as build variables. Local mode never reads them, and the egress guard refuses them.
11. The in-app help still describes removed cloud features, such as the hosted model service, sign-in and the `/issue` command.
12. Pi cannot be installed or updated from inside the app. It ships with the app; a new Pi needs a rebuild.
13. A chat's folder is fixed when the chat is created. A chat with no project works in a private per-chat folder under `%APPDATA%\Countersign`.
14. Teammates imported from a pre-release Countersign build keep their old text. Fresh installs are not affected.
15. Pre-release builds wrote `.cindy` file-type keys to the current user's registry. Current builds no longer write them but do not remove them. Pre-release builds also wrote to places named for Cindy: `shared-system-skills`, `shared-skill-mutation-locks`, `shared-worktree-recycle-journals` and `shared-worktree-runtime-leases` in `%APPDATA%\Cindy`, themes in `%USERPROFILE%\.cindy\themes`, a lock in `%USERPROFILE%\.cindy`, and SSH hosts in `%USERPROFILE%\.ssh\cindy.conf`. Current builds neither use nor remove them. SSH hosts added with a pre-release build are not carried over; while `%USERPROFILE%\.ssh\config` includes `cindy.conf`, they still show up as hosts from your own SSH config.
16. The installer is unsigned. How Windows SmartScreen treats it has not been checked.
17. Only Windows is built. The mobile app (`apps/mobile`) is in the tree but is not built.
18. The third-party notices in `docs/legal/notices/` were generated for Cindy. They list the updater, which Countersign does not ship, and say the engines are downloaded at runtime, while Countersign bundles them.
19. `CONTRIBUTING`, `SUPPORT` and the other community files (the issue and pull-request templates, `CODEOWNERS`) are upstream's and describe Cindy's process and services. Only `SECURITY`, `CODE_OF_CONDUCT` and the security link in `.github/ISSUE_TEMPLATE/config.yml` were changed. The root `package.json` still names Cindy's homepage and repository; its issue tracker link (`bugs`) points at this repository.
20. Inside a project folder, Countersign uses the same `.cindy\` folder (project knowledge, project automations, per-project plugin switches) and `.cindy-worktrees\` folder as Cindy, on purpose: with both apps installed, both read and write the same files there. A project's old `.xdmaker\` folder is moved into `.cindy\` on first use.
21. Both apps write skills and skill links into `%USERPROFILE%\.agents\skills`, `.claude\skills` and `.codex\skills`. Their locks are separate, so the two apps do not wait for each other there: do not change the same skill in both apps at the same time.
22. Countersign's managed Chrome uses debugging port 18800, as Cindy's does. While one app's managed browser runs, the other app's browser tool cannot start its own and reports the browser as unavailable. This is read from the code; it was not tried with both apps installed.
23. Two more places are shared with an installed Cindy (read from the code): on an SSH host that both apps connect to, both install their remote agents in `$HOME/.xdt-server/v1`, so one app's clean-up there can affect the other's; and a web image opened with the default app is saved in `%TEMP%\xdt-maker-remote-images`, which quitting either app deletes.
24. File previews stay on this computer, with these effects: a `.drawio` diagram that uses library shapes (AWS, Cisco, electrical and others) shows placeholder shapes, and its web fonts fall back to an installed font; images a diagram embeds by web address still load; a Draco- or KTX2-compressed 3D model, or a Lottie texture, does not render; and the mail preview shows initials or the mail plugin's own photo and asks no avatar service.
25. The texts added for local mode in Japanese, Korean and Chinese (15 strings in each locale) have not been read by a native speaker. In the "not available" message the feature name stays in English inside the translated sentence.
26. Agents cannot search or install plugins from a marketplace you configured; the Plugins page still can. The Feishu bot, personal WeChat and Slack tools are no longer listed in Settings > Tools but are still registered for agents (read from the code); no chat-app connection starts in local mode.
27. The packaged-output check fails for a builder whose Windows user name is a common word that also appears in ordinary app text (for example `User` or `dev`), and it cannot be skipped (read from the check; not tried). It reads only `app.asar` and `app.asar.unpacked`: in the M1 build output, six Rust-built helper programs in `resources\tools` contained the builder's user name, from cargo registry paths. Deal with them before you share an installer.
28. Not checked live: a start with no network, a build on a clean machine, a network capture after the final set of engine switches, and a package build with the final fix round's build changes (the engine check, the LFS check, the licence files and the packaged-output check).

## Verification status

Checked on one Windows 11 computer, on intermediate builds:

- The installer was built with the packaging command above and installed; the app opened on its main screen with no sign-in.
- Each engine completed a file-writing task: Claude Code with a subscription login, Codex with a ChatGPT login, and Pi with a model in LM Studio.
- One TCP capture of the app's process tree saw only addresses attributed to `chatgpt.com` and to `api.anthropic.com`/`claude.ai`, apart from local connections. An earlier run, before the Claude Code switches, also saw `downloads.claude.ai` and `github.com`.

Not checked: a build on a clean machine, a start with no network, a capture after the final engine switches, and a package build since the final fix round's build changes.

## Checks in this repository

- `pnpm check:countersign-brand` looks for the old product name written with a capital (Cindy, CINDY, and their plurals). It fails on it in locale string values; window, dialog and notification titles in desktop source; the in-app help prose (outside code and link targets); renderer `name`, `alt` and `aria-label` values; prompt files and the string literals of the listed prompt and tool-description modules; the app's `.html` entry pages; and the browser recipe and site-guide data sent to models. It also fails on imports of the known Cindy artwork and on shipped image or video files whose name contains the old name. The exceptions there are short lists inside the guard, each with its reason. Separately, it checks every string literal, template part and JSX text in the non-test app and package source (`apps/desktop/src`, `packages/*/src`), apart from logger-call text and the name inside an identifier, a path or a URL. Old-name text left there on purpose is listed in [`scripts/countersign/brand-guard-baseline.json`](scripts/countersign/brand-guard-baseline.json) with its file, text, count, reason category and reason; the check fails on any such text that is not listed and on an entry found fewer times than its count, so the list can only shrink. In locale strings and prompt text (the prompt files and the listed prompt modules) it also fails on the upstream repository owner (`makecindy`), the upstream domains (`cindy.app`, `cindy.cn`, `cindy.com.cn`) and the upstream company's name written in Latin letters, in any case and inside URLs too, apart from reviewed exceptions listed with their reasons and counts in the guard (`UPSTREAM_REF_EXEMPT`); a listed exception found more or fewer times than its count fails. Elsewhere (the in-app help, entry pages, other source string literals and the recipe data sent to models), and for social-account addresses and the company's name in Chinese characters, these are found only by review.
- `pnpm check:scrub` fails on real-shaped keys (Anthropic, OpenAI, OpenRouter, xAI, any other `sk-` key of 32 or more letters and digits, GitHub, AWS access key ids, Google API keys, Slack and Hugging Face tokens), private-key blocks and the owner's private words in every tracked file, and on personal paths and email addresses in the lines the fork added (a diff against the base named in [`FORK-CHANGES.md`](FORK-CHANGES.md), with rename detection). Personal paths include Windows user folders (with backslashes or slashes, URL-encoded, or in the Git Bash and WSL forms), any other drive path, Git Bash drive paths, and `/Users/<name>` and `/home/<name>`. An address in a URL passes only as `scheme://user:password@host`. Upstream lines are not checked for paths or emails, so, for example, the addresses in the third-party notices pass. File names are checked too: every tracked path goes through the key rules and the private words, and a hit is reported as `<path>:0`, which prints that file's name. Binary files (by extension) and files marked `filter=lfs` are not read. `LICENSE`, `docs/legal/` and files marked `-diff` skip the built-in rules, but the private words still run on them (on a `-diff` file only when it is text). Every file skipped for a reason other than a binary extension is listed in [`scripts/countersign/scrub-skipped.json`](scripts/countersign/scrub-skipped.json), and the check fails when that list and the files actually skipped differ. A `.scrub-patterns` file that is not UTF-8 text, or a list file without entries, stops the check with exit code 2. `pnpm check:scrub --history` checks the fork's commits, skipping merge commits: the author and committer must be the owner's noreply address, commit messages and added lines go through every rule, and the names of added, renamed or copied files go through the key rules and the private words. Reviewed exceptions pass, each listed by hash with its reason: placeholder paths, one GitHub-token fixture, two key fixtures in an upstream redaction test and one fake `sk-` key in two upstream skill tests in [`scripts/countersign/scrub-baseline.json`](scripts/countersign/scrub-baseline.json), and, in `--history` only, email addresses and drive paths that name no person in earlier commits in [`scripts/countersign/scrub-history-baseline.json`](scripts/countersign/scrub-history-baseline.json) (today the upstream project's public support address, one made-up test address, and a placeholder path and two comments describing a path shape in the commit that added the scrub check). Windows user folders are never accepted there. Private words are never accepted. CI runs the built-in rules only. The owner's private words live in a git-ignored `.scrub-patterns` file (format in [`.scrub-patterns.example`](.scrub-patterns.example)) and are checked locally before each push.
- `pnpm check:countersign-egress` fails when a main-process file (`apps/desktop/src/main`) loads `undici` and never calls the egress check. It works per file, so it cannot prove that the check runs before the request. Two files that load `undici` but make no request themselves (one uses only its type, one only builds connection pools) are allowlisted, each with its reason. It does not scan `packages/*`.

## Issues and security

- Report a security problem through GitHub private vulnerability reporting on this repository; see [`SECURITY.en.md`](SECURITY.en.md).
- Report bugs as GitHub issues on this repository. The in-app issue reporter is off.

<!-- owner: enable on GitHub -->

## Credit and licence

Countersign is built on [Cindy](https://github.com/makecindy/cindy). Thanks to the Cindy authors for publishing it under Apache-2.0.

- Licence: Apache License, Version 2.0 ([`LICENSE`](LICENSE)). Except where noted otherwise, the source code is under this licence. Source files carry no per-file licence header; the root `LICENSE` governs.
- [`NOTICE`](NOTICE) keeps Cindy's notice and adds Countersign's modification notice.
- Packaging copies `LICENSE` and `NOTICE` into the installer's `resources` folder as `LICENSE.txt` and `NOTICE.txt`. This step was added after the last package build and has not run in one yet.
- [`FORK-CHANGES.md`](FORK-CHANGES.md) lists the modified areas.
- Model weights, datasets, prompts, trademarks and other separately identified material may have their own terms and are not automatically covered by the repository's Apache-2.0 grant. The Cindy name and logo are not licensed for this project.
- Third-party components keep their own copyright and licences. Their notices and SBOMs are in [`docs/legal/notices/`](docs/legal/notices/) (see limit 18).
- A built installer contains third-party programs under their own terms, including Claude Code and `@anthropic-ai/claude-agent-sdk` under Anthropic's commercial terms, and the Microsoft Visual C++ runtime. Check those terms before you share an installer.
