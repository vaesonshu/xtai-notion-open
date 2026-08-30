# AI 写作写入编辑区（Yjs fork）设计

**日期：** 2026-08-30  
**状态：** 已实施（分支 `feature/block-docs-on-sdk`）  
**实施计划：** [`docs/superpowers/plans/2026-08-30-ai-write-in-editor-fork.md`](../plans/2026-08-30-ai-write-in-editor-fork.md)  
**前置：** [`2026-08-30-block-ai-writing-design.md`](./2026-08-30-block-ai-writing-design.md) 已落地（影子编辑器 + 底部草稿预览）。本文是在此之上的交互升级，不重做后端。

## 目标

AI 写作时把字直接写进用户正在看的编辑区，观感接近「协同者在打字」。写完后，提示条收成接受 / 拒绝。点接受之后，改动才进入共享 Y.Doc；点拒绝则正文回到会话开始时的共享文档。

参考 BlockNote `@blocknote/xl-ai` 的 yFork + `acceptChanges` / `rejectChanges`，用本仓库已有的 `BlockEditor`、`applyAiWriteOp` 和 Hocuspocus 协作实现，不引入 `@blocknote/xl-ai`。

## 非目标

- 不改 `POST /ai/write` 的请求/SSE 契约，不换模型栈。
- 不做 fork 与远端更新的三路合并。
- 不把 AI 光标 / awareness 广播给其他协作者。
- 不把接受后的整段 AI 写作压成一次本地 Ctrl+Z。
- 不恢复底部 `AiWriteDraft` 浮层预览；侧边栏 `/ai/chat` 行为不变。
- 不生成表格、图片、画板、分割线（沿用现有可写块类型）。

## 已确认的产品选择

| 项 | 选择 |
|----|------|
| 写入位置 | 真编辑器（fork 上的 `insertBlocks` / `updateBlock`），不是装饰层假块 |
| 协作可见性 | 接受前仅本机可见；接受后才 merge 进共享 Y.Doc |
| 草稿外观 | 正文样式 + 浅蓝背景与左侧色条；接受后去掉标记 |
| 审阅 UI | 提示条锚在最后一块 AI 块下方；`user-reviewing` 只留拒绝 / 接受 |
| 会话中用户编辑 | 只读，避免与 AI 抢同一棵树 |
| 远端并发 | shared 在会话中被他人更新则结束会话，不静默 merge |

## 架构

```text
Hocuspocus ── 始终绑定 ── shared Y.Doc
                              │
用户开写                      │  clone（encodeStateAsUpdate）
                              ▼
                         fork Y.Doc
                              │
                    可见 BlockEditor 改绑到 fork
                    （无 websocket provider）
                              │
                    SSE tool_call → applyAiWriteOp(fork 编辑器)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
         接受：merge 增量进 shared         拒绝：销毁 fork
              编辑器改绑回 shared+provider     编辑器改绑回 shared+provider
```

`createAiWritingSession` 不再以「影子 `BlockEditor` + 接受时重放 ops」为主路径。影子预览和页面底部草稿框删除。ops 仍记录（停止后审阅、空结果判断、草稿块 id），但正式内容以 fork 文档为准。

### 包边界

| 包 | 职责 |
|----|------|
| `editor-core` | `forkYDoc(shared)`、`mergeForkInto(shared, fork)`；草稿块 id 集合；现有 `applyAiWriteOp` 不变 |
| `editor-react` | 协作 provider **保持** shared 会话不销毁；提供「用另一份 Y.Doc 重建可见 `BlockEditor`」的能力（fork 不带 provider，shared 带 provider） |
| `editor-shadcn` | 去掉 `AiWriteDraft` 浮层；提示条改为锚在块下方；块容器草稿 class |
| `apps/web` | `AiWritingHost`：建 fork、改绑编辑器、拉 SSE、接受/拒绝/停止、监听 shared 远端更新 |

`CollaborationEditorProvider` 创建的 Hocuspocus `provider` 与 `shared` 在整个 AI 会话期间保持连接，以便收到他人更新并判定 stale。

### 编辑器改绑（选定实现）

Tiptap `Collaboration` 在 `BlockEditor` 构造时绑定 `document`，第一期用 **重建可见编辑器**，不在运行中热替换 ydoc：

1. 开写：`new BlockEditor({ document: fork, applyInitialContent: false, editable: false, ...同一 schema / 上传 / 节点视图 })`，无 `provider`。把 context 里的 `blockEditor` 换成它，销毁上一份（仅销毁编辑器，不销毁 shared / provider）。
2. 接受或拒绝后：再 `new BlockEditor({ document: shared, provider, user, editable: true, applyInitialContent: false, ... })` 绑回协作。

重建时会丢本地选区，可接受。React 节点视图（图片、画板）必须从现有 provider 同样的 extension 选项传入，避免 fork 会话里块类型缺失。

### Merge 与丢弃

- **fork**：`const fork = new Y.Doc(); Y.applyUpdate(fork, Y.encodeStateAsUpdate(shared))`。
- **merge**：若会话期间 shared 无远端内容更新，则  
  `Y.applyUpdate(shared, Y.encodeStateAsUpdate(fork, Y.encodeStateVector(shared)))`。  
  只把 fork 相对 shared 的增量写进共享文档，不做整树 `fromJSON` 替换。
