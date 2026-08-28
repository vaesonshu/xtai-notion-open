## 1. 发布基础与包骨架

> **TDD 约束：** 迁移过程中，每迁移一个模块先迁移或更新对应测试，确认行为不变后再改导入路径。纯配置与 re-export 任务不适用。

- [x] 1.1 在仓库根目录添加 `LICENSE`（MIT）；版权行使用 `Copyright (c) 2026 xtai-notion contributors`。
- [x] 1.2 创建 `packages/editor-core/`，包含 `package.json`（`name: @xtai-notion/editor-core`、`private: false`、`type: module`）、`tsconfig.json`、`eslint.config.js`、`tsup.config.ts`、`README.md`；`build` 脚本为 `tsup`，`exports` 指向 `./dist/index.js` 与 `./dist/index.d.ts`；运行 `pnpm install` 后 `pnpm --filter @xtai-notion/editor-core typecheck` 通过（空包或占位入口即可）。
- [x] 1.3 创建 `packages/editor-react/` 与 `packages/editor-shadcn/`，结构同 1.2；`editor-react` 声明 `peerDependencies: react, react-dom` 与依赖 `@xtai-notion/editor-core`；`editor-shadcn` 依赖 core 与 react。
- [x] 1.4 更新根目录 `pnpm-workspace.yaml` 与 `turbo.json`，使三包参与 `build`、`lint`、`typecheck`、`test` 任务；`build` 设置 `dependsOn: ["^build"]`；运行 `pnpm typecheck` 验收工作区解析正常。

## 2. 迁移 editor-core

- [x] 2.1 使用 `git mv` 将 `packages/editor/src/core/` 下全部源码与测试迁移到 `packages/editor-core/src/`；更新内部相对导入路径。
- [x] 2.2 配置 `packages/editor-core/tsup.config.ts` 打包入口 `src/index.ts`，外部化 `@tiptap/*`、`yjs` 等依赖；运行 `pnpm --filter @xtai-notion/editor-core build` 验收 `dist/` 生成。
- [x] 2.3 迁移 `packages/editor/src/core/**/*.test.ts` 与相关 vitest 配置；运行 `pnpm --filter @xtai-notion/editor-core test` 验收与迁移前用例数一致且通过。
- [x] 2.4 确认 `packages/editor-core` 无 `@workspace/ui`、`@workspace/icons`、`react` 导入；运行 `rg '@workspace/ui|@workspace/icons|from "react"' packages/editor-core` 验收无匹配（类型-only 的 devDependency 除外）。

## 3. 迁移 editor-react

- [x] 3.1 将 `packages/editor/src/react/` 与 `packages/editor/src/collaboration/` 迁移到 `packages/editor-react/src/`；协作类型与 `create-collaboration-session` 一并迁移；更新对 core 的导入为 `@xtai-notion/editor-core`。
- [x] 3.2 创建 `packages/editor-react/src/components/components-context.tsx`，定义 `EditorComponents` 接口（Button、Input、Toggle、Popover、Alert、Skeleton、Command、AlertDialog 等，覆盖现有 6 个 UI 耦合文件所需原语）及 `ComponentsProvider`、`useEditorComponents`。
- [x] 3.3 将 `packages/editor/src/components/` 中 **不依赖具体 UI 库** 的逻辑（若有）留在 react 层作为 headless 组件；凡直接 import `@workspace/ui` 的文件留待第 4 节迁入 shadcn 包。
- [x] 3.4 配置 tsup 与 vitest；迁移 `packages/editor/src/react/**/*.test.ts` 与 `packages/editor/src/collaboration/**/*.test.ts`；运行 `pnpm --filter @xtai-notion/editor-react test` 验收通过。
- [x] 3.5 确认 `packages/editor-react` 无 `@workspace/ui`、`@xtai-notion/editor-shadcn` 导入；运行 `pnpm --filter @xtai-notion/editor-react typecheck` 验收通过。

## 4. 迁移 editor-shadcn 主题包

