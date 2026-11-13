export type DocumentQuota = {
  used: number
  limit: number
}

export const DEFAULT_DOCUMENT_QUOTA_LIMIT = 10
/** 达到该占用百分比后，容量条与数字改为警示色（橘黄）。 */
export const DOCUMENT_QUOTA_WARN_PERCENT = 70

export type DocumentQuotaTone = "ok" | "warn" | "full"

export function documentQuotaPercent(quota: DocumentQuota): number {
  if (quota.limit <= 0) return 0
  return Math.min(100, Math.round((quota.used / quota.limit) * 100))
}

/** 侧栏右侧展示用，如「70%」。 */
export function formatDocumentQuotaPercent(quota: DocumentQuota): string {
  return `${documentQuotaPercent(quota)}%`
}

export function isDocumentQuotaFull(quota: DocumentQuota): boolean {
  return quota.used >= quota.limit
}

export function documentQuotaTone(quota: DocumentQuota): DocumentQuotaTone {
  if (isDocumentQuotaFull(quota)) return "full"
  if (documentQuotaPercent(quota) >= DOCUMENT_QUOTA_WARN_PERCENT) return "warn"
  return "ok"
}

/** 与侧栏「待审批」等状态色一致的 Tailwind 原子类。 */
export function documentQuotaAccentClass(tone: DocumentQuotaTone): {
  text: string
  bar: string
} {
  switch (tone) {
    case "full":
      return { text: "text-[#E64B3C]", bar: "bg-[#E64B3C]" }
    case "warn":
      return { text: "text-[#D97706]", bar: "bg-[#D97706]" }
    default:
      return { text: "text-[#24866B]", bar: "bg-[#24866B]" }
  }
}
