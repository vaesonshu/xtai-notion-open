# 资料库（向量检索）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加与文档工作区并列的资料库，完成文件和站内文档快照的分块、1536 维向量入库，以及带出处的问答。

**Architecture:** NestJS `KnowledgeModule` 把资料库成员、来源、入库 worker、检索和问答拆开。向量存在现有 PostgreSQL 的 `vector(1536)` 列里。站内文档只在导入或手动重索引时导出 Markdown 快照到 `body_text`；检索只读当前代、当前 `embedding_revision` 的分块。对话模型用提问者自己的云端配置。

**Tech Stack:** NestJS 11、Prisma、PostgreSQL 16 + pgvector、Next.js 16、Vitest、`mammoth`、`unpdf`。

**Spec:** `docs/superpowers/specs/2026-10-29-vector-library-design.md`

## Global Constraints

- 界面名称是「资料库」。现有「知识库」仍指 `workspace`，不要改那套表和页面。
- 角色只有 `owner` / `admin` / `editor` / `viewer`。创建者是唯一 owner，不能把别人改成 owner。
- 嵌入维度固定 `1536`。只改 API Key 不加 `embedding_revision`；模型名或 Base URL 变化则加一，并把全部来源改为 `queued`，保留 `body_text`。
- 文件仅 `.txt` `.md` `.pdf` `.docx`，最大 `20MB`。正文上限 `270000` 字。分块目标 `800` 字、重叠 `120` 字、单来源最多 `400` 块。
- 检索最多 `6` 块，余弦相似度低于 `0.2`（`<=>` 距离大于 `0.8`）丢弃。提示词上下文不超过 `12000` 字。无命中时不调用对话模型，回答 `资料库里没有找到相关内容。`
- 成功入库后保留 `body_text`。用户重索引文件时清空它；重索引站内文档时覆盖它。worker 不读取活文档。
- 同一资料库对同一 `source_document_id` 只有一个 `document_snapshot` 来源。
- 用户可见文案用简体中文。密钥不写日志、不出现在来源列表里。
- 生成代码遵循根目录 `.prettierrc`（LF、无分号、双引号、80 列），并给每个新文件至少一条说明意图的中文注释。
- 不提交 `.env` 或密钥。

## Review Focus

- 只修改嵌入 API Key 时不得增加 `embedding_revision`，也不得把来源改回 `queued`。测试在 Task 6。
- 更换模型后，已成功的站内文档必须用保存的 `body_text` 重新嵌入，不得调用 `DocumentsService.exportMarkdown`。测试在 Task 9。
- 更新嵌入失败时 `active_generation` 不变，检索仍只命中上一代。测试在 Task 9 与 Task 10。
- 相似度正好 `0.2` 的块保留，低于 `0.2` 的丢弃；一块都没有时不调用对话模型。测试在 Task 10。
- 同一库再次导入同一文档只更新原行；不能读源文档的资料库成员仍可检索该快照。测试在 Task 8 与 Task 10。

## File Map

| 文件 | 职责 |
|------|------|
| `docker-compose.yml` | 本地镜像改为 `pgvector/pgvector:pg16` |
| `apps/api/prisma/schema.prisma` | 四张表与 `AppUser` 关系 |
| `apps/api/prisma/migrations/012_knowledge_library/migration.sql` | 扩展、表、部分唯一索引 |
| `apps/api/src/knowledge/knowledge.types.ts` | 角色、状态、嵌入配置、限额常量 |
| `apps/api/src/knowledge/chunker.ts` | 分块 |
| `apps/api/src/knowledge/content-hash.ts` | 正文 SHA-256 |
| `apps/api/src/knowledge/embedding-client.ts` | OpenAI 兼容 embeddings |
| `apps/api/src/knowledge/parsers.ts` | 按扩展名解析 |
| `apps/api/src/knowledge/knowledge-library.repository.ts` | 资料库与成员 SQL |
| `apps/api/src/knowledge/knowledge-library.service.ts` | 成员与嵌入配置规则 |
| `apps/api/src/knowledge/knowledge-source.repository.ts` | 来源与分块 SQL，含领取和相似度查询 |
| `apps/api/src/knowledge/knowledge-source.service.ts` | 上传、导入、重索引、删除 |
| `apps/api/src/knowledge/knowledge-ingest.worker.ts` | 领取、解析、嵌入、换代 |
| `apps/api/src/knowledge/knowledge-retrieval.ts` | 阈值、打包、出处 |
| `apps/api/src/knowledge/knowledge-qa.service.ts` | 检索后的 SSE 问答 |
| `apps/api/src/knowledge/knowledge.controller.ts` | HTTP |
| `apps/api/src/knowledge/knowledge.module.ts` | 注册 worker |
| `apps/api/src/documents/documents.service.ts` | `exportMarkdown` |
| `apps/api/src/storage/cos.service.ts` | `deleteObject` |
| `apps/web/lib/library-api.ts` | 前端请求 |
| `apps/web/app/libraries/` | 列表与详情路由 |
| `apps/web/components/libraries/` | 列表、来源、问答 |
| `apps/web/components/inkspace/sidebar.tsx` | 「资料库」入口 |
| `apps/web/components/inkspace/workspace-shell.tsx` | 跳转到 `/libraries` |

---

