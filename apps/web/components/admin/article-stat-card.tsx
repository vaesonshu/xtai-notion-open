export function ArticleStatCard({
  label,
  value,
  trend,
  highlighted = false,
}: {
  label: string
  value: string
  trend: string
  highlighted?: boolean
}) {
  return (
    <section
      className={`flex h-[78px] flex-1 flex-col justify-between border p-3 ${
        highlighted
          ? "border-[#268568] bg-[#258268] text-white"
          : "border-[#e7ebe8] bg-white text-[#344039]"
      }`}
    >
      {/* The compact label/value pairing mirrors the Pencil dashboard cards. */}
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] ${highlighted ? "text-[#d8f0e4]" : "text-[#8b9690]"}`}
        >
          {label}
        </span>
        <span
          className={`text-[9px] ${highlighted ? "text-[#d8f0e4]" : "text-[#5ca987]"}`}
        >
          {trend}
        </span>
      </div>
      <strong className="text-[20px] leading-none font-semibold tracking-[-0.04em]">
        {value}
      </strong>
    </section>
  )
}
