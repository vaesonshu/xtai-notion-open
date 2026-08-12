# 编辑器图片上传入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为可编辑文档提供顶部工具栏、Slash Menu、拖放与粘贴四种图片上传入口，并经 COS 预签名直传后仅插入公开 URL。

**Architecture:** `@workspace/editor` 保持与应用 API 无关，提供一个由 `ImageUploadHandler` 驱动的上传控制组件及其触发上下文。Slash Menu 在删除 `/图片` 查询后调用该控制器；Web 的固定工具栏从相同上下文调用文件选择。Web 工作区构造 COS 预签名 PUT 适配器并把 handler 传入 `DocumentEditor`。

**Tech Stack:** React 19、Tiptap 3、Yjs、Vitest、Testing Library、Next.js 16、浏览器 Fetch API、腾讯云 COS 预签名 PUT。

## Global Constraints

- 只支持 `image/jpeg`、`image/png`、`image/gif`、`image/webp`，单文件最大 10MB。
- 上传中、预览 Blob URL 和失败状态不得写入 Tiptap/Yjs；成功节点只保存 `publicUrl`。
- 没有 `imageUpload` handler 或编辑器只读时，不显示也不执行任何上传入口。
- 所有 TypeScript/TSX 使用 LF、无分号、双引号、两空格缩进、ES5 尾逗号和 80 列格式。
- 不新增网络库或 COS SDK；使用现有 Fetch API 与 `@workspace/icons`、`@workspace/ui`。

---

### Task 1: 编辑器上传协调器与交互测试

**Files:**
- Create: `packages/editor/src/components/image-upload.tsx`
- Create: `packages/editor/src/components/image-upload.test.tsx`
- Modify: `packages/editor/src/components/editor-surface.tsx`
- Modify: `packages/editor/src/components/document-editor.tsx`
- Modify: `packages/editor/src/components/index.ts`
- Modify: `packages/editor/src/styles/editor.css`

**Interfaces:**
- Consumes: `ImageUploadHandler`、`uploadImage(file, { upload }, signal)`、`insertUploadedImage(editor, result)`。
- Produces: `ImageUploadControls` context hook，公开 `openFilePicker()`、`uploadFiles(files)` 与 `canUpload`，供 Slash Menu 和宿主工具栏调用。

- [ ] **Step 1: 写失败的组件测试**

```tsx
const upload = vi.fn(async () => ({
  publicUrl: "https://cdn.example.test/image.png",
  contentType: "image/png",
}))

render(<DocumentEditor content={emptyDocument} imageUpload={upload} />)
fireEvent.change(screen.getByTestId("image-upload-input"), {
  target: { files: [pngFile] },
})
await waitFor(() => expect(upload).toHaveBeenCalledWith(pngFile, expect.anything()))
expect(latestEditor.getJSON()).toMatchObject({
  content: expect.arrayContaining([
    expect.objectContaining({
      type: "image",
      attrs: { src: "https://cdn.example.test/image.png" },
    }),
  ]),
})
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter @workspace/editor test -- image-upload.test.tsx`
Expected: FAIL，因为上传控制组件及其入口尚不存在。

- [ ] **Step 3: 实现最小协调器**

```tsx
const ImageUploadContext = createContext<ImageUploadControls | null>(null)

export function ImageUpload({ upload }: { upload?: ImageUploadHandler }) {
  const editor = useEditorInstance()
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const result = await uploadImage(file, { upload: upload! })
      insertUploadedImage(editor, result)
    }
  }, [editor, upload])

  if (!upload || !editor.isEditable) return null
  return <input ref={inputRef} data-testid="image-upload-input" type="file" accept={IMAGE_MIME_TYPES.join(",")} />
}
```

实现每个文件的本地预览、`uploading`/`error` 状态、重试和删除；在组件卸载、完成或删除时调用 `URL.revokeObjectURL`。drop/paste 仅抽取符合图片 MIME 的 `File`，有候选图片时阻止默认事件。失败不插入图片节点，重试重新调用 handler。

