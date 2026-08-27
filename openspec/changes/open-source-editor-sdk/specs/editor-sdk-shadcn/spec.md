## Purpose

为希望开箱即用的集成者提供基于 shadcn/ui 的默认编辑器 UI 主题，包括文档编辑器壳层、斜杠菜单、气泡工具栏与协作状态展示。

## ADDED Requirements

### Requirement: 独立可发布的 shadcn 主题包

系统 SHALL 提供 `@xtai-notion/editor-shadcn` 包，依赖 `@xtai-notion/editor-core` 与 `@xtai-notion/editor-react`，并实现 `ComponentsContext` 所需的全部 UI 原语。

#### Scenario: 开箱即用 DocumentEditor

- **WHEN** 消费者从 `@xtai-notion/editor-shadcn` 导入 `DocumentEditor` 并传入 `content`
- **THEN** 页面 SHALL 渲染可编辑文档、斜杠菜单与气泡工具栏，行为与迁移前 `@workspace/editor/components` 一致

#### Scenario: 样式入口

- **WHEN** 消费者 import `@xtai-notion/editor-shadcn/style.css`
- **THEN** ProseMirror 与编辑器 UI  SHALL 具备最低可读样式

### Requirement: 默认 UI 组件集合

`@xtai-notion/editor-shadcn` SHALL 导出 `DocumentEditor`、`EditorSurface`、`SlashMenu`、`MentionMenu`、`BubbleToolbar`、`BlockHandle`、`CollaborationStatus`、`TableGridPicker`、`TableMenu`、`ImageUpload` 及现有 `@workspace/editor/components` 中的同等公开 API。

#### Scenario: 斜杠菜单插入块

- **WHEN** 用户在 `DocumentEditor` 中输入 `/代码` 并选择命令
- **THEN** 文档 SHALL 插入代码块，与 `block-editor` 规格一致

#### Scenario: 协作状态展示

- **WHEN** 协作连接处于 `connecting` 状态
- **THEN** `CollaborationStatus` SHALL 展示可访问的连接中反馈

### Requirement: 宿主能力仍通过 props 注入

`DocumentEditor` SHALL 继续通过 props 接收 `imageUpload`、`mentionProvider`、`mentionNavigate`、`canvasImageFetch` 等宿主 handler，且 SHALL NOT 硬编码 COS、NestJS 或 web 应用 API 路径。

#### Scenario: 注入图片上传

- **WHEN** 宿主传入 `imageUpload` handler
- **THEN** 图片上传节点 SHALL 调用该 handler 而非内置 COS 客户端

#### Scenario: 无 mentionProvider 时不展示候选

- **WHEN** 未传入 `mentionProvider`
- **THEN** 提及菜单 SHALL 不展示外部文档候选

### Requirement: shadcn 包不依赖应用私有包

`@xtai-notion/editor-shadcn` 发布依赖 SHALL NOT 包含 `@workspace/ui` 或 `@workspace/icons`；所需 shadcn 基元与图标 SHALL 在主题包内声明为直接依赖或 peer 依赖。

#### Scenario: 静态依赖检查

- **WHEN** 对 `packages/editor-shadcn` 检查 import
- **THEN** SHALL 无 `@workspace/ui`、`@workspace/icons` 匹配
