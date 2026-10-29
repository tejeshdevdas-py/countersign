# Countersign M1: acceptance run

This records the live acceptance run for milestone 1 (plan Task 7, Step 8). It describes what was observed on the owner's Windows 11 x64 machine. It does not cover a clean-machine build; that is Task 7 Step 7, which is still open.

## Installer

- File: `Countersign-unversioned-Setup.exe` (NSIS, unsigned, smoke test skipped)
- Size: 431,169,793 bytes
- sha256: `ff2199fa93cf9ae21de4209b037f26179552f2988b3aa4021f7674704beb6f30`
- Built from: commit subject "Countersign: the build-intermediate patterns live in forge-prune-runtime.ts". `build-info.json` names this commit.
- Build: `pnpm release:package -- --platform win32 --allow-unsigned --skip-smoke`, exit 0. The postPackage check found no build intermediates and no user name in a profile path in the packaged app.
- Installed copy: its `resources/app.asar` is byte-identical (sha256) to the packaged build output.

## Engines and sign-in

| Engine | How it was signed in | Result |
| --- | --- | --- |
| Claude Code (bundled) | The owner's own claude.ai login. During the final run its sign-in had expired, and the owner signed in again. | Wrote `final-claude.txt` containing exactly `final claude ok`. |
| Codex (bundled) | The owner's own ChatGPT login | Wrote `final-codex.txt` containing exactly `final codex ok`. |
| Pi with a local model (LM Studio, Qwen3.5 9B) | None (local) | Wrote a file in an earlier run on a previous build. It was not repeated on this installer. |

Neither final chat had a project, so each worked in its own private per-chat folder under Countersign's app data. This is upstream behaviour: a chat with a project works in the project folder.

## Network

### The app's own traffic (final run, this installer)

The app was started with `COUNTERSIGN_EGRESS_LOG` set and quit from the tray. `node scripts/countersign/egress-report.mjs` then exited 0:

- allowed: `chatgpt.com`, `127.0.0.1`
- blocked: none
- unexpected: none
- egress guard not installed: none
- malformed lines: 0
- entries: 5 over about 5 minutes

The owner also reports these steps done during the run:
- opening a `.drawio` file with AWS shapes;
- opening a Draco-compressed `.glb`;
- opening Settings > Computer Use;
- a mail preview.

No host from the diagram viewer, font services, model decoders or avatar services appears in the log. The controller did not observe these steps directly.

### Engine traffic (earlier runs, previous builds)

The engines run as separate processes, so their traffic is not in the app's log. A process-tree capture during the earlier runs saw:
- Claude Code reaching `api.anthropic.com`;
- Codex and the app reaching `chatgpt.com`.

Before the engine telemetry switches were added, Claude Code also reached `downloads.claude.ai`, and `github.com` through git. Neither appeared in the repeat run after the switches. No Cindy host or address was seen in any run.

The process-tree capture was not repeated on this installer.

## Offline start

On a previous build, the app opened to the main screen with no login screen. The network state during that launch was not confirmed, so the offline start counts as not verified.

## What did not work, or was not checked

- **Claude Code sign-in.** It expired between runs. The error was "OAuth session expired and could not be refreshed", and the owner had to sign in again.
- **Local model context.** With LM Studio's default 8192-token context, the Pi engine failed: the prompt was about 10,800 tokens. The model picker shows a 200K context from its catalog. It worked after the model was reloaded with a larger context. The context display is not fixed in M1.
- **Not checked on this installer:**
  - the offline start;
  - the local-model task;
  - a process-tree capture of the engines.
- **Not done:** the clean-machine build from the README (Task 7 Step 7).
- **Builder's user name:** six Rust-built helpers in `resources\tools` carry the Windows user name of the machine that built the installer. The build reports them; see README limit 27.
