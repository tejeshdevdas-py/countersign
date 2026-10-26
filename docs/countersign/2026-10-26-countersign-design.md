# Countersign: design

Status: draft for approval, 2026-10-26. Author: Claude (Opus 5.5) with the owner.
Destination: this file moves into the Countersign repository once it exists. It must stay free of any employer, customer or personal-machine detail, because that repository is public.

## Intent

Countersign is a public, open-source desktop AI agent app. It is a fork of Cindy (`makecindy/cindy`, Apache-2.0, Electron/TypeScript) that runs fully on the user's own computer and adds one idea Cindy lacks: **team work reaches the user only after a second agent has checked it and signed it off**, including its changes to files. Ordinary chats stay fast and ungated, and say so.

Why: the owner wants Cindy's breadth (agents that do real work on the computer, teams, memory, schedules, plugins, skills) without depending on anyone's cloud, plus the working habits proven in the owner's private workspace: quality-gated teams, cheap routing for simple questions, cost visibility and a review loop for generated documents. Publishing it independently of any organisation is a goal in itself.

Success: the owner uses Countersign daily instead of the owner's private workspace, and a stranger can clone, build and run it on Windows from the README alone, with no account.

## Goals

1. A renamed, rebranded fork that builds and runs on Windows, published at `github.com/tejeshdevdas-py/countersign` as a public GitHub fork of `makecindy/cindy` (keeps the upstream link for merges).
2. Fully local: no sign-in, no analytics, no auto-update, no calls to Cindy's servers. The only outbound traffic is to the model providers the user configured.
3. Agents through the user's own access: Claude Code and Codex with their own subscription logins, the user's own API keys, or local models (LM Studio / Ollama / llama.cpp).
4. Quality-gated work: a team's result is reviewed against acceptance criteria before delivery; a failed review blocks delivery instead of showing an unchecked answer.
5. Cheap routing: short, low-risk questions are answered in one call; build work goes to the team.
6. Visibility: per-session token use and prompt-cache warm/cold state with an estimated cost of the next message.
7. Documents: agent-made pages and reports are filed in one index and can be reviewed with pinned comments that feed back to the agent.
8. Routines with hard caps: scheduled jobs with a weekly run cap and a per-run budget.

## Non-goals (for now)

- Phone app, device link, cross-device sync, sharing, plugin/skill store, Cindy's paid model service, cloud voice. They depend on Cindy's servers; local replacements may come later (see Later).
- Self-hosting Cindy's backend. It is not published.
- macOS and Linux packaging. The code stays cross-platform where upstream already is, but only Windows is built and tested.
- Contributing changes back upstream.

## Anti-goals (would make it a failure even if it works)

- Any outbound request to `*.cindy.app` or another third party not chosen by the user.
- Any employer, customer, project-specific or personal-machine detail in the repository or its history (names, paths, keys, memory content). The port is clean-room from the owner's private workspace: features are re-implemented from their behaviour, not copied with their data.
- Using the Cindy name or logo for the product. Apache-2.0 grants no trademark rights.
- Removing Cindy's LICENSE, NOTICE or third-party notices.
- A fork that edits Cindy's core so widely that upstream merges become impractical.

## Constraints

