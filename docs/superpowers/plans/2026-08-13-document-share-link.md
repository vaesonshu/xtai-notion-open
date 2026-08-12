# 文档分享链接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Add secure, copyable document share links that grant logged-in visitors editor access and open the document for realtime collaboration.

**Architecture:** Store one active random token per document in PostgreSQL. The API exposes authenticated endpoints to create/reuse a token and accept it; the Web app adds a share dialog and a `/share/[token]` route that preserves the share URL through login before accepting it. Existing document membership and WebSocket authorization remain the source of truth after acceptance.

**Tech Stack:** NestJS, PostgreSQL migrations/node-pg-migrate, Next.js App Router, React client components, Vitest, Testing Library.

## Global Constraints

- Default accepted role is `editor`.
- Tokens are generated with Node's cryptographically secure random source and are never derived from document IDs.
- Only document owners/editors can create a share link; viewers cannot.
- Invalid, revoked, or missing tokens return 404; unauthenticated acceptance returns 401.
- Existing authentication cookies and document membership checks must remain authoritative.
- Modified code follows repository Prettier rules and includes useful intent comments.

---

### Task 1: Share-link persistence and repository

**Files:**
- Create: `apps/api/migrations/005-add-document-share-links.sql`
- Create: `apps/api/src/documents/share-link-types.ts`
- Create: `apps/api/src/documents/share-link.repository.ts`
- Test: `apps/api/src/documents/share-link.repository.spec.ts`

**Interfaces:**
- Produces `ShareLinkRow`, `findActiveByDocumentId(documentId)`, `findActiveByToken(token)`, and `create(documentId, createdBy, token)` for the service layer.

- [ ] **Step 1: Write the failing repository tests**

Test SQL calls using the same injected `DatabaseService` pattern as `DocumentsRepository`. Cover active-link lookup filtering `revoked_at IS NULL`, token lookup, and insert arguments.

- [ ] **Step 2: Run the focused API test and verify it fails**

Run: `pnpm --filter api test -- src/documents/share-link.repository.spec.ts`

Expected: FAIL because the repository and migration contract do not exist.

- [ ] **Step 3: Add the migration**

Create `document_share_link` with `token TEXT PRIMARY KEY`, `document_id UUID REFERENCES document(id) ON DELETE CASCADE`, `created_by UUID REFERENCES app_user(id) ON DELETE CASCADE`, timestamps, nullable `revoked_at`, and a partial unique index enforcing one active link per document.

- [ ] **Step 4: Implement repository methods**

Use parameterized SQL and return `null` when no row exists. Keep token generation outside the repository so the service owns cryptographic randomness.

- [ ] **Step 5: Run the focused test and typecheck**

Run: `pnpm --filter api test -- src/documents/share-link.repository.spec.ts` and `pnpm --filter api typecheck`.

Expected: PASS with no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/migrations/005-add-document-share-links.sql apps/api/src/documents/share-link-types.ts apps/api/src/documents/share-link.repository.ts apps/api/src/documents/share-link.repository.spec.ts
git commit -m "feat(api): add document share link storage"
```

### Task 2: API service and endpoints

**Files:**
- Create: `apps/api/src/documents/share-link.service.ts`
- Modify: `apps/api/src/documents/documents.module.ts`
- Modify: `apps/api/src/documents/documents.controller.ts`
- Test: `apps/api/src/documents/share-link.service.spec.ts`
- Test: `apps/api/src/documents/documents.controller.spec.ts`

**Interfaces:**
- `ShareLinkService.createOrGet(documentId, userId): Promise<{ token: string }>`
- `ShareLinkService.accept(token, userId): Promise<{ documentId: string; role: "editor" }>`
- `POST /documents/:documentId/share-link` returns `{ token }`.
- `POST /share/:token/accept` returns `{ documentId, role: "editor" }`.

- [ ] **Step 1: Write failing service tests**

Cover editor/owner creation, viewer rejection, active-token reuse, random token creation, invalid token 404, and acceptance upgrading a viewer to editor without downgrading owner/editor memberships.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter api test -- src/documents/share-link.service.spec.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement service and wire repository/module**

Use `randomBytes(32).toString("base64url")`, call `DocumentsService.assertCanWrite` for creation, and update/insert membership in a transaction-safe repository method on acceptance. Preserve owner/editor roles and promote viewer to editor.

- [ ] **Step 4: Add controller routes and auth behavior**

Apply the existing `AuthenticatedIdentityGuard` to the creation route. For acceptance, allow the controller to return 401 when `CurrentUser` has no authenticated user; do not accept a user ID from arbitrary request body data.

- [ ] **Step 5: Add controller tests and run API verification**

Run: `pnpm --filter api test -- src/documents/share-link.service.spec.ts src/documents/documents.controller.spec.ts` and `pnpm --filter api typecheck`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/documents apps/api/src/auth apps/api/src/documents/documents.module.ts
git commit -m "feat(api): accept document share links"
```

