## Why

当前页面仅展示静态文档，现有 `@workspace/editor` 只提供基础 Tiptap 适配，无法支持真实编辑、多人同步或重启后的内容恢复。现在需要建立可复用的编辑器核心与协作服务边界，作为知识工作台后续功能的基础。

## What Changes

- 将静态文档画布替换为基于 Tiptap 的块级编辑器，支持常用块、斜杠菜单、选区工具栏、撤销重做和块排序。
- 新增 Yjs 与 Hocuspocus 实时协作，提供同步状态、在线成员和协作者光标。
- 新增 NestJS `apps/api` 应用，提供开发身份、文档成员授权、协作连接和 PostgreSQL 持久化。
- 新增 `@workspace/icons`，使编辑器和 Web 应用从工作区图标包使用图标；编辑器 UI 复用 `@workspace/ui`。
- 将编辑器依赖从不固定的 `latest` 版本替换为可复现的兼容版本。

## Capabilities

### New Capabilities

- `block-editor`: 提供 Notion 风格的可组合块级编辑器、编辑命令和编辑器 UI。
- `realtime-document-collaboration`: 使用 Yjs 持久化、授权和实时同步协作文档。
- `workspace-icon-library`: 提供工作区统一的图标导出边界。

### Modified Capabilities

无。

## Impact

- 影响 `packages/editor`、`packages/ui`、新增 `packages/icons` 与 `apps/web` 文档页面。
- 新增 `apps/api` NestJS 服务、PostgreSQL schema 与协作 WebSocket 端点。
- 新增 Tiptap 协作、Yjs、Hocuspocus、NestJS 与数据库依赖。
- 后续部署需提供 PostgreSQL 连接配置和 Web 到 API 的协作端点配置。
