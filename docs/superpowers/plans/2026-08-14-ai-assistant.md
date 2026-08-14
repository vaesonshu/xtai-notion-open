# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文档工作区增加一个只读、可流式多轮对话的 AI 协作助手，支持总结、待办提取、大纲生成和自由问答。

**Architecture:** 前端在 `DocumentWorkspace` 内持有抽屉开关和编辑器快照读取能力，AI 面板只管理当前生命周期内的消息与 AbortController，并通过 `POST /ai/chat` 解析 SSE。NestJS `AiModule` 复用 `DocumentsService.assertCanRead` 做身份和成员校验，由 `AiService` 做输入限制与错误归一化，`AiAgent` 使用 LangChain 的 OpenAI 兼容 ChatModel（无工具）输出 token 流。

**Tech Stack:** Next.js 16、React 19、NestJS 11、Tiptap/Yjs editor hooks、Vitest/Testing Library、LangChain OpenAI-compatible chat model、SSE。

## Global Constraints

- 仅允许当前文档只读问答；Agent 不得修改、删除、发布文档。
- 每次请求发送编辑器最新纯文本快照和当前面板消息；后端不保存会话且不信任前端身份。
- `owner`、`editor`、`viewer` 均可调用，非成员必须被现有认证/权限机制拒绝。
- 模型配置使用 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`；缺失配置显示“AI 服务未配置”，供应商错误统一为“AI 服务暂不可用”。
- SSE 事件只能是 `token`、`done`、`error`；客户端取消后保留已生成文本但不把半截回答加入后续上下文。
- 文档文本、消息数量、单条消息长度必须在 API 层有明确上限；不得泄露密钥、堆栈或供应商请求细节。
- 代码遵守根目录 `.prettierrc`：LF、双引号、两空格、无分号，并为每个新增/实质修改代码块保留解释意图的有用注释。
- 实现 Next.js 相关代码前，执行仓库要求的 `node_modules/next/dist/docs/` 相关指南核对 API 变更。

---

### Task 1: 建立 AI 契约、配置和依赖

**Files:**
- Create: `apps/api/src/ai/ai.types.ts`
- Modify: `apps/api/src/config/environment.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/package.json`
- Test: `apps/api/src/config/environment.spec.ts`（如不存在则创建）

**Interfaces:**
- `AiChatMessage = { role: "user" | "assistant"; content: string }`
- `AiChatRequest = { documentId: string; documentText: string; messages: AiChatMessage[] }`
- `AiStreamEvent` 为 `{ type: "token"; content: string } | { type: "done" } | { type: "error"; message: string }`
- 环境类型新增可选 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，保持未配置时应用可启动。

- [ ] **Step 1: 写配置和契约失败测试**：覆盖三项环境变量被读取、空值保持 `undefined`，以及非法消息 role 不被类型守卫接受。
- [ ] **Step 2: 运行 `pnpm --filter api test -- environment.spec.ts`，确认测试先失败。**
- [ ] **Step 3: 添加类型、环境字段和 LangChain OpenAI 适配依赖（锁定与当前 Node 20/TypeScript 版本兼容的包版本），并更新 `.env.example`。**
- [ ] **Step 4: 运行同一测试及 `pnpm --filter api typecheck`，确认通过。**

### Task 2: 实现无工具 LangChain Agent

**Files:**
- Create: `apps/api/src/ai/ai.agent.ts`
- Test: `apps/api/src/ai/ai.agent.spec.ts`

**Interfaces:**
- `AiAgent` 构造函数接收环境配置和可注入的 ChatModel 工厂。
- `stream(input: { documentText: string; messages: AiChatMessage[]; signal?: AbortSignal }): AsyncIterable<string>`。
- 系统提示词必须声明仅使用当前文档/当前会话、无法判断时说明信息不足、不执行外部操作、使用简洁中文。

- [ ] **Step 1: 写失败测试**：断言模型收到系统提示词、文档快照和历史消息；token 按顺序产出；AbortSignal 中止后停止消费；不注册任何 tool。
- [ ] **Step 2: 运行 `pnpm --filter api test -- ai.agent.spec.ts`，确认失败。**
- [ ] **Step 3: 用环境变量构造 OpenAI-compatible ChatModel，使用 LangChain `stream`，把 chunk 内容规范化为字符串；将模型/供应商异常转换为内部可识别错误。**
- [ ] **Step 4: 运行 Agent 单测和 `pnpm --filter api typecheck`。**

### Task 3: 实现 AiService、控制器和模块接入

**Files:**
- Create: `apps/api/src/ai/ai.service.ts`
- Create: `apps/api/src/ai/ai.controller.ts`
- Create: `apps/api/src/ai/ai.module.ts`
- Create: `apps/api/src/ai/ai.service.spec.ts`
- Create: `apps/api/src/ai/ai.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `AiService.chat(request: AiChatRequest, userId: string, signal?: AbortSignal): AsyncIterable<AiStreamEvent>`。
- `POST /ai/chat` 使用现有 `AuthenticatedIdentityGuard` 与 `@CurrentUser()`；响应 `Content-Type: text/event-stream`，每个事件格式为 `event: <type>\ndata: <JSON>\n\n`。

