# AI 写作写入编辑区（Yjs fork）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已落地的块级 AI 写作从「影子编辑器 + 底部草稿卡」改成：本机 Yjs fork 上像真人一样写入正文，写完后在块旁接受/拒绝，接受才 merge 进共享 Y.Doc。

**Architecture:** `forkYDoc` / `mergeForkInto` 负责隔离与合并。`CollaborationEditorProvider.rebindVisibleEditor` 在不销毁 Hocuspocus 的前提下重建可见 `BlockEditor`。`createAiWritingSession` 对 fork 编辑器执行 `applyAiWriteOp`。草稿样式用 PM 装饰（不进 Y.Doc）。后端 `/ai/write` 不动。

**Tech Stack:** Yjs 13.6.32、Tiptap Collaboration 3.29.2、BlockEditor、HocuspocusProvider、Vitest、Testing Library、现有 SSE `readAiWriteSse`。

**Spec:** [`docs/superpowers/specs/2026-08-30-ai-write-in-editor-fork-design.md`](../specs/2026-08-30-ai-write-in-editor-fork-design.md)

## Global Constraints

- 不引入 `@blocknote/xl-ai` 或 Vercel AI SDK；不改 `POST /ai/write` 契约。
- 接受前不得把 AI op 写进 Hocuspocus 绑定的 shared `Y.Doc`。
- 不做 fork 与远端的三路合并；shared 在会话中被他人更新则结束会话。
- 不把 AI awareness 广播给协作者；不把整段 AI 压成一次 Ctrl+Z。
- 草稿 class 只用 PM 装饰，禁止写进 blockContainer Yjs 属性。
- 根目录 `.prettierrc`：LF、双引号、两空格、无分号、80 列；新增代码带有用中文注释。
- 每个新增/实质修改代码块至少一句解释意图的注释。
- 实现 Next.js 相关代码前核对该功能涉及的 `node_modules/next/dist/docs/` 指南。

## File map

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/core/yjs-document.ts` | `forkYDoc`、`mergeForkInto`、`AI_WRITE_MERGE_ORIGIN` |
| `packages/editor-core/src/core/index.ts` | 导出 fork API |
| `packages/editor-core/src/core/extensions/ai-write-draft-extension.ts` | 按 block id 给 `blockContainer` 加草稿装饰 |
| `packages/editor-core/src/core/extensions/build-block-schema-extensions.ts` | 挂上草稿扩展 |
| `packages/editor-core/src/core/ai-write/apply.ts` | `collectAiWriteDraftIds`（insert 新块 id + update id） |
| `packages/editor-react/src/react/context/editor-context.tsx` | 可选 `rebindVisibleEditor` |
| `packages/editor-react/src/react/providers/collaboration-editor-provider.tsx` | 实现改绑；fork 时忽略父级 `editable` 覆盖 |
| `apps/web/lib/ai-writing/session.ts` | fork 编辑器上 apply；accept 时 merge；不再重放 live |
| `packages/editor-shadcn/src/components/ai/ai-write-prompt-anchor.tsx` | 提示条锚在 `data-id` 块下方 |
| `packages/editor-shadcn/src/style.css` | `.ai-write-draft` 浅蓝底 + 左侧色条 |
| `apps/web/components/inkspace/ai-writing-host.tsx` | 提交时 fork 改绑、SSE、stale、去掉底部草稿 |
| `packages/editor-shadcn/src/components/ai/ai-write-draft.tsx` | 产品路径不再使用；可保留文件但 Host 不再渲染 |

---

### Task 1: Yjs fork / merge 原语

**Files:**
- Modify: `packages/editor-core/src/core/yjs-document.ts`
- Modify: `packages/editor-core/src/core/index.ts`（导出新符号）
- Test: `packages/editor-core/test/core/yjs-ai-write-fork.test.ts`

**Interfaces:**
- Consumes: `Y.Doc`、`Y.encodeStateAsUpdate`、`Y.encodeStateVector`、`Y.applyUpdate`、`createBlockSchemaYDoc`、`documentFromYjs`、`applyAiWriteOp`、`BlockEditor`
- Produces:

```ts
export const AI_WRITE_MERGE_ORIGIN = { type: "ai-write-merge" } as const

