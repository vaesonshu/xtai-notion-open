-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "workspace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "parent_id" UUID,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "owner_id" UUID,
    "publication_status" TEXT NOT NULL DEFAULT 'draft',
    "rejection_reason" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_member" (
    "document_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_member_pkey" PRIMARY KEY ("document_id","user_id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_share_link" (
    "token" TEXT NOT NULL,
    "document_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_share_link_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "yjs_snapshot" (
    "id" BIGSERIAL NOT NULL,
    "document_id" UUID NOT NULL,
    "snapshot" BYTEA NOT NULL,
    "sequence" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yjs_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yjs_update" (
    "id" BIGSERIAL NOT NULL,
    "document_id" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "update" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yjs_update_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_workspace_id_idx" ON "document"("workspace_id");

-- CreateIndex
CREATE INDEX "document_parent_id_idx" ON "document"("parent_id");

-- CreateIndex
CREATE INDEX "document_owner_id_idx" ON "document"("owner_id");

-- CreateIndex
CREATE INDEX "document_publication_status_idx" ON "document"("publication_status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "document_member_user_id_idx" ON "document_member"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_session_token_hash_key" ON "user_session"("token_hash");

-- CreateIndex
CREATE INDEX "user_session_user_id_idx" ON "user_session"("user_id");

-- CreateIndex
CREATE INDEX "yjs_snapshot_document_id_sequence_idx" ON "yjs_snapshot"("document_id", "sequence" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "yjs_update_document_id_sequence_key" ON "yjs_update"("document_id", "sequence");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_member" ADD CONSTRAINT "document_member_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_share_link" ADD CONSTRAINT "document_share_link_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_share_link" ADD CONSTRAINT "document_share_link_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "yjs_snapshot" ADD CONSTRAINT "yjs_snapshot_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "yjs_update" ADD CONSTRAINT "yjs_update_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Prisma 无法在 schema 中建模 PARTIAL UNIQUE INDEX，但真实库存在该索引，
-- 手动补入基线以保持“可从空库重建出与当前库一致的 schema”。
CREATE UNIQUE INDEX "document_share_link_active_document_idx" ON "document_share_link"("document_id")
WHERE "revoked_at" IS NULL;
