# Knowledge Base (Workspace) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `workspace` into a real knowledge-base container with workspace-level members, wire the sidebar header to live API data, and create documents under the active workspace.

**Architecture:** Add `workspace_member` and extend `workspace` via Prisma migration with a backfill script. Introduce a NestJS `WorkspacesModule` for CRUD and scoped document listing. Refactor `DocumentsService` permission checks to prefer `workspace_member` with `document_member` fallback. Update `WorkspaceShell` + `WorkspaceSidebar` to track `currentWorkspaceId` in localStorage.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL, Next.js 16 client components, React 19, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-09-knowledge-base-design.md`
- Auth: keep `AuthenticatedIdentityGuard` + `x-dev-user-id` / session cookie paths unchanged.
- Formatting: root `.prettierrc` (LF, no semicolons, double quotes, 80 print width).
- User-facing copy in Simplified Chinese.
- P0 does **not** remove `document_member`; new documents skip writing it.
- Do not commit `.env` or secrets.

## File Map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Add `WorkspaceMember`, extend `Workspace` |
| `apps/api/prisma/migrations/007_workspace_members/migration.sql` | DDL + data backfill |
| `apps/api/src/workspaces/workspace.types.ts` | `WorkspaceRole`, DTOs |
| `apps/api/src/workspaces/workspace.repository.ts` | DB access |
| `apps/api/src/workspaces/workspaces.service.ts` | Business rules |
| `apps/api/src/workspaces/workspaces.controller.ts` | HTTP routes |
| `apps/api/src/workspaces/workspaces.module.ts` | Nest module |
| `apps/api/src/documents/documents.service.ts` | Permission + create/list refactor |
| `apps/api/src/documents/documents.repository.ts` | `createInWorkspace`, list by workspace |
| `apps/api/src/documents/documents.controller.ts` | Optional `workspaceId` query |
| `apps/api/src/app.module.ts` | Register `WorkspacesModule` |
| `apps/web/components/inkspace/sidebar.tsx` | Live workspace header + switcher |
| `apps/web/components/inkspace/workspace-shell.tsx` | Workspace state + API calls |
| `apps/web/components/inkspace/create-workspace-dialog.tsx` | New KB dialog (P0 minimal) |

---

### Task 1: Database migration and Prisma schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/007_workspace_members/migration.sql`

**Interfaces:**
- Produces Prisma models `Workspace`, `WorkspaceMember` with relations to `AppUser` and `Document`.

- [ ] **Step 1: Update Prisma schema**

Add to `schema.prisma`:

```prisma
model Workspace {
  id        String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  createdBy String?           @map("created_by") @db.Uuid
  createdAt DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime          @default(now()) @map("updated_at") @db.Timestamptz(6)
  creator   AppUser?          @relation("WorkspaceCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  members   WorkspaceMember[]
  documents Document[]

  @@map("workspace")
}

model WorkspaceMember {
  workspaceId String   @map("workspace_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  role        String
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        AppUser   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([workspaceId, userId])
  @@index([userId])
  @@map("workspace_member")
}
```

Add to `AppUser`:

```prisma
createdWorkspaces Workspace[]       @relation("WorkspaceCreator")
workspaceMembers    WorkspaceMember[]
```

- [ ] **Step 2: Write migration SQL with backfill**

`007_workspace_members/migration.sql` must:

1. Add `created_by`, `updated_at` to `workspace`.
2. Create `workspace_member`.
3. For each distinct `document.owner_id`, create one workspace named `我的知识库` (if not exists for that user) and reassign owned documents.
4. Insert `workspace_member` rows for owners.
5. Backfill collaborators from `document_member` with highest role per `(workspace_id, user_id)`.
6. Delete orphan workspaces with zero documents.

- [ ] **Step 3: Apply migration and regenerate client**

Run:

```bash
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma generate
```

Expected: migration succeeds; `apps/api/src/generated/prisma` includes `WorkspaceMember`.

---

### Task 2: Workspace types and repository

**Files:**
- Create: `apps/api/src/workspaces/workspace.types.ts`
- Create: `apps/api/src/workspaces/workspace.repository.ts`
- Create: `apps/api/test/workspaces/workspace.repository.spec.ts`

