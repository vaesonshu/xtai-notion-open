import {
  ChartNoAxesColumnIncreasingIcon,
  Clock3Icon,
  FileTextIcon,
  SquarePenIcon,
} from "@workspace/icons"

const icons = [
  FileTextIcon,
  SquarePenIcon,
  ChartNoAxesColumnIncreasingIcon,
  Clock3Icon,
]

export function ArticleStatCard({
  index,
  label,
  value,
  note,
}: {
  index: number
  label: string
  value: string
  note: string
}) {
  const Icon = icons[index]!
  const featured = index === 0
  return (
    <section
      className={`flex h-[104px] flex-1 flex-col justify-between rounded-lg p-[14px_16px] ${featured ? "bg-[#0f766e] text-white" : "border border-[#e5e5e1] bg-white text-[#242522]"}`}
    >
      {/* The token values come directly from the selected Pencil metric nodes. */}
      <div className="flex items-center justify-between text-[13px] font-medium">
        <span className={featured ? "text-[#d9f0ea]" : "text-[#73766f]"}>
          {label}
        </span>
        <Icon
          className={featured ? "size-4 text-white" : "size-4 text-[#0f766e]"}
        />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[28px] leading-none">{value}</span>
        <span
          className={`text-[12px] font-medium ${featured ? "text-[#d9f0ea]" : index === 3 ? "text-[#a06d22]" : index === 2 ? "text-[#0f766e]" : "text-[#73766f]"}`}
        >
          {note}
        </span>
      </div>
    </section>
  )
}
