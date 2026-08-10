# Task 9 报告：编辑器扩展配置 RED/GREEN

## 状态

GREEN 已完成并提交。实现了编辑器扩展工厂的正式协作类型与协作扩展配置，保留 RED 阶段证据。

## RED 证据

执行：

```powershell
pnpm --filter @workspace/editor test -- src/core/extensions.test.ts
```

结果：退出码 1，4 个测试中 1 个失败：

```text
FAIL  src/core/extensions.test.ts > editor core > passes the collaboration document and provider to collaboration extensions
AssertionError: expected undefined to be defined
```

失败位置：`extensions.test.ts:72` 的 `expect(collaboration).toBeDefined()`。

RED 原因：`createEditorExtensions()` 只有 StarterKit、Link、Underline、TaskList、TaskItem 和 Placeholder，没有返回 `collaboration` 或 `collaborationCaret` 扩展；生产类型也没有 `document`、`provider`、`user` 选项。

## GREEN 实现

### 生产类型

在 `packages/editor/src/core/types.ts` 中新增：

- `CollaborationUser`：`id`、`name`、`color`。
- `EditorExtensionOptions`：保留 `placeholder`，新增 `document?: Y.Doc`、`provider?: HocuspocusProvider`、`user?: CollaborationUser`。

并从 `packages/editor/src/core/index.ts` 导出这些类型。

### 扩展工厂

在 `packages/editor/src/core/extensions.ts` 中：

- 普通模式使用 `StarterKit.configure({ undoRedo: {} })`。
- 仅当 `document`、`provider`、`user` 同时提供时进入协作模式。
- 协作模式加入真实的 `Collaboration.configure({ document, provider })`。
- 协作模式加入真实的 `CollaborationCaret.configure({ provider, user })`。
- 协作模式设置 `StarterKit.configure({ undoRedo: false })`。
- 保留 Link、Underline、TaskList、TaskItem、Placeholder 配置。
- 未创建 Provider 实例、未启动网络连接，也未实现其它 Task。

### 测试调整

删除测试中临时的本地 `CollaborationUser` 定义和 `Parameters<typeof createEditorExtensions>[0]` 转换，改为直接导入生产类型并调用正式 API。断言未削弱。

## 验证

```text
pnpm --filter @workspace/editor test -- src/core/extensions.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

pnpm --filter @workspace/editor typecheck
通过

pnpm --filter @workspace/editor lint
通过

pnpm --filter @workspace/editor test
Test Files  3 passed (3)
Tests  11 passed (11)
```

## 顾虑

- `CollaborationCaret` 的 Tiptap 3 类型声明将 `provider` 声明为 `any`、`user` 声明为 `Record<string, any>`；正式的 `CollaborationUser` 结构与其兼容，无需额外类型转换。
- 测试中的 Provider 仍是无网络连接的 `{} as HocuspocusProvider`，只用于验证引用传递；生产工厂不会实例化或连接 Provider。

## 提交

提交：`Task 9 GREEN: implement editor extension factory`