/**
 * Countersign (final fix round 1, journey-3): under the real LOCAL_ONLY switch the device
 * link is off, so no tool the model reads may take a parameter for another computer or
 * describe one. This covers the scheduler tools, get_chat_history, get_task_digest and
 * the Orca tools (get_workspace_info, create_worker, create_workers,
 * list_available_models). The upstream cross-computer cases keep running with
 * LOCAL_ONLY mocked off in their own files.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { LOCAL_ONLY } from "@cindy/maker-shared/local-only";
import {
  SCHEDULER_CATEGORY_DESCRIPTIONS,
  createSchedulerMcpServer,
} from "../cindy_schedulerMcpServer.js";
import { SchedulerToolRegistry } from "../cindy_schedulerToolRegistry.js";
import { XdtHelperToolRegistry } from "../lizi_xdtHelperToolRegistry.js";
import { createOrcaMcpServer } from "../orca/server.js";
import type { OrcaMcpDeps } from "../orca/server.js";
import {
  registerScheduleCreateTool,
  registerScheduleDeleteTool,
  registerScheduleGetTool,
  registerScheduleListModelsTool,
  registerScheduleListRunsTool,
  registerScheduleListTool,
  registerSchedulePauseTool,
  registerScheduleResumeTool,
  registerScheduleRunNowTool,
  registerScheduleUpdateTool,
} from "../scheduler/index.js";
import type { SchedulerMcpDeps } from "../types.js";
import type { XdtHelperHistoryDeps } from "../xdt-helper/_history_types.js";
import { registerGetChatHistoryTool } from "../xdt-helper/get_chat_history.js";
import { registerGetTaskDigestTool } from "../xdt-helper/get_task_digest.js";

/** Wording that points the model at another computer or at the device link. */
const OTHER_COMPUTER =
  /其它电脑|其他电脑|另一台电脑|别的电脑|各自的电脑|跨电脑|同账号|所查的电脑|目标电脑|那台电脑|device="all"|device=<|deviceId::|execution_device|agent_device|agentDeviceId|other (?:same-account )?computers?|another computer|cross-device|device-link|remote control|远程控制/i;

function fieldTexts(shape: Record<string, z.ZodTypeAny>): string {
  return Object.entries(shape)
    .map(([key, schema]) => `${key}: ${schema.description ?? ""}`)
    .join("\n");
}

function schedulerDeps(): SchedulerMcpDeps {
  return {
    getScheduler: () => ({ list: vi.fn(async () => []) }),
    listModels: vi.fn(async () => ({
      ok: true,
      agentDeviceId: null,
      locations: [{ agentDeviceId: "other-pc", name: "Other PC" }],
    })),
    remote: {
      listDevices: vi.fn(async () => []),
      invoke: vi.fn(async () => ({ ok: true, data: [] })),
    },
  } as unknown as SchedulerMcpDeps;
}

function schedulerRegistry(deps = schedulerDeps()): SchedulerToolRegistry {
  const registry = new SchedulerToolRegistry();
  const ctx = () => ({ agentKind: "codex" as const, workingDir: "/repo" });
  registerScheduleListTool(registry, deps);
  registerScheduleGetTool(registry, deps);
  registerScheduleListRunsTool(registry, deps);
  registerScheduleListModelsTool(registry, deps);
  registerScheduleCreateTool(registry, deps, ctx);
  registerScheduleUpdateTool(registry, deps, ctx);
  registerSchedulePauseTool(registry, deps, ctx);
  registerScheduleResumeTool(registry, deps);
  registerScheduleRunNowTool(registry, deps);
  registerScheduleDeleteTool(registry, deps, ctx);
  return registry;
}

const SCHEDULER_TOOLS = [
  "schedule_list",
  "schedule_get",
  "schedule_list_runs",
  "schedule_list_models",
  "schedule_create",
  "schedule_update",
  "schedule_pause",
  "schedule_resume",
  "schedule_run_now",
  "schedule_delete",
];

function textOf(result: unknown): string {
  const content = (
    result as { content?: Array<{ type: string; text?: string }> }
  ).content;
  return content?.[0]?.text ?? "";
}

async function connected(server: { connect: (t: never) => Promise<void> }) {
  const client = new Client({ name: "local-only-devices", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st as never), client.connect(ct)]);
  return client;
}