export function forkYDoc(shared: Y.Doc): Y.Doc
export function mergeForkInto(shared: Y.Doc, fork: Y.Doc): void
```

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import { BlockEditor } from "../../src/core/block-editor"
import { applyAiWriteOp } from "../../src/core/ai-write/apply"
import {
  createBlockSchemaYDoc,
  documentFromYjs,
  forkYDoc,
  mergeForkInto,
} from "../../src/core/yjs-document"

const PARA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function para(text: string) {
  return {
    id: PARA_ID,
    type: "paragraph" as const,
    props: {},
    content: [{ type: "text" as const, text, styles: {} }],
    children: [],
  }
}

describe("forkYDoc / mergeForkInto", () => {
  const editors: BlockEditor[] = []
  afterEach(() => {
    for (const editor of editors) editor.destroy()
    editors.length = 0
  })

  it("keeps shared unchanged while ops apply on the fork editor", () => {
    const shared = createBlockSchemaYDoc([para("one")])
    const fork = forkYDoc(shared)
    const forkEditor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document: fork },
    })
    editors.push(forkEditor)

    applyAiWriteOp(forkEditor, {
      type: "insert_blocks",
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })

    expect(documentFromYjs(shared)).toHaveLength(1)
    expect(documentFromYjs(fork)).toHaveLength(2)
  })

  it("merges fork incremental updates into shared", () => {
    const shared = createBlockSchemaYDoc([para("one")])
    const fork = forkYDoc(shared)
    const forkEditor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document: fork },
    })
    editors.push(forkEditor)
    applyAiWriteOp(forkEditor, {
      type: "insert_blocks",
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })

    mergeForkInto(shared, fork)
    expect(documentFromYjs(shared).map((block) =>
      Array.isArray(block.content) ? block.content[0] : null
    )).toEqual([
      { type: "text", text: "one", styles: {} },
      { type: "text", text: "two", styles: {} },
    ])
  })

  it("does not change shared when the fork is discarded", () => {
    const shared = createBlockSchemaYDoc([para("one")])
    const fork = forkYDoc(shared)
    const forkEditor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document: fork },
    })
    editors.push(forkEditor)
    applyAiWriteOp(forkEditor, {
      type: "insert_blocks",
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    fork.destroy()
    expect(documentFromYjs(shared)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/yjs-ai-write-fork.test.ts`

Expected: FAIL（`forkYDoc` / `mergeForkInto` 未导出）

- [ ] **Step 3: Write minimal implementation**

在 `yjs-document.ts` 末尾增加（保留文件里现有协作安全注释风格）：

```ts
/** merge 时作为 Y.applyUpdate origin，供 Host 忽略自身写入、避免误判 stale */
export const AI_WRITE_MERGE_ORIGIN = { type: "ai-write-merge" } as const

export function forkYDoc(shared: Y.Doc): Y.Doc {
  const fork = new Y.Doc()
  Y.applyUpdate(fork, Y.encodeStateAsUpdate(shared))
  return fork
}

export function mergeForkInto(shared: Y.Doc, fork: Y.Doc): void {
  const update = Y.encodeStateAsUpdate(fork, Y.encodeStateVector(shared))
  Y.applyUpdate(shared, update, AI_WRITE_MERGE_ORIGIN)
}
```