- License: keep `LICENSE`, `NOTICE` ("Cindy, Copyright 2026 XD Inc.") and `docs/legal/notices/`; add a line to NOTICE that Countersign is a modified version; mark modified files as Apache §4 requires (a CHANGES file listing modified areas is acceptable).
- Upstream rule (Cindy's own): workflows go into Skills, integrations and rich UI into plugins, core stays generic. Countersign follows it. Core edits are allowed only for: branding, removing cloud/analytics/updater, and the quality-gate hook in the team workflow. Each such edit is listed in `FORK-CHANGES.md` so merges stay tractable.
- Database migrations: upstream rejects builds whose migration hash differs. New data goes into plugin storage or separate tables with their own migrations, never by editing upstream migrations.
- Build on Windows: Node 22.x, pnpm 10.x, Git LFS, Visual Studio C++ build tools, Python for native modules. `pnpm install` downloads the claude, codex, ripgrep and pi binaries; that is accepted.
- The private workspace repository stays private and untouched as the behavioural reference.

## Decisions taken

| Decision | Who |
| --- | --- |
| Fork Cindy as the base; the private workspace's features move in | Owner |
| Public project, independent of any organisation; drop employer and project-specific content | Owner |
| Fully local; drop features that need Cindy's servers | Owner |
| Repository under `tejeshdevdas-py` on GitHub | Owner |
| Sign-off scope: team runs work in a separate copy of the project and their file changes apply only after the review passes; ordinary chats stay ungated as in Cindy, clearly labelled "not reviewed", with a "send to team" action | Owner |
| Name "Countersign" | Claude (owner had no preference); a quick web search found no AI-agent app by that name; trademark registers not checked |
| Windows-first; first-version scope and milestone order below | Claude (owner said "you decide") |
| Clean-room port: re-implement the private workspace's behaviour, copy no data | Claude |
| The private workspace's features land as plugins/skills/MCP where upstream allows | Claude, from Cindy's product rules |

## Milestones (the order is the plan's spine)

**M1. Runs and is yours.** Fork; rename the product, app id, installer, window titles, icons and user-visible strings; keep the upstream remote. Remove or disable: sign-in screens (start in local mode), TapDB analytics, heartbeat, log upload, auto-updater (both `updateService` and the updater binary), endpoint manifests and every code path that calls them. Agents run with Claude Code and Codex logins and with a local model. Done when: a clean Windows machine builds and launches it from the README, an agent task completes on each engine, and a network capture of a full session shows traffic only to the configured model providers.

**M2. Checked work.** Team runs work in a separate copy of the project (a git worktree when the project is a git repository, otherwise a folder copy); their file changes are applied to the real project only after the final review passes, and are discarded or kept for inspection when it fails. Ordinary chats keep Cindy's behaviour, carry a visible "not reviewed" label, and offer "send to team", which re-runs the request as a gated team run. Extend the Orca team and Cindy's reviewer so that a team run has acceptance criteria from the lead, a reviewer verdict per step in a strict JSON contract (pass needs every check true, score at least 85 and no issues), one escalation to a stronger model on failure, and a blocked state that delivers nothing when the escalation also fails. Add the one-call route for short, low-risk prompts with nothing to build, labelled "not independently reviewed". Workers must show inputs and printed results for any check they claim. Done when: tests cover pass, fail-then-escalate, fail-blocked, one-call and "failed run leaves the real project untouched" cases, and a real two-step task shows the verdicts in the UI and applies its changes only after the pass.

**M3. Cost and schedules.** A cache view: each recent session's idle time, warm/cold state against the measured cache lifetime, context size, and estimated cost of the next message warm and cold, labelled as an API-price estimate, not a charge. Routines on Cindy's scheduler gain a weekly run cap and a per-run budget, with a run log. Done when: the view matches the session files it reads, and a capped routine refuses its extra run with a clear message.

**M4. Documents and review.** A documents plugin: an index of every page and report agents made, newest first, searchable; a review screen to pin comments on a page and send them back to the agent as a follow-up. Ships with one neutral document style (not the private workspace's styles). Done when: an agent-made page appears in the index, and a pinned comment produces a follow-up task.

**M5. Publish.** README (what it is, build steps, what was removed and why), CHANGES/NOTICE update, FORK-CHANGES.md, a scrub check (no employer names, no local paths, no keys, no emails other than the owner's public GitHub identity) run as a script and in CI. Owner approves, then push and make it public.

## Later (not in the first version)

Local chat bots (Telegram, Discord via the user's own bot token), local speech-to-text, a phone page served on the home network, macOS/Linux builds.

## Calls made after the builder check (Claude's, for the owner to check)

1. **Core edits list is open but logged.** Besides branding, cloud removal and the gate hook, core edits are allowed where no plugin hook exists: the one-call router at prompt dispatch, caps and budgets in the scheduler, a read path for session/usage data, and shipping Countersign's own plugins as built-ins (the store is gone). Every core edit is listed in `FORK-CHANGES.md` with the reason; prefer the smallest hook that lets a plugin do the rest.
2. **Reviewer independence.** The reviewer is always a fresh context that sees only the request, the acceptance criteria, the candidate output and the workspace evidence, never the worker's reasoning. When a second model or engine is configured it reviews instead of the worker's model. Escalation order: the user's configured models ranked by a tier field in settings (defaults: frontier > standard > lean > local). A user with one model escalates once to the same model at higher reasoning effort, then blocks. Team runs are never refused.
3. **Permitted outbound traffic (M1 check).** Allowed: the configured model providers' API and login hosts, and traffic a task itself causes on the user's request (web pages it browses, MCP servers the user added, package installs). Not allowed: anything to `*.cindy.app` or analytics hosts. CLI telemetry: switched off where the CLI offers a switch (for Claude Code `DISABLE_TELEMETRY=1` and `DISABLE_ERROR_REPORTING=1`; Codex's equivalent config if one exists), recorded in the README where it cannot be.
4. **Scope of "daily replacement".** Goals 1-8 are the complete first-version scope. Memory comes from Cindy's existing memory module, provider switching from Cindy's model settings. Browser clipper, notes/backlogs and writing-voice skills are Later.
5. **Cache view and budgets.** The view covers Claude Code sessions Countersign launched; Codex and local-model sessions show tokens only, cache state "not applicable". Prices come from the offline model catalog bundled in the client, refreshed by hand in releases. A routine's budget is in tokens (input + output), checked between calls; the run stops at the first check over budget and is logged as "stopped: budget". The weekly cap is in runs.
6. **Subscription logins.** If linking a Claude Code or Codex subscription needs Cindy's servers, Countersign runs the user's own installed `claude` / `codex` CLI with its existing login instead of the bundled binary for that engine. M1's done criterion is checked with whichever path works, and the README says which.

## Left to the builder

- Exact files and order within each milestone, test layout, CI setup.
- How each private-workspace behaviour maps onto Cindy's existing memory, scheduler, Orca and usage modules (extend first, add new only when extending would mean broad core edits).
- Icon and visual identity, within "not Cindy's".
- How to prove "no outbound traffic" (proxy capture, firewall rule, or test harness).
