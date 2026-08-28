# Block Document Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把编辑器对外模型换成 `Block[]`，内部改为块结构的 ProseMirror 树，拆出无 React 的 `@workspace/editor-core`，并在协作 `onLoad` 把旧 Yjs 文档迁到 schema v2。

**Architecture:** 先在现有 `packages/editor` 落地块类型、PM 节点、`Block[]` ↔ Node、`BlockEditor` 门面，再把 core/collaboration 拆到新包。Web 只依赖 `@workspace/editor`；API 只依赖 `@workspace/editor-core`。Yjs fragment 名称仍为 `default`，不另存 Block JSON。

**Tech Stack:** Tiptap 3.29.2、`@tiptap/pm`、Yjs 13.6.32、Hocuspocus 4.5.0、React 19、Vitest、Prisma / PostgreSQL。

**Spec:** `docs/superpowers/specs/2026-08-28-block-document-architecture-design.md`

## Global Constraints

- 全部在本仓库自研实现，只实现本 spec 的类型与行为。
- `@workspace/editor-core` 源码不得 `import` `react`、`@tiptap/react`、`@workspace/ui`。
- 公共文档类型是 `Block[]`；删除公共 `EditorDocument` 与 `export type Editor from "@tiptap/core"`。
- Yjs 字段名仍为 `"default"`。`schemaVersion`：`1` = 旧 StarterKit 树，`2` = 块树。
- 最大缩进深度 `MAX_NEST_DEPTH = 8`。块 `id` 用 `crypto.randomUUID()`。
- 斜杠：空块是 `updateBlock` 变成目标类型；有内容是 `insertBlocks(..., "after")`。
- Prettier：LF、无分号、双引号、2 空格、80 列。每段实质改动的代码至少一条中文注释（说明意图，不复述代码）。
- 先改模型再拆包。提交信息用 `feat(editor):` / `feat(api):` / `test:` 前缀。

## File map

| 路径 | 职责 |
|---|---|
| `packages/editor/src/core/block-schema/types.ts` | `Block`、`PartialBlock`、`InlineContent`、`TableContent`、`BlockType` |
| `packages/editor/src/core/block-schema/ids.ts` | `generateBlockId`、`MAX_NEST_DEPTH` |
| `packages/editor/src/core/block-schema/documents.ts` | `createEmptyBlocks`、`createStarterBlocks`、`isBlockArray` |
| `packages/editor/src/core/block-schema/pm-nodes.ts` | `Doc` / `blockGroup` / `blockContainer` |
| `packages/editor/src/core/block-schema/block-content.ts` | 各 `blockContent` 节点 |
| `packages/editor/src/core/block-schema/convert.ts` | `blockToNode` / `nodeToBlock` / `blocksToPmDoc` / `pmDocToBlocks` |
| `packages/editor/src/core/block-editor.ts` | `BlockEditor` 门面 |
| `packages/editor/src/core/migrate/legacy-json-to-blocks.ts` | 旧 Tiptap JSON → `Block[]` |
| `packages/editor/src/core/migrate/migrate-ydoc.ts` | v1 Y.Doc → v2 Y.Doc（仅 `@workspace/editor-core/migrate`） |
| `packages/editor-core/` | Task 7 从 editor 迁出的无 React 包 |
| `apps/api/prisma/schema.prisma` + `prisma/migrations/002_document_schema_version/` | `document.schema_version` |

---

### Task 1: 块类型与空文档 / 种子文档

**Files:**
- Create: `packages/editor/src/core/block-schema/types.ts`
- Create: `packages/editor/src/core/block-schema/ids.ts`
- Create: `packages/editor/src/core/block-schema/documents.ts`
- Test: `packages/editor/src/core/block-schema/documents.test.ts`
- Modify: `packages/editor/src/core/index.ts`（先 **追加** 导出，暂不删除 `EditorDocument`）

**Interfaces:**
- Produces:
  - `generateBlockId(): string`
  - `MAX_NEST_DEPTH = 8`
  - `createEmptyBlocks(): Block[]` — 恰好一块 `type: "paragraph"`，`content: []`，`children: []`，有 `id`
  - `createStarterBlocks(): Block[]` — 标题 + 段落 + 一条 bullet + quote + codeBlock，文案与现有 `createStarterDocument` 相同
  - `isBlockArray(value: unknown): value is Block[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "./documents"
import { MAX_NEST_DEPTH } from "./ids"

describe("block documents", () => {
  it("creates a single empty paragraph block", () => {
    const blocks = createEmptyBlocks()
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe("paragraph")
    expect(blocks[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(blocks[0]?.children).toEqual([])
    expect(isBlockArray(blocks)).toBe(true)
    expect(isBlockArray({ type: "doc", content: [] })).toBe(false)
  })

  it("keeps starter copy and list-as-block shape", () => {
    const blocks = createStarterBlocks()
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "quote",
      "codeBlock",
    ])
    expect(blocks[0]?.props).toEqual({ level: 1 })
    expect(MAX_NEST_DEPTH).toBe(8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor test -- src/core/block-schema/documents.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

`ids.ts`：`export const MAX_NEST_DEPTH = 8`；`generateBlockId` 调用 `crypto.randomUUID()`。

`types.ts` 按 spec 定义 `BlockType` 联合：

`"paragraph" | "heading" | "bulletListItem" | "numberedListItem" | "checkListItem" | "quote" | "codeBlock" | "divider" | "image" | "table" | "canvas"`

以及 `InlineStyles`、`InlineContent`、`TableContent`、`Block`、`PartialBlock`（`id?`、`children?`、`props?`、`content?`）。

`documents.ts`：`createEmptyBlocks` 返回一块空段落；`createStarterBlocks` 把现有种子文案写成块（heading level 1「让知识真正流动起来」、段落「这是一个可编辑的知识文档。」、bullet「记录想法」、quote「好的工具让秩序自然出现。」、codeBlock `const knowledge = true`）。`isBlockArray`：值为数组且每项有 `string` 的 `id`/`type` 与 `children` 数组。

从 `core/index.ts` 导出这些符号。行内文字块用 `{ type: "text", text: "...", styles: {} }`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/editor test -- src/core/block-schema/documents.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core/block-schema packages/editor/src/core/index.ts
git commit -m "feat(editor): add Block document types and starter blocks"
```

