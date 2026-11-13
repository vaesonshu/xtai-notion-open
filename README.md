# xtai-notion-open

面向团队与个人的 **Notion 式知识工作台**：以块（Block）为一等公民组织文档，内置实时协作、知识广场与文档关系图。编辑器内核拆分为可独立发布的 **MIT** SDK（`@xtai-notion/editor-*`），既可开箱即用，也可 Headless 嵌入自有产品。

---

## 目录

- [xtai-notion-open](#xtai-notion-open)
  - [目录](#目录)
  - [项目介绍](#项目介绍)
    - [是什么](#是什么)
    - [适合谁](#适合谁)
    - [技术参考与定位](#技术参考与定位)
    - [相对闭源文档产品的差异（摘要）](#相对闭源文档产品的差异摘要)
  - [快速开始](#快速开始)
    - [环境要求](#环境要求)
    - [1. 安装依赖](#1-安装依赖)
    - [2. 配置 API](#2-配置-api)
    - [3. 配置 Web](#3-配置-web)
    - [4. 启动](#4-启动)
  - [本地常用入口](#本地常用入口)
  - [产品能力](#产品能力)
  - [文档模型：为何使用 Block\[\]](#文档模型为何使用-block)
  - [技术架构](#技术架构)
    - [Monorepo 结构](#monorepo-结构)
  - [嵌入编辑器 SDK](#嵌入编辑器-sdk)
  - [文档工作区](#文档工作区)
  - [Windows 桌面端](#windows-桌面端)
  - [开发与质量](#开发与质量)
  - [部署](#部署)
  - [相关文档](#相关文档)
  - [许可证](#许可证)

---

## 项目介绍

### 是什么

全栈 Monorepo：**Next.js 工作区** + **NestJS API** + **自研块编辑器 SDK**。持久化与协作以 **Yjs** 为正文真相源；对外业务与 API 以 **`Block[]`** 为文档模型，底层编辑由 **Tiptap 3 / ProseMirror** 完成。

### 适合谁

| 场景 | 说明 |
|------|------|
| **私有化知识库** | 数据在自有 PostgreSQL，支持 Vercel + Render + Neon 等组合部署 |
| **嵌入编辑器** | `editor-core` → `editor-react` → `editor-shadcn` 分层，可只拿 Headless 层 |
| **深度定制** | 协作协议、权限、AI 流程、块类型均可 fork 后改造 |

若需要大厂级 SSO、审计、模板市场等，商业 SaaS 通常更省心；本项目的优势在**可控性、可扩展性与开发者体验**。

### 技术参考与定位

实现思路参考 **[Tiptap](https://tiptap.dev)** 与 **[BlockNote](https://www.blocknotejs.org)**：

| 参考 | 在本仓库中的角色 |
|------|------------------|
| [Tiptap](https://tiptap.dev) | ProseMirror 封装、扩展体系、Yjs 协作集成 |
| [BlockNote](https://www.blocknotejs.org) | 块模型与 UX：`Block[]` API、块 UUID、斜杠菜单、块级 Enter / Backspace |

### 相对闭源文档产品的差异（摘要）

| 维度 | 说明 |
|------|------|
| **开源可自托管** | 编辑器 SDK **MIT**；文档与协作数据可完全落在自有库 |
| **`Block[]` 一等公民** | 语义对齐 Notion / 飞书；**服务端无 React** 也可解析与导入 |
| **UI / 块可扩展** | `ComponentsContext` 换主题；`defineBlockSpec` 注册自定义块 |
| **AI** | OpenAI 兼容接口；续写 / 改写**本地草稿预览**，接受后再进协作 |

---

## 快速开始

### 环境要求

- **Node.js** ≥ 20
- **pnpm** 10.x（见根目录 `packageManager`）
- **PostgreSQL**（API + 协作持久化；本地见 [`docs/local-database.md`](./docs/local-database.md)，云端推荐 [Neon](https://neon.tech)）

### 1. 安装依赖

```bash
pnpm install
```

根目录 `.npmrc` 为 `node-linker=hoisted`（Electron 打包需要）。克隆或改依赖后请重新执行 `pnpm install`。

### 2. 配置 API

在 `apps/api/.env` 中配置（可参考仓库内示例）：

```env
PORT=3100
COLLABORATION_PORT=3101
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

初始化数据库：

```bash
pnpm --filter api prisma migrate deploy
# 本地亦可：pnpm --filter api prisma db push
```

可选：`apps/api/.env` 中配置 COS（图片）、`OPENAI_*`（AI 助手）。

### 3. 配置 Web

复制 `apps/web/.env.example` 为 `apps/web/.env` 或 `.env.local`：

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3100
NEXT_PUBLIC_COLLABORATION_URL=ws://127.0.0.1:3101
NEXT_PUBLIC_DEV_USER_ID=demo-owner
```

### 4. 启动

**推荐（前后端一起）：**

```bash
pnpm dev
```

**或分别启动：**

```bash
pnpm --filter api dev   # HTTP 3100 + 协作 WS 3101
pnpm --filter web dev   # http://localhost:3000
```

登录后访问 **`/documents`** 进入工作区。开发环境通过 Cookie / `x-dev-user-id` 识别用户。

**只想看编辑器 UI、可不连库：**

```text
http://localhost:3000/editor-playground
```

Next 缓存异常时：`pnpm --filter web dev:clean`。

---

## 本地常用入口

| 路径 | 用途 |
|------|------|
| `/documents/[documentId]` | 文档编辑与协作 |
| `/editor-playground` | 编辑器测试台（弱依赖后端） |
| `/square` | 知识广场 |
| `/workspaces` | 知识库总览 |

---

## 产品能力

| 能力 | 说明 |
|------|------|
| **块编辑器** | 段落、标题、列表、待办、引用、代码、分割线、表格、图片、Excalidraw 画板 |
| **Notion 式交互** | `/` 斜杠、气泡工具栏、块拖拽把手、块级 Enter / Backspace |
| **实时协作** | Yjs + Hocuspocus、多光标、PostgreSQL 快照 |
| **文档工作区** | 多文档、分享、角色；回收站、收藏 / 最近、⌘K 搜索、MD 导入导出、版本历史、块级评论 |
| **知识广场** | 发布、公开阅读、评论 |
| **文档图谱** | 文档引用关系可视化 |
| **AI 助手** | 可选：`/ai` 续写与选区改写（草稿预览）；侧边栏只读问答 |

---

## 文档模型：为何使用 Block[]

对外类型是 **`Block[]`**，不是 Tiptap / ProseMirror JSON。PM 树只在编辑器内部使用；业务与 API 通过 `blocksToPmDoc` / `pmDocToBlocks` 与 `BlockEditor` 门面交互。

```ts
type Block = {
  id: string
  type: BlockType
  props: Record<string, unknown>
  content?: InlineContent[] | TableContent
  children: Block[]
}
```

| 维度 | Tiptap / PM JSON | 本仓库 `Block[]` |
|------|------------------|------------------|
| 产品语义 | 节点树（list → listItem → paragraph） | 每行一块，对齐 Notion / 飞书 |
| 稳定 ID | 位置变、无业务 UUID | 每块 **UUID**，评论 / API / 拖拽可寻址 |
| 服务端 | 需懂 schema | 纯 JSON，`editor-core` 在 Node 可读写 |
| 持久化 | — | **Yjs** 存库；`Block[]` 为按需转换视图 |

深度说明：[`docs/interview/块模型与编辑器分层面试总结.md`](./docs/interview/块模型与编辑器分层面试总结.md) · [渲染流水线](./docs/interview/块编辑器渲染流水线面试题.md)

---

## 技术架构

```text
┌─────────────────────────────────────────────────────────────┐
│  apps/web (Next.js)     Inkspace 工作区 / 广场 / 图谱          │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
 @xtai-notion/editor-shadcn  editor-react    @workspace/ui
         │                   │
         └─────────┬─────────┘
                   ▼
         @xtai-notion/editor-core  ←── apps/api (NestJS + Prisma)
         BlockEditor / Block[]       协作 · Yjs 持久化 · REST
                   │
                   ▼
         Tiptap 3 + ProseMirror + Yjs + Hocuspocus
```

### Monorepo 结构

| 路径 | 职责 |
|------|------|
| [`apps/web`](./apps/web) | Next.js 前端 |
| [`apps/api`](./apps/api) | 文档 API、Yjs 持久化、Hocuspocus |
| [`packages/editor-core`](./packages/editor-core) | 块模型、`api/` 块操纵、`BlockEditor`（**无 React**） |
| [`packages/editor-react`](./packages/editor-react) | Provider、协作会话、Hooks |
| [`packages/editor-shadcn`](./packages/editor-shadcn) | 默认 UI：`DocumentEditor`、工具栏、NodeView |
| [`packages/ui`](./packages/ui) · [`packages/icons`](./packages/icons) | 应用 UI 与图标 |

---

## 嵌入编辑器 SDK

| 包 | 场景 |
|----|------|
| **editor-core** | 服务端 Markdown、快照、`core/api` 块操作 |
| **editor-react** | React 集成、协作 Provider |
| **editor-shadcn** | 开箱即用 UI + `style.css` |

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

规格与验收：[`openspec/changes/open-source-editor-sdk/`](./openspec/changes/open-source-editor-sdk/)  
分包说明：[`packages/editor-core`](./packages/editor-core/README.md) · [`editor-react`](./packages/editor-react/README.md) · [`editor-shadcn`](./packages/editor-shadcn/README.md)

---

## 文档工作区

对标飞书 / Notion / 语雀的日常闭环，已在侧边栏与工具栏落地。

| 功能 | 入口 / 操作 | 说明 |
|------|-------------|------|
| 回收站 | 侧边栏 | 软删除 `deleted_at`，可恢复或永久删除 |
| 收藏 & 最近 | 侧边栏 | `user_document_pref`，最近约 8 篇 |
| 全文搜索 | 搜索 / **⌘K** | 标题、ID、正文摘要 |
| Markdown 导入 | 侧边栏 | `markdownToBlocks` → 新文档 |
| Markdown 导出 | 工具栏下载 | `blocksToMarkdown` |
| 版本历史 | ⋯ → 版本历史 | Yjs 快照保存与回滚 |
| 文档评论 | 工具栏「评论」 | 块锚点 `block_id`、嵌套回复 |
| 知识库 & 成员 | 切换器 / `/workspaces` | `workspace_member`、邀请与角色 |

<details>
<summary><strong>相关 REST API（节选）</strong></summary>

| 方法 | 路径 | 用途 |
|------|------|------|
| `GET` · `POST` | `/workspaces` | 知识库列表 / 创建 |
| `GET` · `POST` | `/workspaces/:id/documents` | 库内文档 |
| `GET` | `/documents/search?q=` | 全文搜索 |
| `GET` | `/documents/trash` | 回收站 |
| `POST` | `/documents/import` | Markdown 导入 |
| `GET` · `POST` | `/documents/:id/versions` | 版本列表 / 保存 |
| `GET` · `POST` | `/documents/:id/comments` | 评论（可选 `?blockId=`） |

</details>

<details>
<summary><strong>依赖的数据库迁移</strong></summary>

| 迁移 | 内容 |
|------|------|
| `003_document_lifecycle` | `deleted_at`、`user_document_pref` |
| `004_document_comment` | `document_comment` |
| `007_workspace_members` | `workspace_member` |

目录：[`apps/api/prisma/migrations`](./apps/api/prisma/migrations)。升级后执行 `pnpm --filter api prisma migrate deploy`。

</details>

---

## Windows 桌面端

**开发：** 配置好 Web 与 API 后执行 `pnpm dev:desktop`（或分别 `web dev` + `desktop start`），窗口加载 `http://localhost:3000`。关窗缩到托盘，托盘菜单退出才结束进程。

**打包：** 在 `apps/desktop/.env` 设置 `XT_DESKTOP_APP_URL`（线上 `https`），再 `pnpm --filter desktop package` 或 `make`。默认 `pnpm dev` 不启动 Electron。产物在 `apps/desktop/release/`。打包前关闭所有 Electron 窗口；`EBUSY` 时结束进程并清理 `apps/desktop/out` 或 `release`。

---

## 开发与质量

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式（多应用） |
| `pnpm build` | Turbo 全仓库构建 |
| `pnpm lint` · `typecheck` · `test` | 质量检查 |
| `pnpm check:editor-boundaries` | 校验 editor 三包依赖方向 |
| `pnpm --filter @xtai-notion/editor-core build` | 构建 core（消费 dist 时） |
| `pnpm test:e2e` | Playwright E2E |

在 `packages/ui` 中为应用添加 shadcn 组件：

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

```tsx
import { Button } from "@workspace/ui/components/button"
```

---

## 部署

生产环境推荐 **Vercel + Render + Neon** 三分离：HTTP 与页面走 Vercel，实时协作协议单独跑在 Render，数据库两边共用 Neon。

| 组件 | 推荐 | 说明 |
|------|------|------|
| **Web + REST API** | [Vercel](https://vercel.com)（[`docs/deploy-vercel.md`](./docs/deploy-vercel.md)） | **同一个 Vercel 项目**：Next.js 负责页面；Nest REST API **嵌入该站点**（`apps/web/api/nest.ts` → `apps/api` serverless handler），对外路径为 **`/api/*`**（如 `/api/documents`）。未配置 `NEXT_PUBLIC_API_URL` 时前端默认同域 `/api`。 |
| **协作协议（WebSocket）** | [Render](https://render.com)（[`docs/deploy-render.md`](./docs/deploy-render.md)） | **单独部署**（如 `https://xxx.onrender.com`）：仅运行 Hocuspocus（`collab-main.ts` / `pnpm --filter api start:collab`），**不**承载 REST。前端通过 `NEXT_PUBLIC_COLLABORATION_URL=wss://…` 连接。 |
| **数据库** | [Neon](https://neon.tech) | Vercel 上的 API 与 Render 上的协作服务共用 **`DATABASE_URL`**（Yjs 快照与业务表同一库）。 |

```text
Vercel（单项目）
  ├─ Next.js  →  /documents、/square …
  └─ Serverless → /api/*（嵌入式 Nest API，非独立 API 域名）
Render        → wss://…（Hocuspocus 协作，与 API 进程分离）
Neon          → PostgreSQL
```

本地开发时 API 与协作仍可在同一进程（`pnpm --filter api dev`：HTTP `3100` + WS `3101`）。**上述「Vercel + Render」拆分只是因为 Vercel Serverless 无法常驻 WebSocket**（嵌入 API 时会设 `VERCEL=1`，`CollaborationService` 不会监听协作端口）；与本地/自托管的完整 `main.ts` 不是同一运行模式。

### 自托管（自有服务器 / VPS）

若 **不** 使用 Vercel，而是把 Web 与 API 部署在自有服务器（或 Railway、Fly.io 等支持长连接的 Node 主机），可以 **不再单独部署 Render 协作服务**，运维模型与本地开发一致：

| 对比 | Vercel + Render（托管推荐） | 自托管一台机 |
|------|----------------------------|--------------|
| 前端 | Next.js（Vercel） | `pnpm --filter web build` + `next start`（或 Docker / PM2） |
| REST + 协作 | API 嵌 Serverless **无 WS**；协作另起 `collab-main.ts` | 常驻跑 **`apps/api/src/main.ts`**：同一 Nest 进程内 **REST（`PORT`）+ Hocuspocus（`COLLABORATION_PORT`）** |
| 数据库 | Neon 等 | 自建 PostgreSQL 或 Docker（见 [`docs/local-database.md`](./docs/local-database.md)） |
| 是否要 Render | **要**（或其它协作专线） | **不要**（除非你想把协作拆成独立进程做水平扩展） |

```text
自有服务器（示例）
  ├─ next start          →  :3000  页面
  ├─ main.ts（常驻 API） →  :3100  REST
  │                      →  :3101  Hocuspocus WS
  └─ PostgreSQL          →  本机 / 内网
```

构建与迁移：`pnpm install`、`pnpm build`，在 API 侧执行 `pnpm --filter api prisma migrate deploy`。生产环境 **勿** 设置 `VERCEL=1`。在 `apps/web` 配置例如：

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3100
NEXT_PUBLIC_COLLABORATION_URL=ws://127.0.0.1:3101
```

对外通常用 **Nginx / Caddy** 做 HTTPS 与 WebSocket 升级，把站点与 API、协作反代到同一域名（Cookie 会话更简单）。自托管暂未有单独运维文档，完整请求链路仍可参考 [部署架构与时序](./docs/部署架构与时序.md)（把「Vercel / Render」替换成你的反代与 `main.ts` 即可）。

时序与职责：[`docs/部署架构与时序.md`](./docs/部署架构与时序.md)

---

## 相关文档

| 主题 | 链接 |
|------|------|
| 面试 / 架构复习 | [`docs/interview/高频面试题总结.md`](./docs/interview/高频面试题总结.md) |
| 块模型与渲染 | [`块模型分层`](./docs/interview/块模型与编辑器分层面试总结.md) · [`渲染流水线`](./docs/interview/块编辑器渲染流水线面试题.md) |
| 块文档设计 spec | [`docs/superpowers/specs/2026-08-28-block-document-architecture-design.md`](./docs/superpowers/specs/2026-08-28-block-document-architecture-design.md) |
| 本地数据库 | [`docs/local-database.md`](./docs/local-database.md) |
| 外部参考 | [Tiptap](https://tiptap.dev) · [BlockNote](https://www.blocknotejs.org) |

---

## 许可证

编辑器 SDK（`@xtai-notion/editor-core` / `editor-react` / `editor-shadcn`）为 **MIT**。其它包以各自 `package.json` 为准。
