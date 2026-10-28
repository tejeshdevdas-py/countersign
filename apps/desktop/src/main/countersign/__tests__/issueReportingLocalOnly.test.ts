/**
 * Countersign: the in-app issue reporter and the "my issues" tracker post to
 * and read the upstream project's GitHub repository under the user's own
 * account. Under LOCAL_ONLY (true in this build) the model gets no
 * submit_github_issue tool, /issue is not offered, the submit path refuses
 * before any confirm card or request, and the my-issues list handler refuses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  capabilities: vi.fn(() => ({ canUseCindyAccountServices: true })),
  serverApiFetch: vi.fn(),
  listMyIssues: vi.fn(),
  readSnapshot: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0', getLocale: () => 'en', getPath: () => '', isPackaged: false },
  ipcMain: {
    handle: vi.fn((name: string, handler: (event: unknown, ...args: unknown[]) => unknown) =>
      h.handlers.set(name, handler),
    ),
  },
  BrowserWindow: { getAllWindows: () => [] },
  webContents: { fromId: () => undefined },
}));
vi.mock('../../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../security/trustedAppRenderer.js', () => ({
  assertTrustedAppRendererEvent: vi.fn(),
  isTrustedAppRendererWindow: () => true,
}));
vi.mock('../../authManager', () => ({ getCurrentMembershipDisplayName: () => 'someone' }));
vi.mock('../../serverApiClient', () => ({ serverApiFetch: h.serverApiFetch }));
vi.mock('../../clientEndpointsService', () => ({ getClientEndpoint: vi.fn() }));
vi.mock('../../appCapabilities.js', () => ({ getAppCapabilities: h.capabilities }));
vi.mock('../../appSessionState.js', () => ({ activeOwnerScopeKey: () => 'owner-a' }));
vi.mock('../../github-issue/cindyGithubGhostDeps.js', () => ({
  buildGithubUserSubmitterDeps: vi.fn(),
}));
vi.mock('../../github-issue/myIssuesRuntime.js', () => ({
  invalidateMyIssuesCache: vi.fn(),
  getMyIssuesService: () => ({ list: h.listMyIssues }),
  getMyIssuesSnapshot: h.readSnapshot,
}));
vi.mock('../../github-issue/submittedIssueLedger.js', () => ({ recordSubmittedIssue: vi.fn() }));
vi.mock('../../log-upload/collectRuntime', () => ({ collectLogsFromDisk: vi.fn() }));

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import { DesktopCommandRegistry } from '../../commands/registry.js';
import { registerBuiltinDesktopCommands } from '../../commands/builtins.js';
import { initGithubIssueSubmit, submitGithubIssueForSession } from '../../github-issue/index.js';
import { MAKER_INVOKE } from '../../maker-ipc/channels.js';
import { registerMyIssuesIpc } from '../../maker-ipc/my-issues.js';
import { ISSUE_REPORTING_DISABLED_MESSAGE, issueReportingToolDeps } from '../issueReporting.js';

beforeEach(() => {
  h.handlers.clear();
  vi.clearAllMocks();
});

describe('issue reporting under LOCAL_ONLY', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it('gives the model no submit_github_issue tool', () => {
    const submit = vi.fn();
    expect(issueReportingToolDeps(submit)).toEqual({});
  });

  it('does not offer /issue, and refuses to run it', async () => {
    const registry = new DesktopCommandRegistry();
    registerBuiltinDesktopCommands(registry, {
      getGoalController: () => ({}) as never,
      getLearnController: () => ({}) as never,
      isLearnEnabled: () => true,
      remoteInvoke: vi.fn(),
    });
    expect(registry.list().map((command) => command.name)).not.toContain('issue');
    expect(registry.list().map((command) => command.name)).toContain('help');
    await expect(registry.execute('issue', {})).rejects.toThrow(/unknown command/);
  });

  it('refuses a submission before any confirm card or request, even when the account could post', async () => {
    const request = vi.fn();
    initGithubIssueSubmit({ request } as never, async () => undefined);
    const result = await submitGithubIssueForSession({
      sessionId: 's1',
      agentKind: 'claude-code',
    } as never);
    expect(result).toEqual({
      ok: false,
      errorCode: 'AUTH_NOT_READY',
      message: ISSUE_REPORTING_DISABLED_MESSAGE,
    });
    expect(result.ok === false && result.message).not.toMatch(/Cindy/);
    expect(request).not.toHaveBeenCalled();
    expect(h.serverApiFetch).not.toHaveBeenCalled();
  });

  it('the my-issues list handler refuses and the snapshot is empty, with no lookup', async () => {
    registerMyIssuesIpc();
    const list = h.handlers.get(MAKER_INVOKE.MY_ISSUES_LIST);
    const snapshot = h.handlers.get(MAKER_INVOKE.MY_ISSUES_SNAPSHOT);
    // ipcMain.handle turns a synchronous throw into a rejected invoke.
    await expect(Promise.resolve().then(() => list?.({}, { force: true }))).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    await expect(Promise.resolve(snapshot?.({}))).resolves.toBeNull();
    expect(h.listMyIssues).not.toHaveBeenCalled();
    expect(h.readSnapshot).not.toHaveBeenCalled();
  });
});
