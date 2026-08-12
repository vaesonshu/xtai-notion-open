# 编辑器图片上传与腾讯云 COS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为协作编辑器增加受文档权限保护的图片上传能力，浏览器通过 API 预签名 PUT URL 直传腾讯云 COS，并在上传成功后将公开图片 URL 写入 Tiptap/Yjs 文档。

**Architecture:** API 新增文档图片预签名端点，复用现有文档写权限校验并由服务端生成 `documents/{documentId}/{uuid}.{extension}` 对象 Key。Web 工作区提供上传适配器，编辑器包只依赖抽象上传函数；图片节点、工具栏选择、拖放和粘贴统一使用该适配器。上传中和失败状态保持在客户端，不写入 Yjs，只有成功后的公开 URL 作为图片节点同步给协作者。

**Tech Stack:** NestJS 11、Tiptap 3、Yjs、React 19、Next.js 16、腾讯云 COS Node.js SDK、Vitest、Testing Library。

## Global Constraints

- 仅允许 `image/jpeg`、`image/png`、`image/gif`、`image/webp`，单张大小上限为 10MB。
- 上传必须绑定 `documentId`，只有 owner/editor 可获取预签名 URL；viewer 和非成员返回 403。
- 浏览器只能获得一次性预签名 URL，不得获得 `COS_SECRET_ID` 或 `COS_SECRET_KEY`。
- 文档只保存最终公开图片 URL；上传中状态、Blob URL 和失败元数据不得写入 Yjs。
- 图片对象 Key 必须由服务端生成，格式为 `documents/{documentId}/{uuid}.{extension}`。
- 删除编辑器图片只移除文档节点，不调用 COS 删除接口。
- 上传入口必须覆盖工具栏文件选择、编辑区拖放和剪贴板粘贴。
- 上传失败必须支持使用原始 `File` 重试或删除本地预览。
- 修改的代码必须符合根目录 [`AGENTS.md`](AGENTS.md) 和 [` .prettierrc`](.prettierrc) 的格式约束：LF、无分号、双引号、两空格缩进、80 字符打印宽度和 Tailwind 类名插件排序。
- 在读取 Next.js 16 相关实现指南后再修改 Web 端 Next.js 代码，指南位于 `node_modules/next/dist/docs/`。

---

### Task 1: 建立 COS 配置与图片签名领域接口

**Files:**
- Create: [`apps/api/src/storage/cos.types.ts`](apps/api/src/storage/cos.types.ts)
- Create: [`apps/api/src/storage/cos.service.ts`](apps/api/src/storage/cos.service.ts)
- Create: [`apps/api/src/storage/cos.module.ts`](apps/api/src/storage/cos.module.ts)
- Create: [`apps/api/src/storage/cos.service.spec.ts`](apps/api/src/storage/cos.service.spec.ts)
- Modify: [`apps/api/package.json`](apps/api/package.json)
- Modify: [`apps/api/.env.example`](apps/api/.env.example)
- Modify: [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts)

