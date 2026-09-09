# 本地 PostgreSQL 开发库

用于对比 Neon 远程库与本地库的 API 延迟。本地库数据与 Neon **相互独立**，需重新注册账号或手动迁移数据。

## 前置条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 已安装并**正在运行**

## 快速开始

```bash
# 1. 启动本地 Postgres 并跑迁移
pnpm db:local:setup

# 2. 配置环境（首次）
cp apps/api/.env.local.example apps/api/.env.local

# 3. 使用本地库启动 API + Web（.env.local 覆盖 DATABASE_URL）
pnpm dev:local
```

仅 API 使用本地库时：

```bash
pnpm --filter api dev:local
pnpm --filter web dev
```

## 切回 Neon

停止 `dev:local`，改回 `pnpm dev`（只读 `apps/api/.env` 中的 Neon `DATABASE_URL`）即可。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm db:local:up` | 启动 Postgres 容器 |
| `pnpm db:local:down` | 停止并移除容器（数据卷保留） |
| `pnpm db:local:reset` | 删卷并重建空库 + 迁移 |
| `pnpm --filter api migrate:local` | 对本地库执行 `prisma migrate deploy` |
| `pnpm --filter api prisma:studio:local` | Prisma Studio 连本地库 |

## 连接信息

| 项 | 值 |
|----|-----|
| Host | `127.0.0.1:5432` |
| Database | `xtai_notion` |
| User / Password | `xtai` / `xtai_local_dev` |

## 驱动说明

- **Neon（默认）**：`DATABASE_URL` 指向 Neon 时使用 `@prisma/adapter-neon`
- **本地 Postgres**：设置 `DATABASE_DRIVER=postgres`，或 URL 含 `localhost` / `127.0.0.1` 时自动使用 `@prisma/adapter-pg`（TCP 直连，无跨区网络延迟）
