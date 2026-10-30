import type { LibrarySource } from "@/lib/library-api"

/** 来源索引状态色，与常见知识库「就绪 / 处理中 / 失败」标签一致。 */
export function LibrarySourceStatusBadge({
  source,
}: {
  source: Pick<LibrarySource, "status" | "statusLabel">
}) {
  const tone =
    source.status === "ready"
      ? "bg-[#E8F5EF] text-[#1B6B4F]"
      : source.status === "failed"
        ? "bg-[#FEECEB] text-[#B42318]"
        : "bg-[#F3F2EE] text-[#78746C]"

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {source.statusLabel}
    </span>
  )
}