### Task 1: 数据库与本地 pgvector 镜像

**Files:**
- Modify: `docker-compose.yml`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/012_knowledge_library/migration.sql`
- Test: `apps/api/test/knowledge/migration.spec.ts`

**Interfaces:**
- Consumes: 现有 `AppUser`、`gen_random_uuid()`、`@db.Timestamptz(6)` 写法。
- Produces: Prisma 模型 `KnowledgeLibrary`、`KnowledgeLibraryMember`、`KnowledgeSource`、`KnowledgeChunk`。`KnowledgeChunk.embedding` 为 `Unsupported("vector(1536)")`。`AppUser` 增加 `createdKnowledgeLibraries`、`knowledgeLibraryMembers`、`createdKnowledgeSources` 三条关系。

- [ ] **Step 1: 写失败测试**

`migration.spec.ts` 读取迁移文件，断言同时包含：

- `CREATE EXTENSION IF NOT EXISTS vector`
- `knowledge_library`
- `knowledge_library_member`
- `knowledge_source`
- `knowledge_chunk`
- `vector(1536)`
- `CREATE UNIQUE INDEX` 且条件含 `document_snapshot` 与 `source_document_id`

并断言 `docker-compose.yml` 的镜像是 `pgvector/pgvector:pg16`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/migration.spec.ts`

Expected: FAIL，迁移文件不存在。

- [ ] **Step 3: 写迁移、Prisma 模型和镜像**

`docker-compose.yml` 的 `image` 改为 `pgvector/pgvector:pg16`，容器名和账号保持不动。

迁移创建四张表，列与规格「数据模型」一致。`knowledge_source.source_document_id` 不建外键。成员主键 `(library_id, user_id)`。索引：`knowledge_library_member(user_id)`、`knowledge_source(library_id, status)`、`knowledge_chunk(library_id)`、`knowledge_chunk(source_id, generation)`。部分唯一索引：

```sql
CREATE UNIQUE INDEX knowledge_source_library_document_uidx
ON knowledge_source (library_id, source_document_id)
WHERE kind = 'document_snapshot' AND source_document_id IS NOT NULL
```

`created_by` 删除用户时置空。删除资料库级联成员和来源，删除来源级联分块。不建 HNSW。

Prisma 关系名使用上面的 Produces。`embedding` 不写普通 Prisma 读写。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/migration.spec.ts`

Expected: PASS

- [ ] **Step 5: 生成客户端并格式化**

Run: `pnpm --filter api prisma:generate`

然后对改动文件跑 `pnpm exec prettier --write`。

- [ ] **Step 6: Commit**

```powershell
git add docker-compose.yml apps/api/prisma/schema.prisma apps/api/prisma/migrations/012_knowledge_library/migration.sql apps/api/test/knowledge/migration.spec.ts
git commit -m "feat: add knowledge library pgvector schema"
```

---

### Task 2: 分块与正文哈希

**Files:**
- Create: `apps/api/src/knowledge/knowledge.types.ts`
- Create: `apps/api/src/knowledge/chunker.ts`
- Create: `apps/api/src/knowledge/content-hash.ts`
- Test: `apps/api/test/knowledge/chunker.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces:

```ts
export const EMBEDDING_DIMENSIONS = 1536
export const DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1"
export const CHUNK_TARGET_CHARS = 800
export const CHUNK_OVERLAP_CHARS = 120
export const CHUNK_MAX_COUNT = 400
export const BODY_TEXT_MAX_CHARS = 270_000
export const MAX_KNOWLEDGE_FILE_BYTES = 20 * 1024 * 1024

export type KnowledgeChunkDraft = {
  ordinal: number
  content: string
  heading: string | null
  page: number | null
}

export function assertBodyLength(text: string): void
export function splitKnowledgeChunks(
  text: string,
  options?: { maxChunks?: number; page?: number | null }
): KnowledgeChunkDraft[]
export function prepareKnowledgeChunks(input: {
  text: string
  pages?: { page: number; text: string }[]
}): KnowledgeChunkDraft[]
export function hashKnowledgeBody(text: string): string
```

`assertBodyLength`：trim 后为空抛 `KnowledgeChunkError("empty")`；长度大于 `270000` 抛 `KnowledgeChunkError("too_long")`。`splitKnowledgeChunks` 超过 `maxChunks`（默认 400）抛 `KnowledgeChunkError("too_many_chunks")`。`prepareKnowledgeChunks` 先检查总长度，再分块；传入 `pages` 时按页分块并写入 `page`，忽略顶层 `text` 的二次分块。

- [ ] **Step 1: 写失败测试**

覆盖：

- `"a".repeat(1480)` 无标点时，第二块以第一块末尾 120 字开头。
- `"# 概述\n\n段落一\n\n## 安装\n\n段落二"` 里「段落二」的 `heading` 为 `概述 / 安装`。
- 只有空白时 `prepareKnowledgeChunks` 抛 `empty`。
- 长度为 `270001` 时抛 `too_long`。
- `splitKnowledgeChunks("aaaa", { maxChunks: 1, page: null })` 在目标长度被测小窗口之外：用连续无边界文本和 `maxChunks: 1` 断言抛 `too_many_chunks`。构造长度须大于 800，例如 `900` 个 `a`。
- `prepareKnowledgeChunks({ text: "", pages: [{ page: 2, text: "甲" }] })` 的块 `page === 2`。
- `hashKnowledgeBody(" a\r\nb ")` 等于 `hashKnowledgeBody("a\nb")`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/chunker.spec.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现分块**

