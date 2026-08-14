# AI 辅助协作首期设计

**日期：** 2026-08-14  
**状态：** 已获用户确认，待用户审阅文档后进入实施计划

## 目标

为当前文档工作区增加一个只读 AI 协作助手。用户点击顶部 AI 按钮后，右侧展开固定宽度的 AI 面板；Agent 基于当前文档最新全文和当前会话消息，通过流式响应提供总结、待办提取、大纲生成和自由问答。

## 已确认范围

- 首期只提供当前文档只读问答，不直接修改文档。
- AI 默认读取当前文档全文。
- 前端每次提问时从编辑器实例读取最新快照，并转换为纯文本发送给 API。
- 面板内支持多轮会话；会话仅保存在当前面板生命周期内，关闭后清空。
- 后端使用 LangChain 生态搭建 Agent。
- 模型使用 OpenAI 兼容接口，通过环境变量配置：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。
- 后端使用 SSE 流式返回 Agent 输出。
- 复用现有文档成员读取权限：`owner`、`editor`、`viewer` 均可使用 AI；非成员不可调用。
- 面板采用固定右侧抽屉，展开后编辑器区域自适应变窄，宽度约 360–420px。
- 空状态提供“总结文档”“提取待办”“生成文档大纲”等快捷操作，并保留自由提问输入框。
- 流式生成期间支持“停止生成”，完成或停止后支持“重新生成”。
- Agent 首期不访问其他文档、外部网络、数据库工具或其他外部工具。
- 模型未配置或服务不可用时，面板保持可见并显示明确错误与重试入口。

## 架构

项目已有 Next.js 16/React 19 Web 应用、NestJS API、Tiptap/Yjs 编辑器以及文档成员权限服务。新增能力沿用现有边界：前端负责编辑器快照和临时会话状态，API 负责身份、文档读取权限、输入约束和 LangChain 流式调用。

```text
EditorToolbar
  └─ AI 按钮
      └─ DocumentWorkspace 布局状态
          ├─ DocumentEditor
          │   └─ editor.getJSON() → 纯文本文档快照
          └─ AiAssistantPanel
              └─ POST /ai/chat → SSE

NestJS API
  └─ AiModule
      ├─ AiController：身份校验、请求解析、SSE 响应
      ├─ AiService：文档权限、限制、错误转换、流式协调
      └─ AiAgent：LangChain Agent 与 OpenAI 兼容模型
```

### 后端模块边界

建议创建以下文件：

- `apps/api/src/ai/ai.module.ts`：注册 AI 控制器和服务，并导入 `DocumentsModule` 与认证模块。
- `apps/api/src/ai/ai.controller.ts`：暴露 `POST /ai/chat`，设置 SSE 响应并处理请求中止。
- `apps/api/src/ai/ai.service.ts`：校验可读权限、限制请求规模、创建 Agent、统一模型错误。
- `apps/api/src/ai/ai.agent.ts`：读取模型环境配置，构造无外部工具的 LangChain Agent，并提供 token 流。
- `apps/api/src/ai/ai.types.ts`：定义消息、请求和 SSE 事件契约。
- 对应单元测试文件：覆盖权限、参数校验、模型错误和事件转换。

`DocumentsService` 需要通过现有导出能力提供 `assertCanRead(documentId, userId)`，不复制文档权限规则。AI 模块只能依赖该公开服务接口，不能绕过文档成员校验。

### 前端组件边界

建议创建以下文件：

- `apps/web/components/inkspace/ai-assistant-panel.tsx`：面板布局、打开状态和当前会话协调。
- `apps/web/components/inkspace/ai-message-list.tsx`：用户消息、助手消息、流式状态、错误状态。
- `apps/web/components/inkspace/ai-composer.tsx`：输入框、发送、停止和重新生成。
- `apps/web/components/inkspace/ai-quick-actions.tsx`：预置问题按钮。
- `apps/web/components/inkspace/ai-assistant-panel.test.tsx`：面板交互和流式行为测试。

`DocumentWorkspace` 持有 AI 面板与编辑器的并排布局状态，并将当前编辑器实例的读取能力通过现有编辑器 hook 或受控回调提供给面板。不要把 AI 网络请求逻辑塞入工具栏；工具栏只负责触发面板打开。

## 数据流与接口

### 请求契约

```ts
type AiChatMessage = {
  role: "user" | "assistant"
  content: string
}

type AiChatRequest = {
  documentId: string
  documentText: string
  messages: AiChatMessage[]
}
```

