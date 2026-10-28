/**
 * Countersign: the get_capabilities list under LOCAL_ONLY describes the app as it is.
 *
 * - Entries whose whole subject is switched off are left out (LOCAL_ONLY_HIDDEN_CAPABILITIES).
 * - Entries that stay but also described switched-off parts (other computers and remote
 *   control, chat-app channels, the Skill Hub market and publishing) are replaced by the
 *   local text below. Tool names are the upstream ones; only the switched-off parts are gone.
 *
 * Switched off under LOCAL_ONLY: sign-in and the hosted account, the app updater, the
 * plugin market and Skill Hub, the OAuth broker and hosted plugins (Feishu, Atlassian,
 * Google), chat-app bots, and the device link (other computers, remote control, the phone).
 */
import { BRAND_NAME } from '@cindy/maker-shared/branding';

import type { CapabilityEntry } from './capabilities.js';

/** Keys left out under LOCAL_ONLY, each with why. */
export const LOCAL_ONLY_HIDDEN_CAPABILITIES: ReadonlyMap<string, string> = new Map([
  ['issue-tracker', 'issue reporting is off; submit_github_issue is not registered'],
  ['auto-update', 'the app updater is off; Countersign is rebuilt from source'],
  [
    'feishu-integration',
    'Feishu sign-in, IM notifications and the hosted xd-feishu plugin are off',
  ],
  ['mobile-takeover', 'chat-app bots (Feishu /ctr takeover) are off'],
  ['jira', 'the tools it names were retired upstream into a hosted-broker plugin, which is off'],
  [
    'confluence',
    'the tools it names were retired upstream into a hosted-broker plugin, which is off',
  ],
  [
    'google-sheets',
    'the tool it names is not in this build; Google sign-in goes through the off OAuth broker',
  ],
  [
    'ai-art',
    'the tools it names are not in this build; it describes hosted media models and Feishu upload',
  ],
]);

/** Replacement text, by key, for entries that stay. */
export const LOCAL_ONLY_CAPABILITY_TEXT: ReadonlyMap<
  string,
  Omit<CapabilityEntry, 'key'>
