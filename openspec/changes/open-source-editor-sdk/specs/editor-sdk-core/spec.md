## Purpose

为开源分发提供框架无关的编辑器内核包，使 Node.js 服务与任意前端框架均可使用同一套文档 schema、Tiptap 扩展与编辑命令，而不引入 React 或应用 UI 依赖。

## ADDED Requirements

### Requirement: 独立可发布的 core 包

系统 SHALL 提供名为 `@xtai-notion/editor-core` 的 npm 包，其运行时依赖不得包含 `react`、`react-dom` 或任何应用私有包（如 `@workspace/ui`）。

#### Scenario: Node 服务导入文档工具

- **WHEN** NestJS 服务从 `@xtai-notion/editor-core` 导入 `documentFromYjs` 与 `collectMentionIds`
- **THEN** 构建 SHALL 成功且无需安装 React

#### Scenario: 构建产物包含类型声明

- **WHEN** 消费者执行 `pnpm build` 后安装 `@xtai-notion/editor-core`
- **THEN** 包 SHALL 提供 ESM/CJS 入口与 `.d.ts` 类型文件

### Requirement: 稳定的 core 公开 API

`@xtai-notion/editor-core` SHALL 导出文档契约（`EditorDocument`、`createEmptyDocument`、`isEditorDocument`）、扩展工厂（`createEditorExtensions`）、斜杠命令、行内格式化命令、表格/提及/图片上传工具函数，以及 Yjs 文档转换工具。

#### Scenario: 创建空文档

- **WHEN** 调用 `createEmptyDocument()`
- **THEN** 返回值 SHALL 通过 `isEditorDocument` 校验且可用于 `createEditorExtensions`

#### Scenario: 斜杠命令过滤

- **WHEN** 调用 `filterSlashCommands("代码")`
- **THEN** 返回列表 SHALL 包含代码块相关命令且顺序稳定

### Requirement: core 包零 UI 耦合

`@xtai-notion/editor-core` 源码与构建产物 SHALL NOT 引用 `@workspace/ui`、`@workspace/icons` 或 `@xtai-notion/editor-shadcn`。

#### Scenario: 静态依赖检查

- **WHEN** 对 `packages/editor-core` 运行依赖边界检查（rg 或 eslint import 规则）
- **THEN** SHALL 无 `@workspace/ui`、`@workspace/icons`、`@xtai-notion/editor-shadcn` 匹配
