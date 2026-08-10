## 1. 工作区基础与可复现依赖

> **TDD 约束：** 从本变更起，所有新增或修改的行为必须先创建或更新聚焦测试，并确认测试因待实现行为失败；随后实现最小代码使其通过。配置、文档和纯导入迁移不适用此顺序。

- [x] 1.1 在 `package.json`、`pnpm-workspace.yaml`、`turbo.json` 和 `pnpm-lock.yaml` 中注册 `apps/api`、其 build/lint/typecheck/test Turbo 任务，以及 Playwright 的根目录测试命令；运行 `pnpm install --frozen-lockfile` 后执行 `pnpm typecheck`，验收为所有现有工作区包仍能解析。
- [x] 1.2 修改 `packages/editor/package.json`，以精确版本替换所有 `latest`：现有 Tiptap 包固定到 `3.29.2`，新增 `@tiptap/extension-collaboration@3.29.2`、`@tiptap/extension-collaboration-caret@3.29.2`、`@tiptap/extension-bubble-menu@3.29.2`、`@tiptap/extension-drag-handle-react@3.29.2`、`@hocuspocus/provider@4.5.0` 和 `yjs@13.6.32`；运行 `pnpm --filter @workspace/editor typecheck`，验收为没有 `latest` 依赖。
- [x] 1.3 在实现 Next.js 页面前阅读已安装 Next.js 16.2.6 对应文档的 Client Components、`transpilePackages`、环境变量与 SSR/hydration 指南；运行 `pnpm --filter web typecheck`，验收为计划中的客户端边界符合该版本 API。

## 2. 统一图标包

- [x] 2.1 创建 `packages/icons/src/index.test.ts`，先验证代表性图标与 `Icon` 类型出口可被导入，并运行 `pnpm exec vitest run packages/icons/src/index.test.ts` 确认其因包尚不存在而失败。
- [x] 2.2 创建 `packages/icons/package.json`、`packages/icons/tsconfig.json`、`packages/icons/eslint.config.js` 与 `packages/icons/src/index.ts`；暴露 `Icon`、`IconProps` 以及编辑器和现有 Inkspace 页面需要的具名图标。接口为 `export { BoldIcon, CodeIcon, ... }` 和 `export type { LucideIcon as Icon }`，内部唯一依赖 `lucide-react`。测试必须使用 `expectTypeOf` 或等效类型断言验证 `Icon` 导出。运行 `pnpm --filter @workspace/icons test`、`pnpm --filter @workspace/icons lint` 和 `pnpm --filter @workspace/icons typecheck`。
- [x] 2.3 修改 `apps/web/package.json`、`packages/editor/package.json`、`apps/web/components/inkspace/icon.tsx`、`apps/web/components/inkspace/toolbar.tsx`、`apps/web/components/inkspace/sidebar.tsx` 与 `apps/web/components/inkspace/document.tsx`，改为从 `@workspace/icons` 导入图标并移除其直接 `lucide-react` 依赖；运行 `rg 'from "lucide-react"' apps/web packages/editor`，验收为无匹配。

## 3. 编辑器文档契约与命令核心

