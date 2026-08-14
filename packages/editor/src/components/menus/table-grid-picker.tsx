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

  return (
    <div
      className="select-none p-2"
      role="grid"
      aria-label="选择表格尺寸"
      onMouseLeave={() => setHover(null)}
    >
      <div className="mb-1 text-center text-xs text-[#5C574E]">
        {previewRows} × {previewCols}
      </div>
      <div className="grid gap-1">
        {Array.from({ length: maxRows }).map((_, row) => (
          <div key={row} className="flex gap-1">
            {Array.from({ length: maxCols }).map((_, col) => {
              const isActive = row < previewRows && col < previewCols
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`table-grid-cell-${row}-${col}`}
                  aria-label={`${row + 1} 行 ${col + 1} 列`}
                  className={`size-5 rounded-sm border transition-colors ${
                    isActive
                      ? "border-[#24866B] bg-[#E6F3EC]"
                      : "border-[#D8D2C4] bg-white"
                  }`}
                  onMouseEnter={() => setHover({ row, col })}
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
