# Task 10 Brief: command core RED

## 目标

为 tasks.md 3.3/3.4 的命令核心创建聚焦 TDD RED 测试，不修改生产实现。测试覆盖斜杠命令目录的 id、标签与关键字过滤、代表性块命令执行，以及行内标记和链接命令的真实 Tiptap 编辑器行为。

## RED 命令

```powershell
pnpm --filter @workspace/editor test -- src/core/slash-commands.test.ts src/core/commands.test.ts
```