切分顺序：Markdown 标题（保留标题路径，用 ` / ` 连接）、空行段落、句末字符 `。！？；.!?;`、最后按 800 字硬切。相邻小段合并到不超过 800 字。硬切的下一块起点是上一块终点往前 120 字。空块丢弃，`ordinal` 从 0 连续编号。

`hashKnowledgeBody` 先把 `\r\n` 换成 `\n`，再 trim，然后 SHA-256 十六进制。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/chunker.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/knowledge.types.ts apps/api/src/knowledge/chunker.ts apps/api/src/knowledge/content-hash.ts apps/api/test/knowledge/chunker.spec.ts
git commit -m "feat: chunk knowledge text with overlap"
```

---

### Task 3: 嵌入客户端

**Files:**
- Create: `apps/api/src/knowledge/embedding-client.ts`
- Test: `apps/api/test/knowledge/embedding-client.spec.ts`

**Interfaces:**
- Consumes: `EMBEDDING_DIMENSIONS`
- Produces:

```ts
export type EmbeddingConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

export class EmbeddingClientError extends Error {
  readonly code: "invalid_config" | "unavailable" | "bad_dimensions"
}

export async function embedKnowledgeTexts(
  config: EmbeddingConfig,
  texts: string[],
  fetchImpl: typeof fetch
): Promise<number[][]>
```

每批最多 16 条。请求 `POST {baseUrl}/embeddings`，body 含 `model`、`input`、`dimensions: 1536`。Authorization 为 `Bearer ${apiKey}`。

- [ ] **Step 1: 写失败测试**

用假的 `fetchImpl`：

- 20 条文本产生两次请求，每次 `input.length` 分别是 16 和 4，且都带 `dimensions: 1536`。
- 第一次 400 且 body 提到 `dimensions` 时，去掉该字段再请求一次；返回长度不是 1536 则 `code === "bad_dimensions"`。
- 401 立即 `invalid_config`，不再重试。
- 前两次 429、第三次 200 时最终成功。第四次仍失败则 `unavailable`。测试里把退避等待注入为 `0`，不要真的 sleep。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/embedding-client.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现客户端**

签名增加可选 `options?: { sleep?: (ms: number) => Promise<void> }`，默认 sleep 用 `setTimeout`，退避为 `250 * 2 ** attempt` 毫秒。不要记录 API Key 或响应正文。空 `texts` 返回 `[]`，不发请求。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/embedding-client.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/embedding-client.ts apps/api/test/knowledge/embedding-client.spec.ts
git commit -m "feat: call library embedding endpoint in batches"
```

---

### Task 4: 文件解析

**Files:**
- Modify: `apps/api/package.json`（依赖 `mammoth`、`unpdf`）
- Create: `apps/api/src/knowledge/parsers.ts`
- Test: `apps/api/test/knowledge/parsers.spec.ts`

**Interfaces:**
- Consumes: `MAX_KNOWLEDGE_FILE_BYTES`
- Produces:

```ts
export type KnowledgeFileKind = "txt" | "md" | "pdf" | "docx"

export function knowledgeFileKind(filename: string): KnowledgeFileKind

export async function parseKnowledgeFile(
  input: {
    filename: string
    bytes: Buffer
  },
  extractors?: {
    docxText?: (bytes: Buffer) => Promise<string>
    pdfPages?: (bytes: Buffer) => Promise<{ page: number; text: string }[]>
  }
): Promise<{ text: string; pages?: { page: number; text: string }[] }>
```

`knowledgeFileKind` 只看扩展名，大小写不敏感。不符抛 `BadRequestException("只支持 txt、md、pdf、docx 文件")`。`bytes.length > MAX_KNOWLEDGE_FILE_BYTES` 抛 `PayloadTooLargeException("文件不能超过 20MB")`。

- [ ] **Step 1: 写失败测试**

- `Report.MD` 得到 `md`。`notes.exe` 抛出「只支持 txt、md、pdf、docx 文件」。
- 20MB + 1 字节抛出「文件不能超过 20MB」。
- UTF-8 的 txt 返回原文。非法 UTF-8 抛 `BadRequestException("无法按 UTF-8 读取文件")`。
- 注入的 `docxText` 返回值成为 `text`。
- 注入的 `pdfPages` 为 `[{ page: 1, text: "" }, { page: 2, text: "正文" }]` 时，结果页只保留有文字的页，合并文本含「正文」。全部页为空则抛 `BadRequestException("无法解析 PDF 文本")`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/parsers.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现解析器**

