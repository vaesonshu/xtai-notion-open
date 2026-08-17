"use client"

import { Handle, type NodeProps, Position } from "@xyflow/react"
import { memo } from "react"

type GraphNodeData = {
  title: string
}

/** 关系图谱节点：展示文档标题，选中时高亮边框。 */
export const DocumentGraphNode = memo(function DocumentGraphNode(
  props: NodeProps & { data: GraphNodeData }
) {
  const { data, selected } = props

  return (
    <div className="h-full w-full">
      <Handle
        type="target"
        position={Position.Left}
        className="invisible bg-transparent"
        style={{ left: "50%" }}
      />
      <div className="flex h-full w-full flex-col items-center justify-center px-2 pt-8">
        <div
          className={`mb-1 flex size-9 items-center justify-center rounded-full bg-[#E6F3EC] text-sm font-semibold text-[#24866B] ${selected ? "scale-110 border border-[#24866B] transition-transform" : ""}`}
        >
          {data.title.slice(0, 1) || "文"}
        </div>
        <p className="line-clamp-2 text-center text-[11px] text-[#78746C]">
          {data.title}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Left}
        className="invisible bg-transparent"
        style={{ left: "50%" }}
      />
    </div>
  )
})