**Interfaces:**
- Produces `WorkspaceRole = "owner" | "admin" | "editor" | "viewer"`.
- Produces `WorkspaceRepository.create(name, createdBy): Promise<WorkspaceRow>`.
- Produces `WorkspaceRepository.addMember(workspaceId, userId, role): Promise<void>`.
- Produces `WorkspaceRepository.getMemberRole(workspaceId, userId): Promise<WorkspaceRole | null>`.
- Produces `WorkspaceRepository.listForUser(userId): Promise<WorkspaceListRow[]>`.
- Produces `WorkspaceRepository.countMembers(workspaceId): Promise<number>`.

- [ ] **Step 1: Write failing repository tests**

```ts
it("creates workspace and owner membership atomically", async () => {
  const row = await repository.create("产品知识库", "user-1")
  expect(row.name).toBe("产品知识库")
  expect(await repository.getMemberRole(row.id, "user-1")).toBe("owner")
  expect(await repository.countMembers(row.id)).toBe(1)
})

it("lists workspaces for a member", async () => {
  const ws = await repository.create("A", "user-1")
  await repository.addMember(ws.id, "user-2", "editor")
  const list = await repository.listForUser("user-2")
  expect(list.map((item) => item.id)).toContain(ws.id)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter api test -- workspace.repository.spec.ts`

- [ ] **Step 3: Implement repository**

Use `PrismaService` transactions: create workspace + owner member in one `$transaction`.

- [ ] **Step 4: Run tests until pass**

Run: `pnpm --filter api test -- workspace.repository.spec.ts`

---

### Task 3: Workspaces service and controller

**Files:**
- Create: `apps/api/src/workspaces/workspaces.service.ts`
- Create: `apps/api/src/workspaces/workspaces.controller.ts`
- Create: `apps/api/src/workspaces/workspaces.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/workspaces/workspaces.service.spec.ts`
- Create: `apps/api/test/workspaces/workspaces.controller.spec.ts`

**Interfaces:**
- Produces `WorkspacesService.createWorkspace(userId, name): Promise<WorkspaceSummary>`.
- Produces `WorkspacesService.listWorkspaces(userId): Promise<WorkspaceSummary[]>`.
- Produces `WorkspacesService.renameWorkspace(id, userId, name): Promise<WorkspaceSummary>`.
- Produces `WorkspacesService.listMembers(id, userId): Promise<WorkspaceMemberView[]>`.
- Produces `WorkspacesService.addMember(id, actorId, { userId, role })`.
- Produces `WorkspacesService.removeMember(id, actorId, targetUserId)`.
- Produces `GET|POST|PATCH /workspaces` routes per spec.

- [ ] **Step 1: Write failing service tests**

```ts
it("rejects rename from viewer", async () => {
  await expect(
    service.renameWorkspace("ws-1", "viewer-user", "新名字")
  ).rejects.toMatchObject({ status: 403 })
})

it("rejects removing the last owner", async () => {
  await expect(
    service.removeMember("ws-1", "owner-user", "owner-user")
  ).rejects.toMatchObject({ status: 409 })
})
```

- [ ] **Step 2: Implement service + controller + module**

Register `WorkspacesModule` in `AppModule`. Guard all routes with `AuthenticatedIdentityGuard`.

- [ ] **Step 3: Run workspace API tests**

Run: `pnpm --filter api test -- workspaces.service.spec.ts workspaces.controller.spec.ts`

---

### Task 4: Refactor document permissions to workspace-first

**Files:**
- Modify: `apps/api/src/documents/documents.repository.ts`
- Modify: `apps/api/src/documents/documents.service.ts`
- Modify: `apps/api/test/documents/documents.service.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceRepository.getMemberRole`, `mapWorkspaceRoleToDocumentRole`.
- Produces: `DocumentsService.getMemberRole(documentId, userId)` checks workspace then falls back to `document_member`.
- Produces: `mapWorkspaceRoleToDocumentRole(role): DocumentRole` — `owner→owner`, `admin|editor→editor`, `viewer→viewer`.

- [ ] **Step 1: Write failing permission tests**

```ts
it("allows editor via workspace_member without document_member", async () => {
  // workspace_member editor, no document_member row
  await expect(
    service.assertCanWrite("doc-1", "user-2")
  ).resolves.toBe("editor")
})

it("falls back to document_member for legacy share data", async () => {
  // no workspace_member, document_member editor
  await expect(
    service.assertCanRead("doc-legacy", "user-3")
  ).resolves.toBe("editor")
})
```

