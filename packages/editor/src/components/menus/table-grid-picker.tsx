"use client"

import { useState } from "react"

export type TableGridPickerProps = {
  maxRows?: number
  maxCols?: number
  defaultRows?: number
  defaultCols?: number
  onSelect: (rows: number, cols: number) => void
}

/** 表格尺寸选择网格：鼠标移动高亮预览，点击提交行×列尺寸（类似语雀）。 */
export function TableGridPicker({
  maxRows = 10,
  maxCols = 10,
  defaultRows = 4,
  defaultCols = 4,
  onSelect,
}: TableGridPickerProps) {
  // 记录当前悬停的 0-based 行列，未悬停时回退到默认高亮尺寸。
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)

  const previewRows = hover ? hover.row + 1 : defaultRows
  const previewCols = hover ? hover.col + 1 : defaultCols
  // Render only the current selection area, expanding by one row/column at a time.
  const visibleRows = Math.min(
    maxRows,
    Math.max(defaultRows, previewRows + (hover ? 1 : 0))
  )
  const visibleCols = Math.min(
    maxCols,
    Math.max(defaultCols, previewCols + (hover ? 1 : 0))
  )

  return (
    <div
      // Extra breathing room keeps pointer movement inside the picker surface.
      className="select-none p-4"
      role="grid"
      aria-label="选择表格尺寸"
      onMouseLeave={() => setHover(null)}
    >
      <div className="mb-1 text-center text-xs text-[#5C574E]">
        {previewRows} × {previewCols}
      </div>
      <div className="grid gap-1">
        {Array.from({ length: visibleRows }).map((_, row) => (
          <div key={row} className="flex gap-1">
            {Array.from({ length: visibleCols }).map((_, col) => {
              // Keep the initial 4x4 canvas neutral; fill cells only after a hover.
              const isActive =
                hover !== null && row < previewRows && col < previewCols
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`table-grid-cell-${row}-${col}`}
                  aria-label={`${row + 1} 行 ${col + 1} 列`}
                  className={`size-5 rounded-sm border transition-colors ${
                    isActive
                      ? "border-[#24866B]"
                      : "border-[#D8D2C4]"
                  }`}
                  style={{
                    backgroundColor: isActive ? "#BFE6D0" : "#FFFFFF",
                  }}
                  onMouseEnter={() => setHover({ row, col })}
                  onPointerEnter={() => setHover({ row, col })}
                  onClick={() => onSelect(row + 1, col + 1)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
