import { BadRequestException, PayloadTooLargeException } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { MAX_KNOWLEDGE_FILE_BYTES } from "@api/knowledge/knowledge.types"
import { knowledgeFileKind, parseKnowledgeFile } from "@api/knowledge/parsers"

describe("knowledgeFileKind", () => {
  it("maps Report.MD to md regardless of case", () => {
    expect(knowledgeFileKind("Report.MD")).toBe("md")
  })

  it("rejects unsupported extensions", () => {
    expect(() => knowledgeFileKind("notes.exe")).toThrow(BadRequestException)
    expect(() => knowledgeFileKind("notes.exe")).toThrow(
      "只支持 txt、md、pdf、docx 文件"
    )
  })
})

describe("parseKnowledgeFile", () => {
  it("rejects files larger than 20MB", async () => {
    const error = await parseKnowledgeFile({
      filename: "big.txt",
      bytes: Buffer.alloc(MAX_KNOWLEDGE_FILE_BYTES + 1),
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(PayloadTooLargeException)
    expect((error as Error).message).toBe("文件不能超过 20MB")
  })

  it("returns UTF-8 txt as-is", async () => {
    const text = "标题\n正文"
    const result = await parseKnowledgeFile({
      filename: "note.txt",
      bytes: Buffer.from(text, "utf8"),
    })
    expect(result).toEqual({ text })
  })

  it("rejects invalid UTF-8 bytes", async () => {
    const error = await parseKnowledgeFile({
      filename: "note.txt",
      // 0xff 不是合法 UTF-8 起始字节，用来覆盖 fatal 解码失败路径。
      bytes: Buffer.from([0xff]),
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(BadRequestException)
    expect((error as Error).message).toBe("无法按 UTF-8 读取文件")
  })

  it("uses injected docxText as the parsed text", async () => {
    const result = await parseKnowledgeFile(
      { filename: "合同.docx", bytes: Buffer.from("not-docx") },
      { docxText: async () => "合同正文" }
    )
    expect(result).toEqual({ text: "合同正文" })
  })

  it("keeps only PDF pages that have text", async () => {
    const result = await parseKnowledgeFile(
      { filename: "scan.pdf", bytes: Buffer.from("not-pdf") },
      {
        pdfPages: async () => [
          { page: 1, text: "" },
          { page: 2, text: "正文" },
        ],
      }
    )
    expect(result.pages).toEqual([{ page: 2, text: "正文" }])
    expect(result.text).toContain("正文")
  })

  it("rejects PDFs whose pages have no text", async () => {
    const error = await parseKnowledgeFile(
      { filename: "scan.pdf", bytes: Buffer.from("not-pdf") },
      {
        pdfPages: async () => [
          { page: 1, text: "" },
          { page: 2, text: "" },
        ],
      }
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(BadRequestException)
    expect((error as Error).message).toBe("无法解析 PDF 文本")
  })
})
