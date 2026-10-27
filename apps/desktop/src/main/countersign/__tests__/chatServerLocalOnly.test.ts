import { describe, expect, it, vi } from 'vitest';

// The chat server's import graph touches many electron APIs; none run here.
vi.mock('electron', () => {
  const stub = (): unknown => new Proxy(() => undefined, { get: (_t, key) => (key === 'then' ? undefined : stub()) });
  const app = { isPackaged: true, getPath: () => '/isolated', on: vi.fn(), whenReady: () => Promise.resolve() };
  return new Proxy({ app, default: { app } } as Record<string | symbol, unknown>, {
    has: () => true,
    get: (target, key) => (key in target ? target[key] : key === 'then' ? undefined : stub()),
  });
});

import { withChatServer } from '../../maker-ipc/chatServer';
import type { BotGroupChatService, BotGroupChatServiceDeps } from '../../maker-ipc/botGroupChatService';

describe('withChatServer under Countersign LOCAL_ONLY', () => {
  it('keeps group chat on the local service and builds no polling cloud client', () => {
    const local = { listGroups: vi.fn(), dispose: vi.fn() } as unknown as BotGroupChatService;
    const captureOwnerScope = vi.fn();
    const deps = { captureOwnerScope } as unknown as BotGroupChatServiceDeps;

    const service = withChatServer(local, deps);

    expect(service).toBe(local);
    // The cloud wrapper captures the owner scope when it builds its client.
    expect(captureOwnerScope).not.toHaveBeenCalled();
  });
});