安装 `mammoth` 和 `unpdf`。默认 `docxText` 调 `mammoth.extractRawText`。默认 `pdfPages` 用 `unpdf` 按页取文本层，不启用 OCR。扩展名检查在读内容之前。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/parsers.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/package.json pnpm-lock.yaml apps/api/src/knowledge/parsers.ts apps/api/test/knowledge/parsers.spec.ts
git commit -m "feat: parse txt md pdf and docx for knowledge ingest"
```

---

### Task 5: 角色、状态文案与嵌入补丁

**Files:**
- Modify: `apps/api/src/knowledge/knowledge.types.ts`
- Test: `apps/api/test/knowledge/knowledge-rules.spec.ts`

**Interfaces:**
- Consumes: `DEFAULT_EMBEDDING_BASE_URL`
- Produces:

```ts
export type LibraryRole = "owner" | "admin" | "editor" | "viewer"
export type SourceStatus = "queued" | "processing" | "ready" | "failed"
export type EmbeddingSettings = {
  openAiApiKey?: string
  openAiBaseUrl?: string
  openAiEmbeddingModel?: string
}

export function roleAtLeast(role: LibraryRole, minimum: LibraryRole): boolean
export function sourceStatusLabel(
  status: SourceStatus,
  activeGeneration: number
): "索引中" | "更新中" | "就绪" | "索引失败" | "更新失败，仍可问答"

export function applyEmbeddingPatch(
  current: { settings: EmbeddingSettings; revision: number },
  patch: EmbeddingSettings
): { settings: EmbeddingSettings; revision: number; modelChanged: boolean }
```

`roleAtLeast` 的顺序是 owner > admin > editor > viewer。`applyEmbeddingPatch`：空 Key 保留旧 Key；Key 从无到有或被替换都不算 `modelChanged`。模型名或 Base URL（缺省时用 `DEFAULT_EMBEDDING_BASE_URL`）与当前值不同则 `modelChanged` 为 true 且 `revision + 1`。

- [ ] **Step 1: 写失败测试**

- viewer 不满足 editor；editor 满足 viewer。
- `queued` + generation `0` → `索引中`；`processing` + generation `2` → `更新中`；`failed` + generation `2` → `更新失败，仍可问答`；`failed` + generation `0` → `索引失败`；`ready` → `就绪`。
- 只改 Key：`revision` 不变，`modelChanged` 为 false，新 Key 写入 settings。
- 改模型名或 Base URL：`revision` 加一，`modelChanged` 为 true。
- 补丁 Key 为 `""` 时保留原 Key。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-rules.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现这三个函数**

放在 `knowledge.types.ts`。不要在这里访问数据库。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-rules.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/knowledge.types.ts apps/api/test/knowledge/knowledge-rules.spec.ts
git commit -m "feat: encode knowledge library role and embedding rules"
```

---

### Task 6: 资料库与成员

**Files:**
- Create: `apps/api/src/knowledge/knowledge-library.repository.ts`
- Create: `apps/api/src/knowledge/knowledge-library.service.ts`
- Test: `apps/api/test/knowledge/knowledge-library.service.spec.ts`

**Interfaces:**
- Consumes: `LibraryRole`、`EmbeddingSettings`、`applyEmbeddingPatch`、`roleAtLeast`
- Produces:

```ts
export type LibrarySummary = {
  id: string
  name: string
  role: LibraryRole
  sourceCount: number
  memberCount: number
  updatedAt: string
}

export class KnowledgeLibraryService {
  create(userId: string, name: string): Promise<LibrarySummary>
  list(userId: string): Promise<LibrarySummary[]>
  rename(userId: string, libraryId: string, name: string): Promise<void>
  fileStorageKeys(userId: string, libraryId: string): Promise<string[]>
  deleteLibrary(userId: string, libraryId: string): Promise<void>
  updateEmbedding(userId: string, libraryId: string, patch: EmbeddingSettings): Promise<{
    openAiBaseUrl: string
    openAiEmbeddingModel: string
    hasApiKey: boolean
    modelChanged: boolean
  }>
  inviteMember(actorId: string, libraryId: string, input: {
    userId?: string
    email?: string
    role: Exclude<LibraryRole, "owner">
  }): Promise<void>
  updateMemberRole(actorId: string, libraryId: string, memberUserId: string, role: Exclude<LibraryRole, "owner">): Promise<void>
  removeMember(actorId: string, libraryId: string, memberUserId: string): Promise<void>
}
```

Repository 用方法名 `insertLibrary`、`listForUser`、`requireMembership`、`markAllSourcesQueued`、`listFileStorageKeys`。Service 不直接拿 Prisma。测试用内存假仓库。

- [ ] **Step 1: 写失败测试**

- 名称 `"  "` 抛 `BadRequestException("资料库名称不能为空")`。81 字抛 `BadRequestException("资料库名称不能超过 80 字")`。
- `create` 后假仓库里创建者角色是 `owner`，`memberCount` 为 1。
- viewer 和 admin 调 `rename` 都得到 403「无权管理该资料库」。owner 可以重命名。
- admin 调 `updateEmbedding` 得到同一 403。
- owner 只改 Key 时假仓库的 `markAllSourcesQueued` 不被调用。owner 改模型名时它被调用一次。
- 移除唯一 owner 得到 409「资料库至少保留一名所有者」。
- `inviteMember` 的 role 为 `owner` 时类型层不允许；运行时若传入 `"owner"` 抛 400「不能指定所有者角色」。
- 非成员 `list` 的结果不含该库；`rename` 抛 403「无权访问该资料库」。不存在的库抛 404「资料库不存在」。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-library.service.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现 service 与 repository**

