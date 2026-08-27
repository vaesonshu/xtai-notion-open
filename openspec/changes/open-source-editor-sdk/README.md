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

（实施完成后在此记录命令输出摘要）
