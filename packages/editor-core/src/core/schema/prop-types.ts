import type { Attribute, Attributes } from "@tiptap/core"

/** 单个块 prop 的默认值与可选枚举 */
export type PropSpec<T extends boolean | number | string> = {
  default: T
  values?: readonly T[]
}

/** 块 props 声明式 schema，用于生成 Tiptap node attributes */
export type PropSchema = Record<string, PropSpec<boolean | number | string>>

/** camelCase → kebab-case，映射为 HTML data 属性名 */
function camelToKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

function parsePropValue(
  spec: PropSpec<boolean | number | string>,
  raw: string | null
): boolean | number | string | null {
  if (raw === null) {
    return null
  }

  if (typeof spec.default === "boolean") {
    if (raw === "true") return true
    if (raw === "false") return false
    return null
  }

  if (typeof spec.default === "number") {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  return raw
}

/** 将 PropSchema 转为 Tiptap `addAttributes` 配置 */
export function propsToAttributes(propSchema: PropSchema): Attributes {
  const attributes: Record<string, Attribute> = {}

  for (const [name, spec] of Object.entries(propSchema)) {
    const htmlName = camelToKebab(name)
    attributes[name] = {
      default: spec.default,
      keepOnSplit: true,
      parseHTML: (element) =>
        parsePropValue(spec, element.getAttribute(htmlName)),
      renderHTML: (attrs) => {
        const value = attrs[name]
        if (value === spec.default) {
          return {}
        }
        return { [htmlName]: String(value) }
      },
    }
  }

  return attributes
}
