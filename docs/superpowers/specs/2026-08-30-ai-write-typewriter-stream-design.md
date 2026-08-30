# AI 写作打字机流（写入编辑器）设计

**日期：** 2026-08-30  
**状态：** 待实施  
**前置：** [`2026-08-30-ai-write-in-editor-fork-design.md`](./2026-08-30-ai-write-in-editor-fork-design.md)（fork + 接受/拒绝已落地）  
**参考（思路，不引入代码）：** [BlockNote](https://github.com/TypeCellOS/BlockNote) `@blocknote/xl-ai` 的 tool-call 流式应用；该包 GPL-3.0，本仓库不依赖、不复制其源码。

## 目标

模型还在生成时，字就出现在用户正在看的 fork 编辑器里，观感接近打字机。写完或停止后，仍用现有提示条做接受 / 拒绝；接受前改动仅本机可见。

## 非目标

- 不引入 `@blocknote/xl-ai`、Vercel AI SDK、`prosemirror-suggest-changes`。
- 不把写作协议改成 Markdown token 流。
- 不做 HTML 块解析、不做 agent replace-step 人工延迟。
- 不做并行 tool call；一次请求内按模型产出的工具顺序串行应用。
- 不把 AI 光标 / awareness 广播给协作者。
- 不改侧边栏 `/ai/chat`。
- 不重做 fork / merge / stale / 空段落删除。

## 已确认的产品选择

| 项 | 选择 |
|----|------|
| 效果 | 真打字机：token 到达即写正文，不是整段弹出，也不是本地假打字 |
| 结构 | 继续 `insert_blocks` / `update_block`，不换 Markdown |
| 隔离 | 沿用 fork Y.Doc；接受 merge，拒绝丢 fork |
| 节奏 | 跟模型出字走；`requestAnimationFrame` 合并刷新，不加人工 delay |
| 选区改写 | 目标块先被新文本覆盖（旧文立刻消失），再逐字变长 |

## 架构

```text
ChatOpenAI.stream
  tool_call_chunks（args 字符串变长）
        │
        ▼
AiWriteAgent
  累积 args → 修复不完整 JSON
  结构够用时 yield tool_partial（未完整校验也可）
  该次 tool 结束后 yield 已校验的 tool_call
        │
        ▼
SSE: tool_partial | tool_call | done | error
        │
        ▼
AiWritingHost + session
  tool_partial → 在 fork 上 insert 空块 / updateBlock 当前全文
  tool_call → 对齐最终 type/text/多块，写入 ops
  rAF 合并对同一块的连续 update
```

包边界：

| 包 | 职责 |
|----|------|
| `apps/api` | `AiWriteAgent` 边流边产出 `tool_partial`；完整调用仍 `validateAiWriteOp` 后发 `tool_call` |
| `editor-core` | `parsePartialToolArgs`；`applyAiWritePartial`（幂等：同一条流式 op 不重复 insert） |
| `apps/web` | SSE 解析新事件；session 维护流式块 id；Host rAF 刷 UI 状态 |
| `editor-shadcn` | 不改提示条产品形态；草稿高亮仍用 `touchedIds` |

## SSE 契约

`POST /ai/write` 仍为 `event:` + `data:` JSON。在现有事件上增加一种：

```ts
type AiWriteStreamEvent =
  | {
      type: "tool_partial"
      toolIndex: number
      name: "insert_blocks" | "update_block"
      args: Record<string, unknown>
    }
  | { type: "tool_call"; op: AiWriteOp }
  | { type: "done" }
  | { type: "error"; message: string }
```

规则：

- `toolIndex` 从 0 递增，标识同一次 HTTP 请求里的第几次工具调用。同一 `toolIndex` 的多条 `tool_partial` 是同一条 op 的快照（后一条覆盖前一条），不是 append。
- `args` 是修复后的**当前完整对象快照**（含目前已解析出的字段）。`insert_blocks` 的 `blocks[].text`、`update_block` 的 `text` 为目前已生成的全文，不是单字符 delta。
- 仅当相对上一次已发送的 `tool_partial`，`args` 的 JSON 序列化发生变化时才再发（避免每个模型 chunk 都打 SSE）。
- 某次工具参数收齐后：若 `validateAiWriteOp` 通过，发一条 `tool_call`（`op` 为规范后的完整操作）；若失败，该次工具不发 `tool_call`，也不发针对该次的 error（与现网「非法调用静默丢弃」一致）。
- 整次请求结束后：至少有一条成功 `tool_call`，或至少有一条 `tool_partial` 的 args 里已出现非空 `text`（`insert_blocks.blocks[].text` 或 `update_block.text`）时发 `done`；否则发 `error`「没有可应用的改动」。停止（abort）不发 `done`。服务端只看自己发出过的事件，不依赖客户端是否应用成功。
- 不认识 `tool_partial` 的旧解析器会忽略该事件，仍能在 `tool_call` 时整段应用（退化，无打字机）。

服务端如何得到不完整 args：

- `createDefaultRunner` 不再把整次 `model.stream` concat 完再 yield。
- 按 LangChain `AIMessageChunk.tool_call_chunks` 按 `index` 拼接 `args` 字符串。
- `parsePartialToolArgs`：先 `JSON.parse`；失败则做最小修复（补齐未闭合的引号/括号，去掉末尾残缺键），再 parse；仍失败则本 chunk 不 yield。
- 尚未出现 `name` 或无法判断 `insert_blocks` / `update_block` 时不发 `tool_partial`。
- `tool_partial` **不**走完整 `validateAiWriteOp`（不完整 JSON 几乎总是非法）。只做浅过滤：未知工具名丢弃；`insert_blocks.placement` 若已出现且不是 `before`/`after` 则丢弃该次快照；块 `type` 若已出现且不可写则该块先不暴露给客户端（数组中跳过或等 type 合法）。

## 客户端应用

在 `editor-core` 增加对流式 op 的状态机（可放在 `ai-write/apply-stream.ts`），由 session 持有：

### insert_blocks

状态：`{ toolIndex, refId, placement, blocks: { id, type, lastText }[] }`。

对一条 `tool_partial`：

1. `refId` / `placement` 尚未齐，或 `refId` 在 fork 文档中不存在：忽略。
2. 遍历 `args.blocks`（仅含已有合法 `type` 的项）：
   - 下标 `i` 还没有本地 id：若尚未收到该 `toolIndex` 的 `tool_call`，且该项 `text` 为空、并且是当前数组最后一项，**先不插入**（避免空段闪一下）；一旦 `text.length > 0` 或后面又出现下一块，则 `insertBlocks` 一个带生成 id 的块（text 用当前值），记下 id。
   - 下标 `i` 已有 id：若 `text !== lastText`，`updateBlock(id, { text })`；若 `type`/`props` 变了一并更新。
3. 锚点：第一块相对 `refId`+`placement`；后续块相对前一块、`placement: "after"`。

对随后的 `tool_call`：

- **禁止**再对同一 `toolIndex` 调用一次完整 `applyAiWriteOp(insert_blocks)`（会重复插入）。
- 按完整 `op.blocks` 补插尚未创建的块，并把每个块的 type/text/props 设成终值。
- 把该完整 `op`（块带客户端已生成的 id）推进 `session.ops`，供草稿高亮与「是否有改动」判断。

### update_block

状态：`{ toolIndex, id, started }`。

- `id` 不在 fork 或不在本次模式允许集合（slash：仅 `cursorBlockId`；selection：`selectedIds`）：忽略。
- 第一次应用到该 `toolIndex`：用当前 `text`（可能为空串）写入，使旧文立即被替换。
- 之后每次 `text` 变化：`updateBlock`。
- 完整 `tool_call`：写入终值，push `session.ops`。不要在从未 `tool_partial` 时漏掉：无 partial 只有 `tool_call` 时走现有 `applyAiWriteOp`（兼容 runner 测试/mock 只 yield 完整 op）。

### 刷新合并

Host 对同一块的 `updateBlock` 用 rAF 合并：一帧内多次 `text` 只应用最后一次。`insertBlocks` 不合并延迟（新块要马上出现）。

### 停止与接受

- 用户停止：若 fork 上已有流式触及的块且至少一块文本非空（或 selection 的 update 已开始），进入 `user-reviewing`；否则 `closed` 并绑回 shared（与现「零 op 则关闭」一致）。
- `accept`：以 `session.ops` 或流式状态机里已创建/已开始 update 的 id 为准。若只有空插入、从未出现非空 text，视为 `empty`。否则 merge fork（与现逻辑相同，含空段落删除）。
- 中途停止时可能还没有 `tool_call`：此时要把流式状态机里的 insert/update **合成**进 `session.ops`（用当前 fork 块内容），这样 `collectAiWriteDraftIds` 与 empty 判断仍成立。

## UI

- 提示条、锚点、草稿 class、只读、接受/拒绝：**不变**。
- 第一条成功应用到编辑器的 `tool_partial` 时状态从 `thinking` 变为 `ai-writing`（不必等完整 `tool_call`）。
- 锚点跟随「最后一次 `updateBlock` / 新 insert 的块 id」。

## 错误与边界

| 情况 | 行为 |
|------|------|
| 不完整 JSON 一直修不好 | 不发 partial；若最终也校验失败，整次可能 `没有可应用的改动` |
| 第一条 insert 的 refId 非法 | 忽略 partial；完整校验失败则丢该 tool |
| 流式过程中 shared 远端更新 | 现有 stale：abort、丢 fork、toast |
| 用户停止时已有非空草稿 | 审阅；fork 上保留已打出的字 |
| SSE 中途 error | 已写在 fork 上的字仍可见；关闭 = 拒绝 |
| mock runner 只 yield 完整 op | 无 `tool_partial`，行为与现在相同 |

## 测试与验收

### 测试

- `parsePartialToolArgs`：残缺 `{"text":"hel` 能得到 `{ text: "hel" }`；完整 JSON 原样返回；无法修复返回 `null`。
- `applyAiWritePartial`：同一 `toolIndex` 两次 insert 快照只插入一次，第二次只加长 text；`tool_call` 不产生重复块。
- `AiWriteAgent`：mock chunk 流（args 分片）yield 至少一条 `tool_partial` 再 `tool_call`；非法完整调用仍不 yield `tool_call`。
- Host/session：模拟 `tool_partial` 后 `blockEditor.document` 在 `done` 之前已含部分文本；shared 在接受前无增量。
- 现有「只发 `tool_call`」的测试保持通过。

### 验收

1. 斜杠续写：生成过程中编辑区当前段逐字变长，不是等整段结束再出现。
2. 多段落：第一段打完（或模型开始下一块）后出现下一块，继续打字。
3. 选区润色：选中块内容被新稿从空/短逐渐打满。
4. 写完接受/拒绝、协作隔离、会话中只读：与 fork 设计相同。

## 实施顺序

1. `parsePartialToolArgs` + 单测  
2. `applyAiWritePartial` 状态机 + 单测  
3. `AiWriteAgent` 边流边 yield；`AiWriteStreamEvent` 扩展；API 测  
4. session / Host 消费 `tool_partial`、rAF、停止时合成 ops  
5. 更新 web SSE 解析与 Host 测；手工验收打字机路径
