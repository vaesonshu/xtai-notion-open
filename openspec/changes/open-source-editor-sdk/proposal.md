## Why

项目计划将编辑器作为开源 SDK 对外发布，但当前 `@workspace/editor` 为私有 monorepo 内部包，通过源码直引消费，且默认 UI 与 `@workspace/ui`、`@workspace/icons` 强耦合。外部集成者无法在不引入整套应用 UI 栈的情况下使用编辑器内核，也无法从 npm 安装独立构建产物。现在需要在保持现有编辑能力的前提下，建立可发布、可替换 UI 的分层包结构。

## What Changes

- 将 `packages/editor` 拆分为可独立发布的 `@xtai-notion/editor-core`、`@xtai-notion/editor-react`、`@xtai-notion/editor-shadcn` 三个包。
- 为 core 与 react 包引入 tsup 构建，产出 ESM/CJS 与类型声明，满足 npm 发布要求。
- 在 react 层引入 `ComponentsContext`，将 shadcn 具体 UI 实现下沉到 `@xtai-notion/editor-shadcn` 主题包。
- 新增根目录 `LICENSE` 与各包的 `README`、公开 `exports` 字段；移除发布包的 `private: true`。
- **BREAKING**：应用与示例代码的导入路径从 `@workspace/editor` 及其子路径迁移到新包名；过渡期可保留 `@workspace/editor` 作为 re-export 兼容层（见 design.md）。
- `apps/web` 继续作为官方 Demo；`apps/api` 仅依赖 `@xtai-notion/editor-core`，不依赖 React UI 包。
- 不修改块编辑、协作同步、斜杠菜单等用户可见编辑行为（行为规格仍由 `block-editor` 覆盖）。

## Capabilities

### New Capabilities

- `editor-sdk-core`：框架无关的编辑器内核包，含 schema、扩展、命令、文档契约与 Yjs 工具，零 React UI 依赖。
- `editor-sdk-react`：React Provider、Hooks、协作生命周期与 headless 节点视图，通过 `ComponentsContext` 注入 UI 原语。
- `editor-sdk-shadcn`：基于 shadcn/ui 的默认主题包，提供 `DocumentEditor`、SlashMenu、BubbleToolbar 等开箱即用组件。
- `editor-sdk-distribution`：npm 构建、许可证、版本策略、发布校验与 monorepo 内消费边界。

### Modified Capabilities

- `block-editor`：增加「通过分层 SDK 包消费编辑器能力」的集成要求；原有块编辑行为不变。

## Impact

- 影响 `packages/editor`（拆分或替换）、新增 `packages/editor-core`、`packages/editor-react`、`packages/editor-shadcn`。
- 影响 `apps/web`、`apps/api` 的全部 `@workspace/editor` 导入。
- 影响根目录 `package.json`、`pnpm-workspace.yaml`、`turbo.json`、各包 `tsconfig` 与 CI 构建命令。
- 不影响 NestJS 协作协议、PostgreSQL schema 或 Hocuspocus 房间语义。
- `@workspace/ui` 与 `@workspace/icons` 保留为 monorepo 内部包；仅 `@xtai-notion/editor-shadcn` 在发布时声明对 shadcn 相关 peer 依赖。