- [ ] **Step 4: 运行组件测试和静态检查**

Run: `pnpm --filter @workspace/editor test -- image-upload.test.tsx document-editor.test.tsx`
Expected: PASS，覆盖选择、drop、paste、校验失败、上传失败、重试、删除与只读边界。

Run: `pnpm --filter @workspace/editor typecheck && pnpm --filter @workspace/editor lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/components packages/editor/src/styles/editor.css
git commit -m "feat(editor): add image upload controls"
```

### Task 2: Slash Menu 图片上传命令

**Files:**
- Modify: `packages/editor/src/core/slash-commands.ts`
- Modify: `packages/editor/src/core/slash-commands.test.ts`
- Modify: `packages/editor/src/components/slash-menu.tsx`
- Modify: `packages/editor/src/components/slash-menu.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `useImageUploadControls()` 与 `openFilePicker()`。
- Produces: 公共 slash 条目 `{ id: "upload-image", label: "上传图片", keywords: ["image", "图片", "上传"] }`；选择时删除 suggestion range 并打开文件选择器。

- [ ] **Step 1: 写失败测试**

```tsx
await act(async () => {
  editor.chain().focus("start").insertContent("/图片").run()
})
fireEvent.click(await screen.findByRole("option", { name: "上传图片" }))
expect(editor.getText()).toBe("")
expect(screen.getByTestId("image-upload-input")).toHaveBeenCalled()
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter @workspace/editor test -- slash-commands.test.ts slash-menu.test.tsx`
Expected: FAIL，因为公开命令目录和异步上传回调尚未实现。

- [ ] **Step 3: 实现命令与菜单回调**

```ts
export const IMAGE_UPLOAD_SLASH_COMMAND: SlashCommand = {
  id: "upload-image",
  label: "上传图片",
  keywords: ["image", "图片", "上传"],
}
```

在 `SlashMenu` 中对该 id 特判：先 `deleteRange(range)`，再调用 `openFilePicker()`；未配置上传能力时从菜单目录中排除该项。保留 `executeSlashCommand()` 只处理同步块转换，避免错误地把异步文件选择抽象为 Tiptap 链式命令。

- [ ] **Step 4: 验证**

Run: `pnpm --filter @workspace/editor test -- slash-commands.test.ts slash-menu.test.tsx image-upload.test.tsx`
Expected: PASS，确认 `/图片` 可检索，选择后立即清空命令文本，取消选择不产生节点。

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core/slash-commands.ts packages/editor/src/core/slash-commands.test.ts packages/editor/src/components/slash-menu.tsx packages/editor/src/components/slash-menu.test.tsx
git commit -m "feat(editor): add slash image upload command"
```

### Task 3: Web COS 适配器和顶部工具栏入口

**Files:**
- Create: `apps/web/components/inkspace/image-upload.ts`
- Create: `apps/web/components/inkspace/image-upload.test.ts`
- Modify: `apps/web/components/inkspace/document-workspace.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.test.tsx`
- Modify: `apps/web/components/inkspace/fixed-toolbar.tsx`

**Interfaces:**
- Consumes: `ImageUploadHandler` 与编辑器的 `useImageUploadControls()`。
- Produces: `createDocumentImageUploader({ apiUrl, documentId, userId }): ImageUploadHandler`，以及 Web 工具栏中的上传图片 icon button。

- [ ] **Step 1: 阅读当前 Next.js 指南并编写失败测试**

读取 `node_modules/next/dist/docs/` 内 Client Component 和 fetch 指南。测试预签名请求与 COS PUT：

