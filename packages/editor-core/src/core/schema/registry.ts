import type { Node } from "@tiptap/core"
import type { BlockSpec } from "./block-spec"

/** 块 spec 注册表：convert、keymap、slash 与 extensions 的统一来源 */
export class BlockSchemaRegistry {
  private readonly specs: Map<string, BlockSpec>

  constructor(initialSpecs: BlockSpec[] = []) {
    this.specs = new Map()
    for (const spec of initialSpecs) {
      this.register(spec)
    }
  }

  register(spec: BlockSpec): void {
    if (this.specs.has(spec.config.type)) {
      throw new Error(
        `Block type "${spec.config.type}" is already registered in schema`
      )
    }
    this.specs.set(spec.config.type, spec)
  }

  /** 按 type 替换已有 spec（用于 override 内置块） */
  replace(spec: BlockSpec): void {
    this.specs.set(spec.config.type, spec)
  }

  get(type: string): BlockSpec | undefined {
    return this.specs.get(type)
  }

  getBlockContentTypes(): Set<string> {
    return new Set(this.specs.keys())
  }

  getBlockContentExtensions(): Node[] {
    return [...this.specs.values()].map((spec) => spec.node)
  }

  getAllBlockTypes(): string[] {
    return [...this.specs.keys()]
  }

  clone(): BlockSchemaRegistry {
    return new BlockSchemaRegistry([...this.specs.values()])
  }

  /** 返回排除指定 type 后的新 registry */
  without(types: string[]): BlockSchemaRegistry {
    const next = this.clone()
    for (const type of types) {
      next.specs.delete(type)
    }
    return next
  }
}
