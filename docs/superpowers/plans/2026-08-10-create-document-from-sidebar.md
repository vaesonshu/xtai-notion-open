# Create Document From Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create a document from the sidebar and immediately edit it.

**Architecture:** NestJS exposes a guarded `POST /documents` endpoint that creates a workspace, document, and owner membership atomically. A client-side workspace shell owns the selected ID and calls the endpoint from the sidebar, while `DocumentWorkspace` reloads metadata whenever that ID changes.

**Tech Stack:** Next.js 16.2 client components, React 19, NestJS 11, PostgreSQL, Vitest, Testing Library.

## Global Constraints

- Preserve current development-identity authentication via `x-dev-user-id`.
- A new document has title `未命名文档` and creator role `owner`.
- Use `NEXT_PUBLIC_API_URL` and do not expose non-public server environment variables.
- Keep the existing fixed demo document as the initial selected document.

---

### Task 1: Create document persistence and API

**Files:**
- Modify: `apps/api/src/documents/document-types.ts`
- Modify: `apps/api/src/documents/documents.repository.ts`
- Modify: `apps/api/src/documents/documents.service.ts`
- Modify: `apps/api/src/documents/documents.controller.ts`
- Modify: `apps/api/src/documents/documents.repository.spec.ts`
- Modify: `apps/api/src/documents/documents.service.spec.ts`
- Modify: `apps/api/src/documents/documents.controller.spec.ts`

**Interfaces:**
- Produces `DocumentsService.createDocument(userId: string): Promise<DocumentMetadata>`.
- Produces `POST /documents` returning `DocumentMetadata` for the current user.

- [ ] **Step 1: Write failing repository, service, and controller tests**

```ts
const created = await repository.createForOwner("user-1")
expect(created.title).toBe("未命名文档")

await expect(service.createDocument("user-1")).resolves.toMatchObject({
  role: "owner",
  title: "未命名文档",
})

expect(await controller.createDocument({ id: "user-1" })).toEqual(metadata)
```

- [ ] **Step 2: Run API test files and verify they fail because creation methods/routes are absent**

Run: `pnpm --filter api test -- documents.repository.spec.ts documents.service.spec.ts documents.controller.spec.ts`

- [ ] **Step 3: Add atomic repository creation and API delegation**

```ts
async createForOwner(userId: string): Promise<DocumentRow> {
  return this.db.withTransaction(async (client) => {
    const workspace = await client.query<{ id: string }>(
      "INSERT INTO workspace (name) VALUES ($1) RETURNING id", ["个人空间"]
    )
    const document = await client.query<DocumentRow>(
      `INSERT INTO document (workspace_id, title) VALUES ($1, $2)
       RETURNING id, workspace_id, title, created_at, updated_at`,
      [workspace.rows[0].id, "未命名文档"]
    )
    await client.query(
      "INSERT INTO document_member (document_id, user_id, role) VALUES ($1, $2, 'owner')",
      [document.rows[0].id, userId]
    )
    return document.rows[0]
  })
}
```

Expose it through `DocumentsService.createDocument` and a guarded `@Post()` controller method.

- [ ] **Step 4: Run API creation tests and type check**

Run: `pnpm --filter api test -- documents.repository.spec.ts documents.service.spec.ts documents.controller.spec.ts && pnpm --filter api typecheck`

### Task 2: Add a client workspace shell and actionable sidebar

**Files:**
- Create: `apps/web/components/inkspace/workspace-shell.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/inkspace/sidebar.tsx`
- Create: `apps/web/components/inkspace/workspace-shell.test.tsx`
- Create: `apps/web/components/inkspace/sidebar.test.tsx`

**Interfaces:**
- `WorkspaceShell` receives serializable `initialDocumentId`, `user`, `apiUrl`, and `collaborationUrl` props.
- `WorkspaceSidebar` accepts `onCreateDocument(): void` and `createError?: string`.

- [ ] **Step 1: Write failing component tests**

```tsx
render(<WorkspaceShell {...props} />)
await user.click(screen.getByRole("button", { name: "新建文档" }))
expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:3100/documents", {
  method: "POST",
  headers: { "x-dev-user-id": "demo-owner" },
})
expect(documentWorkspace).toHaveBeenLastRenderedWith(
  expect.objectContaining({ documentId: "new-document-id" })
)
```

Also assert failed creation shows a Chinese connection/error message and restores button availability.

- [ ] **Step 2: Run web tests and verify failure**

Run: `pnpm --filter web test -- workspace-shell.test.tsx sidebar.test.tsx`

- [ ] **Step 3: Implement shell state and sidebar button behavior**

```tsx
"use client"
const [documentId, setDocumentId] = useState(initialDocumentId)
const [creating, setCreating] = useState(false)

async function createDocument() {
  setCreating(true)
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
    method: "POST", headers: { "x-dev-user-id": user.id },
  })
  const document = await response.json()
  setDocumentId(document.id)
  setCreating(false)
}
```

Make the sidebar button call the handler, disable while creating, and render the error beneath the action list. Replace the `page.tsx` sibling sidebar/workspace layout with `WorkspaceShell` so callbacks remain inside one client boundary.

- [ ] **Step 4: Run targeted web tests and type check**

Run: `pnpm --filter web test -- workspace-shell.test.tsx sidebar.test.tsx && pnpm --filter web typecheck`

### Task 3: Clarify unreachable API errors and verify integration

**Files:**
- Modify: `apps/web/components/inkspace/document-workspace.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.test.tsx`

**Interfaces:**
- A rejected metadata fetch shows `无法连接到文档服务，请确认 API 已启动。` rather than raw `Failed to fetch`.

- [ ] **Step 1: Add a failing rejected-fetch test**

```tsx
vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
render(<DocumentWorkspace {...baseProps} />)
expect(await screen.findByRole("alert")).toHaveTextContent("无法连接到文档服务")
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter web test -- document-workspace.test.tsx`

- [ ] **Step 3: Map network TypeErrors to a clear message**

```ts
function getLoadErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "无法连接到文档服务，请确认 API 已启动。"
  }
  return error instanceof Error ? error.message : "Failed to load document"
}
```

- [ ] **Step 4: Run targeted and full affected test suites**

Run: `pnpm --filter web test && pnpm --filter api test`

- [ ] **Step 5: Format and check changed files**

Run: `pnpm exec prettier --check apps/api/src/documents apps/web/app/page.tsx apps/web/components/inkspace`
