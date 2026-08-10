# Task 9 Brief: editor extensions RED

## 目标

为 tasks.md 3.2/3.4 的编辑器扩展配置补充聚焦 TDD RED 测试，不修改生产实现。测试覆盖普通模式 undo/redo、协作模式的 `document`、`provider`、`user` 选项，以及 Collaboration、CollaborationCaret 和 StarterKit history 配置。

## RED 命令

```powershell
pnpm --filter @workspace/editor test -- src/core/extensions.test.ts
```