- [ ] **Step 1: 写失败测试**：非成员被拒绝；三种成员角色允许；缺失/空 documentId、空文本、非法 role、消息数/长度/文档长度超限返回 400；未配置模型和供应商异常分别返回稳定错误事件；token/done/error 格式正确。
- [ ] **Step 2: 运行 `pnpm --filter api test -- ai.service.spec.ts ai.controller.spec.ts`，确认失败。**
- [ ] **Step 3: `AiService` 先调用 `DocumentsService.assertCanRead`，再校验规模并委托 Agent；控制器监听 `req` close/abort，把 `AbortSignal` 传入 Agent，避免向已关闭响应写入。异常只输出公开中文错误。**
- [ ] **Step 4: 在 `AiModule` 导入 `AuthModule`、`DocumentsModule`，注册控制器/服务/Agent，并加入 `AppModule`。**
- [ ] **Step 5: 运行 API 单测、`pnpm --filter api typecheck` 和 `pnpm --filter api build`。**

### Task 4: 暴露编辑器纯文本快照能力

**Files:**
- Modify: `packages/editor/src/react/hooks/`（新增 `use-editor-text.ts`）
- Modify: `packages/editor/src/react/index.ts`
- Modify: `packages/editor/src/components/editor/document-editor.tsx`（按现有 provider 边界暴露回调）
- Test: `packages/editor/src/react/hooks/use-editor-text.test.tsx`

**Interfaces:**
- `getEditorText(editor: Editor): string`：从 `editor.getJSON()` 递归提取 text 节点，以换行保留段落/列表边界，不包含 HTML/属性。
- `useEditorText()` 返回稳定的 `() => string`，调用时读取最新实例快照，而非渲染时缓存。

- [ ] **Step 1: 写失败测试**：段落、列表、空节点和嵌套内容转换为预期纯文本，调用函数时能看到最新 JSON。
- [ ] **Step 2: 运行 `pnpm --filter @workspace/editor test -- use-editor-text.test.tsx`，确认失败。**
- [ ] **Step 3: 实现递归转换和 hook，保留解释换行策略的注释；从 editor 包导出。**
- [ ] **Step 4: 运行 editor 测试、typecheck 和格式化。**

### Task 5: 创建 AI 面板子组件和 SSE 客户端状态机

**Files:**
- Create: `apps/web/components/inkspace/ai-message-list.tsx`
- Create: `apps/web/components/inkspace/ai-composer.tsx`
- Create: `apps/web/components/inkspace/ai-quick-actions.tsx`
- Create: `apps/web/components/inkspace/ai-assistant-panel.tsx`
- Test: `apps/web/components/inkspace/ai-assistant-panel.test.tsx`

**Interfaces:**
- 面板 props：`open`, `onClose`, `apiUrl`, `documentId`, `getDocumentText`, `userId`。
- SSE 客户端 `streamAiChat(request, signal, onEvent)` 使用 `fetch` + `ReadableStream`，按空行拆分事件并严格按 token 顺序拼接。
- 快捷问题固定为“总结文档”“提取待办”“生成文档大纲”；消息仅存组件生命周期。

