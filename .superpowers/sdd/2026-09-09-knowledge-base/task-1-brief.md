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
