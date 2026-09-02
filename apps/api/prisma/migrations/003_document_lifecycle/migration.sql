-- 软删除：移入回收站而非立即级联删除 Yjs 快照
ALTER TABLE "document"
ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "document_deleted_at_idx" ON "document" ("deleted_at");

-- 收藏与最近打开（按用户偏好，不写入协作文档）
CREATE TABLE "user_document_pref" (
  "user_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "is_favorite" BOOLEAN NOT NULL DEFAULT false,
  "last_opened_at" TIMESTAMPTZ(6),
  CONSTRAINT "user_document_pref_pkey" PRIMARY KEY ("user_id", "document_id"),
  CONSTRAINT "user_document_pref_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "user_document_pref_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "document" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "user_document_pref_favorite_idx"
  ON "user_document_pref" ("user_id", "is_favorite");

CREATE INDEX "user_document_pref_recent_idx"
  ON "user_document_pref" ("user_id", "last_opened_at" DESC);
