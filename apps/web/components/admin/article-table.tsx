import { EllipsisIcon, PencilIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"

import type { Article } from "./article-management-page"

const columns = ["文章标题", "分类", "状态", "作者", "更新时间", "操作"]

export function ArticleTable({ articles }: { articles: readonly Article[] }) {
  if (!articles.length)
    return (
      <div className="flex flex-1 items-center justify-center text-[12px] text-[#74857c]">
        未找到匹配的文章
      </div>
    )
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] bg-white outline outline-[#e6ebe8]">
      <div className="flex h-[42px] shrink-0 items-center border-b border-[#e6ebe8] bg-[#f7faf8] px-4 text-[12px] font-semibold text-[#52645b]">
        {columns.map((column, index) => (
          <div
            key={column}
            className={
              [
                "w-[430px]",
                "w-[110px]",
                "w-[115px]",
                "w-[130px]",
                "w-[160px]",
                "w-[90px]",
              ][index]
            }
          >
            {column}
          </div>
        ))}
      </div>
      {articles.map((article) => (
        <div
          key={article.id}
          className="flex h-[58px] shrink-0 items-center border-b border-[#edf0ee] px-4 last:border-0"
        >
          <div className="w-[430px]">
            <p className="text-[13px] font-semibold text-[#29463a]">
              {article.title}
            </p>
            <p className="mt-[3px] text-[10px] text-[#98a59e]">{article.id}</p>
          </div>
          <div className="w-[110px] text-[12px] text-[#52645b]">
            {article.category}
          </div>
          <div className="w-[115px]">
            <span className="rounded-full bg-[#e8f5ee] px-2 py-1 text-[11px] font-semibold text-[#17724f]">
              已发布
            </span>
          </div>
          <div className="w-[130px] text-[12px] text-[#52645b]">
            {article.author}
          </div>
          <div className="w-[160px] text-[12px] text-[#52645b]">
            {article.publishedAt}
          </div>
          <div className="flex w-[90px] items-center gap-[13px] text-[#5d7569]">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`编辑：${article.title}`}
              className="rounded-none p-0 text-[#5d7569] hover:bg-transparent hover:text-[#5d7569]"
            >
              <PencilIcon className="size-[15px]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`更多：${article.title}`}
              className="rounded-none p-0 text-[#5d7569] hover:bg-transparent hover:text-[#5d7569]"
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
