-- 协作文档块级评论：锚定在 blockContainer.attrs.id，不写入 Yjs 文档。
CREATE TABLE "document_comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "block_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_comment_document_id_block_id_created_at_idx"
    ON "document_comment"("document_id", "block_id", "created_at");

CREATE INDEX "document_comment_document_id_created_at_idx"
    ON "document_comment"("document_id", "created_at");

ALTER TABLE "document_comment"
    ADD CONSTRAINT "document_comment_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "document"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_comment"
    ADD CONSTRAINT "document_comment_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_comment"
    ADD CONSTRAINT "document_comment_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "document_comment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
