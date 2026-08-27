## ADDED Requirements

### Requirement: 通过分层 SDK 包消费编辑器

集成者 SHALL 通过 `@xtai-notion/editor-core`、`@xtai-notion/editor-react`、`@xtai-notion/editor-shadcn` 分层包使用编辑器能力；官方 Demo 应用（`apps/web`）与 API 服务（`apps/api`）SHALL 在本变更完成后迁移至新包导入路径。块级编辑、斜杠菜单、工具栏、撤销重做与状态反馈行为 SHALL 与现有 `block-editor` 要求一致。

#### Scenario: Web Demo 使用 shadcn 主题包

- **WHEN** `apps/web` 渲染文档编辑页
- **THEN** 应用 SHALL 从 `@xtai-notion/editor-shadcn` 导入 `DocumentEditor` 及相关组件，且编辑行为与迁移前一致

#### Scenario: API 仅依赖 core

- **WHEN** `apps/api` 处理文档提及或 Yjs 转换
- **THEN** 服务 SHALL 仅从 `@xtai-notion/editor-core` 导入，且不将 React UI 包加入生产依赖

#### Scenario: Headless 集成路径存在

- **WHEN** 文档或示例展示不安装 `@xtai-notion/editor-shadcn` 的集成方式
- **THEN** 示例 SHALL 演示仅使用 `@xtai-notion/editor-core` 与 `@xtai-notion/editor-react` 并提供自定义 UI
