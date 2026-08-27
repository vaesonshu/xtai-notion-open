# open-source-editor-sdk

将 `@workspace/editor` 拆分为可开源发布的 `@xtai-notion/editor-core`、`@xtai-notion/editor-react`、`@xtai-notion/editor-shadcn` 三层 SDK。

## 文档

| 文件 | 说明 |
|------|------|
| [proposal.md](./proposal.md) | 动机、范围、影响 |
| [design.md](./design.md) | 架构决策与迁移策略 |
| [tasks.md](./tasks.md) | **AI 实施清单**（按顺序执行） |
| [specs/](./specs/) | 行为规格 |

## 如何让 AI 实施

1. 在 Cursor 中执行 **`/openspec-apply-change open-source-editor-sdk`**，或发送：
   > 请按照 `openspec/changes/open-source-editor-sdk/tasks.md` 从第 1 节开始实施

2. AI 应逐节完成任务，每完成一组运行对应验收命令。

## 验证说明

**日期：** 2026-08-27 · **分支：** `feat/open-source-editor-sdk`

### 自动化验收（已通过）

| 命令 | 结果 |
|------|------|
| `pnpm check:editor-boundaries` | 三包无反向 / 禁止依赖 |
| `pnpm lint` | 通过（既有 warning，无 error） |
| `pnpm typecheck` | 通过 |
| `pnpm --filter @xtai-notion/editor-core test` | 56 passed |
| `pnpm --filter @xtai-notion/editor-react test` | 19 passed |
| `pnpm --filter @xtai-notion/editor-shadcn test` | 50 passed |
| `pnpm --filter api test` | 95 passed |
| `pnpm --filter web test` | 74 passed |
| `pnpm --filter web build` | Next.js 生产构建成功 |

### 手动冒烟清单

在本地 `pnpm dev` 后建议确认（与迁移前行为一致）：

| 场景 | 路径 | 检查项 |
|------|------|--------|
| 文档编辑 | `/documents/[documentId]` | 输入、粗体、Slash `/` 菜单、撤销/重做 |
| 编辑器测试台 | `/editor-playground` | 工具栏命令、JSON 快照面板 |
| 广场阅读 | `/square/[articleId]` | 只读渲染、图片 lightbox |
| 协作（可选） | 同上 + 协作环境 | 连接状态、多光标（需 `NEXT_PUBLIC_COLLABORATION_URL`） |

自动化测试已覆盖：`DocumentWorkspace`、`FixedToolbar`、`EditorPlayground`、`ArticleReader` 等组件级用例；协作 E2E 依赖外部 Hocuspocus 服务，未纳入 CI 强制项。

### 已知限制

- npm **尚未发布**；本变更仅完成可发布结构与 monorepo 消费
- `@workspace/editor` shim 仍保留于 `transpilePackages`，下一变更可删除
- 含中文源码/测试请用 Node 脚本迁移，避免 PowerShell 破坏 UTF-8
