# AI 写作打字机流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/ai/write` 在模型仍在生成时就把字写进 fork 编辑器（打字机），完整 tool 结束后再对齐，接受/拒绝与协作隔离保持现状。

**Architecture:** 服务端从 LangChain `tool_call_chunks` 修复不完整 JSON，SSE 增加 `tool_partial`（全文快照）。`editor-core` 的流式状态机对同一 `toolIndex` 只 insert 一次，之后 `updateBlock`。完整 `tool_call` 补齐终值并写入 `session.ops`，禁止再次整段 insert。

**Tech Stack:** LangChain ChatOpenAI stream、现有 SSE、`BlockEditor.insertBlocks` / `updateBlock`、Yjs fork、Vitest。

**Spec:** [`docs/superpowers/specs/2026-08-30-ai-write-typewriter-stream-design.md`](../specs/2026-08-30-ai-write-typewriter-stream-design.md)

## Global Constraints

- 不引入 `@blocknote/xl-ai`、Vercel AI SDK、`prosemirror-suggest-changes`。
- 不把写作协议改成 Markdown token 流；不做 HTML 解析；不加人工 delay。
- 不做并行 tool call；接受前不得把 AI 写入 shared Y.Doc。
- 不改侧边栏 `/ai/chat`；不重做 fork / merge / stale / 空段落删除。
- 根目录 `.prettierrc`：LF、双引号、两空格、无分号、80 列；新增代码带有用中文注释。
- 每个新增/实质修改代码块至少一句解释意图的注释。
- `tool_call` 增加 `toolIndex`（与对应 `tool_partial` 相同）。缺少 `toolIndex` 时客户端退化为现有 `applyAiWriteOp`。

## File map

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/core/ai-write/parse-partial.ts` | `parsePartialToolArgs`、`sanitizePartialToolArgs`、`partialArgsHaveNonEmptyText` |
| `packages/editor-core/src/core/ai-write/apply-stream.ts` | `createAiWriteStreamApplier` |
| `packages/editor-core/src/core/ai-write/index.ts` | 导出上述符号 |
| `packages/editor-core/src/core/index.ts`、`server.ts` | 客户端 / Nest 入口导出 |
| `apps/api/src/ai/ai.types.ts` | `AiWriteStreamEvent` 增加 `tool_partial` 与 `toolIndex` |
| `apps/api/src/ai/ai-write.agent.ts` | 边流边 yield `tool_partial` / `tool_call` |
| `apps/api/src/ai/ai.service.ts` | 透传新事件；`done` 条件含非空 partial |
| `apps/web/lib/ai-writing/client.ts` | 解析 `tool_partial` |
| `apps/web/lib/ai-writing/session.ts` | `applyPartial`、合成 ops、停止/接受 |
| `apps/web/components/inkspace/ai-writing-host.tsx` | 消费流、rAF 合并 update |

---

### Task 1: 不完整 JSON 解析与浅过滤

**Files:**
- Create: `packages/editor-core/src/core/ai-write/parse-partial.ts`
- Create: `packages/editor-core/test/core/ai-write-parse-partial.test.ts`
- Modify: `packages/editor-core/src/core/ai-write/index.ts`
- Modify: `packages/editor-core/src/core/index.ts`（在 `ai-write` 导出块增加符号）
- Modify: `packages/editor-core/src/server.ts`（Nest 侧也要能 `parsePartialToolArgs`）

**Interfaces:**
- Consumes: `isAiWritableBlockType`（`./types`）
- Produces:

```ts
export function parsePartialToolArgs(
  input: string
): Record<string, unknown> | null

export function sanitizePartialToolArgs(
  name: string,
  args: Record<string, unknown>
): {
  name: "insert_blocks" | "update_block"
  args: Record<string, unknown>
} | null

export function partialArgsHaveNonEmptyText(
  name: "insert_blocks" | "update_block",
  args: Record<string, unknown>
): boolean
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  parsePartialToolArgs,
  partialArgsHaveNonEmptyText,
  sanitizePartialToolArgs,
} from "@core/ai-write"

describe("parsePartialToolArgs", () => {
  it("returns complete objects unchanged", () => {
    expect(parsePartialToolArgs('{"text":"hello"}')).toEqual({
      text: "hello",
    })
  })

  it("repairs a truncated string value", () => {
    expect(parsePartialToolArgs('{"text":"hel')).toEqual({ text: "hel" })
  })

  it("returns null for empty or irreparable input", () => {
    expect(parsePartialToolArgs("")).toBeNull()
    expect(parsePartialToolArgs("{")).toEqual({})
    expect(parsePartialToolArgs("not json")).toBeNull()
  })
})

