# Countersign fork changes

Countersign is a fork of [Cindy](https://github.com/makecindy/cindy) (Apache-2.0). This file lists every change to upstream files, so upstream merges stay tractable and Apache-2.0 section 4(b) (modified files carry notice) is met. Countersign's own new files are listed only when they replace upstream behaviour.

Base: `makecindy/cindy` main at `0f70b883436cbc31b6f9338c6a304e18a3d72bb6` (2026-10-26).

## Baseline at 0f70b88

`pnpm --filter desktop test` with Node 22.22.3 on Windows 11, before any Countersign change: 4,059 test files (33 failed, 4,011 passed, 15 skipped); 66,304 tests (142 failed, 65,862 passed, 300 skipped); 506 s. The failures are upstream's and are not fixed here; most are git-integration, local-database worker and remote-agent end-to-end tests. Later changes are judged only on failures outside this set. The failing files are:

- `apps/desktop/src/main/__tests__/codexLocalSessions.test.ts`
- `apps/desktop/src/main/bot-import/__tests__/botTakeover.test.ts`
- `apps/desktop/src/main/bot-import/__tests__/takeover.test.ts`
- `apps/desktop/src/main/cindy-brain/__tests__/ghostInstallReceipt.test.ts`
- `apps/desktop/src/main/cindy-brain/__tests__/skillSlot.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/featureHistory.git-integration.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/keepChanges.git-integration.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/personalBuild.git-integration.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/personalCombine.git-integration.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/syncJourneys.git-integration.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/taskCleanup.git-integration.test.ts`
- `apps/desktop/src/main/cindy-make/__tests__/upstreamMerge.git-integration.test.ts`
- `apps/desktop/src/main/cindy-media/__tests__/taskImageDelivery.test.ts`
- `apps/desktop/src/main/companion-cloud/__tests__/replyArtifacts.test.ts`
- `apps/desktop/src/main/localDb/__tests__/drizzle-proxy-perf.test.ts`
- `apps/desktop/src/main/localDb/__tests__/remoteHistoryPagination.test.ts`
- `apps/desktop/src/main/localDb/client/__tests__/DbClient.inproc.test.ts`
- `apps/desktop/src/main/localDb/client/__tests__/WorkerThreadTransport.test.ts`
- `apps/desktop/src/main/localDb/ipc/__tests__/sessionAutoTitlePersist.test.ts`
- `apps/desktop/src/main/localDb/ipc/__tests__/sessionsHiddenTasks.test.ts`
- `apps/desktop/src/main/localDb/ipc/__tests__/sessionsRestoreIfArchived.test.ts`
- `apps/desktop/src/main/maker-host/__tests__/piGatewaySessionAffinity.integration.test.ts`
- `apps/desktop/src/main/maker-ipc/__tests__/chatServerReplyFiles.test.ts`
- `apps/desktop/src/main/mcp-integrations/__tests__/browserScreenshotResolver.test.ts`
- `apps/desktop/src/main/remote-agent/__tests__/claudeHosted.e2e.test.ts`
- `apps/desktop/src/main/remote-agent/__tests__/startupProbe.e2e.test.ts`
- `apps/desktop/src/main/remote-agent/executor/__tests__/gitCredentials.git-integration.test.ts`
- `apps/desktop/src/main/reviewer/__tests__/reviewSelfCheck.git-integration.test.ts`
- `apps/desktop/src/main/reviewer/__tests__/reviewSubmoduleIdentity.git-integration.test.ts`
- `apps/desktop/src/main/skillhub/__tests__/installService.test.ts`
- `apps/desktop/src/main/skillhub/__tests__/scanner.test.ts`
- `apps/desktop/src/main/task-migration/__tests__/workspace.git-integration.test.ts`
- `apps/desktop/src/main/worktree/__tests__/branchSync.git-integration.test.ts`

## Changes

| File | Change | Why |
| --- | --- | --- |
| `.gitignore` | Ignore `.scrub-patterns`, `egress-log.jsonl`, `.superpowers/` | Local-only scrub words, egress logs and build scratch never get committed |