`requireMembership` 查不到库时抛 404，查到库但用户不是成员时抛 403「无权访问该资料库」。`fileStorageKeys` 与 `deleteLibrary` 只允许 owner。本任务的 `deleteLibrary` 只删数据库行，不调用 COS。邀请沿用工作区的用户查找方式：有 `userId` 用 id，否则用邮箱；都没有则 400「请提供用户或邮箱」。admin 可邀请和改角色，不能改动 owner 行。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-library.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/knowledge-library.repository.ts apps/api/src/knowledge/knowledge-library.service.ts apps/api/test/knowledge/knowledge-library.service.spec.ts
git commit -m "feat: manage knowledge libraries and members"
```

---

### Task 7: 站内文档导出 Markdown

**Files:**
- Modify: `apps/api/src/documents/documents.service.ts`
- Test: `apps/api/test/documents/export-markdown.spec.ts`

**Interfaces:**
- Consumes: 现有 `assertCanRead`、`loadDocumentBlocks`（当前是 private）、`blocksToMarkdown`
- Produces:

```ts
async exportMarkdown(documentId: string, userId: string): Promise<string>
```

- [ ] **Step 1: 写失败测试**

用假的 documents repository 和 yjs persistence：

- 无权阅读时不调用 yjs，错误与 `assertCanRead` 现有行为一致。
- 有权且块能序列化为非空 Markdown 时返回该字符串。
- 序列化结果 trim 后为空时抛 `BadRequestException("文档没有可索引的正文")`。

按 `documents.service.spec.ts` 已有的方式构造 `DocumentsService`，缺的依赖用空对象假实现。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/documents/export-markdown.spec.ts`

Expected: FAIL，`exportMarkdown` 不存在。

- [ ] **Step 3: 实现 `exportMarkdown`**

先 `assertCanRead`，再复用 `loadDocumentBlocks`，然后 `blocksToMarkdown`。不要在这个方法里写资料库表。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/documents/export-markdown.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/documents/documents.service.ts apps/api/test/documents/export-markdown.spec.ts
git commit -m "feat: export authorized document markdown"
```

---

### Task 8: 来源的上传、导入与重索引

**Files:**
- Create: `apps/api/src/knowledge/knowledge-source.repository.ts`
- Create: `apps/api/src/knowledge/knowledge-source.service.ts`
- Test: `apps/api/test/knowledge/knowledge-source.service.spec.ts`

**Interfaces:**
- Consumes: `KnowledgeLibraryService` 的成员校验（把 `requireRole(userId, libraryId, minimum)` 加到 library service 上并在本任务测试）、`exportMarkdown`、`knowledgeFileKind`、`parseKnowledgeFile` 不在本任务调用。
- Produces:

```ts
export class KnowledgeSourceService {
  list(userId: string, libraryId: string): Promise<SourceListItem[]>
  uploadFile(userId: string, libraryId: string, file: {
    filename: string
    bytes: Buffer
  }): Promise<{ id: string }>
  importDocument(userId: string, libraryId: string, documentId: string): Promise<{ id: string }>
  reindex(userId: string, libraryId: string, sourceId: string): Promise<void>
  deleteSource(userId: string, libraryId: string, sourceId: string): Promise<void>
  fileOf(userId: string, libraryId: string, sourceId: string): Promise<{ storageKey: string }>
}

export type SourceListItem = {
  id: string
  title: string
  kind: "file" | "document_snapshot"
  status: SourceStatus
  statusLabel: string
  errorMessage: string | null
  activeGeneration: number
}
```

`SourceListItem` 不含 `body_text`。`requireRole` 不足时抛 403「查看者无法修改资料库」（minimum 为 editor）或 Task 6 已有的管理文案。

- [ ] **Step 1: 写失败测试**

- viewer `uploadFile` 得到「查看者无法修改资料库」，假仓库不插入。
- 合法 txt 调用假 COS 保存后插入 `kind: "file"`、`status: "queued"`、`bodyText: null`。扩展名非法时不插入。
- `importDocument` 调用 `exportMarkdown` 一次，插入 `document_snapshot` 且 `bodyText` 为返回值。
- 同一 `libraryId + documentId` 已有来源时，不插入第二行，改为覆盖 `bodyText` 并把状态设为 `queued`。
- 文件重索引把 `bodyText` 设为 null 且状态为 `queued`。文档重索引再次调用 `exportMarkdown`。
- `exportMarkdown` 抛「无权阅读该文档」时不改来源行。
- 列表项没有 `bodyText` 字段，`statusLabel` 使用 Task 5 的文案。
- viewer 调 `fileOf` 得到「查看者无法修改资料库」。快照来源调用 `fileOf` 抛 404「资料库不存在」以外的 `NotFoundException("原文件不存在")`。文件来源返回 `storageKey`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-source.service.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现来源 service**

上传前调用 `knowledgeFileKind` 和字节长度检查。COS 写入由调用方传入的函数 `putFile(storageKey, bytes)` 完成，key 为 `knowledge/{libraryId}/{sourceId}/{filename}`，`sourceId` 用 `randomUUID()`。本任务不解析、不嵌入。`fileOf` 要求 editor 及以上。`deleteSource` 只删数据库行；控制器在 Task 11 先删 COS。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-source.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/knowledge-source.repository.ts apps/api/src/knowledge/knowledge-source.service.ts apps/api/src/knowledge/knowledge-library.service.ts apps/api/test/knowledge/knowledge-source.service.spec.ts
git commit -m "feat: upload and snapshot knowledge sources"
```

