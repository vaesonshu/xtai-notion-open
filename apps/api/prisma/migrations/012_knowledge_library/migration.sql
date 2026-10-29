-- 资料库向量检索：启用 pgvector，并建立库、成员、来源、分块四张表。
-- 第一期不做近似向量索引，查询先按 library_id 过滤再做精确余弦距离。

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "knowledge_library" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_by" UUID,
    "embedding_settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "embedding_revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_library_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_library_member" (
    "library_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_library_member_pkey" PRIMARY KEY ("library_id", "user_id")
);

CREATE TABLE "knowledge_source" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "active_generation" INTEGER NOT NULL DEFAULT 0,
    "indexed_content_hash" TEXT,
    "body_text" TEXT,
    "source_document_id" UUID,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "byte_size" INTEGER,
    "locked_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_source_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_chunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "heading" TEXT,
    "page" INTEGER,
    "embedding" vector(1536) NOT NULL,
    "embedding_revision" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_library_member_user_id_idx"
ON "knowledge_library_member" ("user_id");

CREATE INDEX "knowledge_source_library_id_status_idx"
ON "knowledge_source" ("library_id", "status");

CREATE INDEX "knowledge_chunk_library_id_idx"
ON "knowledge_chunk" ("library_id");

CREATE INDEX "knowledge_chunk_source_id_generation_idx"
ON "knowledge_chunk" ("source_id", "generation");

CREATE UNIQUE INDEX knowledge_source_library_document_uidx
ON knowledge_source (library_id, source_document_id)
WHERE kind = 'document_snapshot' AND source_document_id IS NOT NULL;

ALTER TABLE "knowledge_library"
  ADD CONSTRAINT "knowledge_library_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "app_user" ("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "knowledge_library_member"
  ADD CONSTRAINT "knowledge_library_member_library_id_fkey"
  FOREIGN KEY ("library_id") REFERENCES "knowledge_library" ("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "knowledge_library_member"
  ADD CONSTRAINT "knowledge_library_member_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_user" ("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "knowledge_source"
  ADD CONSTRAINT "knowledge_source_library_id_fkey"
  FOREIGN KEY ("library_id") REFERENCES "knowledge_library" ("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "knowledge_source"
  ADD CONSTRAINT "knowledge_source_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "app_user" ("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "knowledge_chunk"
  ADD CONSTRAINT "knowledge_chunk_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "knowledge_source" ("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
