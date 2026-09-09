-- 知识库成员表 + 按 document.owner_id 合并 workspace
-- 修复「每建一篇文档就新建一个 workspace」的历史问题，并回填 workspace_member。

-- 1. 扩展 workspace：记录创建者与更新时间
ALTER TABLE "workspace"
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "workspace"
  ADD CONSTRAINT "workspace_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "app_user" ("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- 2. 创建 workspace_member（库级成员与角色）
CREATE TABLE "workspace_member" (
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_member_pkey" PRIMARY KEY ("workspace_id", "user_id"),
  CONSTRAINT "workspace_member_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspace" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "workspace_member_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "workspace_member_user_id_idx" ON "workspace_member" ("user_id");

-- 3. 为每个 document.owner_id 创建 canonical workspace 并迁移文档
CREATE TEMP TABLE owner_workspace_map (
  owner_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL
);

WITH owners AS (
  SELECT DISTINCT owner_id
  FROM "document"
  WHERE owner_id IS NOT NULL
),
inserted AS (
  INSERT INTO "workspace" ("name", "created_by", "created_at", "updated_at")
  SELECT
    '我的知识库',
    owners.owner_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM owners
  RETURNING "id", "created_by"
)
INSERT INTO owner_workspace_map ("owner_id", "workspace_id")
SELECT inserted."created_by", inserted."id"
FROM inserted
WHERE inserted."created_by" IS NOT NULL;

UPDATE "document" AS d
SET
  "workspace_id" = m."workspace_id",
  "updated_at" = CURRENT_TIMESTAMP
FROM owner_workspace_map AS m
WHERE d."owner_id" = m."owner_id";

-- owner_id 为空：优先归入 document_member 中 role=owner 的用户知识库
UPDATE "document" AS d
SET
  "workspace_id" = m."workspace_id",
  "updated_at" = CURRENT_TIMESTAMP
FROM "document_member" AS dm
INNER JOIN owner_workspace_map AS m ON m."owner_id" = dm."user_id"::uuid
WHERE d."owner_id" IS NULL
  AND d."id" = dm."document_id"
  AND dm."role" = 'owner'
  AND dm."user_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 仍未归属的 owner_id 为空文档：归入「未分类」库（单例，避免丢数据）
WITH uncategorized AS (
  INSERT INTO "workspace" ("name", "created_at", "updated_at")
  SELECT '未分类', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  WHERE EXISTS (
    SELECT 1
    FROM "document" AS d
    WHERE d."owner_id" IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM owner_workspace_map AS m
        WHERE m."workspace_id" = d."workspace_id"
      )
  )
  RETURNING "id"
)
UPDATE "document" AS d
SET
  "workspace_id" = uncategorized."id",
  "updated_at" = CURRENT_TIMESTAMP
FROM uncategorized
WHERE d."owner_id" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM owner_workspace_map AS m
    WHERE m."workspace_id" = d."workspace_id"
  );

-- 4. 文档 owner 写入 workspace_member（role = owner）
INSERT INTO "workspace_member" ("workspace_id", "user_id", "role", "created_at")
SELECT m."workspace_id", m."owner_id", 'owner', CURRENT_TIMESTAMP
FROM owner_workspace_map AS m
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

-- 5. 从 document_member 回填协作者（同库同用户取最高角色：owner > admin > editor > viewer）
WITH member_roles AS (
  SELECT
    d."workspace_id",
    dm."user_id"::uuid AS "user_id",
    dm."role",
    CASE dm."role"
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'editor' THEN 2
      WHEN 'viewer' THEN 1
      ELSE 0
    END AS "role_rank",
    dm."created_at"
  FROM "document_member" AS dm
  INNER JOIN "document" AS d ON d."id" = dm."document_id"
  WHERE dm."user_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
best_roles AS (
  SELECT DISTINCT ON ("workspace_id", "user_id")
    "workspace_id",
    "user_id",
    "role",
    "created_at"
  FROM member_roles
  ORDER BY "workspace_id", "user_id", "role_rank" DESC, "created_at" ASC
)
INSERT INTO "workspace_member" ("workspace_id", "user_id", "role", "created_at")
SELECT "workspace_id", "user_id", "role", "created_at"
FROM best_roles
ON CONFLICT ("workspace_id", "user_id") DO UPDATE
SET "role" = CASE
  WHEN CASE EXCLUDED."role"
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END > CASE "workspace_member"."role"
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END THEN EXCLUDED."role"
  ELSE "workspace_member"."role"
END;

-- 6. 清理无任何 document 引用的 orphan workspace
DELETE FROM "workspace" AS w
WHERE NOT EXISTS (
  SELECT 1 FROM "document" AS d WHERE d."workspace_id" = w."id"
);
