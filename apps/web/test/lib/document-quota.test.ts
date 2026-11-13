import { describe, expect, it } from "vitest"
import {
  documentQuotaPercent,
  documentQuotaTone,
  formatDocumentQuotaPercent,
  isDocumentQuotaFull,
} from "@/lib/document-quota"

describe("document quota helpers", () => {
  it("computes percent capped at 100", () => {
    expect(documentQuotaPercent({ used: 3, limit: 10 })).toBe(30)
    expect(documentQuotaPercent({ used: 12, limit: 10 })).toBe(100)
    expect(formatDocumentQuotaPercent({ used: 7, limit: 10 })).toBe("70%")
  })

  it("detects full quota", () => {
    expect(isDocumentQuotaFull({ used: 10, limit: 10 })).toBe(true)
    expect(isDocumentQuotaFull({ used: 9, limit: 10 })).toBe(false)
  })

  it("uses warn tone from 70% until full", () => {
    expect(documentQuotaTone({ used: 6, limit: 10 })).toBe("ok")
    expect(documentQuotaTone({ used: 7, limit: 10 })).toBe("warn")
    expect(documentQuotaTone({ used: 10, limit: 10 })).toBe("full")
  })
})
