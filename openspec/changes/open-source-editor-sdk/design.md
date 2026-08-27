## Context

当前 `@workspace/editor` 已在逻辑上分为 `core/`、`react/`、`collaboration/`、`components/`，并通过 `package.json` 的 subpath exports 暴露。`apps/api` 仅使用 `@workspace/editor/core`；`apps/web` 使用完整栈含默认 UI。编辑器组件中有 6 个文件直接依赖 `@workspace/ui` 与 `@workspace/icons`。动机与能力范围见 [proposal.md](proposal.md)。

参考架构模式（仅借鉴分层思路，不复制源码）：learn-miaoma-docs 的 `core → react → shadcn` 多包发布模型。

## Goals / Non-Goals

**Goals:**

- 建立可在 npm 发布的 `@xtai-notion/editor-core`、`@xtai-notion/editor-react`、`@xtai-notion/editor-shadcn` 三层包。
- 外部用户可仅安装 core+react 并自带 UI；也可安装 shadcn 主题包开箱即用。
- monorepo 内 `apps/web` 与 `apps/api` 通过 workspace 协议消费上述包，行为与拆分前一致。
- 保持 Tiptap 3.x、React 19、现有协作与块编辑能力不退化。

**Non-Goals:**

- 不迁移到 Tiptap 2 或重写为 BlockSpec 块模型。
- 不在本变更内发布 npm（仅完成可发布结构与本地构建验证）。
- 不开源 `@workspace/ui` 全量组件库；shadcn 主题包只携带编辑器所需 UI 依赖。
- 不拆分 `apps/api` 或协作后端；不新增 Ant Design / MUI 等第二套主题。
- 不写完整文档站；仅提供各包最小 README 与 Quick Start 示例。

## Decisions

### 目标包名与目录

| 发布名 | 目录 | 职责 |
|--------|------|------|
| `@xtai-notion/editor-core` | `packages/editor-core` | Tiptap 扩展、命令、文档类型、Yjs 工具 |
| `@xtai-notion/editor-react` | `packages/editor-react` | Provider、Hooks、协作会话、ComponentsContext、headless 节点 |
| `@xtai-notion/editor-shadcn` | `packages/editor-shadcn` | 默认 UI：DocumentEditor、菜单、工具栏、状态组件 |

从现有 `packages/editor/src/` 按目录迁移，而非重写逻辑。迁移完成后删除或保留 `packages/editor` 作为薄 re-export 层（见兼容策略）。

### core 与 react 使用 tsup 构建

`editor-core` 与 `editor-react` 使用 tsup 输出 `dist/`（ESM + CJS + `.d.ts`），`package.json` 的 `exports` 指向构建产物。`sideEffects` 标记 CSS 文件。

`editor-shadcn` 同样 tsup 构建，并声明 `peerDependencies`：`react`、`react-dom`、`@xtai-notion/editor-core`、`@xtai-notion/editor-react`，以及对 shadcn 基元（`@base-ui/react` 或项目当前 UI 栈）的 peer。

monorepo 开发时 Turbo `build` 任务依赖 `^build`；`apps/web` 的 `transpilePackages` 更新为新包名。

不采用「仅源码 exports、不构建」方案，因为 npm 消费者无法依赖 monorepo 源码路径。

### ComponentsContext 注入 UI 原语

在 `@xtai-notion/editor-react` 定义 `ComponentsContext`，接口覆盖编辑器 UI 所需最小原语集：

- `Button`、`Input`、`Toggle`
- `Popover`（Trigger / Content）
- `Alert`、`Skeleton`
- `Command` 系列（供 SlashMenu）
- `AlertDialog` 系列（供 Canvas 块）

react 层组件（如 headless 菜单逻辑）通过 context 读取原语；`@xtai-notion/editor-shadcn` 提供默认实现，内部映射到 shadcn 组件。

不采用「react 层继续直接 import @workspace/ui」方案，因为会强制 npm 用户引入私有 UI 包。

### 协作层归属

`collaboration/` 目录迁入 `@xtai-notion/editor-react`（依赖 React 与 Hocuspocus Provider）。纯 Yjs 文档转换函数（如 `documentFromYjs`）留在 `@xtai-notion/editor-core`。

### 图标策略

`@xtai-notion/editor-shadcn` 直接依赖 `lucide-react`（或从 `@workspace/icons` 复制必要 re-export 到主题包内），不将 `@workspace/icons` 作为发布依赖。monorepo 内 web 应用可继续使用 `@workspace/icons`。

### 兼容层 `@workspace/editor`

迁移期间保留 `packages/editor` 作为兼容 shim，re-export 三个新包的公开 API，并在 `package.json` 中标记 `deprecated`。`apps/web` 与 `apps/api` 在本变更 tasks 中完成导入迁移后，下一变更可删除 shim。

不采用一次性删除旧包方案，以降低单次 PR 风险。

### 许可证

根目录添加 `LICENSE`（建议 MIT，与 OpenSpec skills 一致；若产品方另有要求可在 Open Questions 中替换）。各发布包 `package.json` 的 `license` 字段与根目录一致。

### 应用专属逻辑边界

COS 上传、mention 数据源、canvas 远程图片 fetch 继续由宿主通过 handler 注入；core/react 包内不得 import `apps/web` 或 `apps/api` 代码。测试中的 "COS" 字符串仅为 mock 描述，可保留。

## Risks / Trade-offs

- [大规模文件移动导致 git history 断裂] → 优先 `git mv`；必要时按子目录分批 PR。
- [构建产物与源码双轨增加调试成本] → monorepo dev 可配置 `exports` 开发态指向 `src/`（tsup watch）或统一先 build。
- [ComponentsContext 接口膨胀] → 首版只覆盖现有 6 个 UI 耦合文件所需原语；新块类型再扩展接口。
- [peerDependencies 版本与消费者冲突] → 文档明确支持的 React / Tiptap 主版本范围。
- [shadcn 主题与 Tailwind v4 样式绑定] → 主题包单独 export `style.css`；headless 用户无需引入。

## Migration Plan

1. 添加 LICENSE、创建三个新包骨架与 tsup 配置，空包可 typecheck。
2. 迁移 `core/` → `editor-core`，跑通 core 测试与 build。
3. 迁移 `react/` + `collaboration/` → `editor-react`，引入 ComponentsContext 骨架。
4. 迁移 `components/` → `editor-shadcn`，接入 context 默认实现。
5. 建立 `@workspace/editor` shim；更新 `apps/web`、`apps/api` 导入。
6. 全量 `pnpm lint`、`typecheck`、`test`、`web build` 验证。
7. 后续独立变更：npm publish 流水线、文档站、删除 shim。

回滚：恢复单一 `packages/editor` 导入路径；新包目录可保留但不参与 workspace。

## Open Questions

- `editor-shadcn` 是否将 shadcn 组件 vendoring 进包内，还是 peer 依赖 `@workspace/ui` 的子集（建议 peer + 文档说明）。

## Resolved

- npm scope 已确认为 **`@xtai-notion`**（2026-08-27）。
- 许可证已确认为 **MIT**（2026-08-27）。
