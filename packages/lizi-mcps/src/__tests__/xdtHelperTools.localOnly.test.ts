/**
 * Countersign: under the real LOCAL_ONLY switch (true in this build) the cindy_helper server
 * offers no tool for a switched-off feature. The Skill Hub market tools (search, list,
 * publish, status) all need the hosted Skill Hub, and list_history_devices and the history
 * `device` parameter need the device link. Local history tools stay, and neither the history
 * category text nor any history tool's text or fields names another computer (journey-3).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LOCAL_ONLY } from "@cindy/maker-shared/local-only";
import { createXdtHelperMcpServer } from "../lizi_xdtHelperMcpServer.js";
import { XdtHelperToolRegistry } from "../lizi_xdtHelperToolRegistry.js";
import type { XdtHelperHistoryDeps } from "../xdt-helper/_history_types.js";
import {
  registerGetChatHistoryTool,
  registerGetTaskDigestTool,
  registerListSessionQueueTool,
  registerListWorkdirsTool,
} from "../xdt-helper/index.js";
import { registerListSessionsTool } from "../xdt-helper/list_sessions.js";
import { registerSearchChatHistoryTool } from "../xdt-helper/search_chat_history.js";

const SWITCHED_OFF_TOOLS = [
  "search_skills",
  "list_my_published_skills",
  "publish_skill",
  "get_skill_publish_status",
  "list_history_devices",
];

/** Every tool the history category registers when all its dependencies are given. */
const HISTORY_TOOLS = [
  "list_workdirs",
  "list_sessions",
  "get_chat_history",
  "search_chat_history",
  "get_task_digest",
  "list_session_queue",
];

/** Wording that points the model at another computer (Chinese and English). */
const OTHER_COMPUTER =
  /跨电脑|其它电脑|其他电脑|另一台电脑|deviceId::|device 参数|device=|list_history_devices|other computer|another computer|remote device/i;

type ListedTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

function parsePayload(result: unknown): Record<string, unknown> {
  const content = (
    result as { content?: Array<{ type: string; text?: string }> }
  ).content;
  const first = content?.[0];
  if (!first || first.type !== "text" || !first.text)
    throw new Error("no text content");
  return JSON.parse(first.text) as Record<string, unknown>;
}

async function connect() {
  const history = {
    listWorkdirs: vi.fn(),
    listSessions: vi.fn(async () => ({
      ok: true,
      page: { items: [], nextCursor: null, hasMore: false },
    })),
    getMessages: vi.fn(),
    searchMessages: vi.fn(),
    taskDigest: vi.fn(),
    remote: {
      captureAccess: () => () => undefined,
      listDevices: vi.fn(async () => []),
      query: vi.fn(),
    },
  } as unknown as XdtHelperHistoryDeps;
  const sessionQueue = {
    listSessionQueue: vi.fn(),
    listSessionQueuedCounts: vi.fn(),
  };
  const server = createXdtHelperMcpServer(
    {
      resolveSurface: async () => "default",
      history,
      sessionQueue,
      skillhub: vi.fn(),
    } as unknown as Parameters<typeof createXdtHelperMcpServer>[0],
    { agentKind: "codex", workingDir: "/repo", sessionId: "local-task" },
  );
  const client = new Client({ name: "local-only-tools", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { server, client, history };
}

describe("cindy_helper tools under LOCAL_ONLY", () => {
  it("runs under the real switch", () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it("registers no Skill Hub market tool and no history device tool", async () => {
    const { server, client } = await connect();
    try {
      const overview = parsePayload(
        await client.callTool({ name: "list_tools", arguments: {} }),
      );
      const categories = (overview.categories as Array<{ name: string }>).map(
        (c) => c.name,
      );
      expect(categories).toContain("history");
      const names: string[] = [];
      for (const category of categories) {
        const listed = parsePayload(
          await client.callTool({
            name: "list_tools",
            arguments: { category },
          }),
        );
        for (const tool of (listed.tools ?? []) as ListedTool[])
          names.push(tool.name);
      }
      expect(names).toContain("list_sessions");
      expect(names).toContain("search_chat_history");
      for (const name of SWITCHED_OFF_TOOLS) expect(names).not.toContain(name);
      for (const name of SWITCHED_OFF_TOOLS) {
        const result = parsePayload(
          await client.callTool({
            name: "call_tool",
            arguments: { name, args: {} },
          }),
        );
        expect(result.ok, name).toBe(false);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("describes the history category and its tools as this computer only", async () => {
    const { server, client } = await connect();
    try {
      const overview = parsePayload(
        await client.callTool({ name: "list_tools", arguments: {} }),
      );
      const history = (
        overview.categories as Array<{ name: string; description: string }>
      ).find((c) => c.name === "history");
      expect(history?.description).toMatch(/\S/);
      expect(history?.description).not.toMatch(OTHER_COMPUTER);
      const listed = parsePayload(
        await client.callTool({
          name: "list_tools",
          arguments: { category: "history" },
        }),
      );
      const tools = (listed.tools ?? []) as ListedTool[];
      const names = tools.map((tool) => tool.name);
      expect([...names].sort()).toEqual([...HISTORY_TOOLS].sort());
      for (const tool of tools)
        expect(tool.description, tool.name).not.toMatch(OTHER_COMPUTER);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("gives no history tool a field for another computer", () => {
    const registry = new XdtHelperToolRegistry();
    const history = {
      listWorkdirs: vi.fn(),
      listSessions: vi.fn(),
      getMessages: vi.fn(),
      searchMessages: vi.fn(),
      taskDigest: vi.fn(),
    } as unknown as XdtHelperHistoryDeps;
    registerListWorkdirsTool(registry, { history });
    registerListSessionsTool(registry, { history });
    registerGetChatHistoryTool(registry, { history });
    registerSearchChatHistoryTool(registry, { history });
    registerGetTaskDigestTool(registry, { history });
    registerListSessionQueueTool(registry, {
      listSessionQueue: vi.fn(),
      listSessionQueuedCounts: vi.fn(),
    } as unknown as Parameters<typeof registerListSessionQueueTool>[1]);
    for (const name of HISTORY_TOOLS) {
      const tool = registry.get(name);
      expect(tool, name).toBeTruthy();
      expect(Object.keys(tool!.inputShape), name).not.toContain("device");
      const schema = JSON.stringify(
        z.toJSONSchema(z.strictObject(tool!.inputShape)),
      );
      expect(schema, name).not.toMatch(OTHER_COMPUTER);
    }
  });

  it("offers history on this computer only, with no device parameter", async () => {
    const registry = new XdtHelperToolRegistry();
    const history = {
      listSessions: vi.fn(),
      searchMessages: vi.fn(),
    } as unknown as XdtHelperHistoryDeps;
    registerListSessionsTool(registry, { history });
    registerSearchChatHistoryTool(registry, { history });
    for (const name of ["list_sessions", "search_chat_history"]) {
      const tool = registry.get(name);
      expect(tool, name).toBeTruthy();
      expect(Object.keys(tool!.inputShape), name).not.toContain("device");
      expect(tool!.description, name).not.toMatch(
        /list_history_devices|device="all"/,
      );
      expect(tool!.description, name).not.toMatch(/authorized computers/);
    }
  });

  it('never queries another computer, even when asked for device="all"', async () => {
    const { server, client, history } = await connect();
    try {
      await client.callTool({
        name: "call_tool",
        arguments: { name: "list_sessions", args: { device: "all" } },
      });
      expect(history.remote?.listDevices).not.toHaveBeenCalled();
      expect(history.remote?.query).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });
});