---

### Task 9: 入库 worker

**Files:**
- Create: `apps/api/src/knowledge/knowledge-ingest.worker.ts`
- Modify: `apps/api/src/knowledge/knowledge-source.repository.ts`
- Test: `apps/api/test/knowledge/knowledge-ingest.worker.spec.ts`

**Interfaces:**
- Consumes: `parseKnowledgeFile`、`prepareKnowledgeChunks`、`hashKnowledgeBody`、`embedKnowledgeTexts`、`EmbeddingConfig`
- Produces:

```ts
export class KnowledgeIngestWorker {
  reclaimStale(now: Date): Promise<number>
  processNext(): Promise<boolean>
}
```

Repository 增加 `claimNext()`、`reclaimStale(olderThan: Date)`、`commitGeneration(...)`、`failSource(id, message)`。`claimNext` 使用规格里的 `FOR UPDATE SKIP LOCKED` SQL。`reclaimStale` 把超过 10 分钟的 `processing` 改回 `queued`，不改 `body_text`。

- [ ] **Step 1: 写失败测试**

用内存来源，嵌入函数记录调用次数：

- `bodyText` 与 `indexedContentHash` 相同且 `embeddingRevision` 已等于库版本时，不调用嵌入，状态变为 `ready`。
- 库版本较新时，即使用同一哈希也调用嵌入。
- 嵌入抛错时 `activeGeneration` 保持原值，状态 `failed`，`bodyText` 仍在，没有新分块。
- 嵌入成功时新分块 `generation` 为旧值 + 1，`activeGeneration` 切过去，更老分块被删，`errorMessage` 为空。
- `kind === "document_snapshot"` 且 `bodyText` 为空时失败文案为「缺少可索引正文」，且不调用 `exportMarkdown`。
- 文件 `bodyText` 为空时调用解析器；解析结果写入 `bodyText` 后再嵌入。解析器若返回 `pages`，分块草稿的 `page` 必须等于对应页码。
- 处理站内文档时断言 `exportMarkdown` 调用次数为 0。
- `lockedAt` 早于 10 分钟的 `processing` 回到 `queued`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-ingest.worker.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现 worker**

`processNext` 先 `reclaimStale`，再领取一条。提交必须在一个 repository 方法里完成换代和删除旧分块，避免半套向量。失败文案只用规格里的中文短句：`无法解析 PDF 文本`、`嵌入服务暂时不可用`、`嵌入配置无效`、`正文过长请拆分文件`、`对象文件不存在`、`缺少可索引正文`。`EmbeddingClientError.code === "invalid_config" | "bad_dimensions"` 映射为「嵌入配置无效」，`unavailable` 映射为「嵌入服务暂时不可用」。

不要在 worker 里启动定时器。定时器放在 Task 11。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-ingest.worker.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/knowledge-ingest.worker.ts apps/api/src/knowledge/knowledge-source.repository.ts apps/api/test/knowledge/knowledge-ingest.worker.spec.ts
git commit -m "feat: ingest knowledge sources into versioned chunks"
```

---

### Task 10: 检索与问答

**Files:**
- Create: `apps/api/src/knowledge/knowledge-retrieval.ts`
- Create: `apps/api/src/knowledge/knowledge-qa.service.ts`
- Test: `apps/api/test/knowledge/knowledge-retrieval.spec.ts`
- Test: `apps/api/test/knowledge/knowledge-qa.service.spec.ts`

**Interfaces:**
- Consumes: `embedKnowledgeTexts`、`UserCloudAiService.requireLlmConfig`、库的嵌入配置
- Produces:

```ts
export const RETRIEVAL_TOP_K = 6
export const RETRIEVAL_MIN_SIMILARITY = 0.2
export const RETRIEVAL_MAX_CONTEXT_CHARS = 12_000
export const CITATION_EXCERPT_CHARS = 500
export const NO_HIT_ANSWER = "资料库里没有找到相关内容。"
export const KNOWLEDGE_QA_SYSTEM_PROMPT =
  "你是资料库问答助手。只根据给出的编号片段回答问题。\n引用依据时使用片段编号，例如 [1]。\n片段不足以回答时，直接说明资料库里没有足够依据，不要编造。"

export type KnowledgeCitation = {
  index: number
  sourceId: string
  sourceTitle: string
  heading: string | null
  page: number | null
  excerpt: string
  similarity: number
}

export function selectKnowledgeHits(rows: Array<{
  distance: number
  libraryId: string
  generation: number
  activeGeneration: number
  embeddingRevision: number
  libraryRevision: number
  content: string
  sourceId: string
  sourceTitle: string
  heading: string | null
  page: number | null
}>): KnowledgeCitation[]

