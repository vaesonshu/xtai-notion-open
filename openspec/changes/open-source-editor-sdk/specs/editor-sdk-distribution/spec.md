## Purpose

确保编辑器 SDK 在 monorepo 内外均可通过标准 npm 包机制安装、构建与校验，并满足开源仓库的许可证与文档最低要求。

## ADDED Requirements

### Requirement: 开源许可证

仓库根目录 SHALL 包含 `LICENSE` 文件；所有发布包（`@xtai-notion/editor-core`、`@xtai-notion/editor-react`、`@xtai-notion/editor-shadcn`）的 `package.json` SHALL 声明与根目录一致的 `license` 字段，且 `private` 字段 SHALL 为 `false` 或省略。

#### Scenario: 许可证文件存在

- **WHEN** 查看仓库根目录
- **THEN** SHALL 存在可读的 `LICENSE` 文件

#### Scenario: 发布包非私有

- **WHEN** 查看 `packages/editor-core/package.json`
- **THEN** `private` SHALL NOT 为 `true`

### Requirement: tsup 构建与 exports 映射

每个发布包 SHALL 提供 `build` 脚本（tsup），且 `package.json` 的 `main`、`module`、`types` 与 `exports` SHALL 指向 `dist/` 构建产物而非 `src/` 源码。

#### Scenario: 构建 core 包

- **WHEN** 运行 `pnpm --filter @xtai-notion/editor-core build`
- **THEN** `packages/editor-core/dist/` SHALL 生成 JS 与 d.ts 文件

#### Scenario: Turbo 构建顺序

- **WHEN** 根目录运行 `pnpm build`
- **THEN** `editor-react` 与 `editor-shadcn` SHALL 在各自依赖包 build 完成后构建

### Requirement: 兼容 re-export 层

迁移期间系统 SHALL 保留 `@workspace/editor` 包作为薄 shim，re-export 新三包公开 API，并在 `package.json` 或 README 中标注 deprecated。

#### Scenario: 旧导入路径仍可用

- **WHEN** 代码仍从 `@workspace/editor/core` 导入
- **THEN** 类型检查 SHALL 通过且符号解析到新 core 包

#### Scenario: shim 不引入额外逻辑

- **WHEN** 查看 `packages/editor` shim 源码
- **THEN** 文件 SHALL 仅包含 re-export，不含业务逻辑

### Requirement: 发布前校验命令

项目 SHALL 提供可文档化的校验流程：安装依赖、lint、typecheck、三包 test、web build；全部通过后方可标记本变更完成。

#### Scenario: 全量校验

- **WHEN** 在 CI 或本地执行变更 tasks 第 7 节验收命令
- **THEN** 所有命令 SHALL 以 exit code 0 结束

### Requirement: 各包最小 README

每个发布包 SHALL 包含 `README.md`，说明安装方式、peer 依赖、最小使用示例与样式引入方式。

#### Scenario: core README 示例

- **WHEN** 阅读 `packages/editor-core/README.md`
- **THEN** SHALL 包含至少一个可复制的 import 示例
