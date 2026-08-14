import { SearchIcon } from "@workspace/icons"

export type ArticleFiltersValue = {
  query: string
  category: string
  status: string
}

export function ArticleFilters({
  value,
  onChange,
}: {
  value: ArticleFiltersValue
  onChange: (nextValue: ArticleFiltersValue) => void
}) {
  return (
    <div className="flex flex-col gap-2 border-y border-[#edf0ee] py-3 sm:flex-row">
      <label className="flex h-7 min-w-0 flex-1 items-center gap-1.5 border border-[#e3e8e5] bg-white px-2 text-[#8d9892]">
        <SearchIcon className="size-3" />
        <span className="sr-only">搜索文章</span>
        <input
          aria-label="搜索文章"
          value={value.query}
          onChange={(event) =>
            onChange({ ...value, query: event.target.value })
          }
          placeholder="搜索文章标题、作者或分类"
          className="min-w-0 flex-1 bg-transparent text-[10px] text-[#3c4941] outline-none placeholder:text-[#a5ada8]"
        />
      </label>
      <label className="sr-only" htmlFor="article-category">
        文章分类
      </label>
      <select
        id="article-category"
        aria-label="文章分类"
        value={value.category}
        onChange={(event) =>
          onChange({ ...value, category: event.target.value })
        }
        className="h-7 border border-[#e3e8e5] bg-white px-2 text-[10px] text-[#657169] outline-none"
      >
        <option>全部</option>
        <option>产品动态</option>
        <option>使用指南</option>
        <option>设计规范</option>
      </select>
      <label className="sr-only" htmlFor="article-status">
        发布状态
      </label>
      <select
        id="article-status"
        aria-label="发布状态"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value })}
        className="h-7 border border-[#e3e8e5] bg-white px-2 text-[10px] text-[#657169] outline-none"
      >
        <option>全部</option>
        <option>已发布</option>
        <option>草稿</option>
        <option>已下线</option>
      </select>
    </div>
  )
}
