# Extensible Block Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@xtai-notion/editor-core` 引入可扩展 Block Schema 注册框架，SDK 可通过 `createEditorSchema({ blocks, override, omit })` 追加/覆盖块类型，并保持现有 `Block[]` 与 Yjs 协作兼容。

**Architecture:** 自研 `PropSchema` + `defineBlockSpec` + `BlockSchemaRegistry`；内置 11 块迁入 `schema/default-specs/`；`convert` 改读 registry；React NodeView 在 `editor-react` 的 `defineReactBlockSpec`。

**Tech Stack:** Tiptap 3、`@tiptap/core`、`@tiptap/pm`、Vitest、React 19（仅 editor-react 层）。

**Spec:** `docs/superpowers/specs/2026-08-29-extensible-block-schema-design.md`

## Global Constraints

- 全部在本仓库自研实现，不引入外部编辑器框架源码。
- `editor-core` 不得 `import` `react` / `@tiptap/react`。
- PM 结构节点 `doc` / `blockGroup` / `blockContainer` 名称与 attrs **不变**。
- Yjs fragment 仍为 `"default"`；`schemaVersion` 仍为 `2`。
- Prettier：LF、无分号、双引号、2 空格、80 列；实质改动含至少一条中文注释。
- 每阶段合并前：`pnpm --filter @xtai-notion/editor-core test` 全绿；P2 起加 web/shadcn 冒烟。
- 提交前缀：`feat(editor-core):` / `feat(editor-react):` / `test:` / `docs:`。

## File map

| 路径 | 职责 |
|------|------|
| `packages/editor-core/src/core/schema/prop-types.ts` | `PropSchema`、`propsToAttributes` |
| `packages/editor-core/src/core/schema/block-spec.ts` | `BlockConfig`、`defineBlockSpec` |
| `packages/editor-core/src/core/schema/registry.ts` | `BlockSchemaRegistry` |
| `packages/editor-core/src/core/schema/create-editor-schema.ts` | `createEditorSchema` |
| `packages/editor-core/src/core/schema/default-specs/*.ts` | 内置块 spec（自 `block-content.ts` 迁出） |
| `packages/editor-core/src/core/schema/convert/*.ts` | registry 驱动 convert |
| `packages/editor-core/src/core/schema/index.ts` | SDK 对外 export |
| `packages/editor-react/src/schema/define-react-block-spec.ts` | React NodeView spec |
| `packages/editor-core/src/core/extensions/index.ts` | 接受可选 `EditorSchema` |
| `packages/editor-core/test/core/schema/*.test.ts` | 新框架单测 |

---

## Phase P0 — 骨架与第一个自定义块

### Task 1: PropSchema 与 propsToAttributes

**Files:**
- Create: `packages/editor-core/src/core/schema/prop-types.ts`
- Test: `packages/editor-core/test/core/schema/prop-types.test.ts`

**Interfaces:**
- Produces: `PropSchema`, `PropSpec`, `propsToAttributes(propSchema): Attributes`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest"
import { propsToAttributes, type PropSchema } from "@core/schema/prop-types"

