-- 方舟 Agent Plan 的 doubao-embedding-vision 输出 1024 维，1536 列装不下。
-- 已写入的分块维度对不上，删掉后由重新索引再用正文生成；这里不自动排队，
-- 避免旧进程在新代码起来之前把来源再次标成失败。

DELETE FROM "knowledge_chunk";

ALTER TABLE "knowledge_chunk"
  ALTER COLUMN "embedding" TYPE vector(1024);
