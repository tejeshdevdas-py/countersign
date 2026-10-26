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
| `packages/maker-shared/src/branding.ts` | `BRAND_NAME` is `Countersign` | Product display name |
| `packages/maker-shared/src/brandIdentity.ts` | App ids, executable and user-data names, `countersign` deep-link scheme (no legacy schemes), db prefix | Fork identity; `cdnPrefix`, `updaterName` and the `xdt-maker` legacy data names stay to keep merges small |
| `packages/maker-shared/src/__tests__/brandIdentity.test.ts` | Expected values updated to the Countersign identity; cn/global now share app id and user-data dir | Upstream invariants assumed two split channels |
| `packages/maker-shared/src/__tests__/agentInputProjection.test.ts` | `cindy://` links and bot name use `countersign` / `Countersign` | Deep-link parser follows the primary scheme |
| `packages/maker-shared/src/__tests__/deviceLinkContract.test.ts` | Expects `Countersign` in auth guidance | Follows `BRAND_NAME` |
| `apps/desktop/forge.config.ts` | Deb maintainer, Windows `ProductName`, deep-link name, mac display name, cartridge type name use Countersign | User-visible packaging strings; exe/appId/shortcut already derive from `BRAND_IDENTITY` |
| `apps/desktop/package.json` | `productName` and `author` are Countersign | Packaging metadata |
| `apps/desktop/resources/icon.ico` | Replaced with original Countersign mark (16-256 px) | No Cindy logo in shipped assets |
| `apps/desktop/resources/icon.png` | Replaced with original Countersign mark (512 px) | Same |
| `apps/desktop/resources/icon-master-1024.png` | Replaced with original Countersign mark (1024 px) | Same |
| `apps/desktop/resources/icon-dock.png` | Replaced with original Countersign mark (512 px) | Same |
| `apps/desktop/resources/icon.icns` | Replaced with original Countersign mark (PNG entries 32-1024 px; no legacy ic04/ic05) | Same |
| `apps/desktop/cindy-updater/src-tauri/icons/icon.ico` | Regenerated from the Countersign master icon with `scripts/generate-win-ico.mjs` | Test requires updater icons to match the main icons; no Cindy logo |
| `apps/desktop/cindy-updater/src-tauri/icons/icon.png` | Regenerated from the Countersign master icon | Same |
| `apps/desktop/src/main/__tests__/agentInputQueue.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/claudeOrphanReaper.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/deepLink.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/deepLinkWindowsRegistration.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/devKeychainMarkerIo.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/devKeychainName.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/installCliCommand.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/oauthResultPage.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/regionUserData.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/sessionTaskSummary.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/__tests__/windowsShortcutSelfHeal.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/cindy-make/__tests__/personalBuild.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/cindy-make/__tests__/versionLaunchArguments.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-host/__tests__/codexAuthIsolatedSandbox.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-host/__tests__/session-search.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-host/__tests__/sessionSearch.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/agent-input-coordinator.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/agentHandoff.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/agentInputReferences.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/autoReviewUserIntent.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/chatServerInvitations.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/contextOverflowRollover.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/__tests__/makerSendTransaction.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/main/maker-ipc/chatServer.ts` | Generated invite link uses `DEEP_LINK_URL_PREFIX` | Follows the primary scheme |
| `apps/desktop/src/preload/__tests__/deepLinkIslandEntryBridge.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/atResourceService.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/composerStructuredLists.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/imageRefParseUserContent.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/pastePipeline.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/remarkSessionLinks.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/sessionDeepLink.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/sessionLinkPaste.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/sessionMessageChipPresentation.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/__tests__/userMessageLinkify.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/components/chat/__tests__/ProjectLinkChip.test.tsx` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/components/chat/__tests__/embeddedSessionNavigation.test.tsx` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/features/bots/ChatInviteHost.tsx` | Invite link uses `DEEP_LINK_URL_PREFIX` | Follows the primary scheme |
| `apps/desktop/src/renderer/features/bots/__tests__/ChatInviteHost.test.tsx` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/features/bots/__tests__/chatInviteBrowserHandoff.test.tsx` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/features/cc-agent/__tests__/splitGroupDnd.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/lib/__tests__/queueComposerEdit.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/renderer/lib/atResourceService.ts` | Browser-tab and desktop-window references use `DEEP_LINK_URL_PREFIX` | Hardcoded `cindy://` would no longer parse after the scheme change |
| `apps/desktop/src/shared/__tests__/autoTitleSeed.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/shared/__tests__/deepLinkSchemes.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `apps/desktop/src/shared/agentInputQueue.ts` | Session-link regex built from `DEEP_LINK_SCHEME_RE_GROUP` | Hardcoded `(cindy|xdt-maker)` scheme would no longer match |
| `packages/device-link/src/chatInvitation.ts` | Also accepts `countersign://chat-invite/` (upstream prefix kept) | Parser must read links built with the new scheme |
| `apps/desktop/src/renderer/__tests__/pendingQueueDefer.test.ts` | Expected values updated to the Countersign identity (`countersign://` scheme, Countersign names, app id) | Upstream test pinned Cindy values |
| `packages/maker-shared/src/brandIdentity.ts` (fix round 1) | All legacy data-dir, dialogue-dir and db-prefix lists emptied (`xdt-maker` removed) | A `cn` build must never import from or reap processes of a real Cindy install |
| `apps/desktop/src/main/__tests__/deepLink.test.ts` (fix round 1) | Shared-task and provider-share tests split into parse (`cindy:`) and argv-redaction (`countersign:`) cases. Known gap: those two invitation parsers still require the `cindy:` scheme; the cloud features are removed in Task 4 | No single link is accepted by both the parser and the redactor |
| `apps/desktop/forge.config.ts` (fix round 1) | win32metadata `CompanyName` is `Countersign contributors` | No upstream company name in shipped metadata |
| `apps/desktop/package.json` (fix round 1) | `description` is `Countersign desktop client` | User-visible product name |