describe("propsToAttributes", () => {
  it("maps defaults and kebab data attributes", () => {
    const schema: PropSchema = {
      level: { default: 1 },
      checked: { default: false },
    }
    const attrs = propsToAttributes(schema)
    expect(attrs.level.default).toBe(1)
    expect(attrs.checked.default).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @xtai-notion/editor-core test test/core/schema/prop-types.test.ts`

- [ ] **Step 3: Implement `prop-types.ts`**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/schema/prop-types.ts packages/editor-core/test/core/schema/prop-types.test.ts
git commit -m "feat(editor-core): add PropSchema and propsToAttributes"
```

---

### Task 2: BlockSchemaRegistry

**Files:**
- Create: `packages/editor-core/src/core/schema/registry.ts`
- Create: `packages/editor-core/src/core/schema/block-spec.ts`（仅 `BlockConfig` / `BlockSpec` 类型）
- Test: `packages/editor-core/test/core/schema/registry.test.ts`

**Interfaces:**
- Consumes: `BlockSpec` from `block-spec.ts`
- Produces: `BlockSchemaRegistry` with `register`, `get`, `getBlockContentTypes`, `getBlockContentExtensions`, `getAllBlockTypes`

- [ ] **Step 1: Write failing test**（注册、重复 type 抛错、getBlockContentExtensions 返回 Node 数组）

- [ ] **Step 2–4: Implement registry + types**

- [ ] **Step 5: Commit** `feat(editor-core): add BlockSchemaRegistry`

---

### Task 3: defineBlockSpec 工厂

**Files:**
- Modify: `packages/editor-core/src/core/schema/block-spec.ts`
- Test: `packages/editor-core/test/core/schema/define-block-spec.test.ts`

**Interfaces:**
- Produces: `defineBlockSpec(config, impl): BlockSpec`
- 根据 `content: "inline" | "none" | "text" | "table"` 设置 Tiptap Node 的 `group` / `content` / `atom`

- [ ] **Step 1: Test** — 定义 `callout` 块，`group` 为 `blockContent`，`content` 为 `inline*`

- [ ] **Step 2–4: Implement defineBlockSpec**

- [ ] **Step 5: Commit** `feat(editor-core): add defineBlockSpec factory`

---

### Task 4: createEditorSchema 入口

**Files:**
- Create: `packages/editor-core/src/core/schema/create-editor-schema.ts`
- Create: `packages/editor-core/src/core/schema/default-specs/index.ts`（暂 **re-export** 现有 `block-content.ts` 为 legacy specs 适配层）
- Create: `packages/editor-core/src/core/schema/index.ts`
- Test: `packages/editor-core/test/core/schema/create-editor-schema.test.ts`
- Modify: `packages/editor-core/package.json` exports 增加 `"./schema"`

**Interfaces:**
- Produces:
  ```ts
  function createEditorSchema(options?: {
    blocks?: BlockSpec[]
    override?: Record<string, BlockSpec>
    omit?: string[]
  }): EditorSchema
  ```

- [ ] **Step 1: Test** — 默认 `blockTypes` 长度 11；`blocks: [callout]` 长度 12；重复 type 抛错

- [ ] **Step 2: Implement createEditorSchema 合并规则**（见 spec）

- [ ] **Step 3: Wire `createBlockSchemaExtensions`** 内部调用 `createEditorSchema().getExtensions(options)`（行为不变）

- [ ] **Step 4: 全量 editor-core test PASS**

- [ ] **Step 5: Commit** `feat(editor-core): add createEditorSchema SDK entry`

---

## Phase P1 — 内置块迁移与 registry 驱动 convert

### Task 5: 迁移简单块到 default-specs

**Files:**
- Create: `packages/editor-core/src/core/schema/default-specs/paragraph.ts` … `divider.ts`
- Modify: `packages/editor-core/src/core/schema/default-specs/index.ts`
- Modify: `packages/editor-core/src/core/block-schema/block-content.ts`（改为从 default-specs 聚合，暂保留 export 名）

**顺序：** paragraph → heading → bulletListItem → numberedListItem → checkListItem → quote → divider

- [ ] 每迁移 1–2 块：跑 `test/core/block-schema/convert.test.ts`，通过后再 commit
- [ ] 最终 commit: `refactor(editor-core): migrate simple blocks to default-specs`

---

### Task 6: convert 读 registry

**Files:**
- Create: `packages/editor-core/src/core/schema/convert/block.ts`
- Create: `packages/editor-core/src/core/schema/convert/index.ts`
- Modify: `packages/editor-core/src/core/block-schema/convert.ts`（薄 re-export 或删除并改 import 路径）
- Modify: `packages/editor-core/src/core/block-keymap.ts`（`BLOCK_CONTENT_TYPES` 从 registry）
- Test: 现有 `convert.test.ts`、`yjs-document.test.ts` 全过

**Interfaces:**
- Consumes: `BlockSchemaRegistry`
- Produces: `pmDocToBlocks(doc, registry)`, `blocksToPmDoc(blocks, schema, registry)`

- [ ] **Step 1: 将 `BLOCK_CONTENT_NODE_NAMES` 替换为 `registry.getBlockContentTypes()`**

- [ ] **Step 2: switch(nodeType) 改为 registry.get + content 模式分发**

- [ ] **Step 3: 全量 editor-core test PASS**

- [ ] **Step 4: Commit** `refactor(editor-core): drive block convert from schema registry`

---

## Phase P2 — 复杂块与 React NodeView

### Task 7: 迁移 codeBlock / table / image / canvas

**Files:**
- Create: `default-specs/code-block.ts`, `table.ts`, `image.ts`, `canvas.ts`
- 保留 `toBlock` / `fromBlock` 钩子处理 table 与 canvas props

- [ ] 迁移后 convert + canvas-yjs + mention-yjs roundtrip 测试通过
- [ ] Commit: `refactor(editor-core): migrate complex blocks to specs`

---

### Task 8: defineReactBlockSpec

**Files:**
- Create: `packages/editor-react/src/schema/define-react-block-spec.ts`
- Modify: `packages/editor-react/src/react/index.ts` 或 package exports
- Modify: `packages/editor-shadcn` canvas/image 扩展改为 `defineReactBlockSpec` + `createEditorSchema({ override: { canvas, image } })`
- Test: `packages/editor-shadcn/test/components/editor/document-editor.test.tsx`

- [ ] **Step 1: defineReactBlockSpec 生成带 ReactNodeViewRenderer 的 BlockSpec**

- [ ] **Step 2: shadcn DocumentEditor 传入 override schema**

- [ ] **Step 3: shadcn + web 测试通过**

- [ ] **Step 4: Commit** `feat(editor-react): add defineReactBlockSpec for SDK NodeViews`

---

## Phase P3 — SDK 文档与 slash 集成

### Task 9: slash-commands 从 registry 读取

**Files:**
- Modify: `packages/editor-core/src/core/slash-commands/index.ts`
- Test: `packages/editor-core/test/core/slash-commands/index.test.ts`

- [ ] 可选：块仅当 spec 标记 `slashCommand?: { label, group }` 时出现在菜单
- [ ] Commit: `feat(editor-core): derive slash commands from schema registry`

---

### Task 10: SDK 文档与 callout 示例

**Files:**
- Modify: `packages/editor-core/README.md`
- Create: `packages/editor-core/examples/callout-block.ts`（或 `docs/` 内代码片段）

- [ ] 文档含：`createEditorSchema`、`defineBlockSpec`、`defineReactBlockSpec` 完整示例
- [ ] Commit: `docs(editor-core): document extensible block schema`

---

## Spec self-review

| Spec 要求 | 计划任务 |
|-----------|----------|
| createEditorSchema merge 规则 | Task 4 |
| defineBlockSpec 声明式 | Task 3 |
| defineReactBlockSpec | Task 8 |
| convert registry 驱动 | Task 6 |
| 内置 11 块迁移 | Task 5 + 7 |
| slash 从 registry | Task 9 |
| 自研 schema 框架 | Global Constraints |
| Yjs/PM 兼容 | Task 5–7 测 roundtrip |

无 TBD / 占位步骤。

---

**Plan complete.** 建议从 **Phase P0 Task 1** 开始，用 subagent-driven-development 逐 task 执行。
