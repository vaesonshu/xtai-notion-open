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

## GREEN 证据

已实现最小生产代码：

- 新增 `slash-commands.ts`，公开 8 个基础块命令：heading、paragraph、bulletList、orderedList、taskList、blockquote、codeBlock、horizontalRule；`code-block` 使用中文标签“代码块”及 `代码`、`代码块`、`code` 等关键字。
- `executeSlashCommand` 通过 Tiptap `Editor.chain().focus()` 执行真实块转换，未知 id 直接返回 `false`。
- 新增 `commands.ts`，支持 bold、italic、underline、strike、code 行内标记，以及设置和清除链接。
- `core/index.ts` 与包根 `src/index.ts` 均公开命令 API 与类型。

执行结果：

```powershell
pnpm --filter @workspace/editor test -- src/core/slash-commands.test.ts src/core/commands.test.ts
```

结果：退出码 `0`，2 个测试文件、8 个测试全部通过。

```powershell
pnpm --filter @workspace/editor test
pnpm --filter @workspace/editor lint
pnpm --filter @workspace/editor typecheck
git diff --check
```

结果：全部退出码 `0`；完整编辑器测试为 6 个测试文件、20 个测试通过。

## GREEN 顾虑

- Tiptap `Link` 扩展会为链接补充 `target`、`rel`、`class`、`title` 默认属性，测试只验证业务所需的 `href` 与选区文本，避免把扩展默认值误当作公共契约。