- [x] 3.1 修改 `packages/editor/src/core/types.ts`，以 Tiptap JSON 内容类型替换宽泛的 `Array<Record<string, unknown>>`；创建 `packages/editor/src/core/document.ts`，导出 `createEmptyDocument(): EditorDocument`、`createStarterDocument(): EditorDocument` 和 `isEditorDocument(value: unknown): value is EditorDocument`。
- [x] 3.2 修改 `packages/editor/src/core/extensions.ts`，导出 `createEditorExtensions(options: EditorExtensionOptions): Extensions`，并使 `EditorExtensionOptions` 包含 `placeholder`、`document?: Y.Doc`、`provider?: HocuspocusProvider`、`user?: CollaborationUser`；普通模式启用 undo/redo，协作模式启用 Collaboration 与 CollaborationCaret 且禁用 StarterKit history。
- [x] 3.3 创建 `packages/editor/src/core/slash-commands.ts` 和 `packages/editor/src/core/commands.ts`；导出 `SlashCommand`、`SLASH_COMMANDS`、`filterSlashCommands(query)`、`executeSlashCommand(editor, id)`、`toggleInlineMark(editor, mark)` 与 `setEditorLink(editor, href)`，覆盖规格中的块与格式化命令。
- [x] 3.4 更新 `packages/editor/src/core/index.ts` 与 `packages/editor/src/index.ts`，只导出稳定的文档、扩展和命令 API；创建或更新 `packages/editor/src/core/extensions.test.ts`、`document.test.ts`、`slash-commands.test.ts` 和 `commands.test.ts`，分别断言协作 history 配置、空/示例文档验证、`/代码` 过滤与链接/粗体命令。
- [x] 3.5 运行 `pnpm --filter @workspace/editor test -- --runInBand`、`pnpm --filter @workspace/editor lint` 和 `pnpm --filter @workspace/editor typecheck`；验收为 core 测试同时覆盖普通与协作扩展配置。（Vitest 不支持 `--runInBand`，等价执行 `--fileParallelism false`；27 项测试、lint、typecheck 均通过。）

## 4. 协作会话与 React 生命周期

- [x] 4.1 创建 `packages/editor/src/collaboration/types.ts` 与 `create-collaboration-session.ts`，定义 `CollaborationConfig`（`documentId`、`websocketUrl`、`token`、`user`）、`CollaborationStatus`（`connecting | synced | offline | unauthorized | error`）和 `CollaborationSession`（`document`、`provider`、`getStatus()`、`destroy()`）；Provider 必须使用 `documentId` 作为房间名。
- [x] 4.2 创建 `packages/editor/src/collaboration/create-collaboration-session.test.ts`，使用可控 Provider mock 验证首次同步、断线状态、错误映射和 destroy 时移除监听器并销毁 Y.Doc。
- [x] 4.3 创建 `packages/editor/src/react/collaboration-editor-provider.tsx` 与 `use-collaboration-status.ts`；接口为 `CollaborationEditorProviderProps extends EditorProviderProps`，额外接收 `collaboration: CollaborationConfig`，必须在同步完成后创建 Editor，且仅当远端为空时调用 `createStarterDocument()`。
- [x] 4.4 修改 `packages/editor/src/react/editor-context.tsx`、`editor-provider.tsx`、`use-editor-instance.ts`、`use-editor-change.ts`、`use-editor-selection.ts` 和 `react/index.ts`，使非协作 Provider 保持兼容，并增加 `useCollaborationStatus(): CollaborationStatus` 与 `useCollaborators(): CollaborationUser[]`。
- [x] 4.5 更新 `packages/editor/src/react/editor-provider.test.tsx`，新增协作入口渲染、远端内容不被初始内容覆盖、状态变更和卸载清理测试；运行 `pnpm --filter @workspace/editor test`，验收为每个 Editor、Provider 和 Y.Doc 在卸载时恰好释放一次。

## 5. 可组合编辑器 UI

