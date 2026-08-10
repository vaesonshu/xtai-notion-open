## Purpose

为工作区应用和共享包建立统一图标访问边界，避免各功能直接耦合第三方图标包并保持图标视觉与类型使用一致。

## ADDED Requirements

### Requirement: 工作区图标出口

系统 SHALL 提供一个工作区图标包，用于导出编辑器和 Web 应用所需的图标组件与图标类型。

#### Scenario: 编辑器使用格式化图标

- **WHEN** 编辑器工具栏需要渲染格式化图标
- **THEN** 工具栏 SHALL 从工作区图标包导入该图标

### Requirement: 消费方不直接依赖图标实现

系统 SHALL 禁止编辑器包和 Web 应用直接从第三方图标库导入图标。

#### Scenario: 新增页面图标

- **WHEN** 开发者为 Web 页面新增图标
- **THEN** 页面 SHALL 通过工作区图标包获取该图标

#### Scenario: 替换图标实现

- **WHEN** 工作区图标包更换其内部图标实现
- **THEN** 编辑器和 Web 应用 SHALL 不需要更改其图标导入路径
