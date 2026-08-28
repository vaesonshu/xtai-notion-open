# 可扩展 Block Schema 框架设计

**日期：** 2026-08-29  
**状态：** 已确认，待实施

**前置：** `docs/superpowers/specs/2026-08-28-block-document-architecture-design.md`（块模型与 PM 树形状）

## 目标

在 `@xtai-notion/editor-core` 引入 **可扩展 schema 注册框架**，使 SDK 消费者能够：

1. **追加**自定义块类型（如 callout、embed）
2. **覆盖**内置块实现（如带 React NodeView 的 canvas / image）
3. 继续使用统一的 `Block[]` 对外模型与 Yjs 协作存储

采用 **BlockConfig + defineBlockSpec + Registry** 注册模式，在本仓库自研可扩展 schema 框架。

## 非目标（第一版）

- 不引入额外的 blockOuter 双层 DOM 包装结构
- 不实现 markdown / HTML 导出框架
- 不改变 DB 存储（仍为 Yjs 二进制 + `schemaVersion: 2`）
- 不实现运行时动态卸载已注册块（注册在编辑器创建前完成）
- 不提供「完全替换默认 schema、零内置块」模式（需 `omit` 多个内置 type，高级用法留后续）

## SDK 入口（已决定）

### 主 API：`createEditorSchema(options?)`

**默认行为：** 返回包含 **全部 11 种内置块** 的 schema，与当前行为等价。

```ts
import {
  createEditorSchema,
  defineBlockSpec,
} from "@xtai-notion/editor-core/schema"

// 仅内置块（与 today 相同）
const schema = createEditorSchema()

// 追加自定义块
const schema = createEditorSchema({
  blocks: [calloutSpec],
})

// 覆盖内置块（如 apps 注入带 NodeView 的 canvas）
const schema = createEditorSchema({
  override: { canvas: canvasWithNodeViewSpec },
})

// 高级：排除某内置块
const schema = createEditorSchema({
  omit: ["canvas"],
})
```

### 合并规则

| 选项 | 行为 |
|------|------|
| （无 options） | 仅内置 11 块 |
| `blocks: BlockSpec[]` | 在默认之后 **追加**；`type` 与已有冲突 → **抛错** |
| `override: Record<string, BlockSpec>` | 按 `type` **替换** 对应内置 spec；key 不存在于内置 → 视为追加 |
| `omit: string[]` | 从最终 registry 移除这些 type（在 override 之后应用） |

**不在 v1 提供：** `blocks: "replace-all"` 全量替换默认表。YAGNI；需要时可 `omit` 全部内置再 `blocks` 传入完整列表（后续可封装 helper）。

### 返回值：`EditorSchema`

```ts
type EditorSchema = {
  /** 块 spec 注册表，供 convert / slash 等读取 */
  registry: BlockSchemaRegistry
  /** 生成 Tiptap Extensions（含 pm-nodes + blockContent + 协作等） */
  getExtensions(options?: EditorExtensionOptions): Extensions
  /** 当前 registry 中所有 block type 名 */
  blockTypes: readonly string[]
}
```

### 与现有 API 的关系

- `createBlockSchemaExtensions(options)` **保留**，内部改为 `createEditorSchema().getExtensions(options)` 的薄封装（向后兼容）。
- `BlockEditor` / `documentFromYjs` 签名不变；可选后续增加 `createBlockEditor({ schema })`。
- 内置 `BlockType` 联合类型 **保留**；自定义块在 TS 层为 `type: string` + `props: Record<string, unknown>`，或通过 schema builder 泛型增强（P3+）。

## 核心抽象

### 1. PropSchema（`schema/prop-types.ts`）

块 props 的声明式 schema，用于生成 Tiptap node attributes：

```ts
type PropSpec<T extends boolean | number | string> = {
  default: T
  values?: readonly T[]
}

type PropSchema = Record<string, PropSpec<boolean | number | string>>

function propsToAttributes(propSchema: PropSchema): Attributes
```

### 2. BlockConfig + BlockSpec（`schema/block-spec.ts`）

```ts
type BlockContentMode = "inline" | "none" | "table" | "text"

type BlockConfig = {
  type: string
  propSchema: PropSchema
  content: BlockContentMode
  isAtom?: boolean
  isSelectable?: boolean
  /** paragraph 需同时 group: blockContent block（tableCell 内嵌） */
  alsoBlockGroup?: boolean
}

type BlockSpec = {
  config: BlockConfig
  /** Tiptap Node Extension；可由 defineBlockSpec 生成 */
  node: Node
  /** 可选：覆盖 PM → Block 转换 */
  toBlock?: (ctx: ConvertContext) => PartialBlock | null
  /** 可选：覆盖 Block → PM 转换 */
  fromBlock?: (block: PartialBlock, schema: Schema) => PMNode
}
```

### 3. defineBlockSpec（声明式块）

```ts
type DeclarativeBlockImplementation = {
  parseHTML?: TagParseRule[]
  renderHTML?: NodeViewRenderHTML
  addCommands?: Partial<RawCommands>
  /** 不实现 NodeView 时使用 */
}

function defineBlockSpec(
  config: BlockConfig,
  implementation: DeclarativeBlockImplementation
): BlockSpec
```

由工厂根据 `config.content` 设置 `group: "blockContent"`、`content: "inline*"` | `""` | `text*` 等。

