-- 知识库可见性：private（默认）仅成员；public 时非成员可读已发布文档。
ALTER TABLE "workspace"
ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'private';

CREATE INDEX IF NOT EXISTS "workspace_visibility_public_idx"
ON "workspace" ("visibility")
WHERE "visibility" = 'public';