> = new Map([
  [
    'self-management',
    {
      title: '自我管理(Agent 管理用户自己的任务 / 定时任务 / 项目 / 伙伴)',
      oneLiner: '用户本人能对自己的任务、定时任务、项目、伙伴做的操作，Agent 有哪些对应工具。',
      detail: [
        '【任务链接】已知任务 id 时调用 history/get_task_digest，返回的 sessionUrl 可直接写成 [任务标题](sessionUrl)。list_sessions、search_chat_history、get_chat_history 的任务元数据也附带 sessionUrl。',
        '【原则】用户本人能做的操作，Agent 也应有对应工具；是否执行由权限档与自动审核决定。',
        '【任务】cindy_helper history 类：list_sessions / search_chat_history、get_chat_history、get_task_digest(一件任务的 ≤2KB 摘要：状态、已持续分钟、最后的要求与回答、待答问题、错误、模型路线与建议换到的下一条、PR、排队数；只读)、list_workdirs、list_session_queue。handoff 类 send_to_session：发给既有任务，或新建任务。control 类：archive_sessions / unarchive_sessions、改名、移动、标签、排队消息、插话、停止、运行设置、list_projects 与项目增删改。',
        '【定时任务】cindy_scheduler：schedule_list / get / list_runs(list 可用 query 做文本筛选)、schedule_create、schedule_update / pause / resume / delete / run_now、schedule_set_pre_run_hook 与当前运行的通知设置。',
        '【伙伴】cindy_helper bots 类(仅伙伴任务可见)：list_agents / send_to_agent；资料、能力、待办、后台任务。list_teammate_projects / set_teammate_project 读取与修改自身关联项目，资料按需读取，关联不授予任务责任或执行权限。',
        '【自动跟进】宿主在任务卡住、等主人、出错、撞用量上限、做完时叫醒负责跟进的伙伴(内置例行任务)。伙伴先 get_task_digest 读摘要，再用 continue_workbench_task 让任务继续、send_to_session 代答低风险问题、set_session_runtime 换到 suggested_route、update_teammate_todo 记下要主人处理的事。get_workbench 是工作台「一眼」(等你 / 在做)；别的伙伴开的任务默认只读不继续(TASK_FOLLOWED_BY_OTHER_BOT，主人可在那位伙伴的设置里交出来)；其它伙伴只碰自己开的或接手的任务。',
        '【范围】任务、定时任务、项目与伙伴都保存在这台电脑上，这些工具只作用于本机。',
      ].join(' '),
    },
  ],
  [
    'session-handoff',
    {
      title: 'Session Handoff(把消息派给已存在的 session)',
      oneLiner:
        'skill 可读当前 sessionId,并把消息 handoff 到一个既有 session,适合把同一业务对象的二次处理路由回原上下文。',
      detail: [
        `【是什么】get_current_session_id(cindy_helper 自省类)+ send_to_worker(cindy_orca team 工具)/ send_to_session(cindy_helper handoff 类, 走 call_tool)配合使用。前者返回当前 ${BRAND_NAME} session 的 business id / agent_kind / working_dir, 后两者把一条控制层消息投递到指定 session;目标不在内存时会自动 resume, 投递成功即返回。`,
        '【典型场景】自动化 skill 首次处理某个外部业务对象(issue / jira / pr / 任意自定义 key)时, 先调 get_current_session_id 拿 session_id 并把它和外部 key 做持久化绑定;后续二次处理同一对象时, 调 send_to_worker(team 内 worker)或 send_to_session(任意已知 session)把增量信息 handoff 回那个 session, 保留原始上下文、决策链和历史工具调用。',
        '【skill 端伪代码】first_seen -> sid = get_current_session_id(); store(key, sid.session_id); later -> sid = load(key); if sid then send_to_worker / send_to_session({ target_session_id: sid, message: "...增量..." }) else fallback normal flow。',
        '【硬规则】send_to_session 要发给已有任务时 target_session_id 必传;不知道 id 先用 history 类目的 list_sessions 查。完全省略该参数不会报错,而是 create:静默新建一个专属任务、把消息当首条输入并立刻跑一轮,返回 wake_kind=created 和 note。只有明确要为业务对象新建专属任务时才省略;拿到 created 不等于已投给既有任务。',
        '【失败码】NOT_FOUND / DELETED 通常表示绑定失效,skill 应清掉绑定并回退; ARCHIVED 表示 session 已归档，在已有恢复授权时可先用 control/unarchive_sessions 恢复，再发送新消息，不能自行推翻用户归档意图; 传了 id 但目标不存在只会返 NOT_FOUND,绝不自动新建。jump 撞上目标正在跑 turn 时不再返 BUSY,而是入队并成功返回 wake_kind=queued(可用 update/cancel_session_queued_message 管理);BUSY 仅是 create 模式的罕见兜底。',
        '【边界】它不是普通聊天入口,而是 session 间 handoff 的控制层能力;不会自动关闭当前 dispatcher session,也不会替 skill 管理绑定键的存储语义。',
      ].join(' '),
    },
  ],
  [
    'session-control',
    {
      title: '会话控制面(队列 / 插话 / 停止 / 运行探针)',
      oneLiner:
        'agent 可观察本机任务的队列与运行状态，并控制自己投递的队列消息、same-turn 插话或请求优雅停止(仅本机任务)。',
      detail: [
        '【授权】主人在本机输入的请求沿用普通任务权限流程，不另加行动确认卡。自动唤醒、跟进责任与可用工具不增加操作授权。观察可以自动进行；发消息、插话、队列修改、停止、代答、恢复及模型/账号变更必须符合主人已委托的任务与动作范围，否则先展示目标、动作和内容并等待确认。',
        '【入口】cindy_helper 的 history 类 list_sessions / list_session_queue 提供 queuedCount、队列位置、来源、入队时间、正文摘要与 consuming 状态；control 类提供 update_session_queued_message、cancel_session_queued_message、steer_session_queued_message、move_session_queued_message、steer_session、stop_session_turn、get_session_runtime。',
        '【伙伴入口】伙伴可发现通用 control 类；主人请求沿用普通权限流程，自动轮次的实际写入须通过 Host 行动授权。自己的后台任务优先用专属入口：message_session_task 的 queue / steer / resume 分别表示排队、同轮插话、恢复暂停；stop_session_task 的 cancel / request-stop / pause 分别表示取消任务、请求当前轮停止、保留任务与队列的可恢复暂停。check_session_task 的 control 区分 pausing / paused；requested 或 unconfirmed 不能当作已停。不支持的引擎明确返回失败。',
        '【队列所有权】只能修改或撤回当前调用 session 自己通过 send_to_session 投递、且尚未进入 consuming 的消息；Orca、scheduler、用户或其它 session 的消息都会 fail-closed 拒绝。Orca worker 队列控制与这里复用同一底层生命周期实现。steer_session_queued_message / move_session_queued_message 把排队消息转为插话或调整顺序,可操作范围另含自己任务队列里由其它任务 / 协同成员发来的机器消息;没插成时消息留在队列并返回 reason。',
        '【插话】steer_session 只对正在运行且支持 same-turn steer 的 session 生效，在 provider 的下一个输入间隙注入当前 turn；若 turn 已结束会明确失败，不会退化成下一 turn。',
        '【停止】stop_session_turn 是请求式优雅停止：当前并行工具全部收尾后才发送 provider 软中断；不关闭 transport、不重建 session、不硬杀进程，超时未确认会返回 unconfirmed。',
        '【探针】get_session_runtime 返回统一 phase、记录状态、标题工作流语义、turn generation、开始时间、最后活动时间、当前动作摘要和停止状态；动作摘要有界且不包含提示词正文、工具参数或凭证。',
      ].join(' '),
    },
  ],
  [
    'session-management',
    {
      title: '会话管理(含 Fork / Rewind / 批量归档)',
      oneLiner:
        '新建 / 关闭 / 搜索会话,在历史任意点 Fork 分岔或 Rewind 重跑;agent 还能批量归档整理。',
      detail: [
        '会话列表带搜索、按时间和工程目录组织。',
        'Fork:在任意历史消息处分裂出新会话,继承到该点为止的全部上文。',
        'Rewind:在当前会话回到历史点,改写发送内容后重新运行,原分支被替换。',
        'agent 批量整理:control 类工具 rename_sessions(批量改名)、archive_sessions / unarchive_sessions(批量归档/取消归档,把 status 在 active↔archived 间切换)。',
        '归档可逆、不删数据,经统一权威出口写库并广播 sessions:patched,侧栏即时收敛;不能归档当前正在运行的会话。恢复不启动执行、不发旧消息、不恢复暂停自动化；之后可用 send_to_session 发送新消息。',
        '本机批次原子写入；回执未知时先查状态再决定重试。',
        '以上操作都不破坏原数据,可放心试错。',
      ].join(' '),
    },
  ],
  [
    'skillhub',
    {
      title: 'Skill 管理(本地 skill)',
      oneLiner: '管理本地 skill(项目级 + 全局),以 .md 形式扩展 agent 能力。',
      detail: [
        'Skill 页面的 Local 页签列出项目级与全局 skill。',
        'Skill 以 markdown 形式存储,可作为 /slash 命令或工具触发。',
        '让用户不用改代码就能给 agent 加新能力包。',
      ].join(' '),
    },
  ],
  [
    'scheduler',
    {
      title: '自动化调度',
      oneLiner:
        '按 cron 规则自动跑任务(定期分析、工单分拣等),含执行历史,agent 也能通过 MCP 工具自助管理。',
      detail: [
        '基于 cron 表达式创建定时任务,常见用法是每天定时跑 AI 工单分拣或周报生成。',
        'GUI 展示任务列表、上次执行结果、失败原因。已执行项可加黑名单防重复。',
        'agent 也能通过 MCP 工具(schedule_create / list / get / update / pause / resume / run_now / delete / list_runs)自助创建和管理调度,GUI 与 MCP 看到同一份数据。',
        '定时任务保存在这台电脑上,工具作用于本机的定时任务。',
        '后端 SQLite 存储,有独立 Scheduler Host 进程管理生命周期。',
      ].join(' '),
    },
  ],
  [
    'chat-history-query',
    {
      title: '聊天历史查询(本机)',
      oneLiner: 'agent 可列出和搜索本机的聊天历史，并按任务读取内容。',
      detail: [
        '【引用任务】任务元数据的 sessionUrl 可直接写成 [任务标题](sessionUrl)；已知 id 只需链接时用 get_task_digest，无需读取完整聊天。',
        `【是什么】${BRAND_NAME} 的对话历史保存在这台电脑的本地 SQLite。cindy_helper 的 history 类提供只读查询入口，让 agent 按宿主授予的范围读取历史，协助用户组织 memory / 知识库。`,
        '【五个工具】(1)list_workdirs: 列出本机出现过的工作目录 + session 数 / 首末活动时间; (2)list_sessions: 按 workdir / 时间段 / agent_kind 过滤 session 元数据，并附当前 queuedCount; (3)list_session_queue: 按 session_id 查看尚未消费消息的位置、来源、入队时间、正文摘要与投递状态; (4)get_chat_history: 按 session_ids / workdir / 时间段 / role "按元数据精确捞"原始消息(content / agentMeta JSON 解析后透传); (5)search_chat_history: 跨 session "按内容语义找"——自然语言 query, FTS5 全文(全量、永远可用)+ 向量语义(开启"聊天记录语义索引"后生效)RRF 融合, 返回命中 + 上下文窗口。',
        '【典型用法】"帮我总结这周和 agent 的讨论, 写成 memory 条目" → list_sessions({from: 周一 ISO, time_field: "activity"}) 拿 sessionId 列表 → get_chat_history({session_ids: [...]}) 拿对话 → LLM 提炼成 memory。"我之前聊过 X / 上次怎么解决那个 bug"(只记得内容、不知道在哪) → search_chat_history({query}) 直接语义召回。"我在 xxx 项目里都聊过啥" → list_sessions({workdir}) → get_chat_history。',
        '【伙伴】list_sessions / search_chat_history 使用 teammate_id=profile.id 匹配已保存的归属，含归档、旧历史和话题。按话题搜索不默认限制 workdir 或创建时间。结果 companion=null 不代表属于当前伙伴；目录或名字都不能补造归属。',
        '【向量是增益不是依赖】search_chat_history 在用户没开 embedding / sqlite-vec 不可用时静默退化为纯 FTS, 搜索照常工作; 响应里 vector_used 标明向量是否生效。',
        '【分页】任务列表与聊天读取可用 hasMore + nextCursor 持续翻页。搜索受候选池上限约束，pool_capped=true 时应缩小查询范围，不能声称已经穷尽全部匹配。',
        '【权限】遵循宿主授予的历史权限；仅有归属范围权限的调用方不能扩大范围。',
        '【与 memory-system 的区别】memory-system(cindy_memory)管理的是已经提炼好的 markdown 记忆条目; chat-history-query 给的是原始对话数据本身, 是上游素材。两者通常配合用: 先 get_chat_history 拉素材, 再 memory_write 落条目。',
      ].join(' '),
    },
  ],
]);

/** The list as LOCAL_ONLY shows it: switched-off entries left out, the rest in local text. */
export function localOnlyCapabilities(all: readonly CapabilityEntry[]): readonly CapabilityEntry[] {
  return all
    .filter((entry) => !LOCAL_ONLY_HIDDEN_CAPABILITIES.has(entry.key))
    .map((entry) => {
      const local = LOCAL_ONLY_CAPABILITY_TEXT.get(entry.key);
      return local ? { key: entry.key, ...local } : entry;
    });
}