---

### Task 2: 块 PM schema 与 Block ↔ Node 往返

**Files:**
- Create: `packages/editor/src/core/block-schema/pm-nodes.ts`
- Create: `packages/editor/src/core/block-schema/block-content.ts`
- Create: `packages/editor/src/core/block-schema/convert.ts`
- Test: `packages/editor/src/core/block-schema/convert.test.ts`
- Modify: `packages/editor/src/core/extensions/index.ts` — 新增 `createBlockSchemaExtensions(options?)`，**先不要**替换 `createEditorExtensions`

**Interfaces:**
- Consumes: `Block`、`generateBlockId`、现有 `MentionNode`、`CanvasBlockNode`、`ImageUploadNode` 的属性语义（画板 `canvasId`/`snapshot`，提及 `id`/`label`/`href`）。
- Produces:
  - `createBlockSchemaExtensions(options?: EditorExtensionOptions): Extensions`
  - `pmDocToBlocks(doc: Node): Block[]`
  - `blocksToPmDoc(blocks: Block[], schema: Schema): Node`
  - 文档 `content` 为 `blockGroup`；`blockContainer` 的 `content` 为 `blockContent blockGroup?`；`id` 默认 `generateBlockId()`。

**StarterKit 必须关掉会抢 `doc`/`paragraph` 的节点**，只保留 marks 与 history：

```ts
StarterKit.configure({
  doc: false,
  paragraph: false,
  heading: false,
  bulletList: false,
  orderedList: false,
  listItem: false,
  taskList: false,
  taskItem: false,
  blockquote: false,
  codeBlock: false,
  horizontalRule: false,
  dropcursor: false,
  undoRedo: options.document ? false : {},
})
```

`Doc` 扩展：`content: "blockGroup"`。`blockGroup`：`content: "blockContainer+"`。`blockContainer`：`attrs.id`，`content: "blockContent blockGroup?"`。每个块类型 `group: "blockContent"`。

- [ ] **Step 1: Write the failing test**

