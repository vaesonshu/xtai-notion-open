# Task 1 Report — Database migration and Prisma schema

## Status

**DONE_WITH_CONCERNS**

Schema and migration SQL are complete; Prisma client regenerated successfully. `prisma migrate deploy` could not run because the Neon database is not baselined for Prisma Migrate (P3005).

## Commits

**uncommitted** — user did not request a commit.

## Changes

### `apps/api/prisma/schema.prisma`

- Extended `Workspace` with `createdBy`, `updatedAt`, `creator`, and `members` relations.
- Added `WorkspaceMember` model (`@@id([workspaceId, userId])`, index on `userId`).
- Added `AppUser.createdWorkspaces` and `AppUser.workspaceMembers` relations.

### `apps/api/prisma/migrations/007_workspace_members/migration.sql`

1. **DDL**: `ALTER TABLE workspace` adds `created_by` (UUID FK → `app_user`) and `updated_at`.
2. **DDL**: `CREATE TABLE workspace_member` with composite PK and FKs.
3. **Backfill — merge by owner**: For each distinct `document.owner_id`, inserts one workspace named `我的知识库`, maps owner → workspace in temp table `owner_workspace_map`, reassigns all owned documents.
4. **Backfill — NULL owner_id** (per design spec): Documents without `owner_id` first join `document_member` where `role = 'owner'` (cast `user_id::uuid`); remaining orphans go to a singleton `未分类` workspace.
5. **Backfill — owners**: Inserts `workspace_member` rows with `role = 'owner'` from `owner_workspace_map`.
6. **Backfill — collaborators**: Aggregates `document_member` per `(workspace_id, user_id)` using role priority `owner > admin > editor > viewer`; casts legacy TEXT `user_id` to UUID via regex guard; upserts with priority-aware `ON CONFLICT`.
7. **Cleanup**: `DELETE FROM workspace` where no documents reference the row.

## Tests

| Command | Result |
|---------|--------|
| `pnpm exec prisma generate` (in `apps/api`) | **PASS** — client generated to `apps/api/src/generated/prisma`; includes `WorkspaceMember` model |
| `pnpm exec prisma migrate deploy` (in `apps/api`) | **FAIL** — `P3005`: database schema is not empty (no Prisma migration baseline; prior history used node-pg-migrate) |
| `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` | **PASS** — diff matches expected DDL (`created_by`, `updated_at`, `workspace_member` table + FKs) |

No unit/integration tests were run; Task 1 is schema/migration-only.

## Concerns

1. **P3005 baseline required**: Production Neon DB was not initialized via `prisma migrate`. Before deploy, either baseline `_prisma_migrations` for migrations `0_init`–`006`, or apply `007_workspace_members/migration.sql` manually via Neon SQL editor / `psql`, then record the migration.
2. **Legacy `document_member.user_id` is TEXT**: Backfill casts with `::uuid` and skips non-UUID values. Orphan TEXT user IDs will not appear in `workspace_member`; verify production data has UUID-shaped `user_id` values.
3. **Data mutation is irreversible**: Merging workspaces reassigns `document.workspace_id` and deletes orphan workspaces. Take a Neon snapshot/backup before applying in production.
4. **Brief vs design spec**: Brief lists 6 steps; design spec adds NULL-`owner_id` handling — implemented per design spec to avoid data loss.

## Verification checklist

- [x] `schema.prisma` includes `WorkspaceMember` and extended `Workspace`
- [x] `007_workspace_members/migration.sql` written with full backfill
- [x] `pnpm exec prisma generate` succeeds
- [ ] `prisma migrate deploy` applied to database (blocked by baseline)
- [x] Generated client includes `WorkspaceMember` types

## Next steps (Task 2+)

1. Baseline or manually apply migration 007 on Neon.
2. Proceed with `WorkspacesModule` repository/service implementation.
