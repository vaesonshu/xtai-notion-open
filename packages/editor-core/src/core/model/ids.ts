/** 块树允许的最大嵌套深度（Tab 缩进上限） */
export const MAX_NEST_DEPTH = 8

/** 为新建块生成稳定 UUID，供协同与块操作引用 */
export function generateBlockId(): string {
  return crypto.randomUUID()
}
