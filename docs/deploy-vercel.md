# 在 Vercel 上部署（Web + API 同项目）

Web（Next.js）与 REST API（Nest serverless）可以部署在 **同一个 Vercel 项目** 中。协作 WebSocket 仍需单独部署在 Render，见 [`deploy-render.md`](./deploy-render.md)。

## 架构

```text
Vercel（单项目）
  ├─ Next.js  →  /、/documents、/square …（页面）
  └─ serverless → /api/*（Nest REST API）
Render → wss://…（Hocuspocus 协作）
Neon   → DATABASE_URL
```

API 挂在 `/api` 前缀下（例如 `/api/documents`），避免与 Next.js 页面路由 `/documents` 冲突。在 Vercel 上未设置 `NEXT_PUBLIC_API_URL` 时，前端会自动使用同域 `/api`。

---

## Vercel 项目设置

在 **Vercel Dashboard → Settings → General → Build & Development Settings**：

| 项 | 值 |
|----|-----|
| **Root Directory** | `apps/web`（推荐）或留空用仓库根目录 |
| **Framework Preset** | **Next.js** |
| **Output Directory** | **留空**（不要填 `public`） |
| **Include source files outside of the Root Directory** | **勾选**（monorepo 必须） |

Build / Install 命令由 `apps/web/vercel.json`（或根目录 `vercel.json`）提供，一般无需在 Dashboard 里重复填写。

### 常见错误

> `No Output Directory named "public" found after the Build completed`

把 **Output Directory** 清空即可。Next.js 输出在 `.next`，由 Vercel 自动处理。

---

## 环境变量

在 Vercel → Settings → Environment Variables：

```env
DATABASE_URL=postgresql://...（Neon 池化连接串）
NEXT_PUBLIC_COLLABORATION_URL=wss://<render-协作服务>.onrender.com

# 可选：同项目部署时默认 /api，通常不必设置
# NEXT_PUBLIC_API_URL=/api

# 若 API 部署在另一域名，再显式指定：
# NEXT_PUBLIC_API_URL=https://your-api.vercel.app/api
```

还需要 `apps/api/.env.example` 中的 COS、OpenAI 等变量（按功能启用）。

本地开发用的 `NEXT_PUBLIC_DEV_USER_ID` **不要**设到生产环境。

---

## 路由说明

| 路径 | 处理方 |
|------|--------|
| `/api/auth/*` | Nest serverless |
| `/api/documents/*` | Nest serverless |
| `/api/ai/*` | Nest serverless |
| `/documents`、`/square` 等 | Next.js 页面 |
| `/auth/*`（浏览器） | Next.js rewrite → `/api/auth/*`（保持 cookie 同域） |

---

## 验证

1. 部署成功，打开站点首页。
2. 登录后 Network 中 API 请求指向 `/api/...`（或你配置的 `NEXT_PUBLIC_API_URL`）。
3. `GET /api/health` 返回正常（若已实现 health 端点）。
4. 文档页协作连接指向 `wss://` 的 Render 地址。

---

## 拆分部署（可选）

若希望 API 与 Web 分两个 Vercel 项目，可：

1. **API 项目**：Root Directory = `.`，仅部署 `apps/api/src/serverless.ts`（需在 serverless 中去掉 `api` 前缀，或设置 `NEXT_PUBLIC_API_URL` 指向带 `/api` 的地址）。
2. **Web 项目**：Root Directory = `apps/web`，设置 `NEXT_PUBLIC_API_URL` 为 API 项目地址。

同项目部署更简单，推荐默认使用本文配置。
