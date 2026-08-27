## Purpose

为 React 应用提供编辑器状态管理、协作生命周期与可替换 UI 原语注入点，使消费者可在不绑定特定组件库的情况下集成 Tiptap 编辑器。

## ADDED Requirements

### Requirement: 独立可发布的 react 包

系统 SHALL 提供 `@xtai-notion/editor-react` 包，声明 `react` 与 `react-dom` 为 peerDependencies，并依赖 `@xtai-notion/editor-core` 作为唯一编辑器内核依赖。

#### Scenario: 最小 React 集成

- **WHEN** 应用在 `EditorProvider` 内渲染 `EditorContent`
- **THEN** 编辑器 SHALL 可编辑且可通过 `useEditorInstance` 获取 Tiptap 实例

#### Scenario: peer 依赖未安装时报错清晰

- **WHEN** 消费者未安装 `react` peer 依赖并尝试构建
- **THEN** 包管理器或构建工具 SHALL 报告缺失 peer 而非静默失败

### Requirement: 协作 Provider 生命周期

`@xtai-notion/editor-react` SHALL 提供 `CollaborationEditorProvider`，在首次远端同步完成前不写入本地 starter 内容，并在卸载时销毁 Y.Doc 与 Provider。

#### Scenario: 远端已有内容时不覆盖

- **WHEN** 协作房间已有文档且客户端完成首次同步
- **THEN** 编辑器 SHALL 显示远端内容且不写入 `createStarterDocument()` 结果

#### Scenario: 卸载释放资源

- **WHEN** `CollaborationEditorProvider` 卸载
- **THEN** 关联 Y.Doc 与 Provider SHALL 各销毁一次

### Requirement: ComponentsContext UI 注入

`@xtai-notion/editor-react` SHALL 导出 `ComponentsProvider` 与 `useEditorComponents`，定义编辑器所需 UI 原语接口；react 层内置组件（如 headless 菜单控制器）SHALL 通过该 context 渲染按钮、弹层等，而非直接 import 具体 UI 库。

#### Scenario: 未提供 ComponentsProvider 时使用 noop 或报错

- **WHEN** 消费者渲染依赖 UI 原语的 headless 组件但未包裹 `ComponentsProvider`
- **THEN** 系统 SHALL 抛出明确错误或渲染受控 fallback，且不得静默 import shadcn

#### Scenario: 自定义主题注入 Button

- **WHEN** 消费者通过 `ComponentsProvider` 注入自定义 `Button` 实现
- **THEN** headless 工具栏 SHALL 使用该 `Button` 渲染控件

### Requirement: react 包不依赖 shadcn 主题包

`@xtai-notion/editor-react` 源码 SHALL NOT 依赖 `@xtai-notion/editor-shadcn` 或 `@workspace/ui`。

#### Scenario: 静态依赖检查

- **WHEN** 对 `packages/editor-react` 检查 import
- **THEN** SHALL 无 `@xtai-notion/editor-shadcn`、`@workspace/ui` 匹配
