-- 文档评论支持块内选区锚点（字符偏移，相对 block 正文 plain text）
ALTER TABLE "document_comment"
    ADD COLUMN "anchor_from" INTEGER,
    ADD COLUMN "anchor_to" INTEGER;