```ts
import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"
import { createEmptyBlocks, createStarterBlocks } from "./documents"
import { createBlockSchemaExtensions } from "../extensions"
import { blocksToPmDoc, pmDocToBlocks } from "./convert"

const editors: Editor[] = []

function createEditor(content: ReturnType<typeof createStarterBlocks>) {
  const editor = new Editor({
    extensions: createBlockSchemaExtensions(),
    content: undefined,
  })
  // 用块转换灌入 PM 文档，避免旧 HTML 解析走 StarterKit。
  const doc = blocksToPmDoc(content, editor.schema)
  editor.commands.setContent(doc.toJSON())
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("block pm roundtrip", () => {
  it("round-trips starter blocks including list item as a block", () => {
    const original = createStarterBlocks()
    const editor = createEditor(original)
    const restored = pmDocToBlocks(editor.state.doc)
    expect(restored.map((block) => block.type)).toEqual(
      original.map((block) => block.type)
    )
    expect(restored[2]?.type).toBe("bulletListItem")
  })

  it("round-trips nested children, table, image, canvas, and mention", () => {
    const parentId = "11111111-1111-4111-8111-111111111111"
    const childId = "22222222-2222-4222-8222-222222222222"
    const blocks = [
      {
        id: parentId,
        type: "paragraph" as const,
        props: {},
        content: [
          { type: "text" as const, text: "hi ", styles: { bold: true } },
          {
            type: "mention" as const,
            id: "doc-target",
            label: "Target",
            href: "/documents/doc-target",
          },
        ],
        children: [
          {
            id: childId,
            type: "paragraph" as const,
            props: {},
            content: [{ type: "text" as const, text: "nested", styles: {} }],
            children: [],
          },
        ],
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "table" as const,
        props: {},
        content: {
          headerRows: 1,
          rows: [
            {
              cells: [
                {
                  content: [
                    { type: "text" as const, text: "A", styles: {} },
                  ],
                },
                {
                  content: [
                    { type: "text" as const, text: "B", styles: {} },
                  ],
                },
              ],
            },
          ],
        },
        children: [],
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        type: "image" as const,
        props: { src: "https://example.com/a.png", uploadStatus: "idle" },
        children: [],
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        type: "canvas" as const,
        props: { canvasId: "c1", snapshot: "{\"elements\":[]}" },
        children: [],
      },
    ]
    const editor = createEditor(blocks)
    const restored = pmDocToBlocks(editor.state.doc)
    expect(restored[0]?.children[0]?.content).toEqual(
      blocks[0]?.children[0]?.content
    )
    expect(restored[0]?.content).toEqual(blocks[0]?.content)
    expect(restored[1]?.type).toBe("table")
    expect(restored[2]?.props).toMatchObject({ src: "https://example.com/a.png" })
    expect(restored[3]?.type).toBe("canvas")
  })

  it("keeps at least one paragraph for empty input", () => {
    const editor = createEditor(createEmptyBlocks())
    expect(pmDocToBlocks(editor.state.doc)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor test -- src/core/block-schema/convert.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

`pm-nodes.ts`：用 `@tiptap/core` 的 `Node.create` / `Node.extend`。`blockContainer` 的 `id` 默认 `generateBlockId()`；`parseHTML`/`renderHTML` 使用 `data-id` 与 `data-node-type="blockContainer"`。`blockGroup` 渲染为带 `data-node-type="blockGroup"` 的 div。

`block-content.ts`：为每种 `BlockType` 建一个 `group: "blockContent"` 节点。要点：

- `heading`：`attrs.level` 1|2|3，`content: "inline*"`。
- 三个 list item：普通行内；`checkListItem` 另有 `attrs.checked`。
- `quote`：`content: "inline*"`（不是包一层 paragraph）。
- `codeBlock`：`content: "text*"`，`attrs.language` 可空。
- `divider`：`atom`，无 content。
- `image`：atom；`src`、`uploadStatus`（`idle|uploading|error`）。合并旧 `image` 与 `imageUpload`：无 `src` 且 `uploadStatus` 为 `idle` 即占位。
- `table`：块内容节点内部仍用官方 `tableRow`/`tableHeader`/`tableCell`（这些节点 **不是** `blockContent`，只活在 table 内部）。
- `canvas`：atom；`canvasId`、`snapshot`。可继续从现有 `CanvasBlockNode` 改 `group` 为 `blockContent` 并改名为 schema 内的 `canvas`（对外 Block.type 是 `canvas`）。

`convert.ts`：

- 未知 `blockContent` type → 降级 `paragraph`，能抽到的 text 放进 `content`。
- 行内：`text` + marks → `styles`；`link` mark → `type: "link"`；`mention` 节点 → `type: "mention"`。
- `blocksToPmDoc`：若 `blocks.length === 0`，插入 `createEmptyBlocks()`。
- 往返必须保留传入的 `id`。

`createBlockSchemaExtensions`：组装 Doc、blockGroup、blockContainer、全部 blockContent、marks（bold/italic/underline/strike/code/link）、MentionNode、Collaboration（当 `options.document` 存在时，逻辑与现网一致）、Placeholder、Dropcursor。

协作时禁用 undoRedo，与现有 `createEditorExtensions` 相同。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/editor test -- src/core/block-schema/convert.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core/block-schema packages/editor/src/core/extensions
git commit -m "feat(editor): add block ProseMirror schema and Block/Node conversion"
```

---

### Task 3: 旧 Tiptap JSON → Block[]

**Files:**
- Create: `packages/editor/src/core/migrate/legacy-json-to-blocks.ts`
- Test: `packages/editor/src/core/migrate/legacy-json-to-blocks.test.ts`
- Modify: `packages/editor/src/core/migrate/index.ts`（导出 `legacyJsonToBlocks`；本任务仍从 `core` 导出，Task 7 再收到 `/migrate` 子路径）

**Interfaces:**
- Consumes: `generateBlockId`、`Block`、`InlineContent`。
- Produces: `legacyJsonToBlocks(doc: { type?: string; content?: unknown[] }): Block[]`

转换规则（必须全部覆盖在测试里）：

- `paragraph` / `heading` / `codeBlock` / `horizontalRule`→`divider` / `image` / `canvasBlock`→`canvas` / `imageUpload`→`image` 且 `uploadStatus: "idle"`
- `bulletList`/`orderedList`/`taskList`：每个 `listItem`/`taskItem` 变一块；item 内嵌套 list 变成 `children`
- `blockquote`：第一段行内作为 `quote.content`，其余内部节点变成 `quote.children`
- `table`：整表一块，`headerRows` 为 1 如果首行全是 `tableHeader`
- `mention`：行内
- 空 `content` → `createEmptyBlocks()`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { legacyJsonToBlocks } from "./legacy-json-to-blocks"