- [ ] **Step 2: Implement workspace-first lookup in DocumentsService**

```ts
private async resolveDocumentRole(
  documentId: string,
  userId: string
): Promise<DocumentRole | null> {
  const row = await this.documents.findById(documentId)
  if (!row) return null
  const wsRole = await this.workspaces.getMemberRole(row.workspace_id, userId)
  if (wsRole) return mapWorkspaceRoleToDocumentRole(wsRole)
  return this.documents.getMemberRole(documentId, userId)
}
```

Inject `WorkspaceRepository` into `DocumentsService` via `DocumentsModule` import.

- [ ] **Step 3: Run document permission tests**

Run: `pnpm --filter api test -- documents.service.spec.ts`

---

### Task 5: Create and list documents by workspace

**Files:**
- Modify: `apps/api/src/documents/documents.repository.ts`
- Modify: `apps/api/src/documents/documents.service.ts`
- Modify: `apps/api/src/documents/documents.controller.ts`
- Modify: `apps/api/src/workspaces/workspaces.controller.ts`
- Modify: `apps/api/test/documents/documents.service.spec.ts`

**Interfaces:**
- Produces `DocumentsRepository.createInWorkspace(workspaceId, userId, parentId?): Promise<DocumentRow>`.
- Produces `DocumentsRepository.listForUserInWorkspace(userId, workspaceId): Promise<DocumentListRow[]>`.
- Produces `POST /workspaces/:id/documents` and `GET /workspaces/:id/documents`.
- Changes `POST /documents` to use user's default workspace (most recently updated owned workspace, else create `我的知识库`).

- [ ] **Step 1: Write failing tests**

```ts
it("createInWorkspace does not insert a new workspace row", async () => {
  const before = await prisma.workspace.count()
  await repository.createInWorkspace("ws-1", "user-1")
  expect(await prisma.workspace.count()).toBe(before)
})

it("createChild keeps parent workspace_id", async () => {
  const parent = await repository.createInWorkspace("ws-1", "user-1")
  const child = await repository.createChild(parent, "user-1")
  expect(child.workspace_id).toBe(parent.workspace_id)
})

it("POST /workspaces/:id/documents requires workspace membership", async () => {
  await expect(
    controller.createDocument("ws-1", { id: "outsider" })
  ).rejects.toMatchObject({ status: 403 })
})
```

- [ ] **Step 2: Refactor `createForOwner` → `createInWorkspace`**

Remove per-document `workspace.create` from `createForOwner`. New flow:

```ts
async createInWorkspace(workspaceId: string, userId: string, parent?: DocumentRow) {
  return this.prisma.client.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        workspaceId,
        parentId: parent?.id ?? null,
        depth: parent ? (parent.depth ?? 1) + 1 : 1,
        title: "未命名文档",
        ownerId: userId,
      },
    })
    // P0: do NOT insert document_member
    return this.toDocumentRow(document)
  })
}
```

- [ ] **Step 3: Run API tests + typecheck**

Run:

```bash
pnpm --filter api test -- documents.service.spec.ts documents.repository.spec.ts
pnpm --filter api typecheck
```

---

### Task 6: Sidebar workspace header (API props)

**Files:**
- Modify: `apps/web/components/inkspace/sidebar.tsx`
- Modify: `apps/web/test/components/inkspace/sidebar.test.tsx`

**Interfaces:**
- Consumes props:

```ts
type WorkspaceHeaderProps = {
  workspace?: { id: string; name: string; memberCount: number }
  workspaces?: Array<{ id: string; name: string; memberCount: number }>
  onSwitchWorkspace?: (id: string) => void
  onCreateWorkspace?: () => void
}
```

- [ ] **Step 1: Write failing sidebar tests**

```tsx
render(
  <WorkspaceSidebar
    workspace={{ id: "ws-1", name: "产品知识库", memberCount: 4 }}
    workspaces={[
      { id: "ws-1", name: "产品知识库", memberCount: 4 },
      { id: "ws-2", name: "设计知识库", memberCount: 2 },
    ]}
  />
)
expect(screen.getByText("产品知识库")).toBeInTheDocument()
expect(screen.getByText("4 位成员")).toBeInTheDocument()
expect(screen.queryByText("栖木工作室")).not.toBeInTheDocument()
```