```ts
await expect(uploader(pngFile)).resolves.toEqual({
  publicUrl: "https://cdn.example.test/documents/a.png",
  contentType: "image/png",
})
expect(fetch).toHaveBeenNthCalledWith(1, "https://api.example.test/documents/doc-1/images/presign", expect.objectContaining({ method: "POST" }))
expect(fetch).toHaveBeenNthCalledWith(2, uploadUrl, expect.objectContaining({ method: "PUT", body: pngFile }))
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter web test -- image-upload.test.ts document-workspace.test.tsx`
Expected: FAIL，因为适配器、handler 接线和工具栏入口尚未实现。

- [ ] **Step 3: 实现适配器、接线与按钮**

```ts
export function createDocumentImageUploader({ apiUrl, documentId, userId }: CreateDocumentImageUploaderOptions): ImageUploadHandler {
  return async (file, signal) => {
    const presign = await fetch(`${apiUrl.replace(/\/$/, "")}/documents/${documentId}/images/presign`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-dev-user-id": userId },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    })
    // 验证响应后以固定 Content-Type PUT 原始 File，最后仅返回 publicUrl。
  }
}
```

在 `DocumentWorkspace` 对 owner/editor 构造并传递 `imageUpload`，viewer 不传。`FixedEditorToolbar` 从上传控制 context 获取 `canUpload` 和 `openFilePicker`，使用 `ImageIcon` 的 icon-only `Button`，具备 `aria-label="上传图片"` 与 tooltip。

- [ ] **Step 4: 验证**

Run: `pnpm --filter web test -- image-upload.test.ts document-workspace.test.tsx && pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS，覆盖成功、预签名/PUT 错误、403、当前身份与文档 ID、viewer 无入口。

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/inkspace
git commit -m "feat(web): connect image upload entry points"
```

### Task 4: 全链路验证

**Files:**
- Verify only: modified editor and web files

**Interfaces:**
- Consumes: Tasks 1-3 的核心上传控制、slash 菜单和 Web 适配器。
- Produces: 经过格式、测试与运行时检查的图片上传入口。

- [ ] **Step 1: 格式化并检查 diff**

Run: `pnpm exec prettier --write packages/editor/src/components/image-upload.tsx packages/editor/src/components/image-upload.test.tsx packages/editor/src/components/editor-surface.tsx packages/editor/src/components/document-editor.tsx packages/editor/src/components/index.ts packages/editor/src/components/slash-menu.tsx packages/editor/src/components/slash-menu.test.tsx packages/editor/src/core/slash-commands.ts packages/editor/src/core/slash-commands.test.ts apps/web/components/inkspace/image-upload.ts apps/web/components/inkspace/image-upload.test.ts apps/web/components/inkspace/document-workspace.tsx apps/web/components/inkspace/document-workspace.test.tsx apps/web/components/inkspace/fixed-toolbar.tsx`

Run: `git diff --check`
Expected: PASS。

- [ ] **Step 2: 运行目标测试与检查**

Run: `pnpm --filter @workspace/editor test -- image-upload.test.tsx slash-menu.test.tsx slash-commands.test.ts && pnpm --filter @workspace/editor typecheck && pnpm --filter @workspace/editor lint && pnpm --filter web test -- image-upload.test.ts document-workspace.test.tsx && pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS。

- [ ] **Step 3: 手动 COS 验收**

Run: `pnpm --filter web dev -- --port 3000`
Expected: 在配置真实 API 和 COS CORS 后，owner/editor 可通过顶部工具栏和 `/图片` 上传；viewer 看不到入口；浏览器网络面板中 COS PUT 返回成功且文档 JSON 仅有公开 URL。

## Self-Review

- Spec coverage: Task 1 覆盖选择、拖放、粘贴、本地状态、校验、重试和删除；Task 2 覆盖 slash 入口；Task 3 覆盖 COS 适配器、角色接线和顶部工具栏；Task 4 覆盖格式、自动化与真实 CORS 验收。
- Placeholder scan: 无 `TBD`、`TODO` 或未定义的后续实现指令。
- Type consistency: 所有入口使用既有 `ImageUploadHandler`，最终调用 `insertUploadedImage()`，网络层返回 `ImageUploadResult`。