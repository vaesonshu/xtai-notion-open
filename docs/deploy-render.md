# 在 Render 上部署协作服务（Hocuspocus）

本项目的 **REST API** 适合放在 Vercel Serverless；**实时协作 WebSocket** 需要长连接进程，应单独部署在 [Render](https://render.com) 免费层。

## 架构

```text
Vercel (Web + REST API)          Render (协作 WS)           Neon (Postgres)
        │                                │                         │
        │  NEXT_PUBLIC_API_URL           │  wss://xxx.onrender.com │
        └────────────────────────────────┴─────────────────────────┘
                              共用 DATABASE_URL
```

## 前置条件

- GitHub / GitLab 仓库已推送本 monorepo
- [Neon](https://neon.tech) 数据库已创建，`DATABASE_URL` 使用 **带 `-pooler` 的池化连接串**
- 本地已跑通 `pnpm --filter api prisma migrate deploy`

## 部署步骤（约 5 分钟）

### 1. 推送代码到 GitHub

确保仓库根目录包含 `render.yaml` 与 `apps/api/src/collab-main.ts`，并将改动 push 到远程。

### 2. 在 Render 创建服务

1. 打开 [Render Dashboard](https://dashboard.render.com/)
2. 点击 **New** → **Blueprint**
3. 连接你的 GitHub 仓库
4. 在环境变量表单中填写 **`DATABASE_URL`**（Neon 池化连接串，与 API 侧相同）
5. 点击 **Apply**，等待构建完成

> 若不用 Blueprint，见下方 [方式 B：手动创建 Web Service](#方式-b手动创建-web-service)。

### 3. 配置前端环境变量

部署成功后记下服务地址，例如：`https://xtai-collaboration.onrender.com`

在 **Vercel** 项目环境变量，或本地 `apps/web/.env.local` 中设置：

```env
NEXT_PUBLIC_COLLABORATION_URL=wss://xtai-collaboration.onrender.com
```

注意使用 **`wss://`**（不是 `ws://`）。`NEXT_PUBLIC_API_URL` 仍指向 Vercel 或本地 API，无需改动。

### 4. 验证

1. 浏览器访问 `https://xtai-collaboration.onrender.com` → 应显示 `Welcome to Hocuspocus!`
2. 更新 `NEXT_PUBLIC_COLLABORATION_URL` 后重启 Web（Vercel 重新部署或本地 `pnpm dev`）
3. 打开文档页 → 编辑器协作状态应从「连接中」变为「已同步」

### 整体架构（速览）

| 组件 | 平台 | 入口 |
|------|------|------|
| Web + REST API | Vercel | `serverless.ts` |
| 协作 WebSocket | Render（免费层） | `collab-main.ts` |
| 数据库 | Neon | 两边共用 `DATABASE_URL` |

## 方式 A：Blueprint（推荐）

仓库根目录已包含 [`render.yaml`](../render.yaml)。

上述 [部署步骤](#部署步骤约-5-分钟) 已覆盖 Blueprint 流程；以下为补充说明：

1. Render 会读取 `render.yaml` 自动配置 Build / Start 命令与健康检查
2. 服务默认名为 `xtai-collaboration`，可在 Blueprint 预览中修改
3. 仅需手动填写 `DATABASE_URL`，`NODE_ENV=production` 已在 Blueprint 中预设

前端环境变量见上方 [步骤 3：配置前端环境变量](#3-配置前端环境变量)。

## 方式 B：手动创建 Web Service

若不用 Blueprint，在 Render 新建 **Web Service**：

| 配置项 | 值 |
|--------|-----|
| **Root Directory** | （留空，使用仓库根目录） |
| **Build Command** | 见下方 |
| **Start Command** | `pnpm --filter api start:collab` |
| **Health Check Path** | `/` |
| **Plan** | Free |

**Build Command：**

```bash
pnpm install --frozen-lockfile && pnpm --filter @xtai-notion/editor-core build && pnpm --filter api exec prisma migrate deploy && pnpm --filter api build
```

**环境变量：**

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon 池化连接串（与 API 相同） |

Render 会自动注入 `PORT`，`collab-main.ts` 会把它用作 Hocuspocus 监听端口。

## 协作专用入口说明

[`apps/api/src/collab-main.ts`](../apps/api/src/collab-main.ts) 与本地 `main.ts` 的区别：

| | `main.ts`（本地） | `collab-main.ts`（Render） |
|--|-------------------|----------------------------|
| Nest REST | 监听 `PORT`（3100） | **不启动** |
| Hocuspocus | 监听 `COLLABORATION_PORT`（3101） | 监听 Render 的 `PORT` |
| 适用场景 | 本地 `pnpm dev` | Render / 任意单端口 PaaS |

本地调试 Render 模式：

```bash
PORT=3101 pnpm --filter api exec tsx --env-file=.env src/collab-main.ts
```

## 免费层限制

- **15 分钟无流量会休眠**，下次连接约 **1 分钟** 冷启动
- 每月 **750 实例小时**；长期 24/7 常开可能月底暂停
- 有人编辑时 WebSocket 有流量，服务会保持活跃

对个人项目、演示通常够用。需要无休眠可升级到 Render Starter（约 $7/月）。

## 常见问题

### `DevelopmentIdentityGuard must not be enabled when NODE_ENV=production`

协作进程应使用 `collab-main.ts`（加载精简的 `CollabAppModule`），且 `DevelopmentIdentityGuard` 仅在开发路由上生效，生产环境不会在应用启动时因该 Guard 构造失败。若仍看到此错误，请确认 Start Command 为 `pnpm --filter api start:collab` 且已部署最新代码。

### `ERR_MODULE_NOT_FOUND`（找不到 `app.module`）

`apps/api` 使用 ESM（`"type": "module"`），`tsc` 编译后的 `dist/*.js` 不带 `.js` 扩展名，Node 无法按 ESM 规则解析相对导入。协作服务应通过 **`tsx` 直接运行源码**（见 `start:collab`），不要执行 `node dist/collab-main.js`。

### 构建失败：找不到 `@xtai-notion/editor-core`

monorepo 必须先构建 `editor-core`，`render.yaml` 已包含该步骤。手动部署时请确认 Build Command 完整。

### 协作连不上 / unauthorized

前端通过 `token: user.id` 鉴权（见 `document-workspace.tsx`），与 API 是否同域无关。请确认：

- 用户对该文档有成员权限
- `DATABASE_URL` 与 API 使用同一 Neon 库

### P2028 / 数据库超时

Neon 冷启动时可能较慢，生产环境请使用 **pooler 连接串** 并带上 `connect_timeout=15&pool_timeout=15`（见 `apps/api/.env.example`）。