### 4. defineReactBlockSpec（`@xtai-notion/editor-react`）

```ts
function defineReactBlockSpec(
  config: BlockConfig,
  options: {
    component: React.ComponentType<ReactNodeViewProps>
    /** 可选：非 React 的 parseHTML / props 等 */
  }
): BlockSpec
```

在 React 层注入 `addNodeView` + `ReactNodeViewRenderer`；core 保持无 React。

### 5. BlockSchemaRegistry（`schema/registry.ts`）

```ts
class BlockSchemaRegistry {
  register(spec: BlockSpec): void
  get(type: string): BlockSpec | undefined
  getBlockContentTypes(): Set<string>
  getBlockContentExtensions(): Node[]
  getAllBlockTypes(): string[]
  merge(other: BlockSchemaRegistry): BlockSchemaRegistry
}
```

内置块注册在 `schema/default-specs/index.ts`（从现有 `block-content.ts` 迁移）。

### 6. 行内与样式（第一版范围）

| 模块 | v1 策略 |
|------|---------|
| **inline** | 保持现有 `InlineContent` 类型 + `MentionNode`；不拆 `inline-spec` 注册表 |
| **styles** | 保持 StarterKit marks + `InlineStyles`；不拆 `style-spec` 注册表 |
| **后续** | P4+ 可增 `defineInlineContentSpec` / `defineStyleSpec` |

## convert 改造

`block-schema/convert.ts` 拆为：

```
schema/convert/
├── inline.ts      # 现有 marks / inline 互转
├── table.ts       # table 专用
├── block.ts       # registry 驱动的 blockContent → Block
└── index.ts       # pmDocToBlocks / blocksToPmDoc 入口
```

**默认转换规则（按 `config.content`）：**

| content | PM → Block | Block → PM |
|---------|------------|------------|
| `inline` | 抽取 inline* 为 `InlineContent[]` | `inlineBlockToPm` |
| `text` | 纯文本（codeBlock） | `schema.text` 链 |
| `none` | 无 content 字段 | atom / 空 content |
| `table` | 走 table 转换器 | `tableBlockToPm` |

特殊块（canvas、image）通过 `toBlock` / `fromBlock` 钩子扩展。

## 目录结构

```text
packages/editor-core/src/core/schema/
├── prop-types.ts
├── block-spec.ts
├── registry.ts
├── create-editor-schema.ts    # createEditorSchema 入口
├── default-specs/
│   ├── paragraph.ts
│   ├── heading.ts
│   ├── …
│   └── index.ts               # defaultBlockSpecs + defaultRegistry
├── convert/
│   ├── inline.ts
│   ├── table.ts
│   ├── block.ts
│   └── index.ts
└── index.ts                   # 对外 export

packages/editor-core/src/core/block-schema/
├── pm-nodes.ts                # 不变
├── types.ts                   # BlockType 保留；自定义块 type 扩展为 string
├── documents.ts               # 不变
└── ids.ts                     # 不变

packages/editor-react/src/schema/
└── define-react-block-spec.ts
```

**迁移策略：** `block-content.ts` 在 P1 逐步清空，最终仅 re-export `defaultRegistry.getBlockContentExtensions()` 或删除。

## 依赖方改动

| 包 | 改动 |
|----|------|
| `editor-core/extensions` | `createBlockSchemaExtensions` 接受可选 `EditorSchema` |
| `editor-core/block-keymap` | `BLOCK_CONTENT_TYPES` 从 registry 读取 |
| `editor-core/slash-commands` | 块列表从 registry 读取（P3） |
| `editor-shadcn` | canvas/image NodeView spec 通过 `override` 注入 |
| `apps/web` | 默认不传 options；自定义块时 `createEditorSchema({ blocks: [...] })` |

## 分阶段交付

| 阶段 | 交付物 | 验收 |
|------|--------|------|
| **P0** | prop-types、registry、defineBlockSpec、createEditorSchema 骨架；1 个示例块测试 | 新单测通过；现有测试仍绿 |
| **P1** | 迁移 paragraph/heading/divider/quote/list 等简单块到 default-specs；convert 读 registry | editor-core 全测通过 |
| **P2** | table/canvas/image/codeBlock；defineReactBlockSpec；shadcn override | web 手测 + shadcn 测通过 |
| **P3** | slash 从 registry 读；packages/editor-core README schema 章节；示例 callout 块 | SDK 文档可跟做 |

## 测试策略

- 每个 `defineBlockSpec` 块：roundtrip `blocksToPmDoc` ↔ `pmDocToBlocks`
- `createEditorSchema({ blocks: [custom] })`：registry 含内置 + custom
- `override` / `omit` / 冲突 type 抛错
- 现有 `convert.test.ts`、`yjs-document.test.ts` 不回归

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 迁移中断协作 | 不改 PM 节点名与 attrs；Yjs 二进制兼容 |
| convert 回归 | 先迁移简单块，每步全量测 |
| SDK 类型弱 | v1 文档说明；P3+ schema builder 泛型 |
| canvas 双节点 | 仅通过 `override.canvas` 注册一个 spec |

## 与旧 spec 的关系

`2026-08-28-block-document-architecture-design.md` 中「不发布编辑器 SDK」已被本设计取代：现以 `@xtai-notion/editor-*` 对外发布，并增加 schema 扩展能力。块模型、PM 树、Yjs 存储约定不变。
