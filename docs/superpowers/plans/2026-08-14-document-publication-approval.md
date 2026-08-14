# Document Publication Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-authoritative draft/pending/published workflow with admin approval, editor controls, an admin queue, and a public `/square` page.

**Architecture:** Store publication metadata on `document` and a global `role` on `app_user`. `DocumentsService` owns membership and publication authorization; an approval service performs conditional transactional transitions so concurrent admins cannot overwrite each other. Web routes call the API using the existing `x-dev-user-id` development identity convention and render only API-provided state.

**Tech Stack:** NestJS, PostgreSQL migrations, Next.js 16 App Router, React, existing `@workspace/ui` components, Vitest/Jest project test conventions, Prettier with Tailwind plugin.

## Global Constraints

- Preserve existing dependencies and project patterns; do not add a new package.
- Server is the only publication state source; transitions must check the current state in the update predicate.
- Roles are `owner | editor | viewer` per document and `user | admin` globally; default global role is `user`.
- `owner` and `editor` may submit; `viewer` may not; only `admin` may approve or reject.
- Rejection requires a non-empty reason and returns the document to editable `draft`.
- `/square` and `/square/articles` expose only `published` documents.
- Every materially modified code block includes a useful intent/data-flow comment.
- Follow repository formatting: LF, double quotes, no semicolons, two spaces, trailing commas, 80 columns, Tailwind class sorting.
- Read the relevant Next.js App Router guide under `apps/web/node_modules/next/dist/docs/` before editing web routes.

---

### Task 1: Persist publication state and administrator role

**Files:**

