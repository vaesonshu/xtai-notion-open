import { describe, expect, it } from "vitest"
import {
  decodeMultipartFilename,
  resolveUploadFilename,
} from "@api/knowledge/upload-filename"

describe("upload filename decoding", () => {
  it("decodes UTF-8 names that multer misread as latin1", () => {
    const mojibake = Buffer.from("新建文本文档.txt", "utf8").toString("latin1")
    expect(decodeMultipartFilename(mojibake)).toBe("新建文本文档.txt")
  })

  it("prefers the explicit filename form field", () => {
    expect(resolveUploadFilename("产品说明.pdf", "wrong.bin")).toBe(
      "产品说明.pdf"
    )
  })

  it("strips directory segments from the form field", () => {
    expect(resolveUploadFilename("../notes/readme.md", "x.md")).toBe(
      "readme.md"
    )
  })
})