describe("legacyJsonToBlocks", () => {
  it("turns nested bullet lists into children", () => {
    const blocks = legacyJsonToBlocks({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "parent" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    expect(blocks[0]?.type).toBe("bulletListItem")
    expect(blocks[0]?.children[0]?.type).toBe("bulletListItem")
  })

  it("flattens multi-paragraph blockquote", () => {
    const blocks = legacyJsonToBlocks({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "a" }] },
            { type: "paragraph", content: [{ type: "text", text: "b" }] },
          ],
        },
      ],
    })
    expect(blocks[0]?.type).toBe("quote")
    expect(blocks[0]?.children[0]?.type).toBe("paragraph")
  })

  it("maps table, canvasBlock, mention, and imageUpload", () => {
    const blocks = legacyJsonToBlocks({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }],
                },
              ],
            },
          ],
        },
        {
          type: "canvasBlock",
          attrs: { canvasId: "c1", snapshot: "" },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "doc-target", label: "T", href: "/documents/doc-target" },
            },
          ],
        },
        { type: "imageUpload" },
      ],
    })
    expect(blocks.map((block) => block.type)).toEqual([
      "table",
      "canvas",
      "paragraph",
      "image",
    ])
    expect(blocks[2]?.content).toEqual([
      {
        type: "mention",
        id: "doc-target",
        label: "T",
        href: "/documents/doc-target",
      },
    ])
    expect(blocks[3]?.props).toMatchObject({ uploadStatus: "idle" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor test -- src/core/migrate/legacy-json-to-blocks.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

纯 JSON 遍历，不依赖 Tiptap Editor。`listItem` 的第一个 `paragraph` 作为该 list 块的 `content`，后续 nested list 递归为 `children`。每个输出块调用 `generateBlockId()`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/editor test -- src/core/migrate/legacy-json-to-blocks.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core/migrate packages/editor/src/core/index.ts
git commit -m "feat(editor): convert legacy Tiptap JSON into Block arrays"
```

---

### Task 4: `BlockEditor` 门面（insert / update / remove / nest / unnest）

**Files:**
- Create: `packages/editor/src/core/block-editor.ts`
- Test: `packages/editor/src/core/block-editor.test.ts`
- Modify: `packages/editor/src/core/index.ts`

**Interfaces:**
- Consumes: `createBlockSchemaExtensions`、`pmDocToBlocks`、`blocksToPmDoc`、`MAX_NEST_DEPTH`。
- Produces:

```ts
class BlockEditor {
  constructor(options: {
    initialContent?: Block[]
    editable?: boolean
    extensions?: EditorExtensionOptions
  })
  readonly document: Block[]
  insertBlocks(
    blocks: PartialBlock[],
    refId: string,
    placement: "before" | "after" | "nested"
  ): void
  updateBlock(
    id: string,
    update: { type?: BlockType; props?: Record<string, unknown>; content?: Block["content"] }
  ): void
  removeBlocks(ids: string[]): void
  nestBlock(): boolean
  unnestBlock(): boolean
  getSelectedBlocks(): Block[]
  onChange(listener: (blocks: Block[]) => void): () => void
  setEditable(editable: boolean): void
  destroy(): void
  /** 仅供 React NodeView / 协作绑定内部使用，不从包根导出 */
  get tiptap(): Editor
}
```

`nestBlock`：当前选区所在块若存在上一个同级，则移到其 `children` 末尾；无上一个同级或深度已达 8 返回 `false`。`unnestBlock`：有父块则升到父块之后。两者都带子树一起动。

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "./block-editor"
import { generateBlockId } from "./block-schema/ids"

const editors: BlockEditor[] = []

function create() {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "one", styles: {} }],
        children: [],
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "two", styles: {} }],
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

describe("BlockEditor", () => {
  it("updates block type without dropping id", () => {
    const editor = create()
    editor.updateBlock("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      type: "heading",
      props: { level: 2 },
    })
    expect(editor.document[0]?.type).toBe("heading")
    expect(editor.document[0]?.id).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )
  })

  it("nests the current block under the previous sibling", () => {
    const editor = create()
    editor.tiptap.commands.setTextSelection(editor.tiptap.state.doc.content.size - 2)
    expect(editor.nestBlock()).toBe(true)
    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]?.children[0]?.id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    )
  })

  it("unnests a child back after its parent", () => {
    const editor = create()
    editor.tiptap.commands.setTextSelection(editor.tiptap.state.doc.content.size - 2)
    editor.nestBlock()
    expect(editor.unnestBlock()).toBe(true)
    expect(editor.document.map((block) => block.id)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ])
  })

  it("inserts after a ref block", () => {
    const editor = create()
    const id = generateBlockId()
    editor.insertBlocks(
      [
        {
          id,
          type: "paragraph",
          content: [{ type: "text", text: "three", styles: {} }],
        },
      ],
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "after"
    )
    expect(editor.document.map((block) => block.id)[1]).toBe(id)
  })

  it("does not nest past MAX_NEST_DEPTH", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "root0000-0000-4000-8000-000000000001",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "root", styles: {} }],
          children: [],
        },
        {
          id: "root0000-0000-4000-8000-000000000002",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "leaf", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)
    editor.tiptap.commands.setTextSelection(
      editor.tiptap.state.doc.content.size - 2
    )
    for (let depth = 0; depth < 8; depth += 1) {
      expect(editor.nestBlock()).toBe(true)
      editor.tiptap.commands.setTextSelection(
        editor.tiptap.state.doc.content.size - 2
      )
    }
    expect(editor.nestBlock()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor test -- src/core/block-editor.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

`BlockEditor` 内部 `new Editor({ extensions: createBlockSchemaExtensions(options), content: blocksToPmDoc(...) })`。`document` getter 调用 `pmDocToBlocks`。命令通过 PM transaction 改 `blockContainer` 节点，不要 `chain().setNode()` 走旧 StarterKit。

`onChange` 订阅 `editor.on("update")`，回传 `this.document`。`destroy` 调用 `tiptap.destroy()`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/editor test -- src/core/block-editor.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core/block-editor.ts packages/editor/src/core/block-editor.test.ts packages/editor/src/core/index.ts
git commit -m "feat(editor): add BlockEditor facade for block commands"
```

---

### Task 5: 切换公共编辑器到块 schema（斜杠、Yjs、提及收集）

**Files:**
- Modify: `packages/editor/src/core/extensions/index.ts` — `createEditorExtensions` **改为**调用 `createBlockSchemaExtensions`（可删掉旧 StarterKit 工厂，把旧工厂搬到 `core/migrate/legacy-extensions.ts` 供 Task 8 读 v1 Y.Doc）
- Modify: `packages/editor/src/core/slash-commands/index.ts` — `executeSlashCommand(editor: BlockEditor, id: string)`；空块 `updateBlock`，否则 `insertBlocks(..., "after")`
- Modify: `packages/editor/src/core/yjs-document.ts` — `documentFromYjs(yDoc): Block[]`；`documentToPlainText(blocks: Block[]): string`
- Modify: `packages/editor/src/core/mention-collect.ts` — `collectMentionIds(blocks: Block[]): string[]`
- Modify: `packages/editor/src/core/document/index.ts` — `createEmptyDocument` / `createStarterDocument` 作为 deprecated alias，分别返回 `createEmptyBlocks()` / `createStarterBlocks()`；包根主导出用新名字
- Modify 所有因此失败的 core 测试：`slash-commands/index.test.ts`、`yjs-document.test.ts`、`mention-yjs-roundtrip.test.ts`、`mention-collect.test.ts`、`document/index.test.ts`、`index.test.ts`、`core/index.test.ts`、`table/index.test.ts`、`extensions/index.test.ts`、`commands/index.test.ts`

**Interfaces:**
- Consumes: `BlockEditor`、`legacyJsonToBlocks`（仅 legacy-extensions 读旧 Y.Doc 时用）。
- Produces: 包内默认 schema 即为块树；`documentFromYjs` 返回 `Block[]`。

斜杠 id 映射：

| id | 空块 | 有内容 |
|---|---|---|
| `heading-1/2/3` | `updateBlock` type heading + level | 在后方插入 heading |
| `paragraph` | 变成 paragraph | 插入 paragraph |
| `bullet-list` | `bulletListItem` | 插入 |
| `ordered-list` | `numberedListItem` | 插入 |
| `task-list` | `checkListItem` | 插入 |
| `blockquote` | `quote` | 插入 |
| `code-block` | `codeBlock` | 插入 |
| `horizontal-rule` | `divider` | 插入 |
| `table` | 插入默认 3×3 `TableContent`（空块也是插入，不把段落变成 table 以免丢掉文字——与现网「插入表格」一致：有内容时 after；空块可 `updateBlock` 成 table） | after |
| `canvas-block` | `canvas` | 插入 |
| `upload-image` | `image` + `uploadStatus: "idle"` | 插入 |

空块判定：该块 `content` 无文字（mention 算有内容）。

- [ ] **Step 1: Write/update failing tests first**

改 `slash-commands/index.test.ts`：用 `BlockEditor` + 空段落 / 带文字段落，断言 `executeSlashCommand` 后 `editor.document[0].type`。

改 `yjs-document.test.ts`：`toYdoc` 使用 `createBlockSchemaExtensions` + `blocksToPmDoc(createStarterBlocks())`；断言 `documentFromYjs` 返回块且纯文本含「让知识真正流动起来」。

改 `mention-collect.test.ts` / `mention-yjs-roundtrip.test.ts`：入参改为 `Block[]`。

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/editor test -- src/core/slash-commands src/core/yjs-document.test.ts src/core/mention-collect.test.ts src/core/mention-yjs-roundtrip.test.ts`

Expected: FAIL（签名与 schema 仍旧）。

- [ ] **Step 3: Cut over implementation**

`createEditorExtensions` = `createBlockSchemaExtensions`。把当前 StarterKit 工厂完整移到 `legacy-extensions.ts` 的 `createLegacyEditorExtensions`，供旧 Y.Doc `TiptapTransformer.fromYdoc`。

`documentFromYjs`：用 **新** extensions `fromYdoc`，再 `pmDocToBlocks`。若根节点仍是旧 `doc > paragraph`（无 `blockGroup`），则 `legacyJsonToBlocks` 兜底（防御未迁文档被误读）。

`documentToPlainText`：递归块 `content` 文本与 `children`。

`collectMentionIds`：递归 `InlineContent` 与 `children` 与 table cells。

- [ ] **Step 4: Run the whole editor package tests**

Run: `pnpm --filter @workspace/editor test`

Expected: core 测试 PASS。React 测试此步允许仍红，在 Task 6 修。若 React 测试红，本步不要强行改 UI，除非不改就编不过。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core
git commit -m "feat(editor): cut core schema and slash commands over to blocks"
```

---

### Task 6: React / Web 改为 `Block[]` 与 `useBlockEditor`

**Files:**
- Modify: `packages/editor/src/react/context/editor-context.tsx` — `blockEditor: BlockEditor | null`，移除公共 `Editor`
- Create: `packages/editor/src/react/hooks/use-block-editor.ts` — `useBlockEditor(): BlockEditor`
- Modify: `use-editor-instance.ts` — 改为内部用 `blockEditor.tiptap`，或删除公共导出（spec：不从包根导出 Tiptap Editor）。`packages/editor/src/react/index.ts` 停止 `export type { Editor }`
- Modify: providers 的 `initialContent?: Block[]`、`onChange?: (blocks: Block[]) => void`；内部 `new BlockEditor(...)` 而非 `new Editor(...)`
- Modify: `document-editor.tsx`、`collaboration-editor-provider.tsx`（仍先 synced 再创建编辑器；空 fragment 才写入 `createStarterBlocks()`）
- Modify: slash-menu / bubble-toolbar / block-handle / table-menu 改为 `useBlockEditor()`
- Modify: `BLOCK_HANDLE_NESTED` 改为 `true`（spec：块树打开 nested）
- Modify: `apps/web/components/inkspace/fixed-toolbar.tsx` — 删除 `@workspace/editor/core` 的 `insertTable`；改为 `useBlockEditor().insertBlocks` / `updateBlock`
- Modify: `apps/web/app/editor-playground/**`、`apps/web/components/square/article-reader.tsx`、相关测试：`EditorDocument` → `Block[]`
- Modify: 所有 `packages/editor/src/components/**/*.test.tsx` 的 `initialContent`

**Interfaces:**
- Produces: `useBlockEditor(): BlockEditor`；`DocumentEditor` 的 `content?: Block[]`、`onChange?: (blocks: Block[]) => void`。

协作空文档检测仍用 `yDoc.getXmlFragment("default").length === 0`。

Tab / Shift+Tab：在 `BlockEditor` 创建时给 tiptap 加 `editorProps.handleKeyDown`：Tab → `nestBlock()`，Shift+Tab → `unnestBlock()`，并 `preventDefault`。无上一个同级时返回 false 让浏览器默认行为被吞掉（spec：无操作）。

- [ ] **Step 1: Update slash-menu tests for convert vs insert**

在 `slash-menu.test.tsx` 增加（保留现有 `/代码` 用例，把 `EditorDocument` 换成一块空 paragraph / 一块有字 paragraph）：

- 空块输入 `/` 选段落外的 heading → `document[0].type === "heading"`
- 有字块输入 `/` 选 heading → 仍保留原文块，其后出现 heading

- [ ] **Step 2: Run React tests to see failures**

Run: `pnpm --filter @workspace/editor test -- src/components src/react`

Expected: FAIL（仍喂旧 JSON）。

- [ ] **Step 3: Implement provider + hook + toolbar wiring**

`EditorProvider` 用 `useState`/`useEffect` 创建 `BlockEditor`，context 存 `blockEditor`。`EditorContent`/`EditorSurface` 把 `blockEditor.tiptap` 交给现有 Tiptap React 视图（`@tiptap/react` 仅存在于 `@workspace/editor`，不进 core）。

`fixed-toolbar.tsx` 插入表格：若当前选中块没有文字/提及，则 `updateBlock` 成 table；否则 `insertBlocks(..., "after")`。

```ts
function blockHasVisibleContent(block: Block | undefined): boolean {
  if (!block?.content) return false
  if (Array.isArray(block.content)) {
    return block.content.some((item) =>
      item.type === "text" ? item.text.length > 0 : true
    )
  }
  return true
}

const editor = useBlockEditor()
const selected = editor.getSelectedBlocks()[0]
const tableBlock = {
  type: "table" as const,
  content: {
    headerRows: 1,
    rows: Array.from({ length: rows }, () => ({
      cells: Array.from({ length: cols }, () => ({ content: [] })),
    })),
  },
}
if (selected && !blockHasVisibleContent(selected)) {
  editor.updateBlock(selected.id, tableBlock)
} else {
  editor.insertBlocks(
    [tableBlock],
    selected?.id ?? editor.document[0]!.id,
    "after"
  )
}
```

- [ ] **Step 4: Run editor + web tests**

Run:

```bash
pnpm --filter @workspace/editor test
pnpm --filter web test
pnpm --filter @workspace/editor typecheck
pnpm --filter web typecheck
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor apps/web
git commit -m "feat(editor): bind React and web toolbar to BlockEditor"
```

---

### Task 7: 拆出 `@workspace/editor-core`

**Files:**
- Create: `packages/editor-core/package.json`、`packages/editor-core/tsconfig.json`、`packages/editor-core/vitest.config.ts`、`packages/editor-core/src/**`（从 `packages/editor/src/core` 与 `packages/editor/src/collaboration` 移入）
- Modify: `packages/editor/package.json` — 依赖 `@workspace/editor-core: workspace:*`，去掉仅 core 需要的 tiptap/yjs 直依（改由 core 提供）；保留 `@tiptap/react`、`@tiptap/extension-drag-handle-react`、`@workspace/ui`
- Modify: `packages/editor/src/**` 的 import 改为 `@workspace/editor-core`
- Modify: `apps/api/package.json` — 依赖改为 `@workspace/editor-core`，移除 `@workspace/editor`
- Modify: `apps/api/src/documents/documents.service.ts` 与 spec：`from "@workspace/editor-core"`
- Create: `packages/editor-core/src/no-react-boundary.test.ts`
- Modify: `packages/editor/src/index.ts` — 从 core re-export `Block` 类型与 `createEmptyBlocks` 等，供 web `import from "@workspace/editor"`
- 禁止 web 再 import `@workspace/editor/core`（grep 必须为零）

**Interfaces:**
- Produces: `@workspace/editor-core` exports `.` 与 `./migrate`（Task 8 再把 migrate 从主入口拿掉；本任务可先从主入口导出，Task 8 收紧）。
- `package.json` `exports`:

```json
{
  ".": "./src/index.ts",
  "./migrate": "./src/migrate/index.ts"
}
```

- [ ] **Step 1: Write the boundary test**

```ts
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const FORBIDDEN = /from\s+["'](react|react-dom|@tiptap\/react|@workspace\/ui)/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === "node_modules") return []
      return walk(path)
    }
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : []
  })
}

describe("editor-core react boundary", () => {
  it("does not import react, tiptap/react, or workspace ui", () => {
    const files = walk(join(__dirname, ".."))
    const violations = files.flatMap((file) => {
      const text = readFileSync(file, "utf8")
      return FORBIDDEN.test(text) ? [file] : []
    })
    expect(violations).toEqual([])
  })
})
```

路径在包落地后改为 `packages/editor-core/src/no-react-boundary.test.ts`，`walk(join(__dirname))` 扫 `src`。

- [ ] **Step 2: Run test in the new package once files exist (expect fail if still in editor)**

先创建包并移动文件，再跑：

`pnpm --filter @workspace/editor-core test -- src/no-react-boundary.test.ts`

Expected: 移动完成后 PASS。

- [ ] **Step 3: Move files and retarget dependencies**

`editor-core` 的 `tsconfig` 继承 `@workspace/typescript-config/base.json`（不要 `react-library.json`）。把 core 测试一并移走。`pnpm install`。`@workspace/editor` 的 React 层只从 `@workspace/editor-core` 进。

Grep 确认 `apps/web` 无 `@workspace/editor/core`。

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @workspace/editor-core test
pnpm --filter @workspace/editor test
pnpm --filter api test
pnpm --filter web test
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core packages/editor apps/api pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(editor): split @workspace/editor-core from the React editor package"
```

---

### Task 8: `schemaVersion` 与 onLoad 迁移

**Files:**
- Modify: `apps/api/prisma/schema.prisma` — `Document.schemaVersion Int @default(1) @map("schema_version")`
- Create: `apps/api/prisma/migrations/002_document_schema_version/migration.sql`

```sql
ALTER TABLE "document"
ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1;
```

- Modify: `packages/editor-core/src/migrate/legacy-extensions.ts` — 旧 `createLegacyEditorExtensions`
- Create: `packages/editor-core/src/migrate/migrate-ydoc.ts`

```ts
export const CURRENT_SCHEMA_VERSION = 2
export function readYDocSchemaVersion(doc: Y.Doc): number
export function writeYDocSchemaVersion(doc: Y.Doc, version: number): void
export function migrateV1YDocToV2(doc: Y.Doc): Y.Doc
```

`meta` 用 `doc.getMap("meta")` 的 `schemaVersion` 数字。`migrateV1YDocToV2`：`TiptapTransformer.extensions(createLegacyEditorExtensions()).fromYdoc(doc, "default")` → `legacyJsonToBlocks` → `blocksToPmDoc` + 新 extensions `toYdoc`，写入 version 2。失败时抛错、不改入参 doc。

- Modify: `YjsPersistenceService.loadDocument`：加载后若 version<2，加文档锁（已有 `flushChains` 模式或 `Map<string, Promise>` `migrateChains`），迁移、`Y.encodeStateAsUpdate` 写入新快照、`documents.schemaVersion=2`。迁移抛错则不写 version、不替换快照。
- Modify: `documents.repository` 读写 `schemaVersion`
- Test: `packages/editor-core/src/migrate/migrate-ydoc.test.ts`
- Test: `apps/api/src/collaboration/yjs-persistence.service.spec.ts`（追加 onLoad 迁移用例）
- Modify: `documents.service.spec.ts` mock 的 `documentFromYjs` 返回 `Block[]`
- `createHocuspocusHooks` 的 `onLoadDocument` 继续只调 `persistence.loadDocument`（迁移藏在 persistence 内，避免双处迁）

- [ ] **Step 1: Write migrate-ydoc failing test**

用 legacy extensions `toYdoc` 写入一段旧 `paragraph`+`mention` 的 JSON，调用 `migrateV1YDocToV2`，再用 `documentFromYjs` 断言块类型为 `paragraph` 且 `collectMentionIds` 仍为 `["doc-target"]`；`readYDocSchemaVersion` 为 2。再写失败用例：传入损坏 fragment 时抛错且 `readYDocSchemaVersion` 仍为 1。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor-core test -- src/migrate/migrate-ydoc.test.ts`

Expected: FAIL。

- [ ] **Step 3: Implement migrate + persistence onLoad**

Persistence 测试：mock repository 返回 v1 snapshot；`loadDocument` 后 `schemaVersion` 更新；第二次 `loadDocument` 不再调 `migrateV1YDocToV2`（可用 spy）。失败路径：spy migrate throw，断言 `schemaVersion` 仍 1 且 snapshot 未被 `createSnapshot` 成 v2。

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @workspace/editor-core test -- src/migrate
pnpm --filter api test -- src/collaboration/yjs-persistence.service.spec.ts
pnpm --filter api test -- src/documents/documents.service.spec.ts
```

Expected: PASS。本地库执行 `pnpm --filter api prisma:migrate:dev` 或项目既有 migrate 命令应用 `schema_version` 列。

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma packages/editor-core apps/api/src
git commit -m "feat(api): migrate collaborative Yjs documents to block schema v2"
```

---

### Task 9: 缩进、拖拽带子块、回归测试

**Files:**
- Modify: `packages/editor/src/components/handles/block-handle.tsx` — `nested={true}`（若 Task 6 已改则本步只补测试）
- Test: `packages/editor/src/core/block-editor.test.ts` 增补 8 层拒绝；`packages/editor/src/components/handles/block-handle.test.tsx` 断言 nested
- Test: `packages/editor/src/components/menus/slash-menu.test.tsx` 空块变成 / 有内容插入
- Modify: `apps/api/src/collaboration/collaboration.integration.spec.ts` — 写入块 schema 的 Y.Doc（`TiptapTransformer` + `createBlockSchemaExtensions` / `blocksToPmDoc`），两客户端仍能同步
- Modify: `packages/editor/src/core/table` 若仍直接操作 Tiptap table 命令：改为对当前 `table` 块改 `TableContent` 或继续对 `blockEditor.tiptap` 发官方 table 命令（表格内部仍是 PM table，允许 `blockEditor.tiptap.chain().addRowAfter()`，因为那不是块类型转换）

单元格粘贴整块：在 table 的 `handlePaste` 或 `editorProps.handlePaste` 中，若选区在 table cell 且 clipboard 是块 JSON，则压成纯文本插入。单测放 `block-schema/table-paste.test.ts`：构造 clipboard 文本为两段，断言 cell 内只有 text。

- [ ] **Step 1: Write failing tests for nest depth, slash convert/insert, collab fixture**

协作集成测试把 `Y.Doc` 初始内容从旧 paragraph JSON 改为 `blocksToPmDoc(createStarterBlocks())` 再 `toYdoc`。若测试原本只测连接/权限，补一条：editor 客户端插入文本后 owner 客户端 fragment 非空。

- [ ] **Step 2: Run tests to verify new assertions fail if behavior missing**

Run: `pnpm --filter @workspace/editor test -- src/core/block-editor.test.ts src/components/menus/slash-menu.test.tsx src/components/handles/block-handle.test.tsx`

- [ ] **Step 3: Fix remaining behavior**

确认 Tab 绑定在 `BlockEditor` 构造函数。确认拖拽 `nested` 为 true。确认未知块降级已在 `nodeToBlock` 覆盖（补一个 convert 测试：假 type 变成 paragraph）。

- [ ] **Step 4: Full verification**

```bash
pnpm --filter @workspace/editor-core test
pnpm --filter @workspace/editor test
pnpm --filter web test
pnpm --filter api test
pnpm typecheck
pnpm lint
```

Expected: 全绿。有数据库的 integration 按现有方式跑 `pnpm --filter api test:integration`（若环境无 DB，在提交说明里写明未跑项，不要改测试去跳过）。

- [ ] **Step 5: Commit**

```bash
git add packages/editor packages/editor-core apps/api apps/web
git commit -m "feat(editor): nest blocks on Tab and keep collaboration on schema v2"
```

---

## Spec coverage

| Spec 项 | Task |
|---|---|
| `Block[]` 公共模型 / 类型 | 1 |
| PM `blockGroup`/`blockContainer` / 往返 | 2 |
| 第一期块类型（含 table/image/canvas/mention） | 2 |
| 未知 type 降级段落 | 2、9 |
| 旧 JSON 转换规则 | 3 |
| `BlockEditor` API | 4 |
| 斜杠变成 vs 插入 | 5、6、9 |
| 删除公共 `EditorDocument` / Tiptap Editor 导出 | 5、6 |
| `documentFromYjs` / 纯文本 / mention ids | 5 |
| React providers 与 web 工具栏 | 6 |
| 两包边界与 no-react 测试 | 7 |
| `schemaVersion` + onLoad 迁移 + 失败不写 v2 | 8 |
| Tab/深度 8/拖拽 nested/协作 e2e | 9 |
| 单元格贴块压成文本 | 9 |
| 不拆第三包、不另存 Block JSON | 全程遵守 |

## Type names (locked)

`Block`、`PartialBlock`、`InlineContent`、`TableContent`、`BlockType`、`BlockEditor`、`useBlockEditor`、`createEmptyBlocks`、`createStarterBlocks`、`legacyJsonToBlocks`、`migrateV1YDocToV2`、`CURRENT_SCHEMA_VERSION = 2`、`MAX_NEST_DEPTH = 8`、placement `"before" | "after" | "nested"`。
