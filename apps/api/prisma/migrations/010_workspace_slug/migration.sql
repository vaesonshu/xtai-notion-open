-- 知识库短链 slug，用于 /w/:slug 等友好 URL。
ALTER TABLE "workspace"
ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_slug_key"
ON "workspace" ("slug")
WHERE "slug" IS NOT NULL;