从 `core/index.ts` 与现有 `yjs-document` 导出一并导出这两个函数和 `AI_WRITE_MERGE_ORIGIN`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/yjs-ai-write-fork.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/yjs-document.ts packages/editor-core/src/core/index.ts packages/editor-core/test/core/yjs-ai-write-fork.test.ts
git commit -m "feat(editor-core): add Yjs fork and merge helpers for AI write"
```

---

### Task 2: 草稿块装饰与 draft id 收集

**Files:**
- Create: `packages/editor-core/src/core/extensions/ai-write-draft-extension.ts`
- Modify: `packages/editor-core/src/core/extensions/build-block-schema-extensions.ts`（始终 push 该扩展）
- Modify: `packages/editor-core/src/core/ai-write/apply.ts`（新增 `collectAiWriteDraftIds`）
- Modify: `packages/editor-core/src/core/ai-write/index.ts`
- Modify: `packages/editor-core/src/core/index.ts`（导出 `setAiWriteDraftIds`、`aiWriteDraftPluginKey`）
- Modify: `packages/editor-shadcn/src/style.css`
- Test: `packages/editor-core/test/core/ai-write-draft-decoration.test.ts`
- Test: `packages/editor-core/test/core/ai-write-apply.test.ts`（补 `collectAiWriteDraftIds`）

**Interfaces:**
- Consumes: `Plugin` / `Decoration.node`、`AiWriteOp`、`BlockEditor.tiptap`
- Produces:

```ts
export const aiWriteDraftPluginKey = new PluginKey("aiWriteDraft")
export function createAiWriteDraftExtension(): Extension
export function setAiWriteDraftIds(editor: BlockEditor, ids: Iterable<string>): void
export function collectAiWriteDraftIds(ops: AiWriteOp[]): string[]
```

`collectAiWriteDraftIds`：`insert_blocks` 收集已生成的 `block.id`；`update_block` 收集 `op.id`。不要把 `refId` 算进草稿（锚点不是 AI 新内容，除非也被 update）。

- [ ] **Step 1: Write the failing tests**

`ai-write-draft-decoration.test.ts`：

```ts
import { describe, expect, it } from "vitest"
import { BlockEditor } from "../../src/core/block-editor"
import {
  setAiWriteDraftIds,
  aiWriteDraftPluginKey,
} from "../../src/core/extensions/ai-write-draft-extension"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

