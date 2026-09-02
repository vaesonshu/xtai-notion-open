# xtai-notion-open

面向团队与个人的 **Notion 式知识工作台**：以块（Block）为一等公民组织文档，内置实时协作、发布广场与文档关系图。编辑器内核拆分为可独立发布的 **MIT** SDK（`@xtai-notion/editor-*`），既可开箱即用，也可 Headless 嵌入自有产品。

编辑器实现明确参考 **[Tiptap](https://tiptap.dev)** 与 **[BlockNote](https://www.blocknotejs.org)**：以 Tiptap / ProseMirror 为底层编辑引擎，以 BlockNote 为块模型与 Notion 式交互的产品范式。

| 参考项目 | 在本仓库中的角色 |
|----------|------------------|
| **[Tiptap](https://tiptap.dev)** | 编辑内核：ProseMirror 封装、扩展体系、Yjs 协作集成 |
| **[BlockNote](https://www.blocknotejs.org)** | 块模型与 UX：`Block[]` 对外 API、每块 UUID、斜杠菜单、块级 Enter / Backspace |

## 项目优势

相对飞书文档、Notion、语雀等闭源 SaaS，本项目的差异化不在功能广度，而在**可控性、可扩展性与开发者体验**：

| 优势 | 说明 |
|------|------|
| **开源可自托管** | 编辑器 SDK 采用 **MIT** 许可；支持 Vercel + Render + Neon 等组合部署，文档与协作数据存于自有 PostgreSQL，满足数据主权与私有化需求 |
| **可嵌入的编辑器 SDK** | 拆分为 `editor-core` / `editor-react` / `editor-shadcn` 三层，既可开箱即用，也可 Headless 嵌入 CRM、工单、知识库等自有产品 |
| **`Block[]` 一等公民** | 对外文档模型为带 UUID 的块数组，语义与 Notion / 飞书一致；服务端无需 React 即可读写（见下文对比表） |
| **UI 与块类型可扩展** | 通过 `ComponentsContext` 替换 UI 主题；通过 `defineBlockSpec` 注册自定义块，不被单一设计系统绑定 |
| **全栈透明可改造** | Tiptap 3 + Yjs + NestJS 全链路开源，可深度定制协作协议、权限模型、AI 流程与存储策略 |
| **AI 集成灵活** | 支持 OpenAI 兼容接口与自建模型；编辑器内续写 / 改写先本地草稿预览，接受后才同步协作，成本与流程可控 |

**适合谁？** 需要私有化知识库、将 Notion 式编辑器嵌入现有产品、或希望 fork 后按业务深度定制的团队。若追求开箱即用的大厂级企业功能（SSO、审计、模板市场等），商业 SaaS 仍是更成熟的选择。

## 产品能力

| 能力 | 说明 |
|------|------|
| **块编辑器** | 段落、标题、列表、待办、引用、代码、分割线、表格、图片、Excalidraw 画板等 |
| **Notion 式交互** | `/` 斜杠菜单、选区气泡工具栏、左侧块拖拽把手、块级 Enter / Backspace 行为 |
| **实时协作** | Yjs + Hocuspocus，多光标、离线恢复、PostgreSQL 持久化快照 |
| **文档工作区** | 多文档管理、分享链接、成员角色（owner / editor / viewer） |
| **知识广场** | 文档发布、公开阅读、评论 |
| **文档图谱** | 可视化文档之间的引用关系 |
| **AI 助手** | 可选 OpenAI 兼容接口：编辑器内 `/ai` 斜杠续写与选区改写（本地草稿预览，接受后才同步协作）；侧边栏聊天为只读问答（需配置 API Key） |

本地开发常用入口：

- 文档编辑：`/documents/[documentId]`
- 编辑器测试台（无需完整后端）：`/editor-playground`
- 知识广场：`/square`

## 为什么选择 Block[]，而不是 Tiptap JSON？

与 [BlockNote](https://www.blocknotejs.org) 类似，对外文档类型是 **`Block[]`**；[Tiptap](https://tiptap.dev) / ProseMirror JSON 仅作为**内部编辑引擎表示**，不暴露给 Web 与 API 业务层。

```ts
type Block = {
  id: string
  type: BlockType
  props: Record<string, unknown>
  content?: InlineContent[] | TableContent
  children: Block[]
}
```

与原生 Tiptap JSON 相比，块模型的核心优势：

| 维度 | Tiptap / ProseMirror JSON | 本项目的 `Block[]` |
|------|---------------------------|-------------------|
| **产品语义** | 反映编辑器节点树（如 `bulletList` → `listItem` → `paragraph`） | 每个列表项、待办、标题都是**独立块**，与 Notion / 飞书一致 |
| **稳定标识** | 节点位置随编辑变化，缺少业务级 ID | 每块有 **UUID**，便于拖拽、嵌套、API 寻址与后续块级能力扩展 |
| **对外 API** | 深层嵌套、结构随 StarterKit 扩展变化 | 扁平、可预测的 JSON，**服务端无 React 也可读写**（`editor-core`） |
| **嵌套与子块** | 需自行建模 | `children: Block[]` 一等支持，最大深度受控（`MAX_NEST_DEPTH`） |
| **协作存储** | 常直接把 PM 树塞进 Yjs | Yjs 仍存 fragment `default`，对外通过 `BlockEditor.document` 读写块 |
| **迁移与版本** | 结构升级困难 | `schemaVersion` 标记协作文档版本，便于后续演进 |

**设计原则：** 块模型（参考 BlockNote）描述「产品里的文档长什么样」；Tiptap 负责「怎么高效编辑」。二者通过 `blocksToPmDoc` / `pmDocToBlocks` 双向转换，业务代码只依赖 `Block[]`。

## 架构概览

```text
┌─────────────────────────────────────────────────────────────┐
│  apps/web (Next.js 16)          Inkspace 工作区 / 广场 / 图谱   │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
 @xtai-notion/editor-shadcn  editor-react    @workspace/ui
 (默认 UI 主题)              (Provider/Hooks)
         │                   │
         └─────────┬─────────┘
                   ▼
         @xtai-notion/editor-core  ←── apps/api (NestJS + Prisma)
         BlockEditor / Block[]         协作 · 持久化 · 文档 API
                   │
                   ▼
         Tiptap 3 + ProseMirror + Yjs + Hocuspocus
```

### Monorepo 结构

| 路径 | 职责 |
|------|------|
| [`apps/web`](./apps/web) | Next.js 前端：文档、广场、管理、编辑器集成 |
| [`apps/api`](./apps/api) | NestJS API：文档 CRUD、Yjs 持久化、Hocuspocus 协作服务 |
| [`packages/editor-core`](./packages/editor-core) | 块 schema、`BlockEditor`、Slash 命令、协作工具（**无 React**） |
| [`packages/editor-react`](./packages/editor-react) | `EditorProvider`、协作 Hooks、`ComponentsContext` |
| [`packages/editor-shadcn`](./packages/editor-shadcn) | 默认 shadcn UI：`DocumentEditor`、工具栏、块把手 |
| [`packages/ui`](./packages/ui) | 应用级 shadcn 组件 |
| [`packages/icons`](./packages/icons) | 统一图标出口 |

### 编辑器 SDK 分层

| 包 | 适用场景 |
|----|----------|
| **editor-core** | 服务端解析、快照导出、自定义 UI 壳层 |
| **editor-react** | React 集成、协作 Provider |
| **editor-shadcn** | 快速接入完整编辑器 UI + `style.css` |

```tsx
import { createStarterBlocks } from "@xtai-notion/editor-core"
import { DocumentEditor } from "@xtai-notion/editor-shadcn"
import "@xtai-notion/editor-shadcn/style.css"

export function Page() {
  return (
    <DocumentEditor
      content={createStarterBlocks()}
      onChange={(blocks) => console.log(blocks)}
    />
  )
}
```

变更规格与验收说明见 [`openspec/changes/open-source-editor-sdk/`](./openspec/changes/open-source-editor-sdk/)。

## 快速开始

### 环境要求

- **Node.js** ≥ 20
- **pnpm** 10.x（见根目录 `packageManager` 字段）
- **PostgreSQL**（API 与协作持久化，推荐 [Neon](https://neon.tech) 或本地实例）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 API 环境变量

在 `apps/api/.env` 中创建：

```env
PORT=3100
COLLABORATION_PORT=3101
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE

# 可选：图片上传（腾讯云 COS）
# COS_SECRET_ID=
# COS_SECRET_KEY=
# COS_BUCKET=
# COS_REGION=
# COS_PUBLIC_BASE_URL=

# 可选：AI 助手
# OPENAI_API_KEY=
# OPENAI_BASE_URL=
# OPENAI_MODEL=
```

初始化数据库：

```bash
pnpm --filter api prisma migrate deploy
# 本地开发亦可：pnpm --filter api prisma db push
```

### 3. 配置 Web 环境变量

在 `apps/web/.env.local` 中创建：

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3100
NEXT_PUBLIC_COLLABORATION_URL=ws://127.0.0.1:3101
```

登录后访问 `/documents` 即可进入工作区。开发环境通过 Cookie / `x-dev-user-id` 识别用户身份。

### 4. 启动开发服务

**方式 A — 同时启动前后端（推荐）：**

```bash
pnpm dev
```

**方式 B — 分别启动：**

```bash
pnpm --filter api dev      # API + 协作 WebSocket，默认 3100 / 3101
pnpm --filter web dev      # Next.js，默认 http://localhost:3000
```

仅体验编辑器 UI、无需数据库时，访问：

```text
http://localhost:3000/editor-playground
```

若 Next 缓存异常，可在 web 包内执行：

```bash
pnpm --filter web dev:clean
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动全部应用的开发模式 |
| `pnpm build` | Turbo 构建全仓库 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | 质量检查 |
| `pnpm check:editor-boundaries` | 校验 editor 三包依赖方向 |
| `pnpm --filter @xtai-notion/editor-core build` | 构建编辑器内核（改 core 后 web 消费 dist 时需执行） |
| `pnpm test:e2e` | Playwright 端到端测试 |

## 添加 shadcn 组件

应用 UI 组件位于 `packages/ui`。在 web 应用中添加组件：

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

在代码中引用：

```tsx
import { Button } from "@workspace/ui/components/button"
```

## 部署

| 组件 | 推荐平台 |
|------|----------|
| Web + REST API | [Vercel](https://vercel.com)（同项目，见 [`docs/deploy-vercel.md`](./docs/deploy-vercel.md)） |
| 协作 WebSocket | [Render](https://render.com) 免费层（`collab-main.ts`） |
| 数据库 | [Neon](https://neon.tech) |

整体架构与各平台职责、打开文档时的请求时序见 [`docs/部署架构与时序.md`](./docs/部署架构与时序.md)。

协作服务部署步骤见 [`docs/deploy-render.md`](./docs/deploy-render.md)。

## 相关文档

- 技术参考：[Tiptap](https://tiptap.dev) · [BlockNote](https://www.blocknotejs.org)
- 块文档架构设计：[`docs/superpowers/specs/2026-08-28-block-document-architecture-design.md`](./docs/superpowers/specs/2026-08-28-block-document-architecture-design.md)
- 编辑器 SDK 开源拆分：[`openspec/changes/open-source-editor-sdk/`](./openspec/changes/open-source-editor-sdk/)
- 各包 README：[`packages/editor-core`](./packages/editor-core/README.md) · [`packages/editor-react`](./packages/editor-react/README.md) · [`packages/editor-shadcn`](./packages/editor-shadcn/README.md)

## 许可证

编辑器 SDK（`@xtai-notion/editor-core` / `editor-react` / `editor-shadcn`）采用 **MIT**。应用与其它包的许可证以各 `package.json` 为准。