- [ ] **Step 2: Replace hardcoded header**

Remove static `栖木工作室` / `PRO · 6 位成员`. Avatar fallback = first char of `workspace.name`. Wire dropdown to `onSwitchWorkspace` / `onCreateWorkspace`.

- [ ] **Step 3: Run sidebar tests**

Run: `pnpm --filter web test -- sidebar.test.tsx`

---

### Task 7: WorkspaceShell state and API integration

**Files:**
- Modify: `apps/web/components/inkspace/workspace-shell.tsx`
- Create: `apps/web/components/inkspace/create-workspace-dialog.tsx`
- Modify: `apps/web/test/components/inkspace/workspace-shell.test.tsx`

**Interfaces:**
- Consumes: `GET /workspaces`, `GET /workspaces/:id/documents`, `POST /workspaces`, `POST /workspaces/:id/documents`.
- Produces: `currentWorkspaceId` persisted at `inkspace:workspace:v1`.

- [ ] **Step 1: Write failing shell tests**

```tsx
it("loads workspace header from API", async () => {
  mockFetch({
    "/workspaces": [{ id: "ws-1", name: "产品知识库", memberCount: 3, role: "owner" }],
    "/workspaces/ws-1/documents": [{ id: "doc-1", title: "Doc", role: "owner", parentId: null, depth: 1 }],
  })
  render(<WorkspaceShell user={user} apiUrl={API} ... />)
  expect(await screen.findByText("产品知识库")).toBeInTheDocument()
  expect(await screen.findByText("3 位成员")).toBeInTheDocument()
})

it("creates document in current workspace", async () => {
  await user.click(screen.getByRole("button", { name: "新建文档" }))
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/workspaces/ws-1/documents"),
    expect.objectContaining({ method: "POST" })
  )
})
```

- [ ] **Step 2: Implement workspace state in shell**

```ts
const WORKSPACE_STORAGE_KEY = "inkspace:workspace:v1"

async function refreshWorkspaces() {
  const res = await apiRequest({ path: "/workspaces", userId: user.id })
  const items = await res.json()
  setWorkspaces(items)
  const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
  const current =
    items.find((w) => w.id === stored)?.id ??
    items.find((w) => w.role === "owner")?.id ??
    items[0]?.id
  setCurrentWorkspaceId(current ?? null)
}

async function refreshDocuments(workspaceId: string) {
  const res = await apiRequest({
    path: `/workspaces/${workspaceId}/documents`,
    userId: user.id,
  })
  // sync documents cache scoped to workspace
}
```

When opening a document, if metadata `workspaceId` differs from current, call `setCurrentWorkspaceId` and refresh list.

- [ ] **Step 3: Add CreateWorkspaceDialog**

Minimal dialog: name input → `POST /workspaces` → switch workspace → refresh.

- [ ] **Step 4: Run shell tests**

Run: `pnpm --filter web test -- workspace-shell.test.tsx`

---

### Task 8: Integration verification

**Files:**
- Modify: `apps/api/test/documents/documents.authorization.integration.spec.ts` (if needed)
- Modify: `README.md` (P0 API table only)

- [ ] **Step 1: Run full test suites**

```bash
pnpm --filter api test
pnpm --filter web test
pnpm --filter api typecheck
pnpm --filter web typecheck
```

- [ ] **Step 2: Manual smoke test**

1. Register / login dev user.
2. Confirm sidebar shows real workspace name (default `我的知识库` after migration).
3. Create new workspace → header updates.
4. Create document → appears under current workspace only.
5. Switch workspace → document tree changes.
6. Open shared document → workspace auto-switches.

- [ ] **Step 3: Update README API table**

Add `/workspaces` endpoints under「文档工作区能力」.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `workspace_member` table + migration | Task 1 |
| Workspace CRUD API | Task 3 |
| Workspace-scoped document create/list | Task 5 |
| Workspace-first permissions | Task 4 |
| Sidebar name + memberCount | Task 6 |
| currentWorkspaceId localStorage | Task 7 |
| Stop per-document workspace creation | Task 5 |
| document_member fallback | Task 4 |
| Member invite API (backend) | Task 3 |
| Member invite UI | P1 (out of P0 plan) |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-knowledge-base.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you want?
