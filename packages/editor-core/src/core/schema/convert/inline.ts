import type { Mark, Node as PMNode, Schema } from "@tiptap/pm/model"
import { Fragment } from "@tiptap/pm/model"
import type { InlineContent, InlineStyles } from "../../model/types"

/** PM marks → Block 行内 styles（不含 link） */
export function marksToStyles(marks: readonly Mark[]): InlineStyles {
  const styles: InlineStyles = {}
  for (const mark of marks) {
    switch (mark.type.name) {
      case "bold":
        styles.bold = true
        break
      case "italic":
        styles.italic = true
        break
      case "underline":
        styles.underline = true
        break
      case "strike":
        styles.strike = true
        break
      case "code":
        styles.code = true
        break
      case "textStyle": {
        const color = mark.attrs.color
        if (typeof color === "string" && color.length > 0) {
          styles.color = color
        }
        break
      }
    }
  }
  return styles
}

/** Block styles → PM marks */
export function stylesToMarks(styles: InlineStyles, schema: Schema): Mark[] {
  const marks: Mark[] = []
  if (styles.bold && schema.marks.bold) {
    marks.push(schema.marks.bold.create())
  }
  if (styles.italic && schema.marks.italic) {
    marks.push(schema.marks.italic.create())
  }
  if (styles.underline && schema.marks.underline) {
    marks.push(schema.marks.underline.create())
  }
  if (styles.strike && schema.marks.strike) {
    marks.push(schema.marks.strike.create())
  }
  if (styles.code && schema.marks.code) {
    marks.push(schema.marks.code.create())
  }
  if (styles.color && schema.marks.textStyle) {
    marks.push(schema.marks.textStyle.create({ color: styles.color }))
  }
  return marks
}

function textNodeToInline(node: PMNode): InlineContent[] {
  const text = node.text ?? ""
  if (!text) {
    return []
  }

  const linkMark = node.marks.find((mark) => mark.type.name === "link")
  const styles = marksToStyles(
    node.marks.filter((mark) => mark.type.name !== "link")
  )

  if (linkMark) {
    return [
      {
        type: "link",
        href: (linkMark.attrs.href as string) ?? "",
        content: [{ type: "text", text, styles }],
      },
    ]
  }

  return [{ type: "text", text, styles }]
}

/** 将 PM 行内片段转为 Block InlineContent[] */
export function inlinePmToBlock(fragment: Fragment): InlineContent[] {
  const result: InlineContent[] = []

  fragment.forEach((node) => {
    if (node.isText) {
      result.push(...textNodeToInline(node))
      return
    }

    if (node.type.name === "mention") {
      result.push({
        type: "mention",
        id: (node.attrs.id as string) ?? "",
        label: (node.attrs.label as string) ?? (node.attrs.id as string) ?? "",
        href: (node.attrs.href as string) ?? "",
      })
      return
    }

    // hardBreak 等其它 inline 节点压成换行文本
    if (node.type.name === "hardBreak") {
      result.push({ type: "text", text: "\n", styles: {} })
    }
  })

  return result
}

/** codeBlock 的 text* 内容 → 无样式行内数组 */
export function codeTextPmToBlock(fragment: Fragment): InlineContent[] {
  const parts: string[] = []
  fragment.forEach((node) => {
    if (node.isText && node.text) {
      parts.push(node.text)
    }
  })
  const text = parts.join("")
  return text ? [{ type: "text", text, styles: {} }] : []
}

export function inlineBlockToPm(
  inline: InlineContent[],
  schema: Schema
): PMNode[] {
  const nodes: PMNode[] = []

  for (const item of inline) {
    if (item.type === "text") {
      if (item.text) {
        nodes.push(schema.text(item.text, stylesToMarks(item.styles, schema)))
      }
      continue
    }

    if (item.type === "link") {
      const linkType = schema.marks.link
      if (!linkType) {
        continue
      }
      const linkMark = linkType.create({ href: item.href })
      for (const child of item.content) {
        if (child.type === "text" && child.text) {
          nodes.push(
            schema.text(child.text, [
              ...stylesToMarks(child.styles, schema),
              linkMark,
            ])
          )
        }
      }
      continue
    }

    if (item.type === "mention") {
      const mentionType = schema.nodes.mention
      if (mentionType) {
        nodes.push(
          mentionType.create({
            id: item.id,
            label: item.label,
            href: item.href,
          })
        )
      }
    }
  }

  return nodes
}

function requireNodeType(schema: Schema, name: string) {
  const nodeType = schema.nodes[name]
  if (!nodeType) {
    throw new Error(`Missing block schema node: ${name}`)
  }
  return nodeType
}

export { requireNodeType }
