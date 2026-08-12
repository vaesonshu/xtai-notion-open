# 文档分享链接设计

## 目标

让文档所有者点击“分享”后生成可复制链接。访问者打开链接并登录后，系统将其加入该文档，默认授予 `editor` 权限，并跳转到文档页面参与实时协同编辑。

## 架构与数据流

1. 工具栏调用 `POST /documents/:documentId/share-link`。
2. API 校验当前用户是文档成员且具备可写权限；首次调用生成随机 token，后续复用有效 token。
3. 前端展示同源 URL `/share/<token>`，支持复制并显示成功/失败状态。
4. `/share/[token]` 页面请求 `POST /share/:token/accept`：
   - 未登录时跳转 `/login?returnTo=<分享地址>`；
   - 已登录时校验 token，将用户以 `editor` 写入或更新 `document_member`；
   - 成功后跳转 `/documents/<documentId>`。
5. 文档页面继续使用现有成员权限 API 和 WebSocket 协作鉴权，不复制权限逻辑。

## 数据模型

新增 `document_share_link` 表：

- `token`：随机不可预测字符串，主键；
- `document_id`：关联文档，级联删除；
- `created_by`：创建者用户 ID；
- `created_at`：创建时间；
- `revoked_at`：预留撤销能力，第一版保持为空。

每个文档只保留一个未撤销 token。接受链接使用事务和唯一约束，避免重复成员记录；已有 `owner`/`editor` 权限不降级，`viewer` 可升级为 `editor`。

## 错误处理与安全

- token 使用密码学安全随机源生成，只返回 token，不返回内部成员数据。
- 无效、已撤销或不存在的 token 返回 404；未登录接受请求返回 401，由前端转登录页。
- 仅文档所有者/编辑者可生成链接；查看者不能分享。
- 分享链接仅允许站内相对路径，避免开放重定向。

## 测试范围

- API：生成/复用 token、权限校验、接受链接、重复接受、无效 token。
- Web：分享按钮调用 API 并展示可复制链接；未登录分享页保留 `returnTo`；登录后接受并跳转文档。
- 现有文档权限和协同连接测试必须继续通过。
