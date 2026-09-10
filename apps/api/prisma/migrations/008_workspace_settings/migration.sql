-- 知识库级 AI 策略（如是否使用本地 Codex），路径仍仅存本机 bridge 配置。
ALTER TABLE "workspace"
ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}'::jsonb;
