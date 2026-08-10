# Task 10 报告：命令核心 TDD RED

## 状态

RED 已确认。只创建了测试与任务记录，未创建或修改 `slash-commands.ts`、`commands.ts` 或任何其它生产实现。

## 覆盖的预期契约

- `filterSlashCommands(query)` 按命令 `id`、中文 `label` 和 `keywords` 过滤，`/代码` 返回 `code-block` 命令；空查询返回公开命令目录。
- `executeSlashCommand(editor, id)` 使用真实 Tiptap `Editor` 的命令链将当前段落转换为 `codeBlock`；未知 id 返回 `false` 且文档不变。
- `toggleInlineMark(editor, mark)` 通过真实编辑器选区切换粗体并反向切换。
- `setEditorLink(editor, href)` 在真实选区设置 `href`，空 `href` 移除链接。

## RED 证据

执行：

```powershell
pnpm --filter @workspace/editor test -- src/core/slash-commands.test.ts src/core/commands.test.ts
```

结果：退出码 `1`，两个测试套件均在收集阶段失败，原因符合待实现模块缺失：

```text
Failed to resolve import "./slash-commands.js" from "src/core/slash-commands.test.ts". Does the file exist?
Failed to resolve import "./commands.js" from "src/core/commands.test.ts". Does the file exist?
```

这直接对应 tasks.md 3.3 要求新建的生产模块，未因测试拼写或环境配置失败。

## 静态检查

编辑器对新增测试文件未报告 IDE lint 问题。

## 顾虑

- 当前 RED 是 import resolution failure，因此测试主体尚未执行。实现 `slash-commands.ts` 与 `commands.ts` 后，应先重新运行上述精确命令，以验证具体命令契约并进入 GREEN。
- 任务规格没有定义斜杠命令的稳定 id；测试以 `code-block` 作为显式期望，后续实现需要将命令目录与此公共 id 对齐，或在变更规格中明确替代 id 后同步更新测试。
