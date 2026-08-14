import { SearchIcon } from "@workspace/icons"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export type ArticleFiltersValue = {
  query: string
  category: string
  status: string
}

const statusItems = [
  { label: "全部状态", value: "全部状态" },
  { label: "已发布", value: "已发布" },
  { label: "草稿", value: "草稿" },
]

const categoryItems = [
  { label: "全部分类", value: "全部分类" },
  { label: "内容策略", value: "内容策略" },
  { label: "设计趋势", value: "设计趋势" },
  { label: "用户研究", value: "用户研究" },
  { label: "团队管理", value: "团队管理" },
]

export function ArticleFilters({
  value,
  onChange,
}: {
  value: ArticleFiltersValue
  onChange: (next: ArticleFiltersValue) => void
}) {
  return (
    <div className="flex h-11 w-full items-center gap-3">
      <label className="flex h-11 w-[286px] items-center gap-2 rounded-[7px] bg-white px-[11px] outline outline-[#e1e8e4]">
        <SearchIcon className="size-[15px] text-[#7e9087]" />
        {/* <span className="sr-only">搜索标题、作者或编号</span> */}
        <Input
          aria-label=""
          value={value.query}
          onChange={(event) =>
            onChange({ ...value, query: event.target.value })
          }
          placeholder="搜索标题、作者或编号"
          className="h-auto w-full border-0 bg-transparent p-0 text-[12px] text-[#53665c] shadow-none outline-none placeholder:text-[#9aa7a1] focus-visible:border-0 focus-visible:ring-0"
        />
      </label>
      <Select
        items={statusItems}
        value={value.status}
        onValueChange={(status) =>
          onChange({ ...value, status: status ?? value.status })
        }
      >
        <SelectTrigger
          aria-label="全部状态"
          className="h-11 w-fit min-w-[118px] rounded-[7px] border border-[#e1e8e4] bg-white px-[11px] text-[12px] text-[#53665c] shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>发布状态</SelectLabel>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        items={categoryItems}
        value={value.category}
        onValueChange={(category) =>
          onChange({ ...value, category: category ?? value.category })
        }
      >
        <SelectTrigger
          aria-label="全部分类"
          className="h-11 w-fit min-w-[118px] rounded-[7px] border border-[#e1e8e4] bg-white px-[11px] text-[12px] text-[#53665c] shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>文章分类</SelectLabel>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {/* Items arrays keep Select behavior consistent with the repository's demo pattern. */}
      <span className="ml-auto text-[12px] text-[#74857c]">共 128 篇文章</span>
    </div>
  )
}