describe("ai write draft decorations", () => {
  it("marks matching blockContainer with ai-write-draft class", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "hi", styles: {} }],
          children: [],
        },
      ],
    })
    setAiWriteDraftIds(editor, [ID])
    const decos = aiWriteDraftPluginKey.getState(editor.tiptap.state) as {
      decorations: { find: () => { spec?: { class?: string } }[] }
    }
    const html = editor.tiptap.view.dom.innerHTML
    expect(html).toContain("ai-write-draft")
    editor.destroy()
  })
})
```

若 `getState` 形状不便断言，只断言 `editor.tiptap.view.dom.querySelector("[data-id]").className` 包含 `ai-write-draft`。

在 `ai-write-apply.test.ts` 增加：insert 后 `collectAiWriteDraftIds` 含新块 id、不含 `refId`。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-draft-decoration.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`ai-write-draft-extension.ts` 按 `block-placeholder-extension.ts` 的 Plugin 模式：

- plugin state 为 `Set<string>`
- `apply`：若 `tr.getMeta(aiWriteDraftPluginKey)` 为 `Set` 则替换
- decorations：遍历 `doc.descendants`，`blockContainer` 且 `attrs.id` 在 set 中时 `Decoration.node(pos, pos + node.nodeSize, { class: "ai-write-draft" })`
- `setAiWriteDraftIds`：`editor.tiptap.view.dispatch(editor.tiptap.state.tr.setMeta(aiWriteDraftPluginKey, new Set(ids)))`

`build-block-schema-extensions.ts` 的 `extensions` 数组加入 `createAiWriteDraftExtension()`。

`style.css` 增加：

```css
/* AI 草稿：仅本机 fork 装饰，不进 Yjs */
.ProseMirror [data-node-type="blockContainer"].ai-write-draft {
  border-left: 2px solid #8bc6ff;
  background: rgba(139, 198, 255, 0.12);
  padding-left: 0.5rem;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-draft-decoration.test.ts test/core/ai-write-apply.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/extensions/ai-write-draft-extension.ts packages/editor-core/src/core/extensions/build-block-schema-extensions.ts packages/editor-core/src/core/ai-write packages/editor-core/src/core/index.ts packages/editor-shadcn/src/style.css packages/editor-core/test/core/ai-write-draft-decoration.test.ts packages/editor-core/test/core/ai-write-apply.test.ts
git commit -m "feat(editor): decorate AI draft blocks without writing Yjs attrs"
```

---

### Task 3: 协作层改绑可见编辑器

**Files:**
- Modify: `packages/editor-react/src/react/context/editor-context.tsx`
- Modify: `packages/editor-react/src/react/providers/collaboration-editor-provider.tsx`
- Modify: `packages/editor-react/src/react/providers/editor-provider.tsx`（`rebindVisibleEditor` 为 `undefined`，非协作不提供）
- Test: `packages/editor-react/test/react/providers/editor-provider.test.tsx`（在现有 `CollaborationEditorProvider` describe 中追加）

**Interfaces:**
- Consumes: Task 1 的 `forkYDoc`、现有 `createSyncedBlockEditor` 选项
- Produces:

```ts
export type RebindVisibleEditorInput =
  | { target: "shared"; editable: boolean }
  | { target: "fork"; document: Y.Doc; editable: boolean }

export type EditorContextValue = {
  // ...existing
  rebindVisibleEditor?: (input: RebindVisibleEditorInput) => BlockEditor
}
```

改绑必须：销毁上一份 `BlockEditor`（现有 `useEffect` 依赖 `blockEditor` 的 cleanup 已会 `destroy`）；**不得**调用 `session.destroy()`；fork 分支构造时 `extensions.provider` 与 `user` 省略，`document` 为 fork，`applyInitialContent: false`，`editable` 用入参。

父组件 `editable` 的 `useEffect` 不得把 fork 只读锁冲掉：用 `visibleEditableLockRef`，`rebind` 时写入入参 `editable`；`target: "shared"` 时把 lock 设为 `null`，之后跟随 props。

- [ ] **Step 1: Write the failing test**

在协作 provider 测试里，synced 之后：

```tsx
function RebindProbe() {
  const context = use(EditorContext)
  const [mode, setMode] = useState("shared")
  if (!context?.blockEditor) return <span>loading</span>
  return (
    <>
      <span data-testid="editable">
        {context.blockEditor.tiptap.isEditable ? "yes" : "no"}
      </span>
      <span data-testid="mode">{mode}</span>
      <button
        onClick={() => {
          const fork = forkYDoc(sessionDocumentFromTest)
          context.rebindVisibleEditor?.({
            target: "fork",
            document: fork,
            editable: false,
          })
          setMode("fork")
        }}
      >
        fork
      </button>
    </>
  )
}
```

测试不便拿到 session.document 时：从 context 无法直接取 Y.Doc。改为在测试文件里用与 `CollaborationEditorProvider` 相同的 `createProvider` mock，provider 回调里缓存 `options.document`：

```ts
let sharedDoc: Y.Doc | undefined
const createProvider: CreateProvider = (options) => {
  sharedDoc = options.document
  return createMockProvider(...)
}
```

然后：

1. emit synced，等到 `blockEditor` 存在
2. `act(() => rebindVisibleEditor({ target: "fork", document: forkYDoc(sharedDoc!), editable: false }))`
3. 断言 `blockEditor.tiptap.isEditable === false`
4. 对 fork 编辑器 `insertBlocks` 一段文字
5. 断言 `documentFromYjs(sharedDoc).length` 仍为改绑前长度
6. mock provider 的 `destroy` **未被**再次调用（会话仍在）
7. `rebindVisibleEditor({ target: "shared", editable: true })` 后 editable 为 true

需要从测试组件把 `rebindVisibleEditor` 暴露出来（probe 按钮）。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-react test -- test/react/providers/editor-provider.test.tsx`

Expected: FAIL（`rebindVisibleEditor` 不存在）

- [ ] **Step 3: Write minimal implementation**

`collaboration-editor-provider.tsx`：

```ts
const visibleEditableLockRef = useRef<boolean | null>(null)

const rebindVisibleEditor = useCallback(
  (input: RebindVisibleEditorInput) => {
    const options = createOptionsRef.current
    visibleEditableLockRef.current =
      input.target === "fork" ? input.editable : null
    const nextEditor =
      input.target === "fork"
        ? new BlockEditor({
            applyInitialContent: false,
            editable: input.editable,
            editorSchema: options.editorSchema,
            extensions: {
              document: input.document,
              imageUpload: options.imageUpload,
              canvasImageFetch: options.canvasImageFetch,
              imageUploadNode: options.imageUploadNode,
              canvasBlockNode: options.canvasBlockNode,
            },
          })
        : new BlockEditor({
            applyInitialContent: false,
            editable: input.editable,
            editorSchema: options.editorSchema,
            extensions: {
              document: session.document,
              provider: session.provider,
              user: collaboration.user,
              imageUpload: options.imageUpload,
              canvasImageFetch: options.canvasImageFetch,
              imageUploadNode: options.imageUploadNode,
              canvasBlockNode: options.canvasBlockNode,
            },
          })
    blockEditorRef.current = nextEditor
    setBlockEditor(nextEditor)
    return nextEditor
  },
  [collaboration.user, session]
)
```

`ensureEditor` 仍只在 `blockEditorRef.current` 为空时创建，避免 fork 期间 synced 事件再建一份 shared 编辑器。

`setEditable` effect：

```ts
blockEditor?.setEditable(visibleEditableLockRef.current ?? editable)
```

把 `rebindVisibleEditor` 放进 `EditorContext` value。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xtai-notion/editor-react test -- test/react/providers/editor-provider.test.tsx`

Expected: PASS（原有协作测试也必须仍绿）

- [ ] **Step 5: Commit**

```bash
git add packages/editor-react/src/react/context/editor-context.tsx packages/editor-react/src/react/providers/collaboration-editor-provider.tsx packages/editor-react/src/react/providers/editor-provider.tsx packages/editor-react/test/react/providers/editor-provider.test.tsx
git commit -m "feat(editor-react): rebind visible BlockEditor onto a Yjs fork"
```

---

### Task 4: 重写 `createAiWritingSession`

**Files:**
- Modify: `apps/web/lib/ai-writing/session.ts`
- Modify: `apps/web/test/lib/ai-writing/session.test.ts`

**Interfaces:**
- Consumes: Task 1 `forkYDoc` / `mergeForkInto`；`applyAiWriteOp`；`collectAiWriteDraftIds`；`isEmptyTextBlock`；`setAiWriteDraftIds`
- Produces:

```ts
export function createAiWritingSession(input: {
  shared: Y.Doc
  fork: Y.Doc
  forkEditor: BlockEditor
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
}): AiWritingSession

export type AiWritingSession = {
  readonly mode: AiWriteMode
  readonly emptyCursorBlockToDelete: string | undefined
  status: AiWritingStatus
  errorMessage?: string
  ops: AiWriteOp[]
  sharedStale: boolean
  applyRemoteOp(op: AiWriteOp): void
  draftIds(): string[]
  lastTouchedBlockId(): string | undefined
  markSharedStale(): void
  accept(): { ok: true } | { ok: false; reason: "stale" | "empty" | "merge" }
  reject(): void
  stop(): void
}
```

行为：

- **没有** `shadow`；`applyRemoteOp` 只打 `forkEditor`。
- 每次成功 apply 后 `setAiWriteDraftIds(forkEditor, draftIds())`。
- `accept`：`ops.length === 0` → `empty`；`sharedStale` → `stale`（不 merge、不 closed）；否则若有 `emptyCursorBlockToDelete` 且该块仍在 fork 且仍为空则 `forkEditor.removeBlocks`；再 `try { mergeForkInto(shared, fork) } catch { return { ok: false, reason: "merge" } }`；成功则 `status = "closed"`。不销毁 fork Y.Doc（Host 改绑后再 `fork.destroy()`）。
- `reject`：只 `status = "closed"`，不 merge。
- `stop`：有 ops → `user-reviewing`，否则 `closed`。

- [ ] **Step 1: Rewrite failing tests**

用 `createBlockSchemaYDoc([para])` + `forkYDoc` + fork `BlockEditor`。删除所有 `session.shadow` 断言。

- `applyRemoteOp` 后 `documentFromYjs(shared)` 长度仍为 1，`forkEditor.document` 长度为 2
- `accept` 后 shared 长度为 2
- `reject` 后 shared 仍为 1
- 空 ops `accept` → `{ ok: false, reason: "empty" }`
- `markSharedStale()` 后 `accept` → `{ ok: false, reason: "stale" }` 且 shared 未变
- 空段落 slash：accept 后 shared 只有 AI 新块、没有空占位

不要再测「从 live 删 refId 导致 stale」——stale 改为 shared Y.Doc 远端更新标志。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- test/lib/ai-writing/session.test.ts`

Expected: FAIL（旧 session 签名仍要 `live`）

- [ ] **Step 3: Write minimal implementation**

按上面接口改 `session.ts`。`lastTouchedBlockId`：`draftIds()` 的最后一项，若为空则 `cursorBlockId`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- test/lib/ai-writing/session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai-writing/session.ts apps/web/test/lib/ai-writing/session.test.ts
git commit -m "feat(web): apply AI write ops on a forked Yjs editor"
```

---

### Task 5: 提示条锚点，去掉底部草稿卡

**Files:**
- Create: `packages/editor-shadcn/src/components/ai/ai-write-prompt-anchor.tsx`
- Create: `packages/editor-shadcn/test/components/ai/ai-write-prompt-anchor.test.tsx`
- Modify: `packages/editor-shadcn/src/index.ts`（导出 `AiWritePromptAnchor`；可继续导出 `AiWriteDraft` 以免外部断，但 Host 不再用）
- Modify: `packages/editor-shadcn/src/components/ai/ai-write-prompt-bar.tsx`：去掉自身的 `fixed`/`max-w-2xl` 大阴影定位职责以外的全屏样式依赖——条本身保持卡片样式，定位交给 Anchor

**Interfaces:**
- Consumes: `anchorBlockId: string`、`children`（`AiWritePromptBar`）
- Produces: `AiWritePromptAnchor` 渲染 `position:fixed` 的容器，`data-testid="ai-writing-overlay"`，用 `document.querySelector('[data-node-type="blockContainer"][data-id="..."]')` 的 `getBoundingClientRect()` 把提示条放到块下方 8px；找不到锚点时水平居中、距视口底部 32px（回退，避免测试 jsdom 无布局时整页不可见）。

- [ ] **Step 1: Write the failing test**

```tsx
it("positions the overlay using the anchor block rect", () => {
  const anchor = document.createElement("div")
  anchor.setAttribute("data-node-type", "blockContainer")
  anchor.setAttribute("data-id", PARA_ID)
  document.body.appendChild(anchor)
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
    top: 40, left: 80, bottom: 60, right: 280, width: 200, height: 20,
    toJSON: () => ({}),
  } as DOMRect)

  render(
    <AiWritePromptAnchor anchorBlockId={PARA_ID}>
      <div data-testid="ai-write-prompt-bar">bar</div>
    </AiWritePromptAnchor>
  )

  const overlay = screen.getByTestId("ai-writing-overlay")
  expect(overlay.style.top).toBe("68px")
  expect(overlay.style.left).toBe("80px")
})
```

监听 `scroll`/`resize` 用 `{ passive: true }`。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-shadcn test -- test/components/ai/ai-write-prompt-anchor.test.tsx`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`AiWritePromptAnchor`：`useState` 存 `{ top, left, width }`；`useEffect` 量测并订阅 scroll/resize；`createPortal(..., document.body)`。容器 `className` 不要再用 `inset-x-0 bottom-8`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xtai-notion/editor-shadcn test -- test/components/ai/ai-write-prompt-anchor.test.tsx test/components/ai/ai-write-prompt-bar.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-shadcn/src/components/ai/ai-write-prompt-anchor.tsx packages/editor-shadcn/test/components/ai/ai-write-prompt-anchor.test.tsx packages/editor-shadcn/src/index.ts packages/editor-shadcn/src/components/ai/ai-write-prompt-bar.tsx
git commit -m "feat(editor-shadcn): anchor AI prompt bar under the draft block"
```

---

### Task 6: `AiWritingHost` 接 fork 生命周期

**Files:**
- Modify: `apps/web/components/inkspace/ai-writing-host.tsx`
- Modify: `apps/web/test/components/inkspace/ai-writing-host.test.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.tsx`（仅当 Host 需要从 context 取 `rebindVisibleEditor`；一般不用改）

**Interfaces:**
- Consumes: Task 3 `rebindVisibleEditor`、`EditorContext` 无法直接给 Y.Doc 时：给 `CollaborationEditorProvider` 增加只读 `getSharedYDoc?: () => Y.Doc` **或** 把 `session.document` 挂到 context。

选定：`EditorContextValue` 增加可选 `sharedYDoc: Y.Doc | null`（协作 provider 设为 `session.document`，非协作为 `null`）。Host 用它 fork / 听 `update`。

- Produces: 提交 prompt 时 fork + rebind；SSE 打 `session.applyRemoteOp`；接受 merge 后 `rebindVisibleEditor({ target: "shared", editable: true })` 并 `fork.destroy()`；拒绝只 rebind + destroy fork。卸载等同拒绝。监听 `sharedYDoc.on("update", handler)`，`origin === AI_WRITE_MERGE_ORIGIN` 则忽略，否则 `markSharedStale`、toast「文档已变化」、走拒绝路径。

UI：`user-input` 时 `anchorBlockId = cursorBlockId`；写作中用 `session.lastTouchedBlockId()`。**禁止**渲染 `AiWriteDraft`。`blocks` 请求体在 fork **之前**从当时的 `blockEditor.document` 序列化并缓存到 ref。

缺少 `rebindVisibleEditor` 或 `sharedYDoc` 时 toast「当前编辑器不支持 AI 写作」并 return。

本机 AI 光标：apply 成功后 `forkEditor.tiptap.commands.focus()` 到最后草稿块；不接 Hocuspocus awareness。

- [ ] **Step 1: Rewrite host tests**

把 `"keeps live document unchanged until accept after SSE insert"` 改成：

1. 生成过程中（出现 accept 之前，tool_call 后）可见 `blockEditor.document` **已经**有 AI 块（`latestBlockCount === 2` 或文案含 `ai draft`）
2. 同时 `documentFromYjs(sharedDoc)` 仍为 1（测试需像 Task 3 一样缓存 mock provider 的 `options.document`）
3. 点接受后 `documentFromYjs(sharedDoc)` 长度为 2，且不再有 `ai-write-draft` class（改绑回 shared）
4. 断言 **没有** `ai-write-draft` 测试 id 的底部卡片：`queryByTestId("ai-write-draft")` 为 null
5. 保留 viewer / 第二路会话 toast 用例

增加拒绝用例：写完点拒绝，shared 长度仍为 1，可见编辑器回到原长。

`latestBlockCount` 来自 context 中**当前** `blockEditor.document.length`，fork 期间应变大。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- test/components/inkspace/ai-writing-host.test.tsx`

