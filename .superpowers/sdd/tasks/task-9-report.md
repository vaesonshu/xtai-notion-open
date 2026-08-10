# Task 9 报告：编辑器扩展配置 RED 测试

## 状态

已创建聚焦 RED 测试；未修改任何生产实现。测试按 tasks.md 3.2 与 3.4 覆盖普通和协作扩展配置。

## 失败命令与输出

执行：

```powershell
pnpm --filter @workspace/editor test -- src/core/extensions.test.ts
```

结果：退出码 1，4 个测试中 1 个失败：

```text
FAIL  src/core/extensions.test.ts > editor core > passes the collaboration document and provider to collaboration extensions
AssertionError: expected undefined to be defined

Test Files  1 failed (1)
Tests  1 failed | 3 passed (4)
```

失败位置：`extensions.test.ts:72` 的 `expect(collaboration).toBeDefined()`。

## 失败原因

- `createEditorExtensions()` 当前只返回 StarterKit、Link、Underline、TaskList、TaskItem 和 Placeholder，没有 `collaboration` 或 `collaborationCaret`。
- 因此协作配置所需的 `document`、`provider`、`user` 无法通过真实扩展实例接收和断言。
- 普通模式 undo/redo 测试通过：当前 Tiptap 运行时将 `StarterKit.configure({ undoRedo: {} })` 保留为启用配置。该断言仍保留，作为普通模式回归保护。
- 失败来自待实现的扩展配置差异，不是 mock 行为或网络连接问题。

## 改动文件

- `packages/editor/src/core/extensions.test.ts`：新增普通/协作模式配置测试；使用真实 Tiptap 扩展实例、真实 `Y.Doc`，Provider 仅作类型安全转换。
- `.superpowers/sdd/tasks/task-9-brief.md`：记录目标与 RED 命令。
- `.superpowers/sdd/tasks/task-9-report.md`：本报告。

## 自审

- 未修改 `extensions.ts`、`types.ts` 或其他生产文件。
- 未 mock Tiptap、Yjs、Provider 或被测模块；仅对无网络连接的 Provider 使用 `{} as HocuspocusProvider`。
- 测试检查扩展 `name` 与解析后的 `options`，覆盖 `document`、`provider`、`user` 的传递意图，以及协作时关闭 StarterKit undoRedo。
- `CollaborationUser` 当前在测试中定义为最小结构，避免在生产类型尚未实现时引入解析错误；GREEN 阶段应改为从生产 `types.ts` 导入并让 `EditorExtensionOptions` 提供该契约。
- RED 结果是运行时断言失败而非导入/解析错误；3 个既有/普通配置测试通过，证明测试基础设施和现有扩展仍可解析。

## 顾虑

- 测试调用处暂以 `Parameters<typeof createEditorExtensions>[0]` 转换承载尚未存在的生产选项字段，避免 RED 阶段因当前旧类型直接阻断测试执行。GREEN 阶段必须删除该转换，并由生产 `EditorExtensionOptions` 正式提供字段类型。
- 本阶段只要求 RED，不实现生产代码，也未运行完整 monorepo 测试。
