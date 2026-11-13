import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor } from "@tiptap/core"
import type { JSONContent } from "@tiptap/core"
import { blocksToPmDoc } from "@core/api/conversions/pm-doc"
import { createEmptyBlocks } from "@core/model/documents"
import { createEditorExtensions } from "@core/extensions"
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  insertUploadedImage,
  uploadImage,
  validateImageFile,
} from "@core/image-upload/index"

const editors: Editor[] = []

function findNodeByType(
  node: JSONContent,
  type: string
): JSONContent | undefined {
  if (node.type === type) {
    return node
  }
  for (const child of node.content ?? []) {
    const found = findNodeByType(child, type)
    if (found) {
      return found
    }
  }
  return undefined
}

function createTestEditor(): Editor {
  const extensions = createEditorExtensions()
  const editor = new Editor({
    extensions,
    content: blocksToPmDoc(
      createEmptyBlocks(),
      new Editor({ extensions }).schema
    ).toJSON() as JSONContent,
  })
  editor.commands.setTextSelection(3)
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("validateImageFile", () => {
  it.each(IMAGE_MIME_TYPES)("accepts %s", (type) => {
    expect(validateImageFile(new File(["image"], "image", { type }))).toEqual({
      valid: true,
    })
  })

  it("rejects unsupported MIME types", () => {
    expect(
      validateImageFile(new File(["text"], "file.txt", { type: "text/plain" }))
    ).toEqual({
      valid: false,
      code: "unsupported-type",
      message: "仅支持 JPEG、PNG、GIF 或 WebP 图片",
    })
  })

  it("rejects images larger than 10MB", () => {
    const file = new File([new Uint8Array(MAX_IMAGE_SIZE + 1)], "large.png", {
      type: "image/png",
    })

    expect(validateImageFile(file)).toMatchObject({
      valid: false,
      code: "file-too-large",
    })
  })
})

describe("uploadImage", () => {
  it("validates before calling the upload handler", async () => {
    const upload = vi.fn()
    const file = new File(["not an image"], "file.txt", { type: "text/plain" })

    await expect(uploadImage(file, { upload })).rejects.toThrow("仅支持")
    expect(upload).not.toHaveBeenCalled()
  })

  it("calls the upload handler once and returns its public URL", async () => {
    const result = {
      publicUrl: "https://cdn.example/image.png",
      contentType: "image/png",
    }
    const upload = vi.fn().mockResolvedValue(result)
    const file = new File(["image"], "image.png", { type: "image/png" })

    await expect(uploadImage(file, { upload })).resolves.toEqual(result)
    expect(upload).toHaveBeenCalledOnce()
  })
})

describe("insertUploadedImage", () => {
  it("inserts only the returned public URL as an Image node", () => {
    const editor = createTestEditor()

    expect(
      insertUploadedImage(editor, {
        publicUrl: "https://cdn.example/image.png",
        contentType: "image/png",
      })
    ).toBe(true)

    const image = findNodeByType(editor.getJSON(), "image")
    expect(image).toMatchObject({
      type: "image",
      attrs: expect.objectContaining({
        src: "https://cdn.example/image.png",
      }),
    })
  })

  it("preserves the original upload error and does not insert an image", async () => {
    const editor = createTestEditor()
    const error = new Error("COS upload failed")
    const upload = vi.fn().mockRejectedValue(error)
    const file = new File(["image"], "image.png", { type: "image/png" })

    await expect(uploadImage(file, { upload })).rejects.toBe(error)
    expect(findNodeByType(editor.getJSON(), "image")).toBeUndefined()
  })
})