| `apps/desktop/src/renderer/i18n/locales/{en,ja,ko,zh-CN,zh-TW}/common.json` (aiRename.json unchanged: no matches) | Every Latin word `Cindy` in string values replaced by `{{appName}}` (en 643, ja 606, ko 607, zh-CN 626, zh-TW 624); keys untouched. `{{appName}}` is already a global i18n default filled from `BRAND_NAME`. Cloud service/account strings also got it; those screens go in later tasks | User-visible text must say Countersign |
| `apps/desktop/src/main/clientEndpointsService.ts` | Retry dialog title uses `BRAND_NAME` | Literal `'Cindy'` dialog title |
| `apps/desktop/src/main/cindy-make/remoteProvider.ts` | Remote collection title is `` `${BRAND_NAME} Make` `` | Literal `'Cindy Make'` title |
| `apps/desktop/src/main/smoke/computerUseSmoke.ts` | Smoke window title uses `BRAND_NAME` | Literal `'Cindy Computer Use Smoke'` title |
| `package.json` | Added script `check:countersign-brand`; added `scripts/countersign/__tests__/brand-guard.test.mjs` to `test:runner` | Brand guard and its test run with the repo's checks |
| `apps/desktop/src/main/__tests__/notificationService.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/__tests__/sessionNotificationCopy.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/agent-island/__tests__/service.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/cindy-brain/__tests__/ghostExternalLinkNavigation.i18n.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/hook-control/__tests__/dispatcher.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/im/shared/__tests__/turnRunnerSendOutcome.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/maker-ipc/__tests__/sessionEventPipeline.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/main/menubar/__tests__/snapshot.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/__tests__/HookTaskCard.test.tsx` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/__tests__/ghostSummonChip.test.tsx` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/__tests__/ipcErrorModelWindowCodes.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/components/cindy-make/__tests__/CindyMakePreflightDialog.i18n.test.tsx` | Test i18n instance (or expected raw string) fills `{{appName}}` from `BRAND_NAME`; expected product name updated | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/components/cindy-make/__tests__/CindyMakeSync.test.tsx` | Test i18n instance (or expected raw string) fills `{{appName}}` from `BRAND_NAME`; expected product name updated | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/components/cindy-make/__tests__/CindyMakeTestCard.i18n.test.tsx` | Test i18n instance (or expected raw string) fills `{{appName}}` from `BRAND_NAME`; expected product name updated | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/components/cindy-make/__tests__/CindyMakeVersionsPanel.i18n.test.tsx` | Test i18n instance (or expected raw string) fills `{{appName}}` from `BRAND_NAME`; expected product name updated | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/components/login/__tests__/legalSegments.catalog.test.ts` | Expected text measured with `{{appName}}` replaced by `BRAND_NAME`; the 3-line cap is checked in total rows, since the longer name may wrap a line | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/components/settings/__tests__/settingsSearchCatalog.test.ts` | Test i18n instance (or expected raw string) fills `{{appName}}` from `BRAND_NAME`; expected product name updated | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/features/billing/__tests__/BillingPage.test.tsx` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/features/cc-agent/sidebar/__tests__/DeviceSectionHeader.test.tsx` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/features/remote-desktop/__tests__/TaskRemoteDesktopButton.test.tsx` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
| `apps/desktop/src/renderer/lib/__tests__/cindyMakeCommand.test.ts` | Expected user-visible text updated from Cindy to Countersign (or to the raw `{{appName}}` placeholder where the test reads the locale file) | Upstream test pinned the Cindy wording |
