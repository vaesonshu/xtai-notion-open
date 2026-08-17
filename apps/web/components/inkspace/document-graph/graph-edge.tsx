"use client"

import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react"
import { memo } from "react"

/** 关系图谱边：选中实线、未选中虚线，表示 @mention 引用方向。 */
export const DocumentGraphEdge = memo(function DocumentGraphEdge(
  props: EdgeProps
) {
  const { id, selected, sourceX, sourceY, targetX, targetY } = props
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? "#24866B" : "#DFE1DC",
        strokeDasharray: selected ? "0" : "4 4",
        strokeWidth: selected ? 2 : 1,
      }}
    />
  )
})