Expected: FAIL（仍渲染草稿卡且 accept 前 live 不变）

- [ ] **Step 3: Write minimal implementation**

按数据流改 `ai-writing-host.tsx`：

1. `handleSubmit` 开头：`const shared = context.sharedYDoc`；`const fork = forkYDoc(shared)`；`const forkEditor = context.rebindVisibleEditor({ target: "fork", document: fork, editable: false })`；`createAiWritingSession({ shared, fork, forkEditor, ... })`。
2. `handleAccept`：`session.accept()`；失败 toast（`stale` →「文档已变化，无法应用 AI 草稿」；`merge` →「无法写入协作文档」）；成功才 `rebindVisibleEditor({ target: "shared", editable: true })`、`fork.destroy()`、`clearSession`。merge 失败不要 destroy fork。
3. `handleReject` / 卸载：若已 fork，`rebind` shared、`fork.destroy()`。
4. Overlay 用 `AiWritePromptAnchor`。

给 `CollaborationEditorProvider` 的 context value 加上 `sharedYDoc: session.document`。

- [ ] **Step 4: Run tests to verify they pass**

Run:

```
pnpm --filter web test -- test/components/inkspace/ai-writing-host.test.tsx test/lib/ai-writing/session.test.ts
pnpm --filter @xtai-notion/editor-react test -- test/react/providers/editor-provider.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/inkspace/ai-writing-host.tsx apps/web/test/components/inkspace/ai-writing-host.test.tsx packages/editor-react/src/react/context/editor-context.tsx packages/editor-react/src/react/providers/collaboration-editor-provider.tsx
git commit -m "feat(web): stream AI writing into the editor via a local Yjs fork"
```

---

## Spec coverage（自检）

| Spec 项 | Task |
|---------|------|
| fork 真写入、接受 merge | 1, 4, 6 |
| 接受前 shared 不变 | 1, 4, 6 |
| 草稿样式不进 Yjs | 2, 6 |
| 提示条锚在块下、审阅接受/拒绝 | 5, 6 |
| 会话只读 | 3 lock + 6 `editable: false` |
| 远端更新结束会话 | 6 `AI_WRITE_MERGE_ORIGIN` 过滤 |
| 空段落 slash | 4 |
| 去掉底部 AiWriteDraft | 5, 6 |
| 不改 `/ai/write` | 全局约束，无 API task |
| 不广播 AI 光标 | 6 仅 local focus |
| 卸载 = 拒绝 | 6 |
| merge 失败停留审阅 | 4, 6 |
