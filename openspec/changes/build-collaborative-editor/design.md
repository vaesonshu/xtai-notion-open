## Context

当前 `@workspace/editor` 仅包含基础 Tiptap 扩展和 React Provider，页面仍显示静态文档。仓库使用 pnpm workspace、Turbo、React 19 和 Next.js 16；尚未存在后端应用、数据库模型或工作区图标包。动机和能力范围见 [proposal.md](proposal.md) 及各 capability spec。

## Goals / Non-Goals

**Goals:**

- 建立不依赖页面的 Tiptap 编辑器核心与可组合 UI。
- 在单个 NestJS 服务中提供受授权的 Yjs 同步和 PostgreSQL 恢复。
- 在 Web、编辑器和基础 UI 包之间建立稳定边界。
- 使首次协作同步不会被本地演示文档覆盖。

**Non-Goals:**

- 不实现正式登录、跨实例广播、表格、附件、评论、版本浏览或全文搜索。
- 不将协作文档正文经 REST API 保存。
- 不重写现有通用 `@workspace/ui` 组件。

## Decisions

### 编辑器按 core、collaboration、react、components 分层

`packages/editor/core` 保存 schema、扩展和命令；`collaboration` 负责 Y.Doc/Provider 生命周期；`react` 提供上下文与 hooks；`components` 组合 `@workspace/ui` 交互控件。

这样核心和协作连接可以在没有 React 的情况下测试，而页面只负责提供文档标识、身份和端点。单个单体编辑器组件会使网络状态、Tiptap 事务和 UI 弹层相互耦合，因此不采用。

### 使用 Tiptap Collaboration、Yjs 和由 NestJS 托管的 Hocuspocus

客户端使用 `Y.Doc`、Hocuspocus Provider 和 Tiptap 的 Collaboration/CollaborationCaret 扩展。协作模式下禁用 StarterKit 的 history，由 Yjs 处理共享撤销历史。`apps/api` 在 NestJS 生命周期中启动并关闭 Hocuspocus，REST 控制器和协作连接共用身份和成员授权服务。

Hocuspocus 已实现同步和 awareness 协议，避免在 NestJS Gateway 上自行实现兼容协议。独立 Hocuspocus 进程会增加部署单元；原生 NestJS WebSocket 实现则有错误处理和协议兼容风险，因此两者均不采用。

### 文档使用快照加有序更新日志恢复

每份文档保存一个或多个二进制 Yjs 快照和按 sequence 排序的二进制更新。加载房间时恢复最新快照后应用较新的更新；写入先进入按 documentId 分组的短时间窗口缓冲区，再用单个数据库事务插入更新。达到更新数量或时间阈值时生成快照并删除已覆盖更新。

仅保存整篇 JSON 会丢失 CRDT 合并语义；每次击键保存完整快照会造成不必要的数据库负载，因此不采用。

### 以开发身份保留授权边界

第一阶段从 `x-dev-user-id` 解析身份，但 REST 和协作连接均调用相同成员授权服务。角色为 `owner`、`editor` 和 `viewer`；viewer 建立只读编辑器，服务端拒绝其写入。

匿名房间按 documentId 加入会泄露内容且无法迁移到正式认证，因此不采用。身份读取实现被隔离为 NestJS guard/interface，以便替换成正式认证。

### 新增统一图标包

新增 `@workspace/icons` 作为 Lucide 图标和图标类型的唯一出口。`packages/editor` 和 `apps/web` 仅从该工作区包导入图标；所有按钮、菜单、浮层和提示使用 `@workspace/ui`。

直接导入第三方图标库会扩大迁移面并绕开工作区依赖边界，因此不采用。

### 初始同步完成后创建 Tiptap

编辑器入口先创建 `Y.Doc` 和 Provider，订阅同步事件。首次完成远端同步后创建绑定同一 fragment 的 Tiptap 编辑器。客户端仅在新建空文档且服务端未返回状态时写入模板内容。

在 Provider 连接前以默认 JSON 初始化 Tiptap 会把本地演示内容同步到已有文档，因此不采用。

## Risks / Trade-offs

- [单实例协作服务无法跨进程广播] → 首期部署限制为一个协作实例；扩容前增加 Redis 广播适配器。
- [Yjs 二进制状态不可直接人工查询] → 文档元数据独立保存；后续搜索功能从快照派生索引。
- [持久化批量窗口可能在进程崩溃时损失短暂未落库更新] → 设置受限窗口，关闭钩子刷新缓冲区，并使客户端只在持久化确认后显示已同步。
- [开发身份不能用于生产] → 将身份解析限制在 guard，部署配置明确禁止生产开发身份。
- [块拖拽与复杂嵌套列表存在交互边界] → 第一阶段仅移动兼容顶层块，嵌套块维持现有层级。

## Migration Plan

1. 固定现有编辑器依赖版本并安装新增 workspace 与服务端依赖。
2. 增加 `packages/icons`、扩展 `packages/editor`，随后将 Web 静态画布换成编辑器入口。
3. 新建 `apps/api`、数据库迁移和协作服务；在本地环境迁移 PostgreSQL schema。
4. 用开发身份创建种子 workspace、document 和成员，验证两个浏览器会话同步和服务重启恢复。
5. 部署时先运行数据库迁移，再启动单个 API 协作实例，最后配置 Web 端点。

回滚时将 Web 页面切回静态画布并停止协作连接；保留数据库表和二进制状态，不删除已写入的协作文档数据。
