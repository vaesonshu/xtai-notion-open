# Document Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each document a persistent `/documents/<documentId>` App Router URL and navigate to it after creation.

**Architecture:** The existing client `WorkspaceShell` receives the document ID from its server page rather than owning that ID in state. A new Next.js dynamic page awaits `params` and renders the same workspace with that ID. The creation handler remains client-side, then uses App Router navigation to change the URL.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Dynamic App Router pages receive `params` as `Promise<{ documentId: string }>` and must await it.
- Client-side event navigation imports `useRouter` from `next/navigation` and calls `router.push` only after a valid create response.
- The root `/` page continues to open `DEMO_DOCUMENT_ID`.
- Failed or malformed creation responses leave the user on the current document and retain the existing Chinese error message behavior.
- Do not alter the document API or add document-list functionality.

---

### Task 1: Navigate after creating a document

**Files:**
- Modify: `apps/web/components/inkspace/workspace-shell.tsx`
- Modify: `apps/web/components/inkspace/workspace-shell.test.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `WorkspaceShellProps.documentId: string`, plus existing user and endpoint props.
- Consumes: `useRouter(): { push(href: string): void }` from `next/navigation`.
- Produces: a `POST /documents` success navigation to `/documents/<id>`.

- [ ] **Step 1: Write the failing navigation test**

Mock only the Next router boundary and retain the existing `DocumentWorkspace` test double. Replace the current local-document assertion with a route assertion:

```tsx
const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

it("navigates to the created document URL", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "new-document" }),
  }))

  render(<WorkspaceShell {...props} documentId="demo-document" />)
  fireEvent.click(screen.getByRole("button", { name: /新建文档/ }))

  await waitFor(() => {
    expect(push).toHaveBeenCalledWith("/documents/new-document")
  })
})
```

Keep the failed-request test and add `expect(push).not.toHaveBeenCalled()` to it.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter web test -- workspace-shell.test.tsx`

Expected: FAIL because `WorkspaceShell` does not import `useRouter` or call `push`.

- [ ] **Step 3: Implement client navigation and route-owned document ID**

In `workspace-shell.tsx`, replace `initialDocumentId` with `documentId`, remove `useState(initialDocumentId)`, and add the App Router hook:

```tsx
import { useRouter } from "next/navigation"

export type WorkspaceShellProps = {
  documentId: string
  user: DocumentWorkspaceProps["user"]
  apiUrl: string
  collaborationUrl: string
}

const router = useRouter()
// after validating document.id
router.push(`/documents/${document.id}`)
```

Pass the `documentId` prop directly to `DocumentWorkspace`. In `app/page.tsx`, rename the supplied prop from `initialDocumentId` to `documentId` while continuing to use `DEMO_DOCUMENT_ID`.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `pnpm --filter web test -- workspace-shell.test.tsx && pnpm --filter web typecheck`

Expected: tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit the task**

```bash
git add apps/web/components/inkspace/workspace-shell.tsx apps/web/components/inkspace/workspace-shell.test.tsx apps/web/app/page.tsx
git commit -m "feat(web): navigate to created documents"
```

### Task 2: Add the dynamic document page

**Files:**
- Create: `apps/web/app/documents/[documentId]/page.tsx`
- Create: `apps/web/app/documents/[documentId]/page.test.tsx`

**Interfaces:**
- Consumes: `params: Promise<{ documentId: string }>` supplied by the Next.js App Router.
- Produces: `WorkspaceShell` rendered with the exact route `documentId` and existing public environment values.

- [ ] **Step 1: Write the failing dynamic-page test**

Mock `WorkspaceShell`, invoke the async page with a literal route parameter, and assert the boundary contract:

```tsx
it("opens the document identified by the route parameter", async () => {
  render(await Page({ params: Promise.resolve({ documentId: "route-document" }) }))

  expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
    "data-document-id",
    "route-document",
  )
})
```

The `WorkspaceShell` mock must expose only `documentId` using a `data-document-id` attribute.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter web test -- 'app/documents/[documentId]/page.test.tsx'`

Expected: FAIL because no dynamic page module exists.

- [ ] **Step 3: Implement the async App Router page**

Create `app/documents/[documentId]/page.tsx` following the root page's environment and outer layout conventions:

```tsx
import { WorkspaceShell } from "@/components/inkspace/workspace-shell"

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params

  return (
    <div data-pencil-page className="flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]">
      <WorkspaceShell documentId={documentId} user={DEMO_USER} apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""} collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""} />
    </div>
  )
}
```

Define the serializable user inline as `{ id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "demo-owner", name: "林", color: "#E64B3C" }`, matching the root page's fallback behavior. Do not read client-only APIs in this server page.

- [ ] **Step 4: Run page and workspace tests, then typecheck**

Run: `pnpm --filter web test -- 'app/documents/[documentId]/page.test.tsx' workspace-shell.test.tsx && pnpm --filter web typecheck`

Expected: both focused tests pass and the generated Next route type check succeeds.

- [ ] **Step 5: Commit the task**

```bash
git add apps/web/app/documents/[documentId]/page.tsx apps/web/app/documents/[documentId]/page.test.tsx
git commit -m "feat(web): add document route"
```

### Task 3: Verify the route change across the web workspace

**Files:**
- Verify: `apps/web/app/page.tsx`
- Verify: `apps/web/app/documents/[documentId]/page.tsx`
- Verify: `apps/web/components/inkspace/workspace-shell.tsx`
- Verify: `apps/web/components/inkspace/workspace-shell.test.tsx`
- Verify: `apps/web/app/documents/[documentId]/page.test.tsx`

**Interfaces:**
- Verifies: root page remains a demo entry point; dynamic route and creation navigation resolve to the same `WorkspaceShell` contract.

- [ ] **Step 1: Format changed files**

Run: `pnpm exec prettier --write apps/web/app/page.tsx 'apps/web/app/documents/[documentId]/page.tsx' 'apps/web/app/documents/[documentId]/page.test.tsx' apps/web/components/inkspace/workspace-shell.tsx apps/web/components/inkspace/workspace-shell.test.tsx`

- [ ] **Step 2: Run the complete web test suite**

Run: `pnpm --filter web test`

Expected: all web test files pass with no unexpected console errors.

- [ ] **Step 3: Run lint and production build**

Run: `pnpm --filter web lint && pnpm --filter web build`

Expected: ESLint and Next.js production build exit successfully, including dynamic route generation.

- [ ] **Step 4: Inspect the final diff before handoff**

Run: `git diff --check && git diff -- apps/web/app/page.tsx 'apps/web/app/documents/[documentId]/page.tsx' apps/web/components/inkspace/workspace-shell.tsx`

Expected: no whitespace errors; only the planned route and navigation changes appear.