每次请求都发送当前最新 `documentText` 和当前面板的 `messages`。后端不保存会话，也不信任前端提交的权限身份；用户身份从现有认证机制解析，`documentId` 通过服务端成员权限校验。

### SSE 事件

响应使用 `Content-Type: text/event-stream`，事件契约如下：

```text
event: token
data: {"content":"这是"}

event: token
data: {"content":"一份"}
event: done
data: {}
```

错误统一转换为不泄露供应商密钥、请求细节或内部堆栈的事件：

```text
event: error
data: {"message":"AI 服务暂不可用"}
```

前端以 `AbortController` 取消请求；后端监听客户端断开，停止继续消费 Agent 流并避免向已关闭响应写入数据。

## Agent 约束

系统提示词必须明确：

1. 只能使用当前文档全文和当前会话消息。
2. 不得声称访问了其他文档、数据库或外部网络。
3. 无法从当前内容得出结论时，明确说明信息不足。
4. 不执行文档修改、删除、发布或其他外部操作。
5. 面向普通用户使用简洁、清晰的中文回答。

首期 Agent 不注册工具调用。未来扩展其他文档检索或写入编辑器时，需要新增独立权限和用户确认设计，不在本次范围内。

## 前端交互与可访问性

- 顶部 AI 按钮提供明确的 `aria-label`，并用 `aria-expanded` 表示面板状态。
- 面板打开后将焦点放到输入框，Escape 关闭面板。
- 输入框支持 Enter 发送，必要时用 Shift+Enter 换行。
- 发送期间禁用重复提交，显示“停止生成”。
- 完成或停止后在最近一条助手消息下显示“重新生成”。重新生成沿用上一条用户问题，并重新读取最新文档快照。
- 关闭面板后清空消息和错误状态；再次打开回到快捷操作空状态。
- 过渡动画尊重 `prefers-reduced-motion`。
- 面板在窄屏下应保持可用，避免固定宽度导致编辑器内容不可访问。

## 错误处理与输入限制

- 未登录或不是文档成员：使用现有认证/权限错误，不返回文档内容。
- 文档文本、消息数量和单条消息长度设置明确上限；超限在 API 层拒绝，并由前端显示可理解的提示。
- 缺少模型环境变量：返回“AI 服务未配置”。
- 模型连接失败、超时或供应商错误：统一返回“AI 服务暂不可用”，不暴露密钥和底层堆栈。
- 流式过程中出错：保留已经收到的内容，并显示重试入口。
- 用户取消：保留已生成内容，但不把半截助手回答作为新的会话上下文提交。
- 用户问题在失败后仍保留，方便重试。

## 测试计划

### API

- 文档非成员调用 `/ai/chat` 被拒绝。
- `owner`、`editor`、`viewer` 调用均可通过读取权限检查。
- 缺失 `documentId`、空文档文本、非法消息角色和超限输入被拒绝。
- 模型环境变量缺失时返回稳定的配置错误。
- Agent token、完成和错误事件转换为正确 SSE 格式。
- 客户端断开后停止消费流，不继续写入响应。
- 供应商错误不会泄露密钥、堆栈或内部请求细节。

### Web

- 点击顶部 AI 按钮打开/关闭右侧面板。
- 面板打开时编辑器和面板形成并排布局，关闭后恢复编辑器宽度。
- 快捷操作读取当前编辑器最新快照并发起请求。
- 手动提问发送正确的文档文本和当前会话消息。
- SSE token 按顺序拼接为助手回答。
- 停止按钮中止请求；重新生成沿用上一条用户问题。
- API 错误、配置错误和重试入口可见。
- 关闭后重开面板，会话已清空。
- AI 按钮、面板和输入框满足关键键盘与 ARIA 行为。

## 不在本次范围

- 直接修改、插入或删除编辑器内容。
- 对话数据库持久化。
- 其他文档检索、跨文档引用和知识库检索。
- 联网搜索、网页抓取和来源引用。
- LangChain 工具调用、任务编排和后台异步 Agent。
- 配额计费、模型管理后台和管理员配置页面。

## 自检结论

- 范围聚焦于一个可独立验收的只读问答功能。
- 前端、API、Agent 和权限边界相互匹配，没有要求后端读取 Yjs/Hocuspocus 存储。
- SSE、停止生成和客户端断开处理已纳入接口与测试要求。
- viewer 可读取文档，因此允许调用 AI；写权限不会被错误要求。
- 模型未配置时面板仍可用并显示错误，符合已确认的降级行为。
- 没有遗留 TBD、TODO 或未决技术选项。
