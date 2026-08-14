# 文档发布审批设计

**日期：** 2026-08-14  
**状态：** 已获用户确认，待用户审阅文档后进入实施计划

## 目标

为文档工作区增加发布审批流程：`owner`/`editor` 可提交文章审批，管理员审核通过后文章进入公开 `/square` 广场；审核拒绝后回到草稿并可继续编辑。

## 状态流转

```text
草稿 --owner/editor 提交--> 待审批 --admin 通过--> 已发布 --公开查询--> /square
                              |
                              +--admin 拒绝--> 草稿（可继续编辑）
```

- 新建文档默认 `draft`。
- `viewer` 可以阅读，但不能提交发布。
- `owner` 和 `editor` 可以提交 `draft -> pending`。
- `pending` 期间发布按钮显示为禁用的“待审批”，避免重复提交。
- 管理员只能审批 `pending` 文档；通过进入 `published`，拒绝进入 `draft`。
- 拒绝原因保存并显示在后台，供作者继续修改。
- 已发布文档再次编辑时仍保持已发布内容可见；重新提交需由产品规则另行定义，本期不自动撤回已发布内容。

## 数据模型

扩展现有 `document`：

- `publication_status`：`draft | pending | published`，默认 `draft`。
- `rejection_reason`：可空文本，管理员拒绝时写入，重新提交时清空。
- `published_at`：可空时间，审批通过时写入。
- `published_by`：可空用户 ID，记录审批管理员。

扩展现有 `app_user`：

- `role`：`user | admin`，默认 `user`。
- 现有用户默认普通用户；管理员由迁移/开发环境种子明确指定，不通过客户端字段判断。

状态更新必须在服务端完成，并使用事务保证状态条件检查和写入一致。审批接口必须拒绝过期状态，例如不能审批已经被其他管理员处理的文档。

## API 与权限

沿用现有 `x-dev-user-id` 开发身份和认证服务，生产环境使用现有会话身份解析。

- `POST /documents/:documentId/submit-publication`
  - owner/editor 可用。
  - 仅允许当前状态为 `draft`。
  - 返回更新后的文档发布状态。
- `GET /admin/publications?status=pending`
  - 仅 `admin` 可用。
  - 返回待审批文档的元数据和拒绝原因。
- `POST /admin/publications/:documentId/approve`
  - 仅 `admin` 可用。
  - 仅允许 `pending`，写入 `published`、`published_at`、`published_by`。
- `POST /admin/publications/:documentId/reject`
  - 仅 `admin` 可用。
  - 要求非空拒绝原因，仅允许 `pending`，写入 `draft` 和原因。
- `GET /square/articles`
  - 公开接口，仅返回 `published` 文档及标题、作者、发布时间和正文展示所需内容。
  - 不返回草稿、待审批或拒绝原因。

所有写接口复用 `DocumentsService` 的成员权限校验，不在控制器复制 owner/editor 规则；管理员校验集中在用户/认证服务。

## 前端交互

### 编辑器

- `EditorToolbar` 读取文档发布状态。
- `draft`：显示可点击“发布”，点击后提交审批并刷新状态。
- `pending`：显示禁用的“待审批”，不允许重复点击。
- `published`：显示“已发布”状态；本期不提供撤回。
- API 错误使用现有 Alert/Toast 体系展示，状态失败时恢复原按钮。
- viewer 不显示可提交发布的操作，或显示禁用状态并提供明确标签。

### 管理后台

- `/admin/articles` 增加“待审批”筛选。
- 待审批行显示“待审批”、提交时间和提交者。
- 管理员可点击“通过”或“拒绝”；拒绝打开 Dialog 输入原因。
- 操作成功后移除/更新该行，失败保留行并显示错误。
- 非管理员访问管理审批接口或页面时返回 403/无权限状态。

### 广场

- 新建 `/square` 页面，展示已发布文章列表。
- 页面只消费 `/square/articles`，不在前端自行过滤未发布数据。
- 文章卡片展示标题、作者、发布时间和摘要；点击进入公开文章详情或文章阅读状态。
- 空状态和加载/错误状态明确可见。

## 测试计划

### API/数据库

- 默认用户角色为 `user`，admin 能通过角色校验。
- owner/editor 可提交，viewer 和非成员被拒绝。
- 只能从 draft 提交；重复提交返回冲突。
- admin 只能审批 pending；approve 写入发布元数据。
- reject 要求原因并回到 draft；非 admin 被拒绝。
- 广场查询只返回 published 文档。
- 并发审批只有一个请求成功改变状态。

### Web

- 工具栏根据状态显示“发布”“待审批”“已发布”。
- viewer 不可点击发布；pending 按钮禁用。
- 后台待审批筛选、通过和拒绝 Dialog 行为正确。
- 广场只渲染接口返回的已发布文章，并覆盖空/错误状态。

## 不在本期范围

- 审批历史表、多人会签、撤回发布和定时发布。
- 已发布文章编辑后的版本审核策略。
- 角色管理后台；管理员角色通过迁移/种子或现有运维方式配置。
- 文章评论、点赞、搜索和推荐算法。

## 自检结论

- 角色、状态、API、编辑器、后台和广场边界互相对应。
- 服务端是唯一状态真源，公开广场不会暴露未审批内容。
- 拒绝原因和状态条件已明确，没有遗留 TBD 或未决行为。
