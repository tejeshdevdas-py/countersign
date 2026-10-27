# Engine telemetry switches

Countersign starts the bundled Claude Code and Codex engines with every switch they offer for turning off nonessential traffic. This page records where each switch name comes from and what is left over. The README's limits section should carry the "Not switchable" list.

Code: `packages/maker-shared/src/localOnlyEngine.ts` (re-exported by maker-core). Tests: `maker-core/.../claude-code/__tests__/local-only-env.test.ts`, `codex/app-server/stdioTransport.test.ts`, and desktop `claudeNativeCli.test.ts`, `codexAuthState.test.ts`, `codex-account-auth.test.ts`.

## Where the switches are applied (every spawn of the bundled engines)

| Spawn | Where | Switches |
| --- | --- | --- |
| Claude Code sessions, team/Orca workers, model-discovery probe, remote route | `maker-core` `buildClaudeEnv` (`claude-code/index.ts`) | env |
| `claude auth status --json`, `claude auth login --claudeai`, plan-usage `claude -p` | `apps/desktop/src/main/maker-host/claude-native-cli.ts` `cliEnv` | env |
| `claude --version` / engine version probes | `agent-binaries/binary-version-probe.ts`, `maker-ipc/binary-version.ts` | env (harmless for codex and pi) |
| `codex app-server` (chat, workers, model discovery) | `maker-core` `codex/app-server/stdioTransport.ts` | `-c` |
| `codex login` (connect / account) | `maker-host/codex-auth-state.ts` `codexLoginArgs`, `maker-host/codex-account-auth.ts` | `-c` |
| `codex exec-server` | `remote-agent/controller/execServerRelay.ts` | none: device link is removed under LOCAL_ONLY, not reached |
| SSH-remote `cc-mgr` daemon | `maker-cc-manager` | receives `buildClaudeEnv(mode: 'remote')`, so the env switches |

## What the live run saw (2026-10-27)

During an ordinary Claude Code chat the bundled `claude.exe` (2.1.296) connected to `35.190.46.17:443`, and a `git-remote-https` child connected to `github.com`.

- `35.190.46.17` is `downloads.claude.ai` (`nslookup downloads.claude.ai` returns that address on 2026-10-27).
- The CLI fetches three things from that host: `claude-code-releases/plugins/claude-plugins-official` (the official plugin marketplace), `claude-code-releases` (self-update) and `model-catalog/v1/catalog.json`.
- The marketplace auto-install reads `downloads.claude.ai` first and falls back to `git` for `anthropics/claude-plugins-official` on GitHub. Its failure reasons in the binary are `gcs_unavailable` and `git_unavailable`. That fallback matches the `github.com` connection two seconds later. This is an inference from the binary's code and the timing; it was not traced packet by packet.

## Claude Code 2.1.296 (environment variables)

Each name was found in the bundled `apps/desktop/resources/agent-bin/claude-code/claude.exe` with `grep -a`. The code shown is minified CLI source quoted from the binary.