### Task 3: Share dialog and toolbar integration

**Files:**
- Create: `apps/web/components/inkspace/share-dialog.tsx`
- Modify: `apps/web/components/inkspace/toolbar.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.tsx`
- Test: `apps/web/components/inkspace/share-dialog.test.tsx`

**Interfaces:**
- `ShareDialog({ apiUrl, documentId, disabled }): JSX.Element`.
- It receives the current document ID from `DocumentWorkspace` and builds a same-origin `/share/<token>` URL.

- [ ] **Step 1: Write failing UI tests**

Assert clicking “分享” calls `POST /documents/:id/share-link` with credentials, renders the copyable URL, and exposes a useful error when the API fails. Test the copy action with `navigator.clipboard.writeText`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter web test -- components/inkspace/share-dialog.test.tsx`

Expected: FAIL because the dialog and share callback do not exist.

- [ ] **Step 3: Implement dialog and wire toolbar**

Keep dialog state local, show loading/error/success states, use `window.location.origin` for the link, and disable sharing for viewers. Replace the current inert toolbar button with the dialog trigger while preserving existing toolbar styling.

- [ ] **Step 4: Run focused tests and formatting**

Run: `pnpm exec prettier --write apps/web/components/inkspace/share-dialog.tsx apps/web/components/inkspace/share-dialog.test.tsx apps/web/components/inkspace/toolbar.tsx apps/web/components/inkspace/document-workspace.tsx` and `pnpm --filter web test -- components/inkspace/share-dialog.test.tsx`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/inkspace/share-dialog.tsx apps/web/components/inkspace/share-dialog.test.tsx apps/web/components/inkspace/toolbar.tsx apps/web/components/inkspace/document-workspace.tsx
git commit -m "feat(web): add document share dialog"
```

### Task 4: Share acceptance route and login handoff

**Files:**
- Create: `apps/web/app/share/[token]/page.tsx`
- Test: `apps/web/app/share/[token]/page.test.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Test: `apps/web/app/login/page.test.tsx`

**Interfaces:**
- Share route accepts `token` from `useParams`, posts to `/share/:token/accept`, then replaces the URL with `/documents/:documentId`.
- Login handoff preserves `/share/<token>` as a safe `returnTo` and returns there after login.

- [ ] **Step 1: Write failing route tests**

Cover authenticated acceptance, 401-to-login redirect preserving encoded return URL, invalid-token error display, and login success navigating back to the share route.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter web test -- app/share/[token]/page.test.tsx app/login/page.test.tsx`

Expected: FAIL because the share route and handoff behavior do not exist.

- [ ] **Step 3: Implement share route**

Use `useAuth` and `useRouter`; wait for auth loading, call the same-origin acceptance endpoint with credentials, and use `router.replace` for both login and final document navigation. Never interpolate untrusted external URLs into `returnTo`.

- [ ] **Step 4: Extend login return target handling**

Keep the existing safe-path check and ensure `/share/<token>` survives login unchanged, while defaulting unrelated or external values to `/documents`.

- [ ] **Step 5: Run focused tests and formatting**

Run: `pnpm exec prettier --write apps/web/app/share/[token]/page.tsx apps/web/app/share/[token]/page.test.tsx apps/web/app/login/page.tsx apps/web/app/login/page.test.tsx` and `pnpm --filter web test -- app/share/[token]/page.test.tsx app/login/page.test.tsx`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/share apps/web/app/login/page.tsx apps/web/app/login/page.test.tsx
git commit -m "feat(web): accept document share links"
```

### Task 5: Full verification and handoff

**Files:**
- No new files; review all previous task changes.

- [ ] **Step 1: Run API tests and typecheck**

Run: `pnpm --filter api test` and `pnpm --filter api typecheck`.

- [ ] **Step 2: Run Web tests and typecheck**

Run: `pnpm --filter web test` and `pnpm --filter web typecheck`.

- [ ] **Step 3: Review migration and route security**

Confirm token queries are parameterized, only write-capable members can create links, acceptance never trusts a posted user ID, and all redirect targets are same-origin paths.

- [ ] **Step 4: Commit any verification-only fixes**

If verification exposes an issue, add a focused regression test first, then commit the minimal fix with a message describing the issue.

