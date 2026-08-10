# 侧栏新建文档设计

## 目标

用户点击左侧“新建文档”后，系统创建一篇属于当前开发用户的新文档，并自动切换到该文档编辑器。首页仍以现有演示文档作为首次打开的文档。

## 后端

在 `documents` 模块新增 `POST /documents`：

- 从 `x-dev-user-id` 读取当前用户（沿用现有开发身份守卫）。
- 创建一个 workspace、document 和 owner 关系，避免当前数据库没有默认 workspace 时创建失败。
- 返回完整文档元数据：`id`、`workspaceId`、`title`、`role`、`createdAt`、`updatedAt`。
- 新文档默认标题为“未命名文档”，角色为 `owner`。

Repository 负责事务内插入并返回行数据；Service 负责转换为 API 元数据。

## 前端

- `page.tsx` 持有当前 `documentId` 状态，将其传给 `DocumentWorkspace`。
- `WorkspaceSidebar` 接收 `onCreateDocument` 回调；“新建文档”按钮可点击并在请求期间禁用，显示创建中状态。
- 创建请求调用 `POST /documents`，带 `x-dev-user-id`，成功后用返回的 ID 更新当前文档。
- `DocumentWorkspace` 的现有 metadata fetch 会因 ID 变化重新执行，并重建协作编辑器。
- 创建失败时在侧栏展示可读错误；加载已有文档失败时继续展示编辑器区域的错误信息，并将 `Failed to fetch` 转换为“无法连接到文档服务，请确认 API 已启动”。

## 测试

- Controller：验证 POST 将当前用户传给 Service 并返回元数据。
- Service：验证创建委托 repository 并返回 owner 元数据。
- Web：验证点击“新建文档”发起请求、切换 document ID，并在失败时显示错误。

## 不在范围内

- 文档列表持久化和实时刷新。
- 自定义标题输入、删除文档、工作区选择。
- 生产身份认证替换开发身份守卫。