- **拒绝 / 卸载**：不调用 merge；`fork.destroy()`；可见编辑器绑回 shared。shared 从未被 AI 写入，正文即会话前状态。

slash 空段落：在 **fork 上**于 merge 前删除仍为空的 `emptyCursorBlockToDelete`（与现逻辑一致，只是作用对象从 live 换成 fork）。merge 后 shared 不再含该占位块。

## 数据流

1. 用户斜杠或选区打开 AI → 校验 `canWrite` 且 `collaborationStatus === "synced"` → 进入 `user-input`（此时尚未 fork，以免未提交就改绑）。
2. 用户提交 prompt → 立刻 fork 并改绑可见编辑器为只读 → `thinking` → `POST /ai/write`（`blocks` 仍从 **改绑前的 shared 快照** 序列化，与现请求体一致）。
3. 每条 `tool_call`：`applyAiWriteOp(forkEditor, op)`；记录 op 与触及的 block id；状态 `ai-writing`。
4. `done` 或用户停止且 `ops.length > 0` → `user-reviewing`。
5. 接受：空 ops 失败；shared 已 stale 则失败并 toast；否则 fork 上处理空段落、`mergeForkInto`、改绑 shared、清会话。merge 抛错则保持审阅与 fork，toast，允许再拒绝。
6. 拒绝 / 错误关闭 / 卸载：丢 fork，改绑 shared。

## UI

- 提示条不再 `fixed` 贴屏幕底部。用最后一次 AI 触及块的 DOM（`data-id` / blockContainer）定位，浮在该块下方；滚动时跟随或按现有 slash 菜单同样的 `getBoundingClientRect` 策略更新。
- `user-input`：输入框 + 现有 presets；提交后提示条留在锚点。
- `thinking` / `ai-writing`：加载文案 + 停止。
- `user-reviewing`：仅拒绝、接受。
- `error`：错误文案 + 关闭（= 拒绝）。
- 草稿样式：对会话 `touchedIds` 的 `blockContainer` 加 class（例如左侧 2px `#8bc6ff` + 浅底）。样式只存在于 fork 编辑器的 ProseMirror 插件 / 装饰，**不写进 Y.Doc 属性**，因此 merge 后不会把草稿标记同步给别人。
- 本机 AI 光标：fork 编辑器使用本地 CollaborationCaret（固定用户 `{ id: "ai-writer", name: "AI", color: "#8bc6ff" }`），不接入 Hocuspocus awareness。若 caret 扩展强依赖 `provider`，则退化为把选区移到最后插入位置，不做广播。
- 去掉 `AiWriteDraft` 组件的产品用途（测试不再断言底部草稿卡片）。

## 错误与边界

| 情况 | 行为 |
|------|------|
| viewer / 未 synced | 不建会话、不 fork |
| 已有进行中会话 | toast「请先接受或拒绝」 |
| SSE 失败（非停止） | `error`；已写在 fork 上的字仍可见；关闭 = 拒绝 |
| 用户停止且已有 op | `user-reviewing` |
| 零条合法 op | `error`「没有可应用的改动」 |
| shared `update` 且 origin 为远端 | toast「文档已变化」；丢 fork；绑回最新 shared |
| merge 失败 | toast；停留 `user-reviewing` |
| 切文档 / Host 卸载 | 拒绝，不 merge |

判定 stale：在 fork 存活期间监听 `shared.on("update", ...)`。忽略由即将执行的 `mergeForkInto` 自身产生的 update。会话开始时记录 `Y.encodeStateVector(shared)`，任何非 merge 的 shared 内容变更都视为 stale。

## 测试与验收

### 测试

- `editor-core`：fork 后对 fork apply op，shared 文档树不变；merge 后 shared 含增量；不 merge 则 shared 与 clone 前一致。
- `apps/web` session/host：斜杠空段落在 merge 前从 fork 删除；拒绝不调用 merge；接受后 shared 含新块；流式过程中可见编辑器文档增长（fork），且 mock provider 的 Y.Doc 在接受前无 AI 增量。
- `editor-shadcn`：审阅态渲染接受/拒绝；不再渲染 `data-testid="ai-write-draft"` 浮层。
- 不强制 Playwright、不打真模型。后端 `/ai/write` 不因本变更加测。

### 验收

1. 斜杠续写：生成过程中编辑区出现带草稿样式的新块；底部没有独立草稿卡片。
2. 写完后块附近出现接受 / 拒绝；接受后样式消失，协作者（另一客户端或检查 shared Y.Doc）能看到终稿。
3. 拒绝后本机正文与开写前一致，shared 无 AI 增量。
4. 选区润色改的是编辑区里的原块（fork 上的 update），不是另开预览框。
5. 会话中无法用键盘改正文；再开 AI 会提示先处理当前草稿。

## 实施顺序

1. core：`forkYDoc` / `mergeForkInto` 与单测  
2. 协作层：重建可见 `BlockEditor` 并切换 context，provider 不销毁  
3. 重写 `createAiWritingSession` 与 `AiWritingHost`（改绑、merge、stale、空段落）  
4. shadcn：锚点提示条、草稿 class、删除浮层草稿  
5. 更新 web/shadcn 测试与验收路径  
