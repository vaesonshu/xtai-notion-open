-- CreateTable
CREATE TABLE "article_comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "article_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_comment_article_id_created_at_idx" ON "article_comment"("article_id", "created_at");

-- AddForeignKey
ALTER TABLE "article_comment" ADD CONSTRAINT "article_comment_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comment" ADD CONSTRAINT "article_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_comment" ADD CONSTRAINT "article_comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "article_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