- [x] 5.1 创建 `packages/editor/src/components/document-editor.tsx`、`editor-surface.tsx` 和 `collaboration-status.tsx`；`DocumentEditorProps` 接收 `content?` 或 `collaboration`（二者互斥）、`editable?`、`onChange?`、`className?`，使用 `@workspace/ui/components/skeleton`、`alert`、`badge` 和 `tooltip` 显示加载、同步、离线、无权限和错误状态。
- [x] 5.2 创建 `packages/editor/src/components/slash-menu.tsx`，基于 `@workspace/ui/components/command` 与 `@workspace/ui/components/popover` 消费 `filterSlashCommands`；实现 `/` 查询、键盘上下选择、Enter 执行和 Escape 取消。
- [x] 5.3 创建 `packages/editor/src/components/bubble-toolbar.tsx`，基于 `@workspace/ui/components/toggle`、`button`、`input` 与 `popover` 消费共享命令；只在非空可格式化选区显示粗体、斜体、下划线、删除线、行内代码和链接控制。
- [x] 5.4 创建 `packages/editor/src/components/block-handle.tsx`，使用 Tiptap 拖拽手柄扩展并将操作限制为兼容顶层块；创建 `packages/editor/src/styles/editor.css`，定义 ProseMirror 基础样式、任务项、空段落、拖拽态及 CollaborationCaret 的 caret/selection/label 样式，修复现有 `./styles.css` export 指向缺失文件的问题。
- [ ] 5.5 创建 `packages/editor/src/components/index.ts`，导出 UI 组件；创建 `document-editor.test.tsx`、`slash-menu.test.tsx`、`bubble-toolbar.test.tsx` 和 `collaboration-status.test.tsx`，覆盖只读渲染、`/代码` 插入、Escape、粗体/链接、连接状态 aria 文本和错误时不显示“已保存”。
- [ ] 5.6 运行 `pnpm --filter @workspace/editor test`、`lint` 和 `typecheck`；验收为编辑器只从 `@workspace/ui/components/*` 和 `@workspace/icons` 使用基础 UI 与图标。

## 6. NestJS API 与 PostgreSQL 基础

- [ ] 6.1 创建 `apps/api/package.json`、`tsconfig.json`、`eslint.config.js`、`vitest.config.ts` 和 `src/main.ts`；固定 `@nestjs/common`、`@nestjs/core`、`@nestjs/platform-express` 到 `11.1.28`，`pg` 到 `8.23.0`，`node-pg-migrate` 到 `9.0.0`，并提供 `dev`、`build`、`lint`、`typecheck`、`test`、`test:integration`、`migrate` 脚本。
- [ ] 6.2 创建 `apps/api/src/app.module.ts`、`config/environment.ts`、`health/health.controller.ts` 和 `health/health.controller.spec.ts`；定义 `Environment`（`PORT`、`DATABASE_URL`、`COLLABORATION_PORT`、`NODE_ENV`）并实现 `GET /health` 返回 `{ status: "ok" }`。
- [ ] 6.3 创建 `apps/api/migrations/001-create-collaboration-schema.sql`，定义 `workspace`、`document`、`document_member`、`yjs_snapshot` 和 `yjs_update` 表、外键、`(document_id, sequence)` 唯一约束与加载更新所需索引；创建 `apps/api/src/database/database.module.ts`、`database.service.ts` 与 `database.service.spec.ts`，暴露 `query<T>(text, values): Promise<QueryResult<T>>` 和事务 API。
- [ ] 6.4 创建 `apps/api/src/auth/development-identity.guard.ts`、`current-user.decorator.ts` 与对应测试；`x-dev-user-id` 缺失或为空时返回 401，生产环境启用该 guard 时应用启动失败。
- [ ] 6.5 创建 `apps/api/src/documents/documents.repository.ts`、`documents.service.ts`、`documents.controller.ts` 与测试；定义 `DocumentRole = "owner" | "editor" | "viewer"`、`getMemberRole(documentId, userId)`、`assertCanRead` 与 `assertCanWrite`，并实现 `GET /documents/:documentId` 的元数据读取。
- [ ] 6.6 使用 `DATABASE_URL` 指向测试 PostgreSQL 运行 `pnpm --filter api migrate` 和 `pnpm --filter api test:integration`，然后运行 `pnpm --filter api lint`、`typecheck`；验收为非成员得到 403、viewer 无写权限、owner/editor 具备预期权限。

## 7. Yjs 持久化与 Hocuspocus 协作服务

