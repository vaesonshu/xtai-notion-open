type EmojiMartModule = typeof import("emoji-mart")
type EmojiDataModule = typeof import("@emoji-mart/data")

let emojiMartBundle: Promise<{
  Picker: EmojiMartModule["Picker"]
  data: EmojiDataModule["default"]
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
      data: dataModule.default,
    }))
  }
  return emojiMartBundle
}
