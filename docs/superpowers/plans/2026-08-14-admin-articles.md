# 文章管理页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/admin/articles` 提供与 Pencil “文章管理”画布匹配、可筛选与分页的后台文章列表。

**Architecture:** App Router 的 `page.tsx` 仅声明路由入口，客户端页面组件拥有示例数据与筛选状态。展示层拆成侧栏、统计卡、筛选栏、表格与分页，以复用现有 UI 包、图标与 Tailwind 配置。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、@workspace/ui、@workspace/icons、Vitest。

## Global Constraints

- 仅使用项目已确认依赖；不接入文章 API 或新依赖。
- 所有新增或实质修改的代码块至少包含一条有意义的注释。
- 使用双引号、无分号、两空格缩进、LF、ES5 trailing commas 和 Tailwind Prettier 插件。
- 路由目录通过 `app/admin/articles/page.tsx` 映射到 `/admin/articles`。

---

### Task 1: Article list state and interaction tests

**Files:**
- Create: `apps/web/components/admin/article-management-page.test.tsx`
- Create: `apps/web/components/admin/article-management-page.tsx`

**Interfaces:**
- Produces `ArticleManagementPage`, the client component rendered by the route.
- Produces exported `filterArticles(articles, filters)` for deterministic filtering coverage.

- [ ] **Step 1: Write failing tests** for title/author/category keyword matching, combined category/status filters, pagination reset after a filter change, and empty-result messaging.
- [ ] **Step 2: Run** `pnpm --filter web test -- article-management-page.test.tsx` and verify failure because the module does not exist.
- [ ] **Step 3: Implement** typed local article data, `filterArticles`, and a controlled client page that renders filters, pages the filtered rows, and announces empty results.
- [ ] **Step 4: Run the focused test** and verify it passes.
- [ ] **Step 5: Commit** the focused component and test with `feat(web): add article management interactions`.

### Task 2: Pencil-matched reusable presentation components

**Files:**
- Create: `apps/web/components/admin/admin-sidebar.tsx`
- Create: `apps/web/components/admin/article-stat-card.tsx`
- Create: `apps/web/components/admin/article-filters.tsx`
- Create: `apps/web/components/admin/article-table.tsx`
- Modify: `apps/web/components/admin/article-management-page.tsx`
- Modify: `apps/web/components/admin/article-management-page.test.tsx`

**Interfaces:**
- `AdminSidebar()` renders the desktop navigation with “文章管理” active.
- `ArticleStatCard({ label, value, trend, tone })` renders an overview metric.
- `ArticleFilters({ query, category, status, onQueryChange, onCategoryChange, onStatusChange })` is fully controlled.
- `ArticleTable({ articles })` renders semantic headers and responsive overflow handling.

- [ ] **Step 1: Extend failing tests** to assert the active sidebar item, all overview values, accessible filter labels, table headers, status labels, action controls, and no-results state.
- [ ] **Step 2: Run the focused test** and verify the assertions fail.
- [ ] **Step 3: Implement** the components using exact layout, spacing, neutral palette and emerald accent visible in the Pencil selection; preserve Chinese labels and ensure icon-only controls have labels.
- [ ] **Step 4: Run the focused test** and verify it passes.
- [ ] **Step 5: Commit** with `feat(web): match article management design`.

### Task 3: Route, formatting and validation

**Files:**
- Create: `apps/web/app/admin/articles/page.tsx`
- Create: `apps/web/app/admin/articles/page.test.tsx`

**Interfaces:**
- The default page export returns `<ArticleManagementPage />` and makes `/admin/articles` publicly routable.

- [ ] **Step 1: Write a failing route test** that renders the default export and asserts the “文章管理” heading.
- [ ] **Step 2: Run the focused route test** and verify it fails before the route exists.
- [ ] **Step 3: Implement** the minimal route entrypoint, including a comment explaining that the interactive management screen remains isolated in the client component.
- [ ] **Step 4: Run** `pnpm exec prettier --write apps/web/app/admin/articles/page.tsx apps/web/app/admin/articles/page.test.tsx apps/web/components/admin/*.tsx` and then `pnpm --filter web test -- article-management-page.test.tsx page.test.tsx`, `pnpm --filter web typecheck`, and `pnpm --filter web lint`.
- [ ] **Step 5: Manually inspect** `/admin/articles` against the Pencil screenshot at desktop width and verify side navigation, stats, controls, rows, spacing and contrast are intact; commit with `feat(web): add article management route`.

## Plan Self-review

- Spec coverage: Tasks 1-3 cover the new route, reusable structure, local data, filtering, pagination, accessible interactions, Pencil visual fidelity, formatting and validation.
- Placeholder scan: no deferred implementation markers or undefined interfaces remain.
- Type consistency: all named components and filtering API are defined before their consumers.