- Create: `apps/api/src/database/migrations/<next>_document_publication_approval.sql` (use the repository's migration naming/runner convention)
- Modify: `apps/api/src/auth/user.repository.ts`
- Modify: `apps/api/src/auth/dev-user.ts` and any identity response types that expose user data
- Test: `apps/api/src/auth/user.repository.spec.ts` (or the existing auth repository test location)
- Test: migration/integration fixture files that assert `app_user` and `document` schemas

**Interfaces:**

- `UserRecord.role: "user" | "admin"`, with `user` as the database default.
- `DocumentRow.publication_status: "draft" | "pending" | "published"`, `rejection_reason`, `published_at`, `published_by`.

- [ ] **Step 1: Write failing schema/repository tests** asserting new users default to `user`, existing rows read as `draft`, and publication columns round-trip.
- [ ] **Step 2: Run the focused API tests** with `pnpm --filter api test -- user.repository` (or the repository's exact focused test command) and verify failure on missing columns/role.
- [ ] **Step 3: Add the migration** with nullable publication metadata, a check constraint for valid status values, indexes for pending/public queries, and a foreign key from `published_by` to `app_user`.
- [ ] **Step 4: Extend repository/user identity types and queries** without changing existing callers; include a comment explaining why old rows are backfilled to `draft`.
- [ ] **Step 5: Run focused tests and the API typecheck**; commit as `feat(api): persist publication approval state`.

### Task 2: Implement document publication state machine and admin APIs

**Files:**

- Modify: `apps/api/src/documents/document-types.ts`
- Modify: `apps/api/src/documents/documents.repository.ts`
- Modify: `apps/api/src/documents/documents.service.ts`
- Modify: `apps/api/src/documents/documents.controller.ts`
- Modify/create: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/authenticated-identity.guard.ts`, and centralized admin authorization helper as needed
- Test: `apps/api/src/documents/documents.repository.spec.ts`
- Test: `apps/api/src/documents/documents.service.spec.ts`
- Test: `apps/api/src/documents/documents.controller.spec.ts`
- Test: new integration coverage beside existing document integration specs

**Interfaces:**

- `PublicationStatus = "draft" | "pending" | "published"`.
- `DocumentsService.submitPublication(documentId, userId): Promise<DocumentMetadata>`.
- `DocumentsService.listPendingPublications(adminUserId): Promise<PublicationMetadata[]>`.
- `DocumentsService.approvePublication(documentId, adminUserId): Promise<PublicationMetadata>`.
- `DocumentsService.rejectPublication(documentId, adminUserId, reason): Promise<PublicationMetadata>`.
- `DocumentsService.listPublishedArticles(): Promise<PublishedArticle[]>`.
- Routes: `POST /documents/:documentId/submit-publication`, `GET /admin/publications?status=pending`, `POST /admin/publications/:documentId/approve`, `POST /admin/publications/:documentId/reject`, `GET /square/articles`.

- [ ] **Step 1: Add failing unit tests** for owner/editor submission, viewer denial, draft-only submission, admin-only approval/rejection, required rejection reason, and published-only listing.
- [ ] **Step 2: Add failing integration tests** proving two concurrent approvals produce one success and one conflict, and rejected documents can be resubmitted after editing.
- [ ] **Step 3: Implement repository queries** using conditional `UPDATE ... WHERE publication_status = ... RETURNING *` and transactions for approval/rejection; map rows to explicit API DTOs.
- [ ] **Step 4: Implement service authorization** using existing membership checks plus centralized global-role lookup; clear rejection metadata on resubmission and set approver/timestamps on approval.
- [ ] **Step 5: Add controller routes and request validation** using existing NestJS guards/decorators; return 403 for non-admins and 409 for stale state transitions.
- [ ] **Step 6: Run all API document/auth tests and typecheck**; commit as `feat(api): add publication approval workflow`.

### Task 3: Wire editor toolbar publication state and submission

**Files:**

- Modify: `apps/web/components/inkspace/toolbar.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.tsx`
- Modify: relevant document route data loader/types under `apps/web/app/documents/`
- Test: toolbar and workspace component tests colocated with existing web tests

**Interfaces:**

- Toolbar props include `publicationStatus`, `canPublish`, and `onPublish`.
- `DocumentWorkspace` loads the document metadata status, calls `POST /documents/:id/submit-publication`, and refreshes status after success.

- [ ] **Step 1: Write failing component tests** for draft button text/action, pending disabled `待审批`, published `已发布`, and viewer inability to submit.
- [ ] **Step 2: Run focused web tests** and verify failure.
- [ ] **Step 3: Implement status loading and submit callback** with existing alert/toast conventions; keep button dimensions and Pencil styling unchanged, adding only state-dependent labels/disabled behavior.
- [ ] **Step 4: Run focused tests and `pnpm --filter web typecheck`**; commit as `feat(web): connect editor publication approval state`.

### Task 4: Connect `/admin/articles` to pending queue and decisions

**Files:**

- Modify: `apps/web/app/admin/articles/page.tsx`
- Modify: `apps/web/components/admin/article-management-page.tsx`
- Modify: `apps/web/components/admin/article-table.tsx`
- Create/modify: existing `@workspace/ui` Dialog/Input/Textarea usage files if needed
- Test: admin article page/component tests

**Interfaces:**

- Fetch `GET /admin/publications?status=pending` with the current identity header.
- Approve via `POST /admin/publications/:documentId/approve`.
- Reject via `POST /admin/publications/:documentId/reject` body `{ reason: string }`.

- [ ] **Step 1: Write failing tests** for pending filtering, approve removing a row, reject dialog validation, API error retention, and non-admin forbidden state.
- [ ] **Step 2: Implement API-backed loading/mutations** while retaining the existing Pencil layout; use the project Dialog and form controls for rejection.
- [ ] **Step 3: Add loading, empty, and error states** consistent with existing admin page conventions and preserve Select-based filters.
- [ ] **Step 4: Run admin page tests and web typecheck**; commit as `feat(web): add admin publication queue`.

### Task 5: Build the public square page

**Files:**

- Read first: `apps/web/node_modules/next/dist/docs/01-app` App Router route/data-fetching guide relevant to this page.
- Create: `apps/web/app/square/page.tsx`
- Create: public article presentation component under `apps/web/components/square/`
- Create/modify: public article detail route only if the existing document reader can safely render published content
- Test: `apps/web/app/square/page.test.tsx` and component tests

**Interfaces:**

- Server/client fetch consumes only `GET /square/articles` response fields: id, title, author, publishedAt, excerpt/content.
- No client-side filtering may expose draft or pending records.

- [ ] **Step 1: Write failing tests** for published article rendering, empty state, loading/error state, and absence of unpublished records.
- [ ] **Step 2: Implement `/square` using existing layout, typography, and UI primitives**; keep the page focused on the article list and link to the safe public reader path.
- [ ] **Step 3: Run square page tests and typecheck**; commit as `feat(web): add published article square`.

### Task 6: Full verification and integration cleanup

**Files:**

- Modify only files revealed by verification (tests, DTO/type mismatches, formatting)
- Preserve `docs/superpowers/specs/2026-08-14-document-publication-approval-design.md` and this plan

- [ ] **Step 1: Run Prettier on all modified files** using the repository's configured command and inspect the diff for accidental visual changes.
- [ ] **Step 2: Run the complete monorepo test suite** and API/web typechecks.
- [ ] **Step 3: Exercise the end-to-end state flow**: draft -> pending -> approved/published and pending -> rejected/draft -> resubmitted, including viewer/admin authorization.
- [ ] **Step 4: Review git diff/status**, ensure the `.pen` file remains tracked, and commit verification fixes as `test: verify publication approval flow`.

## Self-Review

- Spec coverage: persistence and roles (Task 1), state machine and every API route (Task 2), editor states (Task 3), admin queue and rejection reason (Task 4), published-only square (Task 5), and formatting/concurrency verification (Task 6).
- No placeholder steps or undefined cross-task method names remain; each later task consumes interfaces defined earlier.
- Rejected content remains editable as `draft`; published content is never exposed by pending/admin or square queries.
