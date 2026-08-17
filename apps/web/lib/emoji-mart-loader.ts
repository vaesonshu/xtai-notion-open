type EmojiMartModule = typeof import("emoji-mart")

// @emoji-mart/data 运行时为 default 导出，类型声明未暴露 default 字段
type EmojiMartData = object

let emojiMartBundle: Promise<{
  Picker: EmojiMartModule["Picker"]
  data: EmojiMartData
}> | null = null

/** 评论区等场景共用：emoji-mart 体积大，只加载一次并复用 Promise。 */
export function preloadEmojiMart(): void {
  void loadEmojiMart()
}

export function loadEmojiMart() {
  if (!emojiMartBundle) {
    emojiMartBundle = Promise.all([
      import("emoji-mart"),
      import("@emoji-mart/data"),
    ]).then(([emojiMart, dataModule]) => ({
      Picker: emojiMart.Picker,
      data: (dataModule as { default: EmojiMartData }).default,
    }))
  }
  return emojiMartBundle
}