export function buildKnowledgePrompt(citations: KnowledgeCitation[]): string
```

`selectKnowledgeHits` 丢掉 `libraryId` 不匹配、`generation !== activeGeneration`、`activeGeneration === 0` 或 `embeddingRevision !== libraryRevision` 的行，再丢掉 `1 - distance < 0.2` 的行，按距离升序最多 6 条。`index` 从 1 起。`excerpt` 最多 500 字。`buildKnowledgePrompt` 按规格的 `[1] 标题（标题路径或第 N 页）` 拼接，总长不超过 12000 字。

`KnowledgeQaService.retrieve` 与 `answer` 都先确认成员身份和库级嵌入配置齐全，否则 400「请先配置资料库的嵌入模型」。`answer` 再调用 `requireLlmConfig`。最后一条消息不是非空 user，或超过 20 条，或单条超过 8000 字，抛 400「AI 请求内容超出限制」。无命中时异步生成器先产出 `{ type: "citations", citations: [], pendingSourceCount }`，再产出固定句子的 `token`，然后 `done`，且聊天函数调用次数为 0。

- [ ] **Step 1: 写失败测试**

检索：

- 距离 `0.8`（相似度 0.2）保留；距离 `0.8001` 丢弃。
- 其他库、旧 generation、旧 revision 的行不出现。
- 第 7 条即使相似也不进入。
- 摘录长于 500 字时被截断。
- `page` 为 3 且没有 heading 时，提示词含 `第 3 页`。heading 为 `概述` 时含 `概述`。

问答：

- 无命中时聊天函数不被调用，事件顺序是 `citations`、`token`（内容为固定句子）、`done`。
- 有命中时系统提示等于 `KNOWLEDGE_QA_SYSTEM_PROMPT`，用户提示含 `[1]`。
- `pendingSourceCount` 等于假仓库给出的未就绪来源数。
- 非成员不能检索。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-retrieval.spec.ts test/knowledge/knowledge-qa.service.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现检索与问答**

相似度查询放在 source repository：`WHERE library_id = $1 AND generation = active_generation AND active_generation > 0 AND embedding_revision = $2 ORDER BY embedding <=> $3 LIMIT 6`。距离过滤放在 `selectKnowledgeHits`，这样测试不需要数据库。问答的聊天调用注入为 `streamChat(input: { system: string; messages: { role: string; content: string }[] })`。检索只用最新一条 user 内容去嵌入。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/knowledge/knowledge-retrieval.spec.ts test/knowledge/knowledge-qa.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/knowledge/knowledge-retrieval.ts apps/api/src/knowledge/knowledge-qa.service.ts apps/api/src/knowledge/knowledge-source.repository.ts apps/api/test/knowledge/knowledge-retrieval.spec.ts apps/api/test/knowledge/knowledge-qa.service.spec.ts
git commit -m "feat: retrieve knowledge chunks and answer with citations"
```

---

### Task 11: HTTP、COS 删除与模块装配

**Files:**
- Modify: `apps/api/src/storage/cos.service.ts`
- Modify: `apps/api/src/storage/cos.types.ts`（若 uploader 类型在 service 文件内，则只改该文件）
- Modify: `apps/api/test/storage/cos.service.spec.ts`
- Create: `apps/api/src/knowledge/knowledge.controller.ts`
- Create: `apps/api/src/knowledge/knowledge.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/knowledge/knowledge.controller.spec.ts`

**Interfaces:**
- Consumes: Task 6 到 Task 10 的 service 方法，现有 `AuthenticatedIdentityGuard`、`CurrentUser`、AI SSE 写法（`ai.controller.ts` 的 `streamSse`）
- Produces: 规格「接口」表中的全部路由。`CosService.deleteObject(objectKey: string): Promise<void>`。`KnowledgeModule` 在 `onModuleInit` 里每 2 秒调用一次 `worker.processNext()`，`onModuleDestroy` 清除定时器。

- [ ] **Step 1: 写失败测试**

COS：`deleteObject` 把 key 传给 uploader 的 `deleteObject`，Bucket 与 Region 来自现有环境读取方式。

控制器用假 service：

- `POST /libraries` 把 trim 后的 name 交给 `create`。
- `PUT /libraries/:id/embedding` 交给 `updateEmbedding`。
- `POST /libraries/:id/sources/file` 拒绝后不调用 `uploadFile` 的情况已由 service 测试覆盖；这里断言控制器把文件字节和 `knowledge/{id}/{sourceId}/` 前缀交给 service。
- `POST /libraries/:id/qa` 把 SSE 头设为 `text/event-stream`，并把 service 的 `citations` 事件写成 `event: citations`。
- `GET /libraries/:id/sources/:sourceId/file` 使用 `fileOf`。快照来源的 404 原样返回。
- `DELETE /libraries/:id` 先 `fileStorageKeys`，再对每个 key 调用 `deleteObject`，最后 `deleteLibrary`。
- `DELETE /libraries/:id/sources/:sourceId` 在删行之前删除该来源的 COS 对象。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/storage/cos.service.spec.ts test/knowledge/knowledge.controller.spec.ts`

Expected: FAIL

- [ ] **Step 3: 实现路由、删除对象和模块**

`CosUploader` 增加可选 `deleteObject`。控制器类上使用 `@UseGuards(AuthenticatedIdentityGuard)`。问答在写 SSE 之前让 service 完成配置校验，校验失败走普通 HTTP 错误。`KnowledgeModule` 导入 `DocumentsModule`、`AuthModule`、`CosModule`。`AppModule` 导入 `KnowledgeModule`。

路由与规格表一致，包括 `POST /libraries/:id/retrieve` 和 `POST /libraries/:id/sources/document`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter api exec vitest run --config vitest.config.ts test/storage/cos.service.spec.ts test/knowledge/knowledge.controller.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/storage/cos.service.ts apps/api/src/knowledge/knowledge.controller.ts apps/api/src/knowledge/knowledge.module.ts apps/api/src/app.module.ts apps/api/test/storage/cos.service.spec.ts apps/api/test/knowledge/knowledge.controller.spec.ts
git commit -m "feat: expose knowledge library HTTP API"
```