describe("sanitizePartialToolArgs", () => {
  it("drops unknown tools and invalid placement", () => {
    expect(sanitizePartialToolArgs("other", {})).toBeNull()
    expect(
      sanitizePartialToolArgs("insert_blocks", { placement: "nested" })
    ).toBeNull()
  })

  it("omits blocks whose type is present but not writable", () => {
    const result = sanitizePartialToolArgs("insert_blocks", {
      refId: "a",
      placement: "after",
      blocks: [
        { type: "image", text: "x" },
        { type: "paragraph", text: "ok" },
      ],
    })
    expect(result?.args.blocks).toEqual([
      { type: "paragraph", text: "ok" },
    ])
  })
})

describe("partialArgsHaveNonEmptyText", () => {
  it("detects insert and update text", () => {
    expect(
      partialArgsHaveNonEmptyText("update_block", { text: "a" })
    ).toBe(true)
    expect(
      partialArgsHaveNonEmptyText("insert_blocks", {
        blocks: [{ type: "paragraph", text: "" }],
      })
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-parse-partial.test.ts`

Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

`parse-partial.ts` 实现要点（须含中文注释）：

- `parsePartialToolArgs`：trim → `JSON.parse`；失败则 `repairPartialJson` 再 parse；结果必须是非数组 object，否则 `null`。
- `repairPartialJson`：删掉末尾未写完的 `"key`；若扫描后仍在字符串内则补 `"`；按栈补 `}` / `]`。
- `sanitizePartialToolArgs`：仅接受 `insert_blocks` / `update_block`。`placement` 若已出现且不是 `before`/`after` 返回 `null`。`blocks` 若为数组，丢掉 `type` 已出现且 `!isAiWritableBlockType(type)` 的项；没有 `type` 的项保留（流式尚未出 type）。
- `partialArgsHaveNonEmptyText`：`update_block` 看 `typeof text === "string" && text.length > 0`；`insert_blocks` 看任一 `blocks[].text` 非空字符串。

从 `./index.ts`、`core/index.ts`、`server.ts` 导出这三个函数。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-parse-partial.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/ai-write/parse-partial.ts packages/editor-core/src/core/ai-write/index.ts packages/editor-core/src/core/index.ts packages/editor-core/src/server.ts packages/editor-core/test/core/ai-write-parse-partial.test.ts
git commit -m "feat(editor): parse and sanitize partial AI write tool JSON"
```

---

### Task 2: fork 上的流式状态机

**Files:**
- Create: `packages/editor-core/src/core/ai-write/apply-stream.ts`
- Create: `packages/editor-core/test/core/ai-write-apply-stream.test.ts`
- Modify: `packages/editor-core/src/core/ai-write/index.ts`、`core/index.ts`

**Interfaces:**
- Consumes: `applyAiWriteOp`、`isAiWritableBlockType`、`sanitizePartialToolArgs`、`BlockEditor`、`AiWriteOp`、`AiWriteMode`
- Produces:

```ts
export type AiWritePartialEvent = {
  type: "tool_partial"
  toolIndex: number
  name: "insert_blocks" | "update_block"
  args: Record<string, unknown>
}

export type AiWriteStreamApplier = {
  applyPartial(event: AiWritePartialEvent): {
    applied: boolean
    touchedId?: string
  }
  applyComplete(toolIndex: number, op: AiWriteOp): {
    ok: boolean
    op?: AiWriteOp
  }
  synthesizeOps(): AiWriteOp[]
  hasNonEmptyDraft(): boolean
}

export function createAiWriteStreamApplier(input: {
  editor: BlockEditor
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
}): AiWriteStreamApplier
```

- [ ] **Step 1: Write the failing test**

沿用 `ai-write-apply.test.ts` 的 `BlockEditor` 夹具（一段 id 为 `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` 的段落）。

```ts
import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import { createAiWriteStreamApplier } from "@core/ai-write"

const REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const editors: BlockEditor[] = []

function create() {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: REF,
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "one", styles: {} }],
        children: [],
      },
    ],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

function textOf(editor: BlockEditor, index: number) {
  const content = editor.document[index]?.content
  if (!Array.isArray(content)) return ""
  return content.map((part) => ("text" in part ? part.text : "")).join("")
}

describe("createAiWriteStreamApplier", () => {
  it("inserts once then lengthens the same block", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    const base = {
      type: "tool_partial" as const,
      toolIndex: 0,
      name: "insert_blocks" as const,
    }
    applier.applyPartial({
      ...base,
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "he" }],
      },
    })
    applier.applyPartial({
      ...base,
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "hello" }],
      },
    })
    expect(editor.document).toHaveLength(2)
    expect(textOf(editor, 1)).toBe("hello")

    const complete = applier.applyComplete(0, {
      type: "insert_blocks",
      refId: REF,
      placement: "after",
      blocks: [{ type: "paragraph", text: "hello world" }],
    })
    expect(complete.ok).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(textOf(editor, 1)).toBe("hello world")
  })

  it("skips empty trailing insert until text arrives", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "" }],
      },
    })
    expect(editor.document).toHaveLength(1)
  })

  it("replaces selection text on first update partial", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "selection",
      cursorBlockId: REF,
      selectedIds: [REF],
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "update_block",
      args: { id: REF, text: "n" },
    })
    expect(textOf(editor, 0)).toBe("n")
  })

  it("applyComplete without partials uses applyAiWriteOp", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    const result = applier.applyComplete(0, {
      type: "insert_blocks",
      refId: REF,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    expect(result.ok).toBe(true)
    expect(editor.document).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-apply-stream.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

状态（模块内，不写进 Y.Doc）：

```ts
type InsertState = {
  name: "insert_blocks"
  refId: string
  placement: "before" | "after"
  blocks: { id: string; type: string; lastText: string }[]
  completed: boolean
}
type UpdateState = {
  name: "update_block"
  id: string
  started: boolean
  completed: boolean
}
```

`Map<number, InsertState | UpdateState>` keyed by `toolIndex`。

`applyPartial`：

1. `sanitizePartialToolArgs(event.name, event.args)`，失败则 `{ applied: false }`。
2. **insert_blocks**：`refId`/`placement` 不齐或文档中无 `refId` → 忽略。遍历 `blocks` 数组中 `type` 已合法的项：
   - 无本地 id：若尚未 `completed` 且该项 `text` 为空（或非字符串）且是数组最后一项 → 不 insert。否则相对锚点 `insertBlocks`（第一块用 `refId`+`placement`，后续用上一本地 id + `after`），记下 id。
   - 已有 id：`text`/`type`/`props` 变化则 `updateBlock`。
3. **update_block**：`id` 必须在文档中；slash 仅允许 `cursorBlockId`，selection 仅允许 `selectedIds`。第一次就把 `text`（缺省 `""`）写入。

`applyComplete(toolIndex, op)`：

- 若该 `toolIndex` 无状态：直接 `applyAiWriteOp`，成功则记下 completed。
- 若是 insert 状态：`op.type` 必须是 `insert_blocks`。按 `op.blocks` 补插缺失块，并对每个本地 id `updateBlock` 终值。返回的 `op.blocks` 必须带上本地 id。设 `completed`。
- 若是 update 状态：终值 `updateBlock`，返回原 `op`。

`synthesizeOps()`：对每个未 `completed` 的状态，用当前文档块生成 `insert_blocks` / `update_block`（text 取块纯文本）。已 completed 的用当时返回的 op（applier 内缓存 `committed: AiWriteOp[]`）。

`hasNonEmptyDraft()`：任一已插入块或已 started 的 update，块纯文本非空。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-apply-stream.test.ts test/core/ai-write-apply.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/ai-write/apply-stream.ts packages/editor-core/src/core/ai-write/index.ts packages/editor-core/src/core/index.ts packages/editor-core/test/core/ai-write-apply-stream.test.ts
git commit -m "feat(editor): apply streaming AI write ops without duplicate inserts"
```

---

### Task 3: Agent 流式 yield 与 SSE 契约

**Files:**
- Modify: `apps/api/src/ai/ai.types.ts`
- Modify: `apps/api/src/ai/ai-write.agent.ts`
- Modify: `apps/api/src/ai/ai.service.ts`
- Modify: `apps/api/test/ai/ai-write.agent.spec.ts`
- Modify: `apps/api/test/ai/ai.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 的 `parsePartialToolArgs`、`sanitizePartialToolArgs`、`partialArgsHaveNonEmptyText`（从 `@xtai-notion/editor-core/server`）
- Produces:

```ts
export type AiWriteAgentEvent =
  | {
      type: "tool_partial"
      toolIndex: number
      name: "insert_blocks" | "update_block"
      args: Record<string, unknown>
    }
  | { type: "tool_call"; toolIndex: number; op: AiWriteOp }

export type AiWriteStreamEvent =
  | AiWriteAgentEvent
  | { type: "done" }
  | { type: "error"; message: string }
```

`AiWriteAgent.stream` 改为 `AsyncIterable<AiWriteAgentEvent>`（不再直接 yield 裸 `AiWriteOp`）。

- [ ] **Step 1: Write the failing tests**

在 `ai-write.agent.spec.ts` 增加（并改现有用例：收集 `event.type === "tool_call"` 的 `op`，断言带 `toolIndex: 0`）：

```ts
it("yields tool_partial then validated tool_call from injected runner", async () => {
  const agent = new AiWriteAgent({} as any, async function* () {
    yield {
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
      args: {
        refId: paraId,
        placement: "after",
        blocks: [{ type: "paragraph", text: "续" }],
      },
    }
    yield {
      type: "insert_blocks",
      refId: paraId,
      placement: "after",
      blocks: [{ type: "paragraph", text: "续写内容" }],
    }
  })
  const events = []
  for await (const event of agent.stream(slashRequest)) {
    events.push(event)
  }
  expect(events[0]).toMatchObject({
    type: "tool_partial",
    toolIndex: 0,
    name: "insert_blocks",
  })
  expect(events[1]).toMatchObject({
    type: "tool_call",
    toolIndex: 0,
    op: { type: "insert_blocks" },
  })
})
```

`ai.service.spec.ts` 里 mock `writeAgent.stream` 改为 yield `{ type: "tool_call", toolIndex: 0, op: {...} }`。另加：

```ts
it("emits done when only non-empty tool_partial was streamed", async () => {
  const writeAgent = {
    stream: vi.fn(async function* () {
      yield {
        type: "tool_partial",
        toolIndex: 0,
        name: "update_block",
        args: { id: "block-1", text: "x" },
      }
    }),
  }
  const events = []
  for await (const event of createService(
    { assertCanRead: vi.fn().mockResolvedValue("viewer") },
    { stream: vi.fn() },
    writeAgent
  ).write(writeRequest(), "user-1")) {
    events.push(event)
  }
  expect(events.at(-1)).toEqual({ type: "done" })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- test/ai/ai-write.agent.spec.ts test/ai/ai.service.spec.ts`

Expected: FAIL（类型/事件形状不对）

- [ ] **Step 3: Implement agent + service**

`AiWriteAgent.stream`：

- 对 runner 每个 `raw`：若 `raw.type === "tool_partial"`，用 `sanitizePartialToolArgs`，通过则 yield；同一 `toolIndex` 若 `JSON.stringify(args)` 与上次相同则跳过。
- 否则走现有 `normalizeToolCall` + `validateAiWriteOp`；成功则 yield `{ type: "tool_call", toolIndex, op }`。`toolIndex`：若 raw 带数字 `toolIndex` 用之，否则用「已完成 tool_call 计数」。
- 非法完整调用仍静默跳过。

`createDefaultRunner`：

- 不要等整次 stream concat 完。
- 维护 `Map<number, { name?: string; args: string }>`。每个 chunk 的 `tool_call_chunks`：按 `index` 把 `args` **拼接**（LangChain 给的是增量字符串），`name` 一旦出现就记下。
- 每次拼接后 `parsePartialToolArgs(args)` → sanitize → 若 `JSON.stringify` 变化则 `yield { type: "tool_partial", toolIndex: index, name, args }`。
- 流结束后：对每个 index 再 `JSON.parse` 完整 args（修失败则跳过），`yield { type: name, toolIndex: index, ...args }` 供上面的 complete 路径校验。

`AiService.write`：

```ts
let hasToolCall = false
let hasNonEmptyPartial = false
for await (const event of this.writeAgent.stream(request, signal)) {
  if (event.type === "tool_partial") {
    if (partialArgsHaveNonEmptyText(event.name, event.args)) {
      hasNonEmptyPartial = true
    }
    yield event
    continue
  }
  hasToolCall = true
  yield event
}
if (!signal?.aborted) {
  if (hasToolCall || hasNonEmptyPartial) yield { type: "done" }
  else yield { type: "error", message: "没有可应用的改动" }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- test/ai/ai-write.agent.spec.ts test/ai/ai.service.spec.ts test/ai/ai.controller.spec.ts`

Expected: PASS（controller 仍只断言 `tool_call`/`done` 字符串，应继续绿）

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/ai.types.ts apps/api/src/ai/ai-write.agent.ts apps/api/src/ai/ai.service.ts apps/api/test/ai/ai-write.agent.spec.ts apps/api/test/ai/ai.service.spec.ts
git commit -m "feat(api): stream partial AI write tool args over SSE"
```

---

### Task 4: Session 消费 tool_partial 并合成 ops

**Files:**
- Modify: `apps/web/lib/ai-writing/client.ts`
- Modify: `apps/web/lib/ai-writing/session.ts`
- Modify: `apps/web/test/lib/ai-writing/session.test.ts`

**Interfaces:**
- Consumes: `createAiWriteStreamApplier`、`AiWritePartialEvent`（Task 2）；`AiWriteStreamEvent` 与 API 对齐
- Produces:

```ts
applyPartial(event: AiWritePartialEvent): void
applyRemoteOp(op: AiWriteOp, toolIndex?: number): void
```

`stop()`：若 `applier.hasNonEmptyDraft()` 或 `ops.length > 0` → `user-reviewing` 并 `ops = applier.synthesizeOps()`（若 ops 仍空）；否则 `closed`。

`accept()`：若 `ops.length === 0` 先 `ops = applier.synthesizeOps()`；仍空或 `!hasNonEmptyDraft()` 且 ops 文本全空 → `{ ok: false, reason: "empty" }`。其余 merge 逻辑不变。

- [ ] **Step 1: Write the failing tests**

`client.ts` 测试增加一条 `tool_partial` 帧。

`session.test.ts`：

```ts
it("grows fork text on applyPartial before any tool_call", () => {
  const harness = createHarness()
  const session = createSession(harness)
  session.applyPartial({
    type: "tool_partial",
    toolIndex: 0,
    name: "insert_blocks",
    args: {
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "ai" }],
    },
  })
  expect(harness.forkEditor.document).toHaveLength(2)
  expect(documentFromYjs(harness.shared)).toHaveLength(1)
  expect(session.status).toBe("ai-writing")
})

it("synthesizes ops on stop so accept can merge without tool_call", () => {
  const harness = createHarness()
  const session = createSession(harness)
  session.applyPartial({
    type: "tool_partial",
    toolIndex: 0,
    name: "insert_blocks",
    args: {
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "draft" }],
    },
  })
  session.stop()
  expect(session.status).toBe("user-reviewing")
  expect(session.accept()).toEqual({ ok: true })
  expect(documentFromYjs(harness.shared)).toHaveLength(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- test/lib/ai-writing/session.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement session + SSE parse**

`createAiWritingSession` 内 `const applier = createAiWriteStreamApplier({ forkEditor, mode, cursorBlockId, selectedIds })`。

- `applyPartial`：`applier.applyPartial`；成功则 `status = "ai-writing"`，`setAiWriteDraftIds(forkEditor, draftIds())`。`draftIds()` 改为 `collectAiWriteDraftIds(session.ops.length ? session.ops : applier.synthesizeOps())`。
- `applyRemoteOp(op, toolIndex)`：`applier.applyComplete(toolIndex ?? session.ops.length, op)`；成功则把返回 `op` push 进 `ops`（避免重复 push 同一 toolIndex：若该 index 已 committed 则替换或跳过）。
- `lastTouchedBlockId`：仍取 draft ids 最后一个，否则 cursor。

`readAiWriteSse` 的 `parseSsePayload` 接受 `tool_partial`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- test/lib/ai-writing/session.test.ts`

Expected: PASS（含原有 applyRemoteOp / accept / reject 用例）

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai-writing/client.ts apps/web/lib/ai-writing/session.ts apps/web/test/lib/ai-writing/session.test.ts
git commit -m "feat(web): apply AI write partials on the forked editor session"
```

---

### Task 5: Host 接 SSE 与 rAF，补 Host 测试

**Files:**
- Modify: `apps/web/components/inkspace/ai-writing-host.tsx`
- Modify: `apps/web/test/components/inkspace/ai-writing-host.test.tsx`

**Interfaces:**
- Consumes: Task 4 的 `applyPartial` / `applyRemoteOp(op, toolIndex)`
- Produces: 生成过程中可见 `latestBlockCount` 增长，且块文本在 `done` 前已非空

- [ ] **Step 1: Write the failing Host test**

在现有 `keeps live document unchanged until accept` 旁新增。测试里把 `requestAnimationFrame` stub 成同步执行：

```ts
it("shows streamed text in the editor before the tool_call event", async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  const fetchMock = vi.fn(async (_url, init) => {
    const body = JSON.parse(init!.body as string) as { cursorBlockId: string }
    return streamResponse([
      `event: tool_partial\ndata: ${JSON.stringify({
        type: "tool_partial",
        toolIndex: 0,
        name: "insert_blocks",
        args: {
          refId: body.cursorBlockId,
          placement: "after",
          blocks: [{ type: "paragraph", text: "hel" }],
        },
      })}\n\n`,
      `event: tool_call\ndata: ${JSON.stringify({
        type: "tool_call",
        toolIndex: 0,
        op: {
          type: "insert_blocks",
          refId: body.cursorBlockId,
          placement: "after",
          blocks: [{ type: "paragraph", text: "hello" }],
        },
      })}\n\n`,
      'event: done\ndata: {"type":"done"}\n\n',
    ])
  })
  vi.stubGlobal("fetch", fetchMock)
  const { provider, getSharedDoc } = renderHost(true)
  await syncEditor(provider)
  fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))
  fireEvent.change(screen.getByTestId("ai-write-prompt-input"), {
    target: { value: "续写一段" },
  })
  fireEvent.click(screen.getByRole("button", { name: "生成" }))
  await waitFor(() => {
    expect(latestBlockCount).toBe(2)
  })
  expect(documentFromYjs(getSharedDoc()!)).toHaveLength(1)
  await waitFor(() => {
    expect(screen.getByTestId("ai-write-accept")).toBeInTheDocument()
  })
})
```

若 `latestBlockCount` 不够断言文本，在 Host 测试现有 hook 上读取可见编辑器第一段之后块的纯文本（与该文件现有 `latestBlockCount` 赋值处一起扩展 `latestDraftText`）。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- test/components/inkspace/ai-writing-host.test.tsx`

Expected: FAIL（Host 忽略 `tool_partial`）

- [ ] **Step 3: Wire Host**

SSE 循环：

```ts
if (event.type === "tool_partial") {
  session.applyPartial(event)
  forkEditor.tiptap.commands.focus()
  syncUiFromSession()
  continue
}
if (event.type === "tool_call") {
  session.applyRemoteOp(event.op, event.toolIndex)
  forkEditor.tiptap.commands.focus()
  syncUiFromSession()
  continue
}
```

rAF：在 Host 内对「同一 `touchedId` 的连续 `applyPartial`」合并——更简单的做法是让 `applyPartial` 立刻执行（session 已同步，便于单测），Host 仅用 rAF 调用 `syncUiFromSession`，避免每个 token 都 setState。`insert` 成功后仍立即 `syncUiFromSession()`。

`handleStop` 保持：`session.stop()` 后若 `closed` 则 restore+clear。

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-parse-partial.test.ts test/core/ai-write-apply-stream.test.ts test/core/ai-write-apply.test.ts
pnpm --filter api test -- test/ai
pnpm --filter web test -- test/lib/ai-writing/session.test.ts test/components/inkspace/ai-writing-host.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/inkspace/ai-writing-host.tsx apps/web/test/components/inkspace/ai-writing-host.test.tsx
git commit -m "feat(web): stream AI write tokens into the visible forked editor"
```

---

## Spec coverage

| Spec 项 | Task |
|---------|------|
| `parsePartialToolArgs` 残缺 JSON | 1 |
| `tool_partial` 浅过滤 | 1、3 |
| insert 一次 + 加长 text；complete 不重复插 | 2 |
| 空 trailing 块不闪 | 2 |
| 选区第一次 update 覆盖旧文 | 2 |
| 无 partial 仅 tool_call 兼容 | 2、4 |
| Agent 边流边 yield；非法完整调用丢弃 | 3 |
| SSE 事件；done 含非空 partial | 3 |
| Session partial / stop 合成 / accept | 4 |
| Host 生成中可见文本；shared 接受前不变 | 5 |
| rAF 合并 UI | 5（setState）；文档 mutate 保持同步以便测 |
| 不引入 xl-ai / 不改 chat | 全局约束 |

## 手工验收

1. 斜杠续写：字在正文里逐段变长，不是整段弹出。
2. 多段落：下一块出现后继续打字。
3. 选区润色：旧文被替换后逐渐打满。
4. 接受/拒绝/只读/协作隔离与 fork 设计相同。
