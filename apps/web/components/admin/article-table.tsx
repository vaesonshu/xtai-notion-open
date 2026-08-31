import Link from "next/link"
import { EllipsisIcon, PencilIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"

import type { Article } from "./article-types"

const columns = ["文章标题", "分类", "状态", "作者", "更新时间", "操作"]

// 标题列弹性伸展，其余列保持最小可读宽度。
const rowGrid =
  "grid grid-cols-[minmax(200px,1fr)_minmax(88px,0.7fr)_100px_minmax(96px,0.8fr)_minmax(140px,1fr)_80px] items-center"

const statusStyles: Record<Article["status"], string> = {
  已发布: "bg-[#e8f5ee] text-[#17724f]",
  草稿: "bg-[#f3f4f3] text-[#5f6d66]",
  待审核: "bg-[#fff4e5] text-[#b26a00]",
}

export function ArticleTable({ articles }: { articles: readonly Article[] }) {
  if (!articles.length)
    return (
      <div className="flex flex-1 items-center justify-center text-[12px] text-[#74857c]">
        未找到匹配的文章
      </div>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-white outline outline-[#e6ebe8]">
      <div
        className={`${rowGrid} shrink-0 border-b border-[#e6ebe8] bg-[#f7faf8] px-4 py-3 text-[12px] font-semibold text-[#52645b]`}
      >
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {articles.map((article) => (
          <div
            key={article.id}
            className={`${rowGrid} border-b border-[#edf0ee] px-4 py-3 last:border-0`}
          >
            <div className="min-w-0 pr-3">
              <p className="truncate text-[13px] font-semibold text-[#29463a]">
                {article.title}
              </p>
              <p className="mt-[3px] truncate text-[10px] text-[#98a59e]">
                {article.id}
              </p>
            </div>
            <div className="truncate text-[12px] text-[#52645b]">
              {article.category}
            </div>
            <div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusStyles[article.status]}`}
              >
                {article.status}
              </span>
            </div>
            <div className="truncate text-[12px] text-[#52645b]">
              {article.author}
            </div>
            <div className="truncate text-[12px] text-[#52645b]">
              {article.publishedAt}
            </div>
            <div className="flex items-center gap-[13px] text-[#5d7569]">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`编辑：${article.title}`}
                className="rounded-none p-0 text-[#5d7569] hover:bg-transparent hover:text-[#5d7569]"
              >
                <Link href={`/documents/${article.id}`}>
                  <PencilIcon className="size-[15px]" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`更多：${article.title}`}
                className="rounded-none p-0 text-[#5d7569] hover:bg-transparent hover:text-[#5d7569]"
                disabled
              >
                <EllipsisIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