describe("tools that described other computers, under LOCAL_ONLY", () => {
  it("runs under the real switch", () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each(SCHEDULER_TOOLS)(
    "%s takes no device parameter and names no other computer",
    (name) => {
      const tool = schedulerRegistry().get(name);
      expect(tool, name).toBeTruthy();
      const shape = tool!.inputShape as Record<string, z.ZodTypeAny>;
      expect(Object.keys(shape)).not.toContain("device");
      expect(Object.keys(shape)).not.toContain("agentDeviceId");
      expect(tool!.description).not.toMatch(OTHER_COMPUTER);
      expect(fieldTexts(shape)).not.toMatch(OTHER_COMPUTER);
    },
  );

  it("the scheduler server's entry tools and category text name no other computer", async () => {
    expect(SCHEDULER_CATEGORY_DESCRIPTIONS.scheduler).not.toMatch(
      OTHER_COMPUTER,
    );
    const client = await connected(
      createSchedulerMcpServer(schedulerDeps()) as never,
    );
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        "call_tool",
        "list_tools",
      ]);
      for (const tool of tools)
        expect(tool.description).not.toMatch(OTHER_COMPUTER);
    } finally {
      await client.close();
    }
  });

  it('schedule_list reads this computer only, even when asked for device="all"', async () => {
    const deps = schedulerDeps();
    const client = await connected(createSchedulerMcpServer(deps) as never);
    try {
      const result = await client.callTool({
        name: "call_tool",
        arguments: { name: "schedule_list", args: { device: "all" } },
      });
      expect(textOf(result)).not.toMatch(OTHER_COMPUTER);
      expect(deps.remote!.listDevices).not.toHaveBeenCalled();
      expect(deps.remote!.invoke).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });

  it("schedule_list_models lists no other location", async () => {
    const tool = schedulerRegistry().get("schedule_list_models")!;
    const payload = JSON.parse(textOf(await tool.handler({} as never)));
    expect(payload.data.locations).toEqual([
      { agentDeviceId: "local", name: "local" },
    ]);
  });

  it("get_chat_history and get_task_digest describe this computer's history only", () => {
    const registry = new XdtHelperToolRegistry();
    const history = {
      getMessages: vi.fn(),
      taskDigest: vi.fn(),
    } as unknown as XdtHelperHistoryDeps;
    registerGetChatHistoryTool(registry, { history });
    registerGetTaskDigestTool(registry, { history });
    for (const name of ["get_chat_history", "get_task_digest"]) {
      const tool = registry.get(name);
      expect(tool, name).toBeTruthy();
      expect(tool!.description, name).not.toMatch(OTHER_COMPUTER);
      expect(
        fieldTexts(tool!.inputShape as Record<string, z.ZodTypeAny>),
        name,
      ).not.toMatch(OTHER_COMPUTER);
    }
  });

  it("the Orca tools take no device parameter and name no other computer", async () => {
    const calls: Record<string, ReturnType<typeof vi.fn>> = {};
    const deps = new Proxy({} as OrcaMcpDeps, {
      get: (_target, key) => {
        if (typeof key !== "string" || key === "then") return undefined;
        if (key === "authorizeCall") return undefined;
        calls[key] ??= vi.fn(async () => ({
          ok: true,
          workflow: null,
          ui_capacity: 1,
          worker_count: 0,
          workers: [],
          execution_devices: [{ device_id: "other-pc", supported: true }],
        }));
        return calls[key];
      },
    });
    const server = createOrcaMcpServer(deps, {
      agentKind: "codex",
      workingDir: "/repo",
      sessionId: "lead-1",
      vendorOptions: { orcaRole: "lead" },
    });
    const client = await connected(server as never);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      for (const name of [
        "get_workspace_info",
        "create_worker",
        "create_workers",
      ]) {
        expect(names).toContain(name);
      }
      for (const tool of tools) {
        expect(tool.description ?? "", tool.name).not.toMatch(OTHER_COMPUTER);
        expect(JSON.stringify(tool.inputSchema), tool.name).not.toMatch(
          OTHER_COMPUTER,
        );
      }
      const info = await client.callTool({
        name: "get_workspace_info",
        arguments: {},
      });
      expect(textOf(info)).not.toContain("execution_devices");
    } finally {
      await client.close();
    }
  });
});