- [ ] **Step 1: 写失败交互测试**：快捷/手动发送携带最新文本和消息；token 拼接；停止中止请求；完成/停止显示重新生成；错误保留问题并显示重试；关闭后清空；ARIA、Escape、Enter/Shift+Enter 行为正确。
- [ ] **Step 2: 运行 `pnpm --filter web test -- ai-assistant-panel.test.tsx`，确认失败。**
- [ ] **Step 3: 实现面板、消息列表、输入区和快捷操作；请求状态用 `idle | streaming | error`，失败时不把半截 assistant 消息写入历史；面板打开后 focus 输入框，动画使用 `prefers-reduced-motion`。**
- [ ] **Step 4: 运行 Web 单测和 `pnpm --filter web typecheck`。**

### Task 6: 接入 DocumentWorkspace 与 EditorToolbar 布局

**Files:**
- Modify: `apps/web/components/inkspace/document-workspace.tsx`
- Modify: `apps/web/components/inkspace/toolbar.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.test.tsx`
- Modify: `apps/web/components/inkspace/toolbar.test.tsx`

**Interfaces:**
- `DocumentWorkspace` 持有 `aiOpen`，通过 `renderToolbar` 内的 `EditorToolbar` 传递 `onAiToggle`/`aiOpen`，通过 provider 内部组件获得 `useEditorText` 的 `getDocumentText`。
- 布局为 `flex` 并排：编辑器 `min-w-0 flex-1`，面板 `w-[min(420px,100vw)]`；窄屏不得遮蔽编辑器且关闭恢复原宽度。

- [ ] **Step 1: 写失败测试**：点击带 `aria-label` 的 AI 按钮切换 `aria-expanded`；并排布局出现/消失；快捷操作读取最新编辑器快照；viewer 同样可见并可用；关闭重开会话为空。
- [ ] **Step 2: 运行相关 Web 测试，确认失败。**
- [ ] **Step 3: 将工具栏按钮仅作为打开触发器，新增 `AiAssistantPanel` 及编辑器快照桥接组件；Escape 关闭并清理状态。**
- [ ] **Step 4: 运行 `pnpm --filter web test -- document-workspace.test.tsx toolbar.test.tsx ai-assistant-panel.test.tsx`、typecheck、lint 和 Prettier。**

### Task 7: 端到端契约验证与文档收尾

**Files:**
- Create/Modify: `apps/api/src/ai/ai.integration.spec.ts`（若现有集成 harness 可复用则扩展）
- Modify: `apps/api/.env.example`, `apps/web/.env.example`（仅补充必要 API 说明）
- Modify: `README.md`（运行 AI 所需环境变量和 SSE 行为）

- [ ] **Step 1: 增加集成测试**：真实 Nest 测试模块验证认证、owner/editor/viewer 权限路径、SSE headers/events、断开请求停止流；LangChain 模型用 deterministic mock，禁止网络调用。
- [ ] **Step 2: 运行 `pnpm --filter api test:integration -- ai.integration.spec.ts`，修复契约差异。**
- [ ] **Step 3: 运行全仓验证：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`；必要时按包单独重跑失败命令。**
- [ ] **Step 4: 检查规格逐项覆盖：权限、限制、错误文案、停止/重试、可访问性、窄屏和不在范围项；运行 `pnpm exec prettier --check` 覆盖所有修改文件。**

## Self-review checklist

- 权限由 `DocumentsService.assertCanRead` 统一执行，未复制规则。
- Agent 无工具、无跨文档/联网能力，系统提示词覆盖五条约束。
- SSE token/done/error、AbortController、服务端 close 监听和半截回答语义均有任务与测试。
- 面板生命周期清空会话，快捷操作与自由提问共享同一请求状态机。
- 文档文本/消息限制、模型缺失/供应商错误和信息不足提示均有明确实现位置。
- 没有引入文档修改、持久化会话、检索、计费或后台 Agent；Next.js 文档核对和格式化列入执行约束。

Plan complete and saved to `docs/superpowers/plans/2026-08-14-ai-assistant.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review checkpoints。
2. **Inline Execution** — use executing-plans in this session with batch checkpoints。

请选择执行方式后再开始实施。
