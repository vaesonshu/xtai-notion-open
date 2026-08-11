# 编辑器 Emoji 性能优化：面试总结

## 一句话总结

将 emoji 功能从首屏静态加载改为“按需动态加载 + 按需挂载 + 生命周期清理”，把完整 emoji 数据集和 Picker 的成本从编辑器初始化阶段延迟到用户真正点击 emoji 按钮时。

## 背景与问题

项目使用 `emoji-mart` 提供 emoji 选择器，并使用 `@emoji-mart/data` 提供完整 emoji 数据。

初始实现将依赖静态导入到固定工具栏中：

```tsx
import data from "@emoji-mart/data"
import { Picker } from "emoji-mart"
```

这会带来两个问题：

1. **首屏加载成本高**：即使用户从未使用 emoji，完整数据集和 Picker 代码也会进入编辑器相关的客户端模块，增加 JavaScript 下载、解析和执行成本。
2. **初始化阻塞主线程**：创建 Picker 时需要处理大量 emoji 数据并生成对应的 DOM，容易在编辑器加载或弹框打开时造成卡顿。

## 核心优化方案

### 1. 动态导入，降低首屏负担

移除文件顶部的静态导入，改为用户首次打开 emoji 面板时动态加载：

```tsx
void Promise.all([import("emoji-mart"), import("@emoji-mart/data")]).then(
  ([{ Picker }, { default: data }]) => {
    // 在这里创建 Picker
  }
)
```

这样可以让 emoji 相关代码进入独立的异步 chunk：

- 用户只打开编辑器但不使用 emoji 时，不需要加载 emoji 资源；
- 用户第一次点击 emoji 按钮时才加载相关模块；
- 后续打开通常会复用浏览器的模块缓存。

这是典型的 **code splitting** 和 **lazy loading**，核心是把非首屏必需资源延迟到真正使用时再加载。

### 2. 按需挂载 Picker，避免隐藏状态下创建大量 DOM

Popover 使用受控状态，只有打开时才挂载 Picker：

```tsx
<Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
  <PopoverTrigger>{/* emoji button */}</PopoverTrigger>
  <PopoverContent>
    {emojiPickerOpen && <EmojiPicker editor={editor} />}
  </PopoverContent>
</Popover>
```

关闭弹框时，`EmojiPicker` 会被卸载，不会在页面中持续保留大规模 emoji DOM。这样既减少内存占用，也避免不必要的布局、绘制和事件处理。

### 3. 管理异步加载生命周期，避免竞态问题

动态导入是异步操作，需要考虑以下场景：

- 用户打开弹框后马上关闭；
- 组件在模块加载完成前被卸载；
- 异步回调返回时，原来的容器已经不存在。

实现中通过取消标记避免向已卸载的容器插入 Picker，并在卸载时移除已经创建的 Picker：

```tsx
let cancelled = false
let picker: HTMLElement | undefined

// 动态加载完成后先检查组件是否仍然有效
if (cancelled || !containerRef.current) return

return () => {
  cancelled = true
  picker?.remove()
}
```

这部分的重点不是简单地“异步加载”，而是保证异步任务与 React 组件生命周期一致，避免内存泄漏、无效 DOM 操作和状态更新竞态。

### 4. 选择完成后立即关闭弹框

Picker 的 `onEmojiSelect` 回调中，先插入 emoji，再关闭弹框：

```tsx
onEmojiSelect: (emoji: { native?: string }) => {
  if (!emoji.native) return

  insertEmoji(editor, emoji.native)
  onSelect()
}
```

这样用户选择一次后可以立即回到编辑器继续输入，交互行为也符合常见编辑器的预期。

## 面试时可以这样回答

> 这次 emoji 卡顿的根因是 `emoji-mart` 和完整 emoji 数据集被静态引入到了编辑器工具栏。即使用户不使用 emoji，首屏也会下载、解析相关资源；而创建 Picker 时还会处理大量数据并生成 DOM，从而增加主线程压力。
>
> 我的优化主要有三点。第一，把 `emoji-mart` 和 `@emoji-mart/data` 改成动态 `import()`，只有用户第一次点击 emoji 按钮时才加载，减少首屏 JavaScript 体积和解析成本。第二，Popover 采用受控状态，只有打开时才挂载 Picker，关闭时卸载，避免无意义的 DOM 和内存占用。第三，给异步加载增加卸载保护，防止用户快速关闭弹框后，异步回调继续操作已经失效的 DOM。用户选中 emoji 后则立即插入内容并关闭弹框。
>
> 本质上是把 emoji 从“首屏同步初始化”改成“用户触发时按需加载和按需挂载”，用一次首次打开时的加载成本换取更快的编辑器首屏体验。

## 面试追问与回答

### 为什么不直接删除 emoji 数据？

因为完整 emoji 数据是功能所需的，删除会损失搜索、分类和完整选择能力。动态加载可以保留功能，只调整资源加载时机。

### 第一次打开会不会变慢？

会有一次按需加载成本，因此界面提供 loading 状态。但这是合理的性能取舍：编辑器首屏是高频路径，而打开 emoji 面板只发生在实际需要 emoji 的用户身上。后续打开可以复用模块缓存。

### 还可以继续优化什么？

- 在用户 hover 或即将点击按钮时预加载异步 chunk，缩短首次打开等待时间；
- 使用 `requestIdleCallback` 在浏览器空闲时间预加载，但不能影响首屏主线程；
- 对 emoji 列表使用虚拟滚动，避免一次性创建过多节点；
- 按分类或搜索结果加载数据，减少一次性处理的数据量；
- 优化 emoji 图片资源的缓存、CDN 和加载策略。

## 如何验证优化效果

可以使用 Chrome DevTools 的 Network 和 Performance 面板进行前后对比：

1. 只打开编辑器、不点击 emoji，确认 Network 中不再加载 emoji 相关异步 chunk。
2. 第一次点击 emoji，确认只在此时加载对应 chunk，并能看到 loading 状态。
3. 再次打开 emoji，确认模块命中缓存，加载时间明显降低。
4. 对比优化前后的首屏 JavaScript 体积、脚本执行时间、Long Task 数量和首次可交互时间。
5. 验证快速打开和关闭弹框时没有控制台错误、无效 DOM 操作或内存持续增长。

## 相关实现

- 工具栏实现：`apps/web/components/inkspace/fixed-toolbar.tsx`
- 行为测试：`apps/web/components/inkspace/fixed-toolbar.test.tsx`
