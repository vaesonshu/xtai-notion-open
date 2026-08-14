import "@testing-library/jest-dom/vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useEffect } from "react"
import { EditorProvider } from "../../react/providers/editor-provider"
import { useEditorInstance } from "../../react/hooks/use-editor-instance"
import { EditorSurface } from "../editor/editor-surface"
import { ImageUpload } from "./image-upload"

const image = new File(["image"], "image.png", { type: "image/png" })
const text = new File(["text"], "text.txt", { type: "text/plain" })
const dropzoneName = "选择或拖拽上传图片"

let latestEditor: Editor | null = null

function EditorProbe() {
  const editor = useEditorInstance()
  useEffect(() => {
    latestEditor = editor
  }, [editor])
  return null
}

function renderUpload(
  upload: (file: File) => Promise<{
    publicUrl: string
    contentType: string
  }>
) {
  return render(
    <EditorProvider imageUpload={upload}>
      <ImageUpload>
        <EditorSurface />
        <EditorProbe />
      </ImageUpload>
    </EditorProvider>
  )
}

function insertUploadNode() {
  act(() => {
    latestEditor?.chain().focus().insertImageUpload().run()
  })
}

async function findDropzone() {
  return screen.findByRole("button", { name: dropzoneName })
}

beforeAll(() => {
  Range.prototype.getClientRects ??= () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as DOMRectList
  Range.prototype.getBoundingClientRect ??= () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }) as DOMRect
})

afterEach(() => {
  latestEditor = null
})

describe("ImageUpload", () => {
  it("renders an inline dropzone and replaces it with the uploaded image", async () => {
    const upload = vi.fn().mockResolvedValue({
      publicUrl: "https://cdn.example/image.png",
      contentType: "image/png",
    })
    renderUpload(upload)
    insertUploadNode()

    const dropzone = await findDropzone()
    expect(dropzone).toHaveTextContent("点击上传或拖拽图片到这里")

    await act(async () => {
      fireEvent.change(dropzone.parentElement!.querySelector("input")!, {
        target: { files: [image] },
      })
    })

    await waitFor(() => expect(upload).toHaveBeenCalledWith(image, undefined))
    await waitFor(() => {
      expect(latestEditor?.getJSON().content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
            attrs: expect.objectContaining({
              src: "https://cdn.example/image.png",
              alt: "image.png",
            }),
          }),
        ])
      )
    })
  })

  it("uploads a dropped image from the inline dropzone", async () => {
    const upload = vi.fn().mockResolvedValue({
      publicUrl: "https://cdn.example/image.png",
      contentType: "image/png",
    })
    renderUpload(upload)
    insertUploadNode()

    await act(async () => {
      fireEvent.drop(await findDropzone(), {
        dataTransfer: { files: [image] },
      })
    })
    await waitFor(() => expect(upload).toHaveBeenCalledWith(image, undefined))
  })

  it("keeps failed uploads in the document so they can retry or be removed", async () => {
    const upload = vi.fn().mockRejectedValue(new Error("COS upload failed"))
    renderUpload(upload)
    insertUploadNode()

    const dropzone = await findDropzone()
    await act(async () => {
      fireEvent.change(dropzone.parentElement!.querySelector("input")!, {
        target: { files: [image] },
      })
    })
    expect(await screen.findByText("COS upload failed")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "重试上传 image.png" })
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "移除图片上传" }))
    })
    await waitFor(() => {
      expect(latestEditor?.getJSON().content).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "imageUpload" }),
        ])
      )
    })

    insertUploadNode()
    const invalidDropzone = await findDropzone()
    await act(async () => {
      fireEvent.change(invalidDropzone.parentElement!.querySelector("input")!, {
        target: { files: [text] },
      })
    })
    expect(
      await screen.findByText("仅支持 JPEG、PNG、GIF 或 WebP 图片")
    ).toBeInTheDocument()
  })
})
