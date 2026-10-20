-- 用户级云端 AI 配置（OpenAI 兼容接口），供个人中心维护。
ALTER TABLE "app_user"
ADD COLUMN IF NOT EXISTS "ai_settings" JSONB;