- [ ] 7.1 在 `apps/api/package.json` 固定新增 `@hocuspocus/server@4.5.0`、`yjs@13.6.32` 与所需协议依赖；创建 `src/collaboration/collaboration.module.ts`、`collaboration.service.ts`、`hocuspocus.factory.ts`，使 NestJS `OnModuleInit`/`OnModuleDestroy` 负责协作服务器启动、缓冲区刷新和停止。
- [ ] 7.2 创建 `apps/api/src/collaboration/yjs-persistence.repository.ts` 与 `yjs-persistence.service.ts`；接口为 `loadDocument(documentId): Promise<Y.Doc>`、`enqueueUpdate(documentId, update: Uint8Array): void`、`flushDocument(documentId): Promise<void>`、`compactDocument(documentId): Promise<void>`。实现“最新快照 + 有序更新”恢复、同文档批量事务写入、阈值压缩和已覆盖 update 删除。
- [ ] 7.3 创建 `apps/api/src/collaboration/collaboration-auth.service.ts` 与 `hocuspocus-hooks.ts`；从协作连接解析开发身份，调用 `DocumentsService.assertCanRead/assertCanWrite`，为 viewer 建立只读会话，拒绝非成员和无效身份，并将 persistence 失败转为客户端可感知的错误状态。
- [ ] 7.4 创建 `apps/api/src/collaboration/yjs-persistence.service.spec.ts`、`hocuspocus-hooks.spec.ts` 和 `collaboration.integration.spec.ts`；覆盖快照后重放更新、批量写入、压缩、两个 editor 同步、viewer 写入拒绝、非成员不接收状态与服务重启后恢复。
- [ ] 7.5 运行 `pnpm --filter api test`、`pnpm --filter api test:integration`、`pnpm --filter api lint` 和 `pnpm --filter api typecheck`；验收为所有协作会话都通过同一成员角色规则。

## 8. Web 编辑器集成

- [ ] 8.1 创建 `apps/web/components/inkspace/document-workspace.tsx` 作为客户端组合根；定义 `DocumentWorkspaceProps`（`documentId`、`user: { id, name, color }`、`apiUrl`、`collaborationUrl`），在同一编辑器 Provider 下组合 `EditorToolbar`、`DocumentEditor` 和状态 UI。
- [ ] 8.2 修改 `apps/web/app/page.tsx`、`apps/web/components/inkspace/document.tsx` 和 `apps/web/components/inkspace/toolbar.tsx`，用 `DocumentWorkspace` 替换静态 `DocumentCanvas`；将页面演示数据限定为开发身份和稳定 demo `documentId`，不再在页面中硬编码正文块。
- [ ] 8.3 修改 `apps/web/next.config.ts` 和新增 `.env.example`，定义 `NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_COLLABORATION_URL` 和 `NEXT_PUBLIC_DEV_USER_ID`；在缺少客户端端点时显示配置错误而不是静默退回静态内容。
- [ ] 8.4 创建 `apps/web/components/inkspace/document-workspace.test.tsx`，mock 协作会话并覆盖同步后可编辑、viewer 只读、离线状态、无权限状态和错误状态；运行 `pnpm --filter web test`、`lint`、`typecheck` 和 `build`。

## 9. 端到端验证与运维文档

- [ ] 9.1 创建 `apps/web/e2e/collaboration.spec.ts` 与 `playwright.config.ts`；使用两个独立浏览器上下文，以两个 editor 身份连接同一 `documentId`，断言文本实时同步、协作者 caret 标签、viewer 无法编辑，以及刷新/重启 API 后持久化内容恢复。
- [ ] 9.2 创建 `apps/api/README.md` 和更新根 `README.md`，记录 PostgreSQL 启动条件、迁移、开发身份 header、Web/API/协作端点环境变量、单实例限制、启动顺序和回滚步骤。
- [ ] 9.3 执行 `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm typecheck`、`pnpm --filter @workspace/editor test`、`pnpm --filter api test:integration`、`pnpm --filter web build` 和 `pnpm exec playwright test`；验收为所有命令通过，且将实际命令输出记录到变更验证说明。