| Variable | Evidence in the binary | Effect |
| --- | --- | --- |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | `function MDt(){if(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)return"essential-traffic";…}`; the auto-updater check `eA()` treats it as disabling updates; claude.ai plugin downloads refuse with "non-essential network traffic is disabled". Upstream's own native tests also set it. | Traffic level "essential-traffic" |
| `DISABLE_TELEMETRY=1` | Same `MDt()`: `if(process.env.DISABLE_TELEMETRY)return"no-telemetry"`. Upstream already set it. | Telemetry off; feature-flag evaluation off |
| `DO_NOT_TRACK=1` | Same `MDt()`: `if(Fe(process.env.DO_NOT_TRACK))return"no-telemetry"` | Same as above (belt and braces) |
| `DISABLE_ERROR_REPORTING=1` | Read: `if(process.env.DISABLE_ERROR_REPORTING)return!1` in the error-reporting gate. Upstream already set it. | Error-sample upload off |
| `DISABLE_GROWTHBOOK=1` | `if(gg()\|\|a.DISABLE_GROWTHBOOK\|\|…)return!1` in the feature-flag path; the CLI adds `DISABLE_GROWTHBOOK:"1"` to child environments itself | GrowthBook feature-flag fetch off |
| `DISABLE_AUTOUPDATER=1` | `function VAe(){return eA(Fe(process.env.DISABLE_AUTOUPDATER))}`; plugin auto-update logs "Plugin autoupdate: skipped (auto-updater disabled)" when it is off | CLI self-update and plugin/marketplace `git` refresh off |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` | `function _xo(){return a.CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL}` … `if(_xo())return t("Official marketplace auto-install disabled via env var, skipping")` | First-run download of `claude-plugins-official` (downloads.claude.ai, then git to GitHub) off |
| `OTEL_SDK_DISABLED=true` | **Not in the 2.1.296 binary.** Kept only because upstream's env builder set it; harmless. The CLI's own OTel switch is `CLAUDE_CODE_ENABLE_TELEMETRY` (opt-in), handled below | none |
| removed: `CLAUDE_CODE_ENABLE_TELEMETRY`, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, `ENABLE_ENHANCED_TELEMETRY_BETA` | `QLt(){return Fe(process.env.CLAUDE_CODE_ENABLE_TELEMETRY)&&…}`; `soo(){let n=process.env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA??process.env.ENABLE_ENHANCED_TELEMETRY_BETA;…}` | Opt-in OTel / session tracing from the user's shell is deleted from the spawn env |

Under `LOCAL_ONLY` these are forced and applied last: a value inherited from the user's shell, a host behaviour flag or an auth-adapter env does not win (tested). Upstream set the three telemetry variables only when unset.

The user's login is untouched. For subscription sessions (`nativeCliAuth`) the CLI still reads its own sign-in. None of these variables changes where credentials are read from.

## Codex 0.159.2 (`-c` config overrides)

The names come from the bundled `codex.exe`. Its config struct lists the fields `analytics`, `feedback`, `otel` and `check_for_update_on_startup`, and the binary contains the struct names `AnalyticsConfigToml`, `FeedbackConfigToml` and `OtelConfigToml`, plus the field names `exporter`, `trace_exporter` and `metrics_exporter`. The exporter kinds are `none`, `statsig`, `otlp-http` and `otlp-grpc`, and the `statsig` exporter posts to `https://ab.chatgpt.com/otlp/v1/metrics`.

Each key was checked against the binary itself with a scratch `CODEX_HOME`. A wrong-typed value is refused ("failed to load bootstrap configuration"), so the key is a real typed field. An unknown key (`analytics.zzz`) is silently accepted, so acceptance alone proves nothing.

| Override | Wrong value refused? | Effect |
| --- | --- | --- |
| `analytics.enabled=false` | yes (`"nope"`) | Usage analytics off |
| `feedback.enabled=false` | yes (`"nope"`) | Feedback upload off |
| `otel.metrics_exporter="none"` | yes (`bogus`) | Metrics exporter (Statsig → ab.chatgpt.com) off |
| `otel.exporter="none"` | yes (`"bogus"`) | OTel log export off |
| `otel.trace_exporter="none"` | yes (`"bogus"`) | OTel trace export off |
| `check_for_update_on_startup=false` | yes (`"nope"`) | Update check off |

## Not switchable, or not verified

- **Model traffic and sign-in.** `api.anthropic.com` / `claude.ai` for Claude Code and `chatgpt.com` for Codex are the user's own model calls and token refresh. They are essential and stay on.
- **Codex analytics host.** Codex sends model traffic and its account calls to the same `chatgpt.com` host, so a network capture cannot show that analytics stopped. Only the config switch is known.
- **User settings files.** Claude Code applies the `env` block of the user's `~/.claude/settings.json` itself, inside the CLI, after Countersign hands over the env; Codex reads `~/.codex/config.toml` and managed requirements (`-c` overrides take precedence over `config.toml`). A user who puts e.g. `DISABLE_TELEMETRY` or `CLAUDE_CODE_ENABLE_TELEMETRY` in that `env` block can change what the CLI sees; Countersign cannot test or prevent this without running the CLI. Countersign's own settings (host behaviour flags, auth env) cannot re-enable a forced switch (tested).
- **Explicit actions.** Installing a plugin, adding a marketplace or running `/login` inside an engine still goes to the network when the user asks for it.
- **No live re-capture.** After this change, no network capture of a full session was run, because the owner's app was not relaunched for this fix. The next acceptance run should repeat the process-tree capture and confirm that `downloads.claude.ai` and `github.com` are gone.