- [x] 4.1 将原 `packages/editor/src/components/` 下全部 UI 组件迁移到 `packages/editor-shadcn/src/components/`；将 `packages/editor/src/styles/editor.css` 迁移为 `packages/editor-shadcn/src/style.css` 并通过 `exports["./style.css"]` 暴露。
- [x] 4.2 创建 `packages/editor-shadcn/src/components/default-components.tsx`，用 shadcn 基元（可从 `@base-ui/react` + 本地拷贝的最小组件，或 vendored 组件）实现 `EditorComponents` 接口；在 `ShadcnEditorProvider` 中组合 `ComponentsProvider` 与默认实现。
- [x] 4.3 替换迁移组件中的 `@workspace/ui` 与 `@workspace/icons` 导入为主题包内实现或 `lucide-react` 直接导入；运行 `rg '@workspace/ui|@workspace/icons' packages/editor-shadcn` 验收无匹配。
- [x] 4.4 迁移 `packages/editor/src/components/**/*.test.tsx` 到 `packages/editor-shadcn`；更新测试 wrapper 使用 `ShadcnEditorProvider`；运行 `pnpm --filter @xtai-notion/editor-shadcn test` 验收通过。
- [x] 4.5 确保 `DocumentEditor` 公开 props（`content`/`collaboration` 互斥、`imageUpload`、`mentionProvider` 等）与迁移前一致；运行 `pnpm --filter @xtai-notion/editor-shadcn typecheck` 验收通过。

## 5. 兼容层与 workspace 包更新

- [x] 5.1 将 `packages/editor` 改为 shim：各 subpath（`.`、`./core`、`./react`、`./components`、`./collaboration`、`./styles.css`）re-export 对应新包；在 `package.json` 添加 `"deprecated": "Use @xtai-notion/editor-core, @xtai-notion/editor-react, @xtai-notion/editor-shadcn instead."` 或 README 说明。
- [x] 5.2 更新 `apps/web/package.json` 依赖：添加 `@xtai-notion/editor-shadcn`、`@xtai-notion/editor-react`、`@xtai-notion/editor-core` workspace 引用；逐步将源码导入从 `@workspace/editor` 改为新包（优先 `@xtai-notion/editor-shadcn` 与 `@xtai-notion/editor-react`）。
- [x] 5.3 更新 `apps/api/package.json` 与 `documents.service.ts` 等文件：将 `@workspace/editor/core` 改为 `@xtai-notion/editor-core`；确认 api 生产依赖不含 react 包。
- [x] 5.4 更新 `apps/web/next.config.ts` 的 `transpilePackages` 为 `@xtai-notion/editor-core`、`@xtai-notion/editor-react`、`@xtai-notion/editor-shadcn`（可暂时保留 `@workspace/editor`）；更新 `apps/web/app/layout.tsx` 样式导入为 `@xtai-notion/editor-shadcn/style.css`。
- [x] 5.5 运行 `rg '@workspace/editor' apps packages --glob '!packages/editor/**'` 验收仅测试 mock 或 shim 文档中保留旧路径；若有生产代码残留，继续迁移直至清零。

## 6. 文档与边界校验

- [x] 6.1 为 `packages/editor-core`、`packages/editor-react`、`packages/editor-shadcn` 各编写 `README.md`：安装、peer 依赖、最小示例、样式引入；react README 须包含 headless + 自定义 `ComponentsProvider` 示例。
- [x] 6.2 在根目录 `README.md` 增加「编辑器 SDK 包结构」小节，说明三包职责与开源意图（简短即可）。
- [x] 6.3 添加 ESLint 或简单脚本 `scripts/check-editor-boundaries.mjs`（可选），校验 core/react/shadcn 包间禁止反向依赖；在根 `package.json` 增加 `"check:editor-boundaries"` 脚本。

## 7. 全量验收

- [x] 7.1 运行 `pnpm install --frozen-lockfile`（若 lockfile 有变更则先 `pnpm install` 再提交 lockfile）。
- [x] 7.2 运行 `pnpm --filter @xtai-notion/editor-core build && pnpm --filter @xtai-notion/editor-react build && pnpm --filter @xtai-notion/editor-shadcn build` 验收三包构建成功。
- [x] 7.3 运行 `pnpm lint`、`pnpm typecheck`、`pnpm --filter @xtai-notion/editor-core test`、`pnpm --filter @xtai-notion/editor-react test`、`pnpm --filter @xtai-notion/editor-shadcn test`、`pnpm --filter api test`、`pnpm --filter web test` 验收全部通过。
- [x] 7.4 运行 `pnpm --filter web build` 验收 Demo 应用构建成功。
- [x] 7.5 手动或 Playwright 冒烟：打开文档编辑页，验证斜杠菜单、粗体、协作状态（若环境可用）与迁移前行为一致；将结果记录到本变更目录 `README.md` 验证说明。

## 8. 后续（本变更不实现，仅记录）

- [ ] 8.1 （后续变更）配置 Changesets 或 semantic-release 实现 npm 发布流水线。
- [x] 8.2 （后续变更）删除 `@workspace/editor` shim 与 `packages/editor` 目录。
- [ ] 8.3 （后续变更）建立独立文档站（VitePress / Nextra）与 interactive playground。