---

### Task 12: 资料库页面

**Files:**
- Create: `apps/web/lib/library-api.ts`
- Create: `apps/web/app/libraries/page.tsx`
- Create: `apps/web/app/libraries/layout.tsx`
- Create: `apps/web/app/libraries/[libraryId]/page.tsx`
- Create: `apps/web/components/libraries/library-list-page.tsx`
- Create: `apps/web/components/libraries/library-detail-page.tsx`
- Create: `apps/web/components/libraries/library-ask-panel.tsx`
- Modify: `apps/web/components/inkspace/sidebar.tsx`
- Modify: `apps/web/components/inkspace/workspace-shell.tsx`
- Test: `apps/web/test/components/libraries/library-list-page.test.tsx`
- Test: `apps/web/test/components/libraries/library-detail-page.test.tsx`
- Test: `apps/web/test/components/libraries/library-ask-panel.test.tsx`

**Interfaces:**
- Consumes: 现有 `apiRequestJson`、`useAuth`、侧边栏 `activeNav`、工作区列表页的按钮和空态写法。
- Produces: `/libraries` 与 `/libraries/[libraryId]`。`activeNav` 增加 `"libraries"`。浏览菜单在「全部知识库」下方增加「资料库」，点击 `router.push("/libraries")`。

- [ ] **Step 1: 写失败测试**

- 列表把 API 返回的名称和角色渲染出来。创建时提交 trim 后的名称。
- 选择 `notes.exe` 时不调用上传函数，页面出现「只支持 txt、md、pdf、docx 文件」。
- 问答区在收到 `citations` 后显示来源标题；答案里的 `[1]` 仍作为文本可见。`pendingSourceCount` 为 2 时显示「2 个来源未参与本次回答」。无命中事件流显示「资料库里没有找到相关内容。」
- 来源 `status` 为 `queued` 时显示「索引中」。测试用假的定时器，不需要真的等 3 秒；断言组件在存在 `queued` 时调用了刷新函数。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter web exec vitest run --config vitest.config.ts test/components/libraries/library-list-page.test.tsx test/components/libraries/library-detail-page.test.tsx test/components/libraries/library-ask-panel.test.tsx`

Expected: FAIL

- [ ] **Step 3: 实现页面**

`library-api.ts` 对应 Task 11 的路由。详情页分「来源」和「问答」。存在 `queued` 或 `processing` 时 `setInterval` 3 秒刷新，全部结束后 `clearInterval`。成员和嵌入配置用对话框：嵌入配置仅 `role === "owner"` 可打开，Key 输入留空表示不修改。改模型名或 Base URL 前 `window.confirm("将按新模型重建全部来源")`。删除来源和删除资料库也要确认。

列表和详情未登录时与 `/workspaces` 一样不渲染内容。`libraries/layout.tsx` 使用 `WorkspaceShell`，`activeNav="libraries"`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter web exec vitest run --config vitest.config.ts test/components/libraries/library-list-page.test.tsx test/components/libraries/library-detail-page.test.tsx test/components/libraries/library-ask-panel.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add apps/web/lib/library-api.ts apps/web/app/libraries apps/web/components/libraries apps/web/components/inkspace/sidebar.tsx apps/web/components/inkspace/workspace-shell.tsx apps/web/test/components/libraries
git commit -m "feat: add knowledge library pages"
```

---

### Task 13: pgvector 检索集成测试

**Files:**
- Create: `apps/api/test/knowledge/vector-search.integration.spec.ts`

**Interfaces:**
- Consumes: Task 1 的 `knowledge_chunk` 表和 Task 10 的 SQL 过滤条件。把该 SQL 抽成 repository 方法 `searchChunks(libraryId, revision, embedding)`，Task 10 已经使用它。
- Produces: 一条不依赖真实嵌入供应商的集成测试。

- [ ] **Step 1: 写测试**

在集成配置下启动现有 `AppModule`。插入一个库、一个 `ready` 来源和两行分块：目标块向量全是 `1`，干扰块向量全是 `0`，查询向量全是 `1`。断言最近的一条是目标块。再插入另一个库的相同向量，断言它不被返回。旧 `generation` 的行也不被返回。

测试结束后删除这些行。

- [ ] **Step 2: 准备本地库**

本地若仍是旧数据卷，执行 `pnpm db:local:reset`，让新镜像创建带 `vector` 扩展的库。不要在测试里跳过扩展缺失。

- [ ] **Step 3: 运行集成测试**

Run: `pnpm --filter api test:integration -- test/knowledge/vector-search.integration.spec.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```powershell
git add apps/api/test/knowledge/vector-search.integration.spec.ts apps/api/src/knowledge/knowledge-source.repository.ts
git commit -m "test: search knowledge chunks with pgvector"
```
