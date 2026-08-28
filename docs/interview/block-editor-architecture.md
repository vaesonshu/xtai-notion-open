# 块编辑器架构

**日期：** 2026-08-28  
**状态：** 当前实现  
**参考：** [BlockNote](https://github.com/TypeCellOS/BlockNote)（分层与块模型，非源码依赖）

本文描述 xtai-notion-open 的块文档编辑器架构：对外以 `Block[]` 为文档单位，内部基于 Tiptap 3 + ProseMirror + Yjs 实现，协同经 Hocuspocus 持久化到 Postgres。

---

## 1. 与 BlockNote 的关系

| 维度 | 本项目 | BlockNote |
|------|--------|-----------|
| 对外文档类型 | `Block[]` | `Block[]` |
| 底层引擎 | Tiptap + ProseMirror + Yjs | Tiptap + ProseMirror + Yjs |
| NPM 依赖 | **无** `@blocknote/*` | `@blocknote/core` / `react` / `mantine` |
| 实现方式 | 自研 `editor-core` 等包 | 独立开源项目 |
| 内部 PM 树 | `blockGroup` → `blockContainer` → `blockContent` | 同形文档树 |

> 学 BlockNote 的分层与块模型，不复制其源码。详见 [块文档架构设计](./superpowers/specs/2026-08-28-block-document-architecture-design.md)。

---

## 2. 包分层与依赖

```mermaid
flowchart TB
  subgraph Apps["应用层"]
    WEB["apps/web<br/>DocumentWorkspace / Sidebar"]
    API["apps/api<br/>Hocuspocus + 文档服务"]
  end

  subgraph UI["UI 层"]
    SHADCN["@xtai-notion/editor-shadcn<br/>DocumentEditor / 工具栏 / 斜杠菜单 / NodeView"]
  end

  subgraph React["React 绑定层"]
    REACT["@xtai-notion/editor-react<br/>EditorProvider / useBlockEditor / 协作会话"]
  end

  subgraph Core["核心层（无 React）"]
    CORE["@xtai-notion/editor-core<br/>BlockEditor / Block[] ↔ PM / Yjs 转换 / migrate"]
  end

  subgraph Engine["底层引擎"]
    TIPTAP["Tiptap 3 + ProseMirror"]
    YJS["Yjs + Hocuspocus"]
  end

  subgraph Storage["持久化"]
    PG[("Postgres<br/>Yjs 快照 + 增量更新<br/>schemaVersion")]
  end

  WEB --> SHADCN
  WEB --> REACT
  API --> CORE
  SHADCN --> REACT
  SHADCN --> CORE
  REACT --> CORE
  CORE --> TIPTAP
  CORE --> YJS
  API --> YJS
  REACT --> YJS
  YJS --> PG
  API --> PG
```

**包边界约束：**

- `editor-core` 源码不得出现 `react`、`@tiptap/react`、`@workspace/ui`
- `apps/web` 通过 `editor-shadcn` / `editor-react` 使用编辑器，不直接依赖 Tiptap 公共 API
- `apps/api` 仅依赖 `editor-core`（含 `/migrate` 子路径做 v1→v2 迁移）

---

## 3. 块数据模型

对外公共类型定义于 `packages/editor-core/src/core/block-schema/types.ts`。

```mermaid
classDiagram
  class Block {
    +string id
    +BlockType type
    +Record props
    +InlineContent[] | TableContent content
    +Block[] children
  }

  class InlineContent {
    <<union>>
    Text
    Link
    Mention
  }

  class Text {
    +string text
    +InlineStyles styles
  }

  class TableContent {
    +number headerRows
    +Row[] rows
  }

  Block --> InlineContent : content
  Block --> Block : children
  Block --> TableContent : content
```

**第一期块类型：**

| 块 | `type` | 说明 |
|---|---|---|
| 段落 | `paragraph` | 默认块，文档末尾保留一块空段落 |
| 标题 | `heading` | `props.level`: 1 \| 2 \| 3 |
| 列表 | `bulletListItem` / `numberedListItem` / `checkListItem` | 每条一块，可嵌套 |
| 引用 | `quote` | 行内 + 可选 `children` |
| 代码 | `codeBlock` | 纯文本行内 |
| 分隔线 | `divider` | 不可输入 |
| 图片 | `image` | `src`、`uploadStatus` |
| 表格 | `table` | 单元格仅行内，不可再嵌套块 |
| 画板 | `canvas` | `canvasId`、`snapshot` |

提及、链接、粗斜体等属于**行内**（`InlineContent`），不是独立块类型。

---

## 4. 内部 ProseMirror 文档树

块 API 操作的是 `Block[]`，编辑器内部映射为与 BlockNote 同形的 PM 树：

```mermaid
flowchart TD
  DOC["doc（根）"]
  BG["blockGroup（同级块列表）"]
  BC1["blockContainer<br/>attrs.id = UUID"]
  BC2["blockContainer"]
  CONTENT1["blockContent<br/>paragraph / heading / …"]
  NESTED["blockGroup?（嵌套子块）"]
  CONTENT2["blockContent"]

  DOC --> BG
  BG --> BC1
  BG --> BC2
  BC1 --> CONTENT1
  BC1 --> NESTED
  NESTED --> BC2
  BC2 --> CONTENT2
```

**转换层：** `blocksToPmDoc` / `pmDocToBlocks`（`block-schema/convert.ts`）负责 `Block[]` ↔ PM 树双向转换。

**稳定 ID：** 每个 `blockContainer` 携带 UUID，协同、拖拽、块 API（`updateBlock(id)`）均针对该 id。

---

## 5. BlockEditor 门面

`BlockEditor`（`editor-core`）是对外唯一编辑器门面，Tiptap `Editor` 不暴露给 Web 公共 API。

```mermaid
flowchart LR
  subgraph PublicAPI["公共 API"]
    DOC["document: Block[]"]
    INS["insertBlocks()"]
    UPD["updateBlock()"]
    REM["removeBlocks()"]
    NEST["nestBlock() / unnestBlock()"]
    SEL["getSelectedBlocks()"]
    CHG["onChange(Block[])"]
  end

  subgraph Internal["内部"]
    BE["BlockEditor"]
    PM["ProseMirror Transaction"]
    CONV["pmDocToBlocks / blocksToPmDoc"]
  end

  DOC --> BE
  INS --> BE
  UPD --> BE
  REM --> BE
  NEST --> BE
  SEL --> BE
  BE --> PM
  PM --> CONV
  CONV --> CHG
```

React 层通过 `useBlockEditor()` 获取 `BlockEditor` 实例；工具栏、斜杠菜单调用 `updateBlock` / `insertBlocks`，而非 `chain().setNode()`。

---

## 6. 数据流

### 6.1 本地编辑（Playground）

```mermaid
sequenceDiagram
  participant UI as EditorProvider
  participant BE as BlockEditor
  participant PM as ProseMirror
  participant CB as onChange

  UI->>BE: initialContent: Block[]
  BE->>PM: blocksToPmDoc()
  Note over PM: 用户输入 / 快捷键 / 斜杠菜单
  PM->>BE: transaction
  BE->>BE: pmDocToBlocks()
  BE->>CB: Block[]
```

### 6.2 协作编辑（文档页）

```mermaid
sequenceDiagram
  participant Web as DocumentEditor
  participant Collab as createCollaborationSession
  participant HP as Hocuspocus Provider
  participant API as apps/api onLoadDocument
  participant PG as Postgres
  participant BE as BlockEditor

  Web->>Collab: documentId + token
  Collab->>HP: WebSocket 连接
  HP->>API: onLoadDocument
  API->>PG: 读取 Yjs 快照 + updates
  alt schemaVersion = 1
    API->>API: migrateV1YDocToV2()
    API->>PG: 持久化 v2 快照
  end
  API-->>HP: Y.Doc
  HP-->>Collab: synced
  Collab->>BE: 绑定 Y fragment "default"
  Note over BE: 远端为空时才写入默认 Block[]
  Note over BE,HP: 编辑 ↔ Yjs 双向同步 + awareness
  HP->>API: onChange / onStoreDocument
  API->>PG: 缓冲写入 updates / 定期 compact
```

**关键时序：** 先等 Hocuspocus 首次 `synced`，再创建 `BlockEditor`，避免本地种子覆盖远端内容。

### 6.3 服务端只读（摘要 / 提及 / 广场）

```mermaid
flowchart LR
  PG[("Postgres<br/>Yjs 字节")]
  YDOC["Y.Doc"]
  DFY["documentFromYjs()"]
  BLOCKS["Block[]"]
  USE["collectMentionIds()<br/>documentToPlainText()<br/>只读 DocumentEditor"]

  PG --> YDOC
  YDOC --> DFY
  DFY --> BLOCKS
  BLOCKS --> USE
```

协同层**只存 Yjs**，不把 `Block[]` JSON 另存一份到 Postgres。

---

## 7. React 组件栈

```mermaid
flowchart TB
  subgraph Web["apps/web"]
    DW["DocumentWorkspace"]
    FT["FixedToolbar / Sidebar"]
  end

  subgraph Shadcn["editor-shadcn"]
    DE["DocumentEditor"]
    ES["EditorSurface"]
    SL["SlashMenu"]
    BT["BubbleToolbar"]
    BH["BlockHandle（拖拽）"]
    IV["ImageUpload / CanvasBlock NodeView"]
  end

  subgraph ReactPkg["editor-react"]
    EP["EditorProvider"]
    CEP["CollaborationEditorProvider"]
    UBE["useBlockEditor()"]
    CTX["EditorContext"]
  end

  DW --> DE
  FT --> UBE
  DE --> CEP
  DE --> EP
  DE --> ES
  ES --> SL
  ES --> BT
  ES --> BH
  ES --> IV
  EP --> CTX
  CEP --> CTX
  UBE --> CTX
```

- **EditorProvider**：本地模式，`initialContent?: Block[]`
- **CollaborationEditorProvider**：协作模式，注入 Hocuspocus Provider
- **DocumentEditor**：统一入口，组合 Surface + 工具栏 + 提及

---

## 8. 旧文档迁移（v1 → v2）

```mermaid
stateDiagram-v2
  [*] --> v1: 旧 StarterKit 流式树
  [*] --> v2: 新块树（空文档 / 种子文档）

  v1 --> Migrating: onLoadDocument 加锁
  Migrating --> v2: migrateV1YDocToV2() 成功
  Migrating --> v1: 迁移失败，保留旧字节

  v2 --> v2: 再次 load，跳过迁移
```

| schemaVersion | 含义 |
|---|---|
| `1` | 旧 Tiptap StarterKit 树 |
| `2` | 块树（`blockGroup` / `blockContainer`） |

迁移路径：旧 Y.Doc → 旧 Tiptap JSON → `Block[]`（补 UUID）→ 新 PM 文档 → 新 Y.Doc。

服务端入口：`@xtai-notion/editor-core/migrate`（Web 不得引用）。

---

## 9. 交互模型（BlockNote 对齐）

| 操作 | 行为 |
|------|------|
| `/` 斜杠菜单 | 空块 → 变成该类型；有内容 → 下方插入 |
| Tab | 当前块成为上一个同级的最后一个 child |
| Shift+Tab | 当前块 + children 提升到父块之后 |
| 拖拽把手 | 移动整个 `blockContainer`（含嵌套） |
| 最大嵌套深度 | 8 |

---

## 10. 相关文档

- [块文档架构设计（详细规格）](./superpowers/specs/2026-08-28-block-document-architecture-design.md)
- [块文档架构实施计划](./superpowers/plans/2026-08-28-block-document-architecture.md)