**Interfaces:**
- Consumes: `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, `COS_REGION` 和 `COS_PUBLIC_BASE_URL`。
- Produces: `CosPresignRequest`、`CosPresignResult` 以及可注入的 `CosService.createPutPresign()`。

- [ ] **Step 1: 先确认腾讯云 SDK 的实际 API**

  在 `apps/api` 的依赖树中确认仓库没有现成 COS SDK；读取已安装 SDK 的类型定义和文档入口，确定 `getAuthorization` 或等价签名 API、请求 URL 格式和过期时间参数。不要在没有确认 SDK API 的情况下手写签名算法。

  运行：`pnpm --filter api list --depth 0`

  预期：确认当前未安装 COS 客户端 SDK；若已存在，复用已安装版本。

- [ ] **Step 2: 编写签名服务失败测试**

  在 [`cos.service.spec.ts`](apps/api/src/storage/cos.service.spec.ts) 中使用依赖注入的 COS 客户端 mock，覆盖以下行为：缺少任一环境变量时拒绝初始化；合法输入返回以 COS 域名为基础的签名 PUT URL；返回的公开 URL 由 `COS_PUBLIC_BASE_URL` 与服务端生成 Key 拼接；签名请求固定使用给定 `Content-Type`；日志和异常中不得包含密钥。

  测试输入应包含：

  ```ts
  const request = {
    objectKey: "documents/document-1/asset.png",
    contentType: "image/png",
  }
  ```

- [ ] **Step 3: 运行失败测试**

  运行：`pnpm --filter api test -- cos.service.spec.ts`

  预期：测试因 [`CosService`](apps/api/src/storage/cos.service.ts) 尚未实现而失败。

- [ ] **Step 4: 添加最小 COS SDK 依赖并实现服务**

  在 [`apps/api/package.json`](apps/api/package.json) 增加已确认的腾讯云 COS Node.js SDK。实现 [`CosService.createPutPresign()`](apps/api/src/storage/cos.service.ts) 接收：

  ```ts
  type CosPutPresignInput = {
    objectKey: string
    contentType: string
  }
  ```

  返回：

  ```ts
  type CosPutPresignResult = {
    uploadUrl: string
    publicUrl: string
    objectKey: string
    contentType: string
  }
  ```

  服务端固定签名 PUT 方法、固定 `Content-Type`、短有效期和对象 Key；使用 URL 安全拼接公开基础 URL；不得把密钥写入返回值或日志。

- [ ] **Step 5: 注册模块并补全环境示例**

  让 [`CosModule`](apps/api/src/storage/cos.module.ts) 导出 [`CosService`](apps/api/src/storage/cos.service.ts)，并在 [`AppModule`](apps/api/src/app.module.ts) 中导入。把五个 COS 环境变量加入 [`apps/api/.env.example`](apps/api/.env.example)，注明 `COS_PUBLIC_BASE_URL` 不带末尾斜杠。

- [ ] **Step 6: 运行服务单元测试和类型检查**

  运行：`pnpm --filter api test -- cos.service.spec.ts` 和 `pnpm --filter api typecheck`

  预期：签名服务测试通过，TypeScript 编译通过。

- [ ] **Step 7: 提交独立变更**

  ```text
  git add apps/api/package.json apps/api/.env.example apps/api/src/storage
  git commit -m "feat: add COS presign service"
  ```

---

### Task 2: 增加按文档权限校验的图片预签名 API

**Files:**
- Create: [`apps/api/src/images/image-upload.types.ts`](apps/api/src/images/image-upload.types.ts)
- Create: [`apps/api/src/images/image-upload.service.ts`](apps/api/src/images/image-upload.service.ts)
- Create: [`apps/api/src/images/image-upload.controller.ts`](apps/api/src/images/image-upload.controller.ts)
- Create: [`apps/api/src/images/image-upload.module.ts`](apps/api/src/images/image-upload.module.ts)
- Create: [`apps/api/src/images/image-upload.service.spec.ts`](apps/api/src/images/image-upload.service.spec.ts)
- Create: [`apps/api/src/images/image-upload.authorization.integration.spec.ts`](apps/api/src/images/image-upload.authorization.integration.spec.ts)
- Modify: [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts)

**Interfaces:**
- Consumes: [`DocumentsService.assertCanWrite()`](apps/api/src/documents/documents.service.ts:35) 和 [`CosService.createPutPresign()`](apps/api/src/storage/cos.service.ts)。
- Produces: `POST /documents/:documentId/images/presign`，请求体 `{ contentType: string; size: number }`，响应 `{ uploadUrl; publicUrl; objectKey; contentType }`。

- [ ] **Step 1: 编写图片元数据校验失败测试**

  在 [`image-upload.service.spec.ts`](apps/api/src/images/image-upload.service.spec.ts) 中先写测试：合法 JPEG/PNG/GIF/WebP 且 `size <= 10 * 1024 * 1024` 才调用 COS 服务；未知 MIME 返回 400；`size > 10 * 1024 * 1024` 返回 413；负数、非有限值和缺失字段返回 400；对象 Key 不接受客户端传入内容，并始终包含目标 `documentId`。

- [ ] **Step 2: 运行失败测试**

  运行：`pnpm --filter api test -- image-upload.service.spec.ts`

  预期：测试因图片上传服务尚未实现而失败。

- [ ] **Step 3: 实现服务端输入类型和业务服务**

  在 [`image-upload.types.ts`](apps/api/src/images/image-upload.types.ts) 定义：

  ```ts
  type PresignImageRequest = {
    contentType: string
    size: number
  }

  type PresignImageResponse = {
    uploadUrl: string
    publicUrl: string
    objectKey: string
    contentType: string
  }
  ```

  实现 [`ImageUploadService.createPresign()`](apps/api/src/images/image-upload.service.ts)：先调用 [`DocumentsService.assertCanWrite()`](apps/api/src/documents/documents.service.ts:35)，再校验 MIME 和大小，最后用随机 UUID 和 MIME 到扩展名的服务端映射生成 `documents/${documentId}/${uuid}.${extension}`，调用 [`CosService.createPutPresign()`](apps/api/src/storage/cos.service.ts)。不要从请求体读取对象 Key、扩展名或公开 URL。

- [ ] **Step 4: 增加 controller 和模块**

  在 [`image-upload.controller.ts`](apps/api/src/images/image-upload.controller.ts) 添加带 [`DevelopmentIdentityGuard`](apps/api/src/auth/development-identity.guard.ts) 的 controller，路径为 `documents/:documentId/images`，方法为 `POST /presign`，从 [`CurrentUser`](apps/api/src/auth/current-user.decorator.ts) 取得用户 ID。让 [`ImageUploadModule`](apps/api/src/images/image-upload.module.ts) 注入 [`DocumentsModule`](apps/api/src/documents/documents.module.ts) 和 [`CosModule`](apps/api/src/storage/cos.module.ts)，并在 [`AppModule`](apps/api/src/app.module.ts) 注册。

- [ ] **Step 5: 写 HTTP 授权集成测试**

  在 [`image-upload.authorization.integration.spec.ts`](apps/api/src/images/image-upload.authorization.integration.spec.ts) 仿照现有文档授权集成测试创建 owner/editor/viewer/outsider 成员：owner/editor 返回 200，viewer/outsider 返回 403；未知文档返回不泄露成员信息的错误；格式错误返回 400；超限返回 413。mock 或替换 COS 服务，避免集成测试真实上传腾讯云。

- [ ] **Step 6: 运行 API 测试和类型检查**

  运行：`pnpm --filter api test -- image-upload.service.spec.ts image-upload.authorization.integration.spec.ts` 和 `pnpm --filter api typecheck`

  预期：业务与授权测试通过，类型检查通过。

- [ ] **Step 7: 提交 API 变更**

  ```text
  git add apps/api/src/app.module.ts apps/api/src/images
  git commit -m "feat: add document image presign endpoint"
  ```

---

### Task 3: 为编辑器注册图片节点并定义上传抽象

**Files:**
- Create: [`packages/editor/src/core/image-upload.ts`](packages/editor/src/core/image-upload.ts)
- Create: [`packages/editor/src/core/image-upload.test.ts`](packages/editor/src/core/image-upload.test.ts)
- Modify: [`packages/editor/src/core/types.ts`](packages/editor/src/core/types.ts)
- Modify: [`packages/editor/src/core/extensions.ts`](packages/editor/src/core/extensions.ts)
- Modify: [`packages/editor/package.json`](packages/editor/package.json)
- Modify: [`packages/editor/src/index.ts`](packages/editor/src/index.ts)
- Modify: [`packages/editor/src/core/index.ts`](packages/editor/src/core/index.ts)

**Interfaces:**
- Consumes: `File`，抽象上传函数和当前 Tiptap editor 实例。
- Produces: `ImageUploadConfig`、`ImageUploadResult`、格式/大小校验工具和带 Image 扩展的 [`createEditorExtensions()`](packages/editor/src/core/extensions.ts:15)。

- [ ] **Step 1: 编写核心校验和上传合同测试**

  在 [`image-upload.test.ts`](packages/editor/src/core/image-upload.test.ts) 测试：支持四种 MIME；拒绝其他类型；拒绝超过 `10 * 1024 * 1024` 字节；合法文件调用抽象上传函数一次；上传返回 `publicUrl` 后结果可用于插入 Image 节点；上传函数拒绝时保留原始错误状态，不产生最终图片节点。

- [ ] **Step 2: 运行失败测试**

  运行：`pnpm --filter @workspace/editor test -- image-upload.test.ts`

  预期：测试因图片上传抽象尚未实现而失败。

- [ ] **Step 3: 添加 Tiptap Image 依赖并注册扩展**

  在 [`packages/editor/package.json`](packages/editor/package.json) 增加与当前 Tiptap 版本一致的 `@tiptap/extension-image`。在 [`extensions.ts`](packages/editor/src/core/extensions.ts) 引入并加入 Image 扩展，配置 `inline: false`、`allowBase64: false`，保持已有 Dropcursor 和协作扩展配置不变。

- [ ] **Step 4: 定义上传抽象和共享校验**

  在 [`image-upload.ts`](packages/editor/src/core/image-upload.ts) 定义：

  ```ts
  const IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ] as const

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024

  type ImageUploadResult = {
    publicUrl: string
    contentType: string
  }

  type ImageUploadHandler = (
    file: File,
    signal?: AbortSignal
  ) => Promise<ImageUploadResult>
  ```

  提供纯函数 `validateImageFile(file)`，返回稳定的错误码/用户文案；所有入口使用同一函数。提供插入最终图片节点的最小辅助函数，必须使用 `publicUrl`，不得使用签名 `uploadUrl`。

- [ ] **Step 5: 更新导出并运行编辑器测试**

  从 [`packages/editor/src/index.ts`](packages/editor/src/index.ts) 和 [`packages/editor/src/core/index.ts`](packages/editor/src/core/index.ts) 导出上述类型和函数。运行：`pnpm --filter @workspace/editor test -- image-upload.test.ts extensions.test.ts` 和 `pnpm --filter @workspace/editor typecheck`。

  预期：图片扩展名称存在，既有扩展测试不回归，类型检查通过。

- [ ] **Step 6: 提交编辑器核心变更**

  ```text
  git add packages/editor/package.json packages/editor/src/core packages/editor/src/index.ts
  git commit -m "feat: add editor image extension and upload contract"
  ```

---

### Task 4: 实现编辑器本地上传预览与三种入口

**Files:**
- Create: [`packages/editor/src/components/image-upload.tsx`](packages/editor/src/components/image-upload.tsx)
- Create: [`packages/editor/src/components/image-upload.test.tsx`](packages/editor/src/components/image-upload.test.tsx)
- Modify: [`packages/editor/src/components/editor-surface.tsx`](packages/editor/src/components/editor-surface.tsx)
- Modify: [`packages/editor/src/components/document-editor.tsx`](packages/editor/src/components/document-editor.tsx)
- Modify: [`packages/editor/src/components/index.ts`](packages/editor/src/components/index.ts)
- Modify: [`packages/editor/src/styles/editor.css`](packages/editor/src/styles/editor.css)

**Interfaces:**
- Consumes: [`ImageUploadHandler`](packages/editor/src/core/image-upload.ts)、Tiptap editor context、`editable` 状态和可选 `renderToolbar`。
- Produces: 编辑器中的文件选择按钮、drop/paste 处理器、本地上传预览状态和成功后的协作图片节点。

- [ ] **Step 1: 编写失败的交互测试**

  在 [`image-upload.test.tsx`](packages/editor/src/components/image-upload.test.tsx) 建立真实 [`EditorProvider`](packages/editor/src/react/editor-provider.tsx) 测试：

  - 文件选择调用 handler，并在 handler pending 时显示图片缩略图、文件名和上传中状态。
  - drop 和 paste 只提取图片文件，阻止默认行为；文本文件不会触发 handler。
  - handler 成功后 JSON 包含 `image` 节点和公开 URL。
  - handler 失败后显示重试和删除按钮；重试继续使用同一个 `File`；删除移除本地预览且不产生 image 节点。
  - pending 期间 editor JSON 不包含临时 Blob URL 或 image 节点。
  - `editable=false` 时不渲染上传入口，也不处理上传事件。

- [ ] **Step 2: 运行失败测试**

  运行：`pnpm --filter @workspace/editor test -- image-upload.test.tsx`

  预期：测试因 [`ImageUpload`](packages/editor/src/components/image-upload.tsx) 尚未实现而失败。

- [ ] **Step 3: 定义本地预览状态模型**

  在 [`image-upload.tsx`](packages/editor/src/components/image-upload.tsx) 使用 React state 保存每个本地任务：原始 `File`、`URL.createObjectURL(file)` 生成的预览 URL、上传状态、错误文案和锚点信息。组件卸载、删除或完成替换时调用 `URL.revokeObjectURL()`，避免 Blob URL 泄漏。

- [ ] **Step 4: 实现统一上传协调器**

  为每个文件创建一个本地预览任务，调用 `validateImageFile()`，记录插入时的 editor selection，并调用 `ImageUploadHandler(file, signal)`。成功时通过事务在仍有效的位置插入 `{ type: "image", attrs: { src: publicUrl } }`；失败时只更新本地任务为 error。重试重新调用 handler，不复用过期签名 URL；删除只清理本地任务。

- [ ] **Step 5: 接入 input、drop 和 paste**

  添加隐藏的 `input[type=file]`，使用 `accept="image/jpeg,image/png,image/gif,image/webp"`；按钮点击触发 input；监听编辑器根节点的 `drop` 和 `paste`，提取 `DataTransfer.files` 或 `clipboardData.files` 中的图片，处理后阻止默认浏览器导航。多张图片按文件顺序创建独立任务。

- [ ] **Step 6: 实现附件式上传预览样式**

  复用 [`packages/ui/src/components/attachment.tsx`](packages/ui/src/components/attachment.tsx) 的状态化视觉约定，在 [`editor.css`](packages/editor/src/styles/editor.css) 增加局部样式：缩略图、文件名、状态文案、重试和删除 icon button；使用已有 icons 和 tooltip 组件，不新增圆角卡片嵌套。成功后移除预览，交给 `.ProseMirror img` 的最大宽度和等比高度样式。

- [ ] **Step 7: 接入编辑器表面和导出**

  扩展 [`DocumentEditor`](packages/editor/src/components/document-editor.tsx) 的 props，增加可选 `imageUpload?: ImageUploadHandler`，并把它传给 [`EditorSurface`](packages/editor/src/components/editor-surface.tsx)。保持没有 handler 时不渲染上传入口，避免现有测试和只读场景改变。导出组件和相关类型。

- [ ] **Step 8: 运行组件测试与全量编辑器检查**

  运行：`pnpm --filter @workspace/editor test -- image-upload.test.tsx document-editor.test.tsx`、`pnpm --filter @workspace/editor typecheck`、`pnpm --filter @workspace/editor lint`。

  预期：入口、状态、重试、删除和协作前的本地状态测试通过；既有编辑器测试、类型检查和 lint 通过。

- [ ] **Step 9: 提交编辑器交互变更**

  ```text
  git add packages/editor/src/components packages/editor/src/styles/editor.css
  git commit -m "feat: add image upload interactions"
  ```

---

### Task 5: 在 Web 工作区实现 API 直传适配器并接线

**Files:**
- Create: [`apps/web/components/inkspace/image-upload.ts`](apps/web/components/inkspace/image-upload.ts)
- Create: [`apps/web/components/inkspace/image-upload.test.ts`](apps/web/components/inkspace/image-upload.test.ts)
- Modify: [`apps/web/components/inkspace/document-workspace.tsx`](apps/web/components/inkspace/document-workspace.tsx)
- Modify: [`apps/web/components/inkspace/document-workspace.test.tsx`](apps/web/components/inkspace/document-workspace.test.tsx)
- Modify: [`apps/web/package.json`](apps/web/package.json) only if an existing icon or tooltip export requires it

**Interfaces:**
- Consumes: `apiUrl`、`documentId`、当前用户 ID、浏览器 `fetch` 和 [`ImageUploadHandler`](packages/editor/src/core/image-upload.ts)。
- Produces: `createDocumentImageUploader({ apiUrl, documentId, userId })`，返回签名请求、COS PUT 和公开 URL 结果。

- [ ] **Step 1: 读取 Next.js 16 本地指南**

  在修改 [`document-workspace.tsx`](apps/web/components/inkspace/document-workspace.tsx) 前读取 `node_modules/next/dist/docs/` 中与 Client Component、环境变量和 fetch 使用相关的指南，确认当前 Next.js 16.2.6 约定。

- [ ] **Step 2: 编写直传适配器失败测试**

  在 [`image-upload.test.ts`](apps/web/components/inkspace/image-upload.test.ts) mock `fetch`，验证：

  - presign 请求为 `POST ${apiUrl.replace(/\/$/, "")}/documents/${documentId}/images/presign`。
  - 请求头包含 `content-type: application/json` 和 `x-dev-user-id`。
  - 请求体只包含 `contentType` 和 `size`。
  - 第二次 fetch 使用返回的 `uploadUrl`、方法 `PUT`、固定 `Content-Type` 和原始 File body。
  - 适配器返回 `publicUrl`，不返回或暴露签名 URL。
  - presign 或 PUT 非 2xx、网络异常、缺少 publicUrl 时抛出稳定错误。

- [ ] **Step 3: 运行失败测试**

  运行：`pnpm --filter web test -- image-upload.test.ts`

  预期：测试因 [`createDocumentImageUploader()`](apps/web/components/inkspace/image-upload.ts) 尚未实现而失败。

- [ ] **Step 4: 实现 API 预签名和 COS PUT 适配器**

  在 [`image-upload.ts`](apps/web/components/inkspace/image-upload.ts) 定义：

  ```ts
  type CreateDocumentImageUploaderOptions = {
    apiUrl: string
    documentId: string
    userId: string
  }

  function createDocumentImageUploader(
    options: CreateDocumentImageUploaderOptions
  ): ImageUploadHandler
  ```

  第一个请求发送 JSON 元数据，第二个请求向 COS 使用原始 `File` 直传；支持 `AbortSignal`；所有 URL 拼接去除 API 基础地址末尾斜杠；用户可见错误不得包含签名参数或服务端堆栈。

- [ ] **Step 5: 在文档工作区接线**

  在 [`DocumentWorkspace`](apps/web/components/inkspace/document-workspace.tsx) 构造基于当前 `apiUrl`、`documentId` 和 `user.id` 的 handler，并传给 [`DocumentEditor`](packages/editor/src/components/document-editor.tsx) 的 `imageUpload` prop。只在 `role !== "viewer"` 时提供 handler；加载失败、未配置 API 或只读角色不应创建上传入口。

- [ ] **Step 6: 写工作区集成测试**

  扩展 [`document-workspace.test.tsx`](apps/web/components/inkspace/document-workspace.test.tsx)，验证 owner/editor 传入上传 handler，viewer 不传；模拟 presign 和 PUT，确认图片最终使用 `publicUrl`；确认 API URL 尾斜杠只被移除一次；确认请求使用当前 documentId 和用户身份头。

- [ ] **Step 7: 运行 Web 测试、类型检查和 lint**

  运行：`pnpm --filter web test -- image-upload.test.ts document-workspace.test.tsx`、`pnpm --filter web typecheck`、`pnpm --filter web lint`。

  预期：适配器和工作区接线测试通过，类型检查和 lint 通过。

- [ ] **Step 8: 提交 Web 接线变更**

  ```text
  git add apps/web/components/inkspace
  git commit -m "feat: connect document image uploads to COS"
  ```

---

### Task 6: 完善配置文档、COS CORS 和端到端验证

**Files:**
- Create: [`docs/superpowers/specs/2026-08-12-image-upload-cos-operations.md`](docs/superpowers/specs/2026-08-12-image-upload-cos-operations.md)
- Modify: [`apps/web/.env.example`](apps/web/.env.example) only if the Web app needs an explicit API URL example update
- Modify: [`apps/api/.env.example`](apps/api/.env.example) if Task 1 did not include all values
- Modify: [`apps/api/src/main.ts`](apps/api/src/main.ts) only if configured production Web Origin must be added to CORS

**Interfaces:**
- Consumes: API endpoint、COS 配置和 Web Origin。
- Produces: 可复制的环境变量、COS CORS、最小权限与验证步骤文档。

- [ ] **Step 1: 编写运维配置文档**

  在 [`2026-08-12-image-upload-cos-operations.md`](docs/superpowers/specs/2026-08-12-image-upload-cos-operations.md) 明确：五个服务端环境变量、不能将密钥放入 `NEXT_PUBLIC_*`、`documents/*` 的最小 `PutObject` 权限、开发/生产 Origin 精确列表、COS CORS 的 `PUT`/`HEAD`、`Content-Type`、`ETag`、缓存时间，以及公开基础 URL 的格式。

- [ ] **Step 2: 配置应用跨域边界**

  检查 [`apps/api/src/main.ts`](apps/api/src/main.ts) 当前 API CORS 是否覆盖实际 Web Origin；只添加明确配置的开发和生产 Origin，不使用任意 Origin。注意 API CORS 与 COS bucket CORS 是两套独立配置，都要写入运维文档。

- [ ] **Step 3: 运行全仓库验证**

  运行：`pnpm test`、`pnpm typecheck`、`pnpm lint` 和 `pnpm build`。

  预期：API、Web、编辑器和 UI 包的测试、类型检查、lint 和构建均通过；若数据库集成测试需要外部服务，应明确记录实际阻塞而不宣称全量通过。

- [ ] **Step 4: 手工验证浏览器直传链路**

  使用真实但非生产 COS 配置启动 API 和 Web，依次验证 owner 上传 PNG、editor 上传 WebP、viewer 看不到上传入口、拖放、粘贴、失败重试、失败删除以及两名协作者看到最终图片。浏览器网络面板确认图片 PUT 直接发往 COS，API 没有接收图片二进制，浏览器没有请求或暴露 COS 密钥。

- [ ] **Step 5: 做最终验收检查**

  检查文档 JSON 只包含最终公开 URL；检查上传预览卸载后 Blob URL 被回收；检查删除图片不调用 COS 删除；检查生成的对象 Key 不能穿越到 `documentId` 目录之外；检查签名 URL 没有写入日志或错误提示。

- [ ] **Step 6: 提交文档与验证结果**

  ```text
  git add docs/superpowers/specs/2026-08-12-image-upload-cos-operations.md apps/api/.env.example apps/api/src/main.ts apps/web/.env.example
  git commit -m "docs: document COS image upload operations"
  ```

---

## Self-Review Checklist

- [ ] API 权限：Task 2 覆盖 owner/editor/viewer/outsider、未知文档和输入限制。
- [ ] COS 安全：Task 1 和 Task 6 覆盖密钥隔离、对象 Key 服务端生成、最小权限和 CORS。
- [ ] 编辑器节点：Task 3 覆盖 Tiptap Image 扩展、拒绝 Base64、四种 MIME 和 10MB 限制。
- [ ] 三种入口：Task 4 覆盖工具栏选择、drop 和 paste。
- [ ] 状态恢复：Task 4 覆盖 uploading、done、error、重试、删除和 Blob URL 回收。
- [ ] 协作边界：Task 4 覆盖上传中不产生 Yjs 图片节点、成功后才同步，以及位置失效不覆盖协作者内容。
- [ ] 工作区接线：Task 5 覆盖 documentId、用户身份、API URL 规范化和 viewer 只读行为。
- [ ] 验证：Task 6 覆盖包级测试、全仓库检查、真实 COS 直传和浏览器网络面板验收。
- [ ] 无未决占位：计划中的函数名、类型名、路径和请求字段均已在对应任务中定义。
