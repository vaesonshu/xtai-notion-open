# Task 22 报告：Document Authorization Integration（6.6）

## 状态

GREEN。Task 6.6 已完成并在 `tasks.md` 勾选。

## 环境

- 本地 `apps/api/.env`（gitignore，未提交）提供 `DATABASE_URL`、`PORT=3100`、`COLLABORATION_PORT=3101`、`NODE_ENV=test`
- Neon host：`ep-small-silence-afqpkpmv-pooler.c-2.us-west-2.aws.neon.tech`（未记录密码）
- 根 `.gitignore` 调整为 `.env` / `.env.*`，并例外允许 `!.env.example` / `!**/.env.example`
- 新增 `apps/api/.env.example`（占位符，无真实密钥）

## 实现

- `vitest.integration.setup.ts`：从 `apps/api/.env` 加载环境变量（不覆盖已有 process env）
- `vitest.integration.config.ts`：改用集成 setup；放宽 timeout
- `src/documents/documents.authorization.integration.spec.ts`：
  - Nest `TestingModule` + 真实 `AppModule` / `DatabaseService`
  - migrate 后 seed：workspace + document + owner/editor/viewer 成员（outsider 不入成员表）
  - 验收：非成员 GET/service → 403；viewer 可读、`assertCanWrite` 403；owner/editor 可读可写（含 HTTP `GET /documents/:id`）
- `package.json` `migrate`：`node --env-file=.env ...` 便于本地跑迁移

## 验证

```powershell
pnpm --filter api migrate
pnpm --filter api test:integration
pnpm --filter api lint
pnpm --filter api typecheck
```

结果：全部退出码 `0`。

- migrate：`No migrations to run!` / `Migrations complete!`（schema 已在库中）
- integration：1 文件、3 通过（约 12.7s）
- lint / typecheck：通过

## 自审

- `.env` 未纳入提交；报告不含连接串密码。
- seed 在 `afterAll` 通过删除 workspace 级联清理。
- HTTP 与 `DocumentsService` 双路径覆盖读权限；写权限经 `assertCanWrite`（HTTP 尚无写端点）。

## 顾虑

- Neon pooler + `sslmode=require` 触发 `pg-connection-string` 关于将来 `verify-full` 语义的 Node 警告；功能不受影响。
- 集成测试依赖可达的 Neon；无 `DATABASE_URL` 时无法本地跑通。
- migrate 显示已无待执行迁移；若空库需确保 `001-create-collaboration-schema.sql` 的 Up/Down 注释格式仍被 node-pg-migrate 正确拆分。
