# 文档动态路由设计

## 目标

每篇文档使用稳定且可分享的 URL：`/documents/<documentId>`。用户创建文档后自动进入该 URL；浏览器刷新、前进后退或直接打开链接时，页面恢复对应文档。

## 路由结构

- 新增 `apps/web/app/documents/[documentId]/page.tsx` App Router 动态页面。
- 页面从动态路由参数读取 `documentId`，并将它传给现有 `WorkspaceShell`。
- `/` 保留作为演示文档入口，继续传入 `DEMO_DOCUMENT_ID`，不改变现有首次访问行为。

## 创建后的导航

- `WorkspaceShell` 不再维护当前 `documentId` 的本地 state；当前 ID 由其页面路由决定。
- 创建请求 `POST /documents` 成功并获得有效 `id` 后，使用 Next.js `useRouter().push(`/documents/${document.id}`)` 导航。
- 导航前仍展示创建中状态并禁用按钮；请求失败则保留当前页面与现有错误提示。
- 动态页面的重新渲染会为新的 `documentId` 建立 `DocumentWorkspace`，由其已有的 metadata 加载与协作编辑流程打开新文档。

## 错误与边界

- 空或无效的创建响应不导航，继续显示“新建文档响应无效”。
- 无权访问或不存在的 URL 继续由 `DocumentWorkspace` 的 metadata 请求显示加载错误，不回退到 demo 文档。
- 该变更不涉及文档列表、标题、删除功能或 API 合约调整。

## 测试

- `WorkspaceShell`：创建成功时调用 Next router 并跳转至 `/documents/new-document`，而非仅更新本地 state。
- 动态页面：路由参数 `documentId` 传给 `WorkspaceShell`。
- 既有创建失败用例继续验证不会导航并恢复按钮可用状态。
